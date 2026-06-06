import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  Switch,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
const LocalAuthentication = require('expo-local-authentication') as any;

import type { Transaction } from '../types';
import {
  getDB,
  getUserProfile,
  saveUserProfile as dbSaveProfile,
  getAllTransactions,
  getTransactionsByRange,
  deleteTransaction,
  wipeAllData,
  convertAllTransactionsCurrency,
} from '../db/database';
import { setupSecurity, authenticateUser, getLockoutRemaining } from '../services/securityService';
import { formatAmount } from '../utils/mathUtils';
import { useTheme } from '../hooks/useTheme';
import { isModelDownloaded } from '../services/aiEngine';
import {
  scheduleDailyNotification,
  scheduleWeeklyNotification,
  scheduleMonthlyNotification,
} from '../services/notificationEngine';
import { CURRENCIES as CURRENCIES_MAP, convertCurrency } from '../constants/currencies';
import { initExchangeRates, getExchangeRates } from '../services/exchangeRateService';
import { PremiumAlert } from '../components/PremiumAlert';

const WINDOW_WIDTH = Dimensions.get('window').width;

// Build full currency picker list from constants (40+ currencies)
const CURRENCIES = Object.values(CURRENCIES_MAP).map(c => ({ code: c.code, symbol: c.symbol, label: c.name }));

const categoryEmojis: Record<string, string> = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
  Health: '💊', Utilities: '💡', Transfer: '💸', Salary: '💰', Refund: '🔄', Other: '📦',
};

// ============================================================================
// Animated Amount Counter Component
// ============================================================================
function AnimatedAmount({ targetAmount, currencyCode, locale, colors, style }: { targetAmount: number; currencyCode: string; locale: string; colors: any; style: any }) {
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = targetAmount;
    if (end === 0) {
      setDisplayAmount(0);
      return;
    }
    const duration = 500; // ms
    const stepTime = 16; // approx 60fps
    const steps = duration / stepTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const val = Math.round(start + (end * (currentStep / steps)));
      if (currentStep >= steps) {
        setDisplayAmount(end);
        clearInterval(timer);
      } else {
        setDisplayAmount(val);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetAmount]);

  return (
    <Text style={style}>
      {formatAmount(displayAmount, currencyCode, locale)}
    </Text>
  );
}

// ============================================================================
// Animated Transaction Row Component (Staggered Slide-In)
// ============================================================================
function AnimatedTransactionRow({
  item,
  index,
  onDelete,
  colors,
  profile,
}: {
  item: Transaction;
  index: number;
  onDelete: (item: Transaction) => void;
  colors: any;
  profile: any;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: Math.min(index * 40, 400),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: Math.min(index * 40, 400),
        useNativeDriver: true,
      }),
    ]).start();
  }, [item.id]);

  const isCredit = item.type === 'credit';

  const handleDeletePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDelete(item);
  };

  return (
    <Animated.View
      style={[
        styles.txRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Type indicator bar */}
      <View style={[styles.txIndicatorBar, { backgroundColor: isCredit ? colors.success : colors.danger }]} />

      <View style={styles.txLeft}>
        <View style={[styles.emojiContainer, { backgroundColor: colors.background }]}>
          <Text style={styles.emojiText}>{categoryEmojis[item.category] || '📦'}</Text>
        </View>
        <View style={styles.txMeta}>
          <Text style={[styles.txMerchant, { color: colors.foreground }]} numberOfLines={1}>
            {item.merchant || 'Unknown'}
          </Text>
          <Text style={styles.txSource}>{item.source || 'Manual'}</Text>
        </View>
      </View>

      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isCredit ? colors.success : colors.foreground }]}>
          {isCredit ? '+' : '-'}{formatAmount(item.amount_minor, item.currency_code, profile.locale)}
        </Text>
        <TouchableOpacity onPress={handleDeletePress} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color={colors.secondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// Skeleton Loading Component
// ============================================================================
function SkeletonLoader({ colors }: { colors: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity }]} />
      <Animated.View style={[styles.skeletonTitle, { backgroundColor: colors.surface, opacity }]} />
      {[1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity }]} />
      ))}
    </View>
  );
}

