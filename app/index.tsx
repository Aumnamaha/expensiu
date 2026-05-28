import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Alert, Share, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Transaction } from '../types';
import { getDB, getUserProfile, getAllTransactions, deleteTransaction } from '../db/database';
import { setupSecurity } from '../services/securityService';
import { formatAmount } from '../utils/mathUtils';

const WINDOW_WIDTH = Dimensions.get('window').width;

export default function HomeScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [todayCreditMinor, setTodayCreditMinor] = useState(0);
  const [todayDebitMinor, setTodayDebitMinor] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload data whenever screen is focused (returns from settings or add screens)
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      await setupSecurity();
      const loaded = await getUserProfile();

      if (!loaded) {
        router.replace('/onboarding/welcome');
        return;
      }

      setProfile(loaded);
      await getTodayTotals(loaded.locale || 'en-US');
      await loadRecentTransactions();
      setLoading(false);
    } catch (error) {
      console.error('Failed to load profile/transactions:', error);
      setLoading(false);
    }
  }

  async function getTodayTotals(locale: string) {
    const db = await getDB();
    const today = new Date().toISOString().split('T')[0];

    // Query using LIKE to match dates starting with YYYY-MM-DD
    const allTx = (await db.getAllAsync<Transaction>(
      'SELECT * FROM transactions WHERE date LIKE ?',
      [`${today}%`]
    )) || [];

    let creditMinor = 0;
    let debitMinor = 0;

    for (const tx of allTx) {
      if (tx.type === 'credit') {
        creditMinor += tx.amount_minor;
      } else {
        debitMinor += tx.amount_minor;
      }
    }

    setTodayCreditMinor(creditMinor);
    setTodayDebitMinor(debitMinor);
  }

  async function loadRecentTransactions() {
    const allTx = await getAllTransactions(20, 0);
    setRecentTransactions(allTx || []);
  }

  async function handleDelete(item: Transaction) {
    Alert.alert(
      'Delete Expense',
      `Delete "${item.merchant || 'Transaction'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(item.id);
              await loadData();
            } catch (e) {
              console.error('Delete failed:', e);
            }
          },
        },
      ]
    );
  }

  if (loading || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const dailyBudget = Math.round(profile.monthly_budget_minor / 30);
  const budgetUsedPct = dailyBudget > 0 ? Math.min(100, (todayDebitMinor / dailyBudget) * 100) : 0;

  const categoryEmojis: Record<string, string> = {
    Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
    Health: '💊', Utilities: '💡', Transfer: '💸', Salary: '💰', Refund: '🔄', Other: '📦',
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.topSection}>
        <View style={styles.headerInfo}>
          <Text style={styles.greeting}>Hey, {profile.name} 👋</Text>
          <Text style={styles.greetingDate}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <View style={styles.offlineBadge}>
          <Ionicons name="lock-closed-outline" size={11} color="#666" style={{ marginRight: 4 }} />
          <Text style={styles.offlineText}>Offline Vault</Text>
        </View>
      </View>

      {/* TODAY'S BALANCE METRICS */}
      <View style={styles.todayCard}>
        <Text style={styles.cardLabel}>TODAY'S SUMMARY</Text>
        <View style={styles.todayTotals}>
          <View style={styles.totalBlock}>
            <View style={styles.totalRow}>
              <View style={[styles.arrowCircle, { backgroundColor: 'rgba(0, 200, 150, 0.1)' }]}>
                <Ionicons name="arrow-down" size={16} color="#00C896" />
              </View>
              <Text style={styles.totalLabel}>Money In</Text>
            </View>
            <Text style={[styles.totalAmount, { color: '#00C896' }]}>
              {formatAmount(todayCreditMinor, profile.currency_code, profile.locale)}
            </Text>
          </View>

          <View style={styles.totalBlockDivider} />

          <View style={styles.totalBlock}>
            <View style={styles.totalRow}>
              <View style={[styles.arrowCircle, { backgroundColor: 'rgba(255, 76, 76, 0.1)' }]}>
                <Ionicons name="arrow-up" size={16} color="#FF4C4C" />
              </View>
              <Text style={styles.totalLabel}>Money Out</Text>
            </View>
            <Text style={[styles.totalAmount, { color: '#FF4C4C' }]}>
              {formatAmount(todayDebitMinor, profile.currency_code, profile.locale)}
            </Text>
          </View>
        </View>

        {/* Budget Progress Bar */}
        {dailyBudget > 0 && (
          <View style={styles.budgetSection}>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${budgetUsedPct}%`, backgroundColor: budgetUsedPct >= 90 ? '#FF4C4C' : '#ffffff' }]} />
            </View>
            <View style={styles.budgetInfo}>
              <Text style={styles.budgetText}>
                {Math.round(budgetUsedPct)}% of daily allowance
              </Text>
              <Text style={styles.budgetLimit}>
                Max {formatAmount(dailyBudget, profile.currency_code, profile.locale)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* RECENT TRANSACTIONS */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          <TouchableOpacity onPress={() => router.push('/summary?period=monthly')} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>Detailed view</Text>
            <Ionicons name="chevron-forward" size={14} color="#666" />
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={32} color="#222" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No recent expenses. Tap + to add one.</Text>
          </View>
        ) : (
          <FlatList
            data={recentTransactions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isCredit = item.type === 'credit';
              return (
                <View style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View style={styles.emojiContainer}>
                      <Text style={styles.emojiText}>{categoryEmojis[item.category] || '📦'}</Text>
                    </View>
                    <View style={styles.txMeta}>
                      <Text style={styles.txMerchant} numberOfLines={1}>{item.merchant || 'Unknown'}</Text>
                      <Text style={styles.txSource}>{item.source || 'Manual'}</Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: isCredit ? '#00C896' : '#ffffff' }]}>
                      {isCredit ? '+' : '-'}{formatAmount(item.amount_minor, item.currency_code, profile.locale)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={14} color="#444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* SUPERLIST-STYLE FLOATING BOTTOM CAPSULE DOCK */}
      <View style={styles.capsuleDock}>
        <TouchableOpacity style={styles.dockItem} onPress={() => router.replace('/')}>
          <Ionicons name="grid" size={20} color="#ffffff" />
          <View style={styles.dockIndicatorActive} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dockItem} onPress={() => router.push('/summary?period=monthly')}>
          <Ionicons name="bar-chart-outline" size={20} color="#666" />
        </TouchableOpacity>

        {/* Floating action button integrated in capsule dock */}
        <TouchableOpacity
          style={styles.dockAddButton}
          onPress={() => router.push('/add')}
        >
          <Ionicons name="add" size={24} color="#080808" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dockItem} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808', // Superlist pitch black
    paddingTop: 64,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#080808',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  headerInfo: {
    flexDirection: 'column',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  greetingDate: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222222',
  },
  offlineText: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayCard: {
    backgroundColor: '#121212',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#555555',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  todayTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBlock: {
    flex: 1,
  },
  totalBlockDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#222222',
    marginHorizontal: 16,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  totalLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  budgetSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingTop: 16,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#222222',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
  },
  budgetLimit: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '600',
  },
  sectionContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
    marginRight: 4,
  },
  emptyContainer: {
    flex: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#444444',
  },
  listContent: {
    paddingBottom: 110,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emojiContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1e1e1e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emojiText: {
    fontSize: 18,
  },
  txMeta: {
    flexDirection: 'column',
    flex: 1,
  },
  txMerchant: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.1,
  },
  txSource: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginRight: 12,
  },
  deleteBtn: {
    padding: 6,
  },
  capsuleDock: {
    position: 'absolute',
    bottom: 34,
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#222222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  dockIndicatorActive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    marginTop: 4,
  },
  dockAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
