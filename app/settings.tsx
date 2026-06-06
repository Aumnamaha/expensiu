import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
const LocalAuthentication = require('expo-local-authentication') as any;
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getUserProfile,
  saveUserProfile as dbSaveProfile,
  getAllTransactions,
  wipeAllData,
  getDB,
} from '../db/database';
import { isModelDownloaded } from '../services/aiEngine';
import {
  scheduleDailyNotification,
  scheduleWeeklyNotification,
  scheduleMonthlyNotification,
} from '../services/notificationEngine';
import { useTheme } from '../hooks/useTheme';
import { CURRENCIES as CURRENCIES_MAP, convertCurrency } from '../constants/currencies';
import { getExchangeRates } from '../services/exchangeRateService';
import { PremiumAlert } from '../components/PremiumAlert';

const CURRENCIES = Object.values(CURRENCIES_MAP).map(c => ({ code: c.code, symbol: c.symbol, label: c.name }));

export default function SettingsScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('1000');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [locale, setLocale] = useState('en-US');
  const [dailyNotif, setDailyNotif] = useState(false);
  const [weeklyNotif, setWeeklyNotif] = useState(false);
  const [monthlyNotif, setMonthlyNotif] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied'>('denied');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    loadSettings();
    checkPermissions();
    checkModelStatus();
    checkBiometrics();
  }, []);

  async function loadSettings() {
    try {
      const profile = await getUserProfile();
      if (!profile) return;
      if (profile.name) setName(profile.name);
      if (profile.monthly_budget_minor !== undefined) {
        setMonthlyBudget((profile.monthly_budget_minor / 100).toString());
      }
      if (profile.currency_code) setCurrencyCode(profile.currency_code);
      if (profile.locale) setLocale(profile.locale);

      const storedDaily = await AsyncStorage.getItem('settings_daily_notif');
      const storedWeekly = await AsyncStorage.getItem('settings_weekly_notif');
      const storedMonthly = await AsyncStorage.getItem('settings_monthly_notif');
      if (storedDaily !== null) setDailyNotif(storedDaily === 'true');
      if (storedWeekly !== null) setWeeklyNotif(storedWeekly === 'true');
      if (storedMonthly !== null) setMonthlyNotif(storedMonthly === 'true');
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  async function checkModelStatus() {
    const downloaded = await isModelDownloaded();
    setModelLoaded(downloaded);
  }

  async function checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    setNotifStatus(status === 'granted' ? 'granted' : 'denied');
  }

  async function checkBiometrics() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
    } catch (e) {
      setBiometricAvailable(false);
    }
  }

  function handlePickCurrency() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrencyModalVisible(true);
  }

  async function handleSaveProfile() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSaving(true);
    try {
      const budgetVal = parseFloat(monthlyBudget) || 0;
      const currencyEntry = CURRENCIES.find((c) => c.code === currencyCode);
      await dbSaveProfile({
        name: name.trim() || undefined,
        monthly_budget_minor: Math.round(budgetVal * 100),
        currency_code: currencyCode,
        currency_symbol: currencyEntry?.symbol || '$',
        locale: locale || 'en',
      });
      showCustomAlert('Saved', 'Your profile has been updated.');
    } catch (e) {
      console.error('Failed to save:', e);
      showCustomAlert('Error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestNotifications() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifStatus(status === 'granted' ? 'granted' : 'denied');
    } catch (e) {}
  }

  async function applyNotificationSettings(daily: boolean, weekly: boolean, monthly: boolean) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (weekly) {
        await scheduleWeeklyNotification();
      }
      if (daily) {
        await scheduleDailyNotification();
      }
      if (monthly) {
        await scheduleMonthlyNotification();
      }
    } catch (e) {
      console.error('Failed to apply notification settings:', e);
    }
  }

  async function handleToggleDailyNotif(val: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDailyNotif(val);
    await AsyncStorage.setItem('settings_daily_notif', String(val));
    await applyNotificationSettings(val, weeklyNotif, monthlyNotif);
  }

  async function handleToggleWeeklyNotif(val: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setWeeklyNotif(val);
    await AsyncStorage.setItem('settings_weekly_notif', String(val));
    await applyNotificationSettings(dailyNotif, val, monthlyNotif);
  }

  async function handleToggleMonthlyNotif(val: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMonthlyNotif(val);
    await AsyncStorage.setItem('settings_monthly_notif', String(val));
    await applyNotificationSettings(dailyNotif, weeklyNotif, val);
  }

  async function handleExportData() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const allTx = await getAllTransactions(10000, 0);
      if (!allTx || allTx.length === 0) {
        showCustomAlert('No Data', 'No transactions to export.');
        return;
      }

      const jsonStr = JSON.stringify(allTx, null, 2);
      const fileName = `ExpensiU_backup_${Date.now()}.json`;
      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const fileUri = `${cacheDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonStr);
      showCustomAlert('Export Complete', `Backup saved to:\n${fileUri}`);
    } catch (e) {
      console.error('Export failed:', e);
      showCustomAlert('Error', 'Failed to export data.');
    }
  }

  async function handleClearData() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    showCustomAlert(
      'Delete All Data',
      'This will permanently delete all your transactions and reset the app. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              const countRow = await db.getFirstAsync<{ c: number }>(
                'SELECT COUNT(*) as c FROM transactions'
              );
              const count = countRow?.c ?? 0;

              showCustomAlert(
                'Final Confirmation',
                `You have ${count} transaction${count !== 1 ? 's' : ''}. Are you absolutely sure?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Yes, Delete All',
                    style: 'destructive',
                    onPress: async () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      await wipeAllData();
                      router.replace('/onboarding/welcome');
                    },
                  },
                ],
              );
            } catch (e) {
              console.error('Clear failed:', e);
              showCustomAlert('Error', 'Failed to clear data.');
            }
          },
        },
      ],
    );
  }

  const selectedCurrencyLabel = CURRENCIES.find((c) => c.code === currencyCode);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* PROFILE SECTION */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>PROFILE</Text>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>YOUR NAME</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. Alex"
            placeholderTextColor={colors.secondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>MONTHLY BUDGET</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="1000.00"
            placeholderTextColor={colors.secondary}
            keyboardType="decimal-pad"
            value={monthlyBudget}
            onChangeText={setMonthlyBudget}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CURRENCY</Text>
          <TouchableOpacity style={[styles.selectButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={handlePickCurrency}>
            <Text style={[styles.selectButtonText, { color: colors.foreground }]}>
              {selectedCurrencyLabel
                ? `${selectedCurrencyLabel.symbol} ${selectedCurrencyLabel.code} — ${selectedCurrencyLabel.label}`
                : currencyCode}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>

      {/* NOTIFICATIONS SECTION */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        {notifStatus !== 'granted' ? (
          <TouchableOpacity style={[styles.permissionBanner, { borderColor: colors.danger }]} onPress={handleRequestNotifications}>
            <Ionicons name="notifications-off-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={[styles.permissionBannerText, { color: colors.danger }]}>Tap to enable notifications</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
          <View style={styles.switchInfo}>
            <Text style={[styles.switchLabel, { color: colors.foreground }]}>Daily Digest</Text>
            <Text style={styles.switchSub}>Every day at 7:00 PM</Text>
          </View>
          <Switch
            value={dailyNotif}
            onValueChange={handleToggleDailyNotif}
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
            onValueChange={handleToggleWeeklyNotif}
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
            onValueChange={handleToggleMonthlyNotif}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* AI MODEL SECTION */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>AI MODEL</Text>
        
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
              {modelLoaded ? 'Downloaded · Runs Locally' : 'Not Downloaded'}
            </Text>
            <Text style={styles.modelNote}>~300 MB · Never connects to internet</Text>
          </View>
        </View>

        {!modelLoaded && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/onboarding/model-download');
            }}
          >
            <Ionicons name="cloud-download-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Download Model (WiFi Required)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* PERMISSIONS SECTION */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>PERMISSIONS</Text>

        <View style={[styles.permRow, { borderBottomColor: colors.border }]}>
          <Ionicons
            name={notifStatus === 'granted' ? 'notifications-outline' : 'notifications-off-outline'}
            size={20}
            color={notifStatus === 'granted' ? colors.success : colors.danger}
            style={{ marginRight: 12 }}
          />
          <View style={styles.permInfo}>
            <Text style={[styles.permLabel, { color: colors.foreground }]}>Notifications</Text>
            <Text style={[styles.permStatus, { color: notifStatus === 'granted' ? colors.success : colors.danger }]}>
              {notifStatus === 'granted' ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
          {notifStatus !== 'granted' && (
            <TouchableOpacity onPress={handleRequestNotifications} style={[styles.grantButton, { borderColor: colors.border }]}>
              <Text style={[styles.grantText, { color: colors.primary }]}>Grant</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.permRow, { borderBottomColor: colors.border }]}>
          <Ionicons
            name={biometricAvailable ? 'finger-print-outline' : 'lock-closed-outline'}
            size={20}
            color={biometricAvailable ? colors.success : colors.secondary}
            style={{ marginRight: 12 }}
          />
          <View style={styles.permInfo}>
            <Text style={[styles.permLabel, { color: colors.foreground }]}>Biometric Auth</Text>
            <Text style={[styles.permStatus, { color: biometricAvailable ? colors.success : colors.secondary }]}>
              {biometricAvailable ? 'Available' : 'Not Available on Device'}
            </Text>
          </View>
        </View>

        {Platform.OS === 'android' && (
          <View style={[styles.permRow, { borderBottomColor: colors.border }]}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.secondary} style={{ marginRight: 12 }} />
            <View style={styles.permInfo}>
              <Text style={[styles.permLabel, { color: colors.foreground }]}>SMS Reading</Text>
              <Text style={[styles.permStatus, { color: colors.secondary }]}>Android Only — Configure in System Settings</Text>
            </View>
          </View>
        )}
      </View>

      {/* DATA MANAGEMENT SECTION */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>DATA MANAGEMENT</Text>
        
        <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={handleExportData}>
          <Ionicons name="download-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Export Transactions (JSON)</Text>
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
          <Text style={[styles.dangerLabel, { color: colors.danger }]}>DANGER ZONE</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton, { borderColor: colors.danger }]}
            onPress={handleClearData}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Wipe All Data & Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ABOUT SECTION */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.aboutBox}>
          <Text style={[styles.aboutAppName, { color: colors.foreground }]}>ExpensiU</Text>
          <Text style={styles.aboutTagline}>Your money. Your device. Your privacy.</Text>
          <View style={styles.aboutBadges}>
            <View style={[styles.badge, { backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed-outline" size={12} color={colors.success} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: colors.foreground }]}>100% Offline</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.background }]}>
              <Ionicons name="shield-checkmark-outline" size={12} color={colors.success} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: colors.foreground }]}>AES-256 Encrypted</Text>
            </View>
          </View>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
        </View>
      </View>

      <View style={{ height: 48 }} />

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
                const isSelected = item.code === currencyCode;
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
                      const budgetVal = parseFloat(monthlyBudget) || 0;
                      if (budgetVal > 0) {
                        const converted = convertCurrency(
                          Math.round(budgetVal * 100),
                          currencyCode,
                          item.code,
                          getExchangeRates()
                        );
                        setMonthlyBudget((converted / 100).toFixed(2));
                      }
                      
                      setCurrencyCode(item.code);
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionCard: {
    borderRadius: 16, // Consistent border radius of 16px for cards
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.4,
    marginBottom: 16,
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
  input: {
    borderRadius: 12, // Consistent border radius of 12px for inputs
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12, // Consistent border radius of 12px for inputs/selectors
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
    marginTop: 20,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  dangerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 12,
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
    backgroundColor: 'rgba(0,0,0,0.05)',
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
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  permInfo: {
    flex: 1,
  },
  permLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  permStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  grantButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  grantText: {
    fontSize: 12,
    fontWeight: '700',
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
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
});