// ============================================================================
// Main Home/Tab Container Screen
// ============================================================================
export default function HomeScreen() {
  const { colors, currentThemeName, cycle } = useTheme();
  const [activeTab, setActiveTab] = useState<'home' | 'summary' | 'settings'>('home');
  const [profile, setProfile] = useState<any>(null);
  
  // Dashboard & shared states
  const [todayCreditMinor, setTodayCreditMinor] = useState(0);
  const [todayDebitMinor, setTodayDebitMinor] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Summary/Insights specific states
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [periodCredits, setPeriodCredits] = useState<Transaction[]>([]);
  const [periodDebits, setPeriodDebits] = useState<Transaction[]>([]);

  // Settings specific states
  const [settingsName, setSettingsName] = useState('');
  const [settingsBudget, setSettingsBudget] = useState('1000');
  const [settingsCurrency, setSettingsCurrency] = useState('USD');
  const [settingsLocale, setSettingsLocale] = useState('en-US');
  const [dailyNotif, setDailyNotif] = useState(false);
  const [weeklyNotif, setWeeklyNotif] = useState(false);
  const [monthlyNotif, setMonthlyNotif] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied'>('denied');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  // Premium custom alert states
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

  // Reload data whenever screen is focused or tab changes
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [activeTab, selectedPeriod])
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
      
      // Update states for Settings inputs if loaded profile is newer
      setSettingsName(loaded.name || 'Friend');
      setSettingsBudget(((loaded.monthly_budget_minor ?? 0) / 100).toString());
      setSettingsCurrency(loaded.currency_code || 'USD');
      setSettingsLocale(loaded.locale || 'en-US');

      await getTodayTotals(loaded.locale || 'en-US');
      await loadRecentTransactions();
      await loadPeriodTransactions(loaded);
      await loadSettingsPreferences();
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Failed to load dashboard/tabs:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    loadData();
  };

  async function getTodayTotals(locale: string) {
    const db = await getDB();
    const today = new Date().toISOString().split('T')[0];

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

  // ============================================================================
  // Summary Tab Functions
  // ============================================================================
  async function loadPeriodTransactions(loadedProfile: any) {
    try {
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

      setPeriodCredits(credits);
      setPeriodDebits(debits);
    } catch (e) {
      console.error('Failed to load period transactions:', e);
    }
  }

  // ============================================================================
  // Settings Tab Functions
  // ============================================================================
  async function loadSettingsPreferences() {
    try {
      const storedDaily = await AsyncStorage.getItem('settings_daily_notif');
      const storedWeekly = await AsyncStorage.getItem('settings_weekly_notif');
      const storedMonthly = await AsyncStorage.getItem('settings_monthly_notif');
      if (storedDaily !== null) setDailyNotif(storedDaily === 'true');
      if (storedWeekly !== null) setWeeklyNotif(storedWeekly === 'true');
      if (storedMonthly !== null) setMonthlyNotif(storedMonthly === 'true');

      // Check model
      const downloaded = await isModelDownloaded();
      setModelLoaded(downloaded);

      // Check permissions
      const { status } = await Notifications.getPermissionsAsync();
      setNotifStatus(status === 'granted' ? 'granted' : 'denied');

      // Check biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
    } catch (e) {
      console.error('Failed loading settings prefs:', e);
    }
  }

  async function handleSaveSettings() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSavingSettings(true);
    try {
      const budgetVal = parseFloat(settingsBudget) || 0;
      const currencyEntry = CURRENCIES.find((c) => c.code === settingsCurrency);
      await dbSaveProfile({
        name: settingsName.trim() || undefined,
        monthly_budget_minor: Math.round(budgetVal * 100),
        currency_code: settingsCurrency,
        currency_symbol: currencyEntry?.symbol || '$',
        locale: settingsLocale || 'en-US',
      });
      showCustomAlert('Success', 'Profile settings updated successfully.');
      loadData();
    } catch (e) {
      console.error('Failed to save settings:', e);
      showCustomAlert('Error', 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function applyNotificationSettings(daily: boolean, weekly: boolean, monthly: boolean) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (weekly) await scheduleWeeklyNotification();
      if (daily) await scheduleDailyNotification();
      if (monthly) await scheduleMonthlyNotification();
    } catch (e) {
      console.error('Notification configuration failed:', e);
    }
  }

  async function handleToggleDaily(val: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDailyNotif(val);
    await AsyncStorage.setItem('settings_daily_notif', String(val));
    await applyNotificationSettings(val, weeklyNotif, monthlyNotif);
  }

  async function handleToggleWeekly(val: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setWeeklyNotif(val);
    await AsyncStorage.setItem('settings_weekly_notif', String(val));
    await applyNotificationSettings(dailyNotif, val, monthlyNotif);
  }

  async function handleToggleMonthly(val: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMonthlyNotif(val);
    await AsyncStorage.setItem('settings_monthly_notif', String(val));
    await applyNotificationSettings(dailyNotif, weeklyNotif, val);
  }

  async function handleExport() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const allTx = await getAllTransactions(10000, 0);
      if (!allTx || allTx.length === 0) {
        showCustomAlert('No Data', 'No transactions to export.');
        return;
      }
      const jsonStr = JSON.stringify(allTx, null, 2);
      const fileName = `ExpensiU_backup_${Date.now()}.json`;
      const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonStr);
      showCustomAlert('Export Complete', `Backup saved locally:\n${fileUri}`);
    } catch (e) {
      showCustomAlert('Error', 'Export failed.');
    }
  }

  async function handleClearEverything() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    showCustomAlert(
      'Wipe All Data',
      'This will permanently delete all your transactions and profile settings. This is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await wipeAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            router.replace('/onboarding/welcome');
          }
        }
      ]
    );
  }

  async function handleDeleteTransaction(item: Transaction) {
    showCustomAlert(
      'Delete Expense',
      `Delete "${item.merchant || 'Transaction'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const remaining = getLockoutRemaining();
            if (remaining > 0) {
              showCustomAlert(
                'Security Lockout',
                `Too many failed unlock attempts. Please try again in ${remaining} seconds.`
              );
              return;
            }

            const authenticated = await authenticateUser();
            if (!authenticated) {
              const newRemaining = getLockoutRemaining();
              if (newRemaining > 0) {
                showCustomAlert(
                  'Security Lockout',
                  `Too many failed unlock attempts. Please try again in ${newRemaining} seconds.`
                );
              } else {
                showCustomAlert(
                  'Access Denied',
                  'Authentication failed. Transaction was not deleted.'
                );
              }
              return;
            }

            try {
              await deleteTransaction(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              await loadData();
            } catch (e) {
              console.error('Delete failed:', e);
            }
          },
        },
      ]
    );
  }

  // ============================================================================
  // Dynamic Tab Action Handlers
  // ============================================================================
  const handleTabPress = (tab: 'home' | 'summary' | 'settings') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTab(tab);
  };

  const handleThemeCycle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    cycle();
  };

  const handlePickCurrency = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrencyModalVisible(true);
  };

  const checkPermissions = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status === 'granted' ? 'granted' : 'denied');
  };

  const handleNavigateAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/add');
  };

  if (loading || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SkeletonLoader colors={colors} />
      </View>
    );
  }

  // Gradient definitions based on dynamic theme
  let gradientColors: [string, string] = [colors.background, colors.background];
  if (currentThemeName === 'dark') {
    gradientColors = ['rgba(31, 111, 235, 0.12)', '#0d0d0d'];
  } else if (currentThemeName === 'light') {
    gradientColors = ['rgba(59, 130, 246, 0.05)', '#f5f5f5'];
  } else if (currentThemeName === 'ocean') {
    gradientColors = ['rgba(14, 165, 233, 0.12)', '#0a1628'];
  } else if (currentThemeName === 'forest') {
    gradientColors = ['rgba(34, 197, 94, 0.12)', '#0a1a0f'];
  } else if (currentThemeName === 'slate') {
    gradientColors = ['rgba(99, 102, 241, 0.08)', '#f8fafc'];
  }

  const selectedCurrencyLabel = CURRENCIES.find((c) => c.code === settingsCurrency);

  // ============================================================================
  // Render: 1. HOME DASHBOARD TAB
  // ============================================================================
  const renderHomeDashboard = () => {
    const dailyBudget = Math.round(profile.monthly_budget_minor / 30);
    const budgetUsedPct = dailyBudget > 0 ? Math.min(100, (todayDebitMinor / dailyBudget) * 100) : 0;

    return (
      <View style={styles.tabContentContainer}>
        {/* TODAY'S BALANCE METRICS (Glassmorphism Card) */}
        <View style={[styles.todayCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderColor: colors.border }]}>
          <Text style={styles.cardLabel}>TODAY'S SUMMARY</Text>
          <View style={styles.todayTotals}>
            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>Money In</Text>
              <AnimatedAmount
                targetAmount={todayCreditMinor}
                currencyCode={profile.currency_code}
                locale={profile.locale}
                colors={colors}
                style={[styles.totalAmount, { color: colors.success }]}
              />
            </View>

            <View style={[styles.totalBlockDivider, { backgroundColor: colors.border }]} />

            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>Money Out</Text>
              <AnimatedAmount
                targetAmount={todayDebitMinor}
                currencyCode={profile.currency_code}
                locale={profile.locale}
                colors={colors}
                style={[styles.totalAmount, { color: colors.danger }]}
              />
            </View>
          </View>

          {/* Budget Progress Bar */}
          {dailyBudget > 0 && (
            <View style={[styles.budgetSection, { borderTopColor: colors.border }]}>
              <View style={[styles.progressBarContainer, { backgroundColor: colors.background }]}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${budgetUsedPct}%`,
                      backgroundColor: budgetUsedPct >= 90 ? colors.danger : colors.primary
                    }
                  ]}
                />
              </View>
              <View style={styles.budgetInfo}>
                <Text style={styles.budgetText}>
                  {Math.round(budgetUsedPct)}% of daily allowance
                </Text>
                <Text style={[styles.budgetLimit, { color: colors.foreground }]}>
                  Max {formatAmount(dailyBudget, profile.currency_code, profile.locale)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* RECENT TRANSACTIONS */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Expenses</Text>
            <TouchableOpacity onPress={() => handleTabPress('summary')} style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Detailed view</Text>
              <Ionicons name="chevron-forward" size={14} color="#666" />
            </TouchableOpacity>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emojiArt}>
                <Text style={{ fontSize: 48 }}>📭</Text>
                <Text style={{ fontSize: 24, marginTop: -10 }}>🕊️</Text>
              </View>
              <Text style={[styles.emptyText, { color: colors.secondary }]}>No recent expenses. Tap + to add one.</Text>
            </View>
          ) : (
            <FlatList
              data={recentTransactions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
              }
              renderItem={({ item, index }) => (
                <AnimatedTransactionRow
                  item={item}
                  index={index}
                  onDelete={handleDeleteTransaction}
                  colors={colors}
                  profile={profile}
                />
              )}
            />
          )}
        </View>
      </View>
    );
  };

  // ============================================================================
  // Render: 2. SUMMARY / INSIGHTS TAB
  // ============================================================================
  const renderSummaryInsights = () => {
    const combinedList = [...periodCredits, ...periodDebits].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const totalCredits = periodCredits.reduce((acc, tx) => acc + tx.amount_minor, 0);
    const totalDebits = periodDebits.reduce((acc, tx) => acc + tx.amount_minor, 0);
    const netBalance = totalCredits - totalDebits;

    const handlePeriodPress = (period: 'daily' | 'weekly' | 'monthly') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedPeriod(period);
    };

    return (
      <View style={styles.tabContentContainer}>
        {/* Period tabs */}
        <View style={[styles.tabSelectorContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['daily', 'weekly', 'monthly'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => handlePeriodPress(period)}
              style={[
                styles.tabSelectorItem,
                selectedPeriod === period && [styles.tabSelectorItemActive, { backgroundColor: colors.primary }]
              ]}
            >
              <Text style={[
                styles.tabSelectorText,
                { color: colors.secondary },
                selectedPeriod === period && styles.tabSelectorTextActive
              ]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period totals row */}
        <View style={styles.metricsSection}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.metricRow}>
              <View style={[styles.metricIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                <Ionicons name="trending-up" size={18} color={colors.success} />
              </View>
              <View style={styles.metricInfo}>
                <Text style={styles.metricLabel}>Total In</Text>
                <Text style={[styles.metricValue, { color: colors.success }]}>
                  {formatAmount(totalCredits, profile.currency_code, profile.locale)}
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
                  {formatAmount(totalDebits, profile.currency_code, profile.locale)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {selectedPeriod !== 'daily' && (
          <TouchableOpacity
            style={[styles.aiBannerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push(`/summary?period=${selectedPeriod}`);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.aiBannerLeft}>
              <Ionicons name="sparkles" size={20} color={colors.primary} style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.aiBannerTitle, { color: colors.foreground }]}>Local AI Financial Summary</Text>
                <Text style={[styles.aiBannerSub, { color: colors.secondary }]}>
                  View spending analysis & saving tips
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
          </TouchableOpacity>
        )}

        {/* Transactions List */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transactions History</Text>
            <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark" size={12} color={colors.success} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: colors.secondary }]}>Local</Text>
            </View>
          </View>

          {combinedList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emojiArt}>
                <Text style={{ fontSize: 48 }}>🔢</Text>
                <Text style={{ fontSize: 24, marginTop: -10 }}>📊</Text>
              </View>
              <Text style={[styles.emptyText, { color: colors.secondary }]}>No transactions for this period.</Text>
            </View>
          ) : (
            <FlatList
              data={combinedList}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => (
                <AnimatedTransactionRow
                  item={item}
                  index={index}
                  onDelete={handleDeleteTransaction}
                  colors={colors}
                  profile={profile}
                />
              )}
            />
          )}
        </View>

        {/* Floating summary footer inside tab */}
        <View style={[styles.inlineSummaryFooter, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={styles.inlineFooterLabel}>Net Balance</Text>
            <Text style={[styles.inlineFooterAmount, { color: netBalance >= 0 ? colors.success : colors.danger }]}>
              {formatAmount(Math.abs(netBalance), profile.currency_code, profile.locale)}
            </Text>
          </View>
          <Text style={[styles.inlineFooterCount, { color: colors.secondary }]}>
            {combinedList.length} total
          </Text>
        </View>
      </View>
    );
  };

  // ============================================================================
  // Render: 3. SETTINGS TAB
  // ============================================================================
  const renderSettings = () => {
    return (
      <ScrollView
        style={styles.settingsScroll}
        contentContainerStyle={styles.settingsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.sectionCardTitle}>PROFILE</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>YOUR NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Alex"
              placeholderTextColor={colors.secondary}
              value={settingsName}
              onChangeText={setSettingsName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>MONTHLY BUDGET</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="1000.00"
              placeholderTextColor={colors.secondary}
              keyboardType="decimal-pad"
              value={settingsBudget}
              onChangeText={setSettingsBudget}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CURRENCY</Text>
            <TouchableOpacity style={[styles.selectButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={handlePickCurrency}>
              <Text style={[styles.selectButtonText, { color: colors.foreground }]}>
                {selectedCurrencyLabel
                  ? `${selectedCurrencyLabel.symbol} ${selectedCurrencyLabel.code} — ${selectedCurrencyLabel.label}`
                  : settingsCurrency}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.primary }, savingSettings && { opacity: 0.6 }]}
            onPress={handleSaveSettings}
            disabled={savingSettings}
          >
            <Text style={styles.primaryButtonText}>{savingSettings ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.sectionCardTitle}>NOTIFICATIONS</Text>

          {notifStatus !== 'granted' && (
            <TouchableOpacity style={[styles.permissionBanner, { borderColor: colors.danger }]} onPress={checkPermissions}>
              <Ionicons name="notifications-off-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.permissionBannerText, { color: colors.danger }]}>Tap to grant notifications</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchInfo}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>Daily Digest</Text>
              <Text style={styles.switchSub}>Every day at 7:00 PM</Text>
            </View>
            <Switch
              value={dailyNotif}
              onValueChange={handleToggleDaily}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchInfo}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>Weekly Summary</Text>
              <Text style={styles.switchSub}>Every Sunday at 8:00 PM</Text>
            </View>
            <Switch
              value={weeklyNotif}
              onValueChange={handleToggleWeekly}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchInfo}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>Monthly Report</Text>
              <Text style={styles.switchSub}>1st of each month at 9:00 AM</Text>
            </View>
            <Switch
              value={monthlyNotif}
              onValueChange={handleToggleMonthly}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* AI Model Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.sectionCardTitle}>AI BRAIN</Text>
          <View style={[styles.modelBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modelBoxLeft}>
              <Ionicons
                name={modelLoaded ? 'hardware-chip-outline' : 'cloud-download-outline'}
                size={24}
                color={modelLoaded ? colors.success : colors.secondary}
              />
            </View>
            <View style={styles.modelBoxRight}>
              <Text style={[styles.modelName, { color: colors.foreground }]}>Qwen 2.5 — 0.5B</Text>
              <Text style={[styles.modelStatus, { color: modelLoaded ? colors.success : colors.secondary }]}>
                {modelLoaded ? 'Ready offline' : 'WiFi download required'}
              </Text>
              <Text style={styles.modelNote}>~300 MB · Local scanning brain</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/onboarding/model-download');
            }}
          >
            <Ionicons name="settings" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Manage AI Download</Text>
          </TouchableOpacity>
        </View>

        {/* Data Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.sectionCardTitle}>DATA CONTROLS</Text>
          
          <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={handleExport}>
            <Ionicons name="download-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Export JSON Backup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { marginTop: 12, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/import');
            }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Import Bank Statement</Text>
          </TouchableOpacity>

          <View style={[styles.dangerZone, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton, { borderColor: colors.danger }]}
              onPress={handleClearEverything}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete All & Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.aboutBox}>
            <Text style={[styles.aboutAppName, { color: colors.foreground }]}>ExpensiU</Text>
            <Text style={styles.aboutTagline}>Your money. Your device. Your privacy.</Text>
            <View style={styles.aboutBadges}>
              <View style={[styles.badge, { backgroundColor: colors.background }]}>
                <Ionicons name="lock-closed-outline" size={12} color={colors.success} style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: colors.foreground }]}>100% Offline</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.background }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.success} style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: colors.foreground }]}>Encrypted</Text>
              </View>
            </View>
            <Text style={styles.aboutVersion}>Version 1.0.1</Text>
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Subtle Gradient */}
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFillObject} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      {/* FIXED HEADER */}
      <View style={styles.topSection}>
        <View style={styles.headerInfo}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            {activeTab === 'home' && `Hey, ${profile.name || 'Friend'} 👋`}
            {activeTab === 'summary' && 'Insights 📊'}
            {activeTab === 'settings' && 'Settings ⚙️'}
          </Text>
          <Text style={styles.greetingDate}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* Theme Toggle Button */}
        <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleThemeCycle}>
          <Ionicons name={currentThemeName === 'light' ? 'moon-outline' : 'sunny-outline'} size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* ACTIVE TAB RENDER */}
      {activeTab === 'home' && renderHomeDashboard()}
      {activeTab === 'summary' && renderSummaryInsights()}
      {activeTab === 'settings' && renderSettings()}

      {/* BOTTOM CAPSULE DOCK */}
      <View style={[styles.capsuleDock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.dockItem} onPress={() => handleTabPress('home')}>
          <Ionicons name="grid" size={20} color={activeTab === 'home' ? colors.primary : colors.secondary} />
          {activeTab === 'home' && <View style={[styles.dockIndicatorActive, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.dockItem} onPress={() => handleTabPress('summary')}>
          <Ionicons name="bar-chart" size={20} color={activeTab === 'summary' ? colors.primary : colors.secondary} />
          {activeTab === 'summary' && <View style={[styles.dockIndicatorActive, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockAddButton, { backgroundColor: colors.primary, borderColor: colors.background }]}
          onPress={handleNavigateAdd}
        >
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dockItem} onPress={() => handleTabPress('settings')}>
          <Ionicons name="settings" size={20} color={activeTab === 'settings' ? colors.primary : colors.secondary} />
          {activeTab === 'settings' && <View style={[styles.dockIndicatorActive, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>

      {/* CURRENCY SELECTION MODAL */}
      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Currency</Text>
              <TouchableOpacity
                onPress={() => setCurrencyModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={CURRENCIES}
              keyExtractor={(item) => item.code}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const isSelected = item.code === settingsCurrency;
                return (
                  <TouchableOpacity
                    style={[
                      styles.currencyItem,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.background },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      
                      // Convert budget instantly if it's entered
                      const budgetVal = parseFloat(settingsBudget) || 0;
                      if (budgetVal > 0) {
                        const converted = convertCurrency(
                          Math.round(budgetVal * 100),
                          settingsCurrency,
                          item.code,
                          getExchangeRates()
                        );
                        setSettingsBudget((converted / 100).toFixed(2));
                      }
                      
                      setSettingsCurrency(item.code);
                      setCurrencyModalVisible(false);
                    }}
                  >
                    <View style={styles.currencyLeft}>
                      <View style={[styles.currencySymbolContainer, { backgroundColor: colors.background }]}>
                        <Text style={[styles.currencySymbolText, { color: colors.foreground }]}>{item.symbol}</Text>
                      </View>
                      <View style={styles.currencyMeta}>
                        <Text style={[styles.currencyCode, { color: colors.foreground }]}>{item.code}</Text>
                        <Text style={styles.currencyLabel}>{item.label}</Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

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
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 64,
    marginBottom: 16,
  },
  headerInfo: {
    flexDirection: 'column',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  greetingDate: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabContentContainer: {
    flex: 1,
  },
  todayCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  todayTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBlock: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  totalBlockDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 16,
  },
  budgetSection: {
    marginTop: 18,
    borderTopWidth: 1,
    paddingTop: 14,
    paddingBottom: 2,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  budgetLimit: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginRight: 4,
  },
  emptyContainer: {
    flex: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiArt: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 110,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: 'hidden',
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
    paddingLeft: 4,
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    letterSpacing: -0.1,
  },
  txSource: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
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
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    flex: 1,
  },
  dockIndicatorActive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  dockAddButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    marginHorizontal: 12,
  },

  // Skeleton styles
  skeletonContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 64,
  },
  skeletonCard: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 32,
  },
  skeletonTitle: {
    height: 20,
    width: 140,
    borderRadius: 10,
    marginBottom: 20,
  },
  skeletonRow: {
    height: 68,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },

  // ============================================================================
  // Tab: Summary Insights Styles
  // ============================================================================
  tabSelectorContainer: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    alignSelf: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  tabSelectorItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSelectorItemActive: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabSelectorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabSelectorTextActive: {
    color: '#ffffff',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
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
    marginBottom: 20,
  },
  metricCard: {
    flexDirection: 'row',
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 12,
  },
  inlineSummaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 100, // Safe above Capsule Dock
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  inlineFooterLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inlineFooterAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  inlineFooterCount: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ============================================================================
  // Tab: Settings Styles
  // ============================================================================
  settingsScroll: {
    flex: 1,
  },
  settingsScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.4,
    marginBottom: 16,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 8,
    borderWidth: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  dangerZone: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  permissionBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  switchSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  modelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  modelBoxLeft: {
    marginRight: 16,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelBoxRight: {
    flex: 1,
  },
  modelName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modelStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  modelNote: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  aboutBox: {
    alignItems: 'center',
    padding: 8,
  },
  aboutAppName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 4,
  },
  aboutTagline: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  aboutBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  aboutVersion: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    padding: 4,
  },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: 12,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbolContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currencySymbolText: {
    fontSize: 16,
    fontWeight: '700',
  },
  currencyMeta: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  currencyLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  aiBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aiBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  aiBannerSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
