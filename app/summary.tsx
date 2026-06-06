import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Transaction } from '../types';
import { getTransactionsByRange, getUserProfile, getAISummary, saveAISummary } from '../db/database';
import { formatAmount } from '../utils/mathUtils';
import { useTheme } from '../hooks/useTheme';
import { isModelDownloaded, isModelLoaded, initAI, generateDetailedSummary } from '../services/aiEngine';
import { PremiumAlert } from '../components/PremiumAlert';

const WINDOW_WIDTH = Dimensions.get('window').width;

export default function SummaryScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ period?: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>(
    (params.period as any) ?? 'daily'
  );
  const [creditTransactions, setCreditTransactions] = useState<Transaction[]>([]);
  const [debitTransactions, setDebitTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // AI Summary States
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryTime, setSummaryTime] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [modelDownloaded, setModelDownloaded] = useState(false);
  const [initializingModel, setInitializingModel] = useState(false);

  // Custom Alert states for PremiumAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<any[]>([]);

  function showCustomAlert(title: string, message: string, buttons?: any[]) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(buttons || []);
    setAlertVisible(true);
  }

  useEffect(() => {
    loadProfileAndTransactions();
  }, [selectedPeriod]);

  async function loadProfileAndTransactions() {
    setLoading(true);
    try {
      const user = await getUserProfile();
      setProfile(user || { currency_code: 'USD', locale: 'en' });

      const nowDate = new Date();
      let startDateStr: string;

      switch (selectedPeriod) {
        case 'daily': {
          const d = new Date(nowDate);
          d.setHours(0, 0, 0, 0);
          startDateStr = d.toISOString().split('T')[0];
          break;
        }
        case 'weekly': {
          const d = new Date(nowDate);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          d.setDate(diff);
          startDateStr = d.toISOString().split('T')[0];
          break;
        }
        case 'monthly': {
          const d = new Date(nowDate);
          d.setDate(1);
          startDateStr = d.toISOString().split('T')[0];
          break;
        }
      }

      const allTx = await getTransactionsByRange(new Date(startDateStr), nowDate);

      const credits: Transaction[] = [];
      const debits: Transaction[] = [];

      for (const tx of allTx) {
        if (tx.type === 'credit') {
          credits.push(tx);
        } else {
          debits.push(tx);
        }
      }

      credits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      debits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setCreditTransactions(credits);
      setDebitTransactions(debits);

      const downloaded = await isModelDownloaded();
      setModelDownloaded(downloaded);

      if (selectedPeriod === 'weekly' || selectedPeriod === 'monthly') {
        const cached = await getAISummary(selectedPeriod);
        const currentKey = getPeriodKey(selectedPeriod);
        if (cached) {
          if (cached.period_key === currentKey) {
            setAiSummary(cached.content);
            setSummaryTime(cached.created_at);
          } else {
            setAiSummary(null);
            setSummaryTime(null);
          }
        } else {
          setAiSummary(null);
          setSummaryTime(null);
        }
      } else {
        setAiSummary(null);
        setSummaryTime(null);
      }
    } catch (error) {
      console.error('Failed to load summary transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function getPeriodKey(period: 'weekly' | 'monthly'): string {
    const d = new Date();
    if (period === 'weekly') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return monday.toISOString().split('T')[0];
    } else {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  async function triggerAISummary() {
    if (selectedPeriod === 'daily') return;

    const downloaded = await isModelDownloaded();
    if (!downloaded) {
      showCustomAlert(
        'AI Model Required',
        'You need to download the local AI model (Qwen 0.5B, ~300MB) from Settings first to enable offline summaries.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => {
              router.push('/onboarding/model-download');
            }
          }
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setGenerating(true);

    try {
      if (!isModelLoaded()) {
        setInitializingModel(true);
        try {
          await initAI();
        } catch (initErr: any) {
          throw new Error(`Failed to initialize local AI engine: ${initErr.message}`);
        } finally {
          setInitializingModel(false);
        }
      }

      const allTxForAI = [...creditTransactions, ...debitTransactions];
      const summaryText = await generateDetailedSummary(selectedPeriod, profile, allTxForAI);
      
      const timestamp = new Date().toLocaleString(profile?.locale || 'en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const currentKey = getPeriodKey(selectedPeriod);

      await saveAISummary({
        period: selectedPeriod,
        content: summaryText,
        period_key: currentKey,
        created_at: timestamp
      });

      setAiSummary(summaryText);
      setSummaryTime(timestamp);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      console.error('Failed to generate AI summary:', e);
      showCustomAlert(
        'AI Summary Failed',
        e.message || 'An error occurred while running the local AI model. Please try again.'
      );
    } finally {
      setGenerating(false);
    }
  }

  const handlePeriodChange = (period: 'daily' | 'weekly' | 'monthly') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedPeriod(period);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };

  const categoryEmojis: Record<string, string> = {
    Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
    Health: '💊', Utilities: '💡', Transfer: '💸', Salary: '💰', Refund: '🔄', Other: '📦',
  };

  const currencyCode = profile?.currency_code || 'USD';
  const locale = profile?.locale || 'en';

  const totalCreditMinor = creditTransactions.reduce((acc, tx) => acc + tx.amount_minor, 0);
  const totalDebitMinor = debitTransactions.reduce((acc, tx) => acc + tx.amount_minor, 0);
  const netBalanceMinor = totalCreditMinor - totalDebitMinor;

  if (loading || !profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.secondary, marginTop: 16, fontSize: 14 }}>Loading summary...</Text>
      </View>
    );
  }

  const renderTransactionItem = ({ item, isCredit }: { item: Transaction; isCredit: boolean }) => {
    return (
      <View style={[styles.txRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Left type bar */}
        <View style={[styles.txIndicatorBar, { backgroundColor: isCredit ? colors.success : colors.danger }]} />
        
        <View style={styles.txLeft}>
          <Text style={styles.categoryEmoji}>{categoryEmojis[item.category] || '📦'}</Text>
          <View style={styles.txMeta}>
            <Text style={[styles.txMerchant, { color: colors.foreground }]} numberOfLines={1}>
              {item.merchant || 'Unknown'}
            </Text>
            <Text style={styles.txDate}>
              {new Date(item.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>
        <Text style={[styles.txAmount, { color: isCredit ? colors.success : colors.foreground }]}>
          {(isCredit ? '+' : '-') + formatAmount(item.amount_minor, currencyCode, locale)}
        </Text>
      </View>
    );
  };



  const renderAISummarySection = () => {
    if (selectedPeriod === 'daily') return null;

    return (
      <View style={[styles.aiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.aiCardHeader}>
          <View style={styles.aiTitleRow}>
            <Ionicons name="sparkles" size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.aiCardTitle, { color: colors.foreground }]}>Local AI Financial Summary</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.background, borderColor: colors.border, paddingVertical: 4, paddingHorizontal: 8 }]}>
            <Ionicons name="shield-checkmark" size={10} color={colors.success} style={{ marginRight: 2 }} />
            <Text style={[styles.badgeText, { color: colors.secondary, fontSize: 8 }]}>Qwen 0.5B</Text>
          </View>
        </View>

        {generating ? (
          <View style={styles.aiGeneratingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.aiGeneratingText, { color: colors.secondary }]}>
              {initializingModel ? 'Loading model into memory...' : 'Analyzing spending patterns...'}
            </Text>
          </View>
        ) : aiSummary ? (
          <View style={styles.aiContentContainer}>
            <Text style={[styles.aiText, { color: colors.foreground }]}>{aiSummary}</Text>
            <View style={styles.aiFooterRow}>
              <Text style={[styles.aiTimestamp, { color: colors.secondary }]}>
                Generated {summaryTime}
              </Text>
              <TouchableOpacity onPress={triggerAISummary} style={styles.aiRegenBtn} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.aiRegenText, { color: colors.primary }]}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.aiEmptyContainer}>
            <Text style={[styles.aiEmptyText, { color: colors.secondary }]}>
              No summary generated for this {selectedPeriod}. Let our local AI model analyze your transactions!
            </Text>
            <TouchableOpacity
              onPress={triggerAISummary}
              style={[styles.aiGenerateBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.aiGenerateBtnText}>Generate AI Summary</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderListHeader = () => {
    if (selectedPeriod === 'daily') return null;
    return renderAISummarySection();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* Period Selector Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['daily', 'weekly', 'monthly'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => handlePeriodChange(period)}
              style={[
                styles.tabItem,
                selectedPeriod === period && [styles.tabItemActive, { backgroundColor: colors.primary }],
              ]}
            >
              <Text style={[
                styles.tabText,
                { color: colors.secondary },
                selectedPeriod === period && styles.tabTextActive
              ]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark-outline" size={12} color={colors.success} style={{ marginRight: 4 }} />
          <Text style={[styles.badgeText, { color: colors.secondary }]}>Local</Text>
        </View>
      </View>

      {/* HEADER METRICS */}
      <View style={styles.metricsSection}>
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.metricRow}>
            <View style={[styles.metricIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
              <Ionicons name="trending-up" size={18} color={colors.success} />
            </View>
            <View style={styles.metricInfo}>
              <Text style={styles.metricLabel}>Total In</Text>
              <Text style={[styles.metricValue, { color: colors.success }]}>
                {formatAmount(totalCreditMinor, currencyCode, locale)}
              </Text>
            </View>
          </View>
          
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          
          <View style={styles.metricRow}>
            <View style={[styles.metricIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
              <Ionicons name="trending-down" size={18} color={colors.danger} />
            </View>
            <View style={styles.metricInfo}>
              <Text style={styles.metricLabel}>Total Out</Text>
              <Text style={[styles.metricValue, { color: colors.danger }]}>
                {formatAmount(totalDebitMinor, currencyCode, locale)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* TRANSACTIONS LIST */}
      <View style={styles.transactionSection}>
        <FlatList
          data={[...creditTransactions, ...debitTransactions].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
          })}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <View style={styles.emojiArt}>
                <Text style={{ fontSize: 48 }}>🔢</Text>
                <Text style={{ fontSize: 24, marginTop: -10 }}>📊</Text>
              </View>
              <Text style={[styles.emptyText, { color: colors.secondary }]}>No transactions for this period.</Text>
            </View>
          )}
          renderItem={({ item }) => renderTransactionItem({ item, isCredit: item.type === 'credit' })}
        />
      </View>

      {/* FOOTER SUMMARY */}
      <View style={[styles.summaryFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryLabel}>Net Balance</Text>
          <Text style={[
            styles.summaryAmount,
            { color: netBalanceMinor >= 0 ? colors.success : colors.danger }
          ]}>
            {formatAmount(Math.abs(netBalanceMinor), currencyCode, locale)}
          </Text>
        </View>
        <Text style={[styles.summaryCount, { color: colors.secondary }]}>
          {creditTransactions.length + debitTransactions.length} transaction{creditTransactions.length + debitTransactions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <PremiumAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  tabContainer: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    alignSelf: 'center',
    marginHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  metricsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  metricCard: {
    flexDirection: 'row',
    borderRadius: 16, // Consistent border radius of 16px for cards
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  metricInfo: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 12,
  },
  transactionSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiArt: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 110,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16, // Consistent border radius of 16px for cards
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.01,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  txIndicatorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    paddingLeft: 4,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  txMeta: {
    flex: 1,
  },
  txMerchant: {
    fontSize: 13,
    fontWeight: '700',
  },
  txDate: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  summaryFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 84,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 30 : 8,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  summaryLeft: {
    flexDirection: 'column',
  },
  summaryLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  summaryCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  aiCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  aiGeneratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aiGeneratingText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
  },
  aiContentContainer: {
    marginTop: 4,
  },
  aiText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  aiFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  aiTimestamp: {
    fontSize: 10,
    fontWeight: '600',
  },
  aiRegenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  aiRegenText: {
    fontSize: 11,
    fontWeight: '700',
  },
  aiEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  aiEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  aiGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aiGenerateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
