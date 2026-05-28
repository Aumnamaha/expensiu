import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Transaction } from '../types';
import { getTransactionsByRange, getUserProfile } from '../db/database';
import { formatAmount } from '../utils/mathUtils';

export default function SummaryScreen() {
  const params = useLocalSearchParams<{ period?: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>(
    (params.period as any) ?? 'weekly'
  );
  const [creditTransactions, setCreditTransactions] = useState<Transaction[]>([]);
  const [debitTransactions, setDebitTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

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
          d.setDate(d.getDate() - 1);
          startDateStr = d.toISOString().split('T')[0];
          break;
        }
        case 'weekly': {
          const d = new Date(nowDate);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Start of week (Monday)
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

      // Query database for date range (database accepts start and end Dates)
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

      // Sort by date desc
      credits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      debits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setCreditTransactions(credits);
      setDebitTransactions(debits);
    } catch (error) {
      console.error('Failed to load summary transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  const categoryEmojis: Record<string, string> = {
    Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
    Health: '💊', Utilities: '💡', Transfer: '💸', Salary: '💰', Refund: '🔄', Other: '📦',
  };

  const currencyCode = profile?.currency_code || 'USD';
  const locale = profile?.locale || 'en';

  const totalCreditMinor = creditTransactions.reduce((acc, tx) => acc + tx.amount_minor, 0);
  const totalDebitMinor = debitTransactions.reduce((acc, tx) => acc + tx.amount_minor, 0);
  const netBalanceMinor = totalCreditMinor - totalDebitMinor;
  const transactionCount = creditTransactions.length + debitTransactions.length;

  if (loading || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const renderTransactionItem = ({ item, isCredit }: { item: Transaction; isCredit: boolean }) => (
    <View style={styles.txRow}>
      <View style={styles.txLeft}>
        <Text style={styles.categoryEmoji}>
          {categoryEmojis[item.category] || '📦'}
        </Text>
        <View style={styles.txMeta}>
          <Text style={styles.txMerchant} numberOfLines={1}>
            {item.merchant || 'Unknown'}
          </Text>
          <Text style={styles.txDate}>
            {new Date(item.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isCredit ? '#00C896' : '#FF4C4C' }]}>
        {isCredit ? '+' : '-'}{formatAmount(item.amount_minor, currencyCode, locale)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>

        {/* Period Selector Tabs */}
        <View style={styles.tabContainer}>
          {(['daily', 'weekly', 'monthly'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={[
                styles.tabItem,
                selectedPeriod === period && styles.tabItemActive,
              ]}
            >
              <Text style={[styles.tabText, selectedPeriod === period && styles.tabTextActive]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.badge}>
          <Ionicons name="shield-outline" size={12} color="#666" style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>Local</Text>
        </View>
      </View>

      {/* SPLIT COLUMNS SCREEN */}
      <View style={styles.splitContent}>
        {/* LEFT COLUMN: MONEY IN */}
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Ionicons name="trending-up-outline" size={16} color="#00C896" style={{ marginRight: 6 }} />
            <Text style={[styles.columnTitle, { color: '#00C896' }]}>Money In</Text>
          </View>

          {creditTransactions.length === 0 ? (
            <View style={styles.emptyColumn}>
              <Ionicons name="lock-closed-outline" size={20} color="#222" />
              <Text style={styles.emptyText}>Zero credits</Text>
            </View>
          ) : (
            <FlatList
              data={creditTransactions}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => renderTransactionItem({ item, isCredit: true })}
            />
          )}

          <View style={styles.columnFooter}>
            <Text style={styles.footerLabel}>Total In</Text>
            <Text style={[styles.footerVal, { color: '#00C896' }]}>
              {formatAmount(totalCreditMinor, currencyCode, locale)}
            </Text>
          </View>
        </View>

        {/* CENTER SPLIT DIVIDER */}
        <View style={styles.verticalDivider} />

        {/* RIGHT COLUMN: MONEY OUT */}
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Ionicons name="trending-down-outline" size={16} color="#FF4C4C" style={{ marginRight: 6 }} />
            <Text style={[styles.columnTitle, { color: '#FF4C4C' }]}>Money Out</Text>
          </View>

          {debitTransactions.length === 0 ? (
            <View style={styles.emptyColumn}>
              <Ionicons name="lock-closed-outline" size={20} color="#222" />
              <Text style={styles.emptyText}>Zero expenses</Text>
            </View>
          ) : (
            <FlatList
              data={debitTransactions}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => renderTransactionItem({ item, isCredit: false })}
            />
          )}

          <View style={styles.columnFooter}>
            <Text style={styles.footerLabel}>Total Out</Text>
            <Text style={[styles.footerVal, { color: '#FF4C4C' }]}>
              {formatAmount(totalDebitMinor, currencyCode, locale)}
            </Text>
          </View>
        </View>
      </View>

      {/* FIXED BOTTOM SUMMARY FOOTER */}
      <View style={styles.summaryFooter}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryLabel}>Net Balance</Text>
          <Text style={[styles.summaryAmount, { color: netBalanceMinor >= 0 ? '#00C896' : '#FF4C4C' }]}>
            {formatAmount(Math.abs(netBalanceMinor), currencyCode, locale)}
          </Text>
        </View>
        <Text style={styles.summaryCount}>
          {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

const ActivityIndicator = ({ color }: { color: string }) => (
  <View style={{ transform: [{ scale: 1.5 }] }}>
    <Text style={{ color, fontSize: 16 }}>Loading...</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    paddingTop: 64,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#080808',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#222222',
  },
  tabItem: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  tabItemActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#080808',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222222',
  },
  badgeText: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  splitContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 88, // space for footer
  },
  column: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 12,
    justifyContent: 'space-between',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    paddingBottom: 10,
    marginBottom: 10,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 4,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  txMeta: {
    flex: 1,
  },
  txMerchant: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  txDate: {
    color: '#555555',
    fontSize: 10,
    marginTop: 1,
  },
  txAmount: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  verticalDivider: {
    width: 12,
  },
  columnFooter: {
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingTop: 10,
    marginTop: 10,
  },
  footerLabel: {
    fontSize: 9,
    color: '#555555',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  footerVal: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  summaryFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flexDirection: 'column',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#555555',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  summaryCount: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '600',
  },
});
