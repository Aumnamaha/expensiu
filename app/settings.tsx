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
} from 'react-native';
import * as Notifications from 'expo-notifications';
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

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
];

export default function SettingsScreen() {
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

  // handlePickCurrency is INSIDE the component so it can call setCurrencyCode
  function handlePickCurrency() {
    Alert.alert(
      'Select Currency',
      'Choose your preferred currency',
      CURRENCIES.map((c) => ({
        text: `${c.symbol} ${c.code} — ${c.label}`,
        onPress: () => {
          setCurrencyCode(c.code);
        },
      })).concat([{ text: 'Cancel', onPress: () => {} }]),
    );
  }

  async function handleSaveProfile() {
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
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      console.error('Failed to save:', e);
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestNotifications() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifStatus(status === 'granted' ? 'granted' : 'denied');
    } catch (e) {}
  }

  async function handleToggleDailyNotif(val: boolean) {
    setDailyNotif(val);
    if (val) {
      try {
        await scheduleDailyNotification();
      } catch (e) {
        console.error('Failed to schedule daily notification:', e);
      }
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  }

  async function handleToggleWeeklyNotif(val: boolean) {
    setWeeklyNotif(val);
    if (val) {
      try {
        await scheduleWeeklyNotification();
      } catch (e) {
        console.error('Failed to schedule weekly notification:', e);
      }
    }
  }

  async function handleToggleMonthlyNotif(val: boolean) {
    setMonthlyNotif(val);
    if (val) {
      try {
        await scheduleMonthlyNotification();
      } catch (e) {
        console.error('Failed to schedule monthly notification:', e);
      }
    }
  }

  async function handleExportData() {
    try {
      const allTx = await getAllTransactions(10000, 0);
      if (!allTx || allTx.length === 0) {
        Alert.alert('No Data', 'No transactions to export.');
        return;
      }

      const jsonStr = JSON.stringify(allTx, null, 2);
      const fileName = `ExpensiU_backup_${Date.now()}.json`;
      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const fileUri = `${cacheDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonStr);
      Alert.alert('Export Complete', `Backup saved to:\n${fileUri}`);
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Error', 'Failed to export data.');
    }
  }

  async function handleClearData() {
    Alert.alert(
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

              Alert.alert(
                'Final Confirmation',
                `You have ${count} transaction${count !== 1 ? 's' : ''}. Are you absolutely sure?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Yes, Delete All',
                    style: 'destructive',
                    onPress: async () => {
                      await wipeAllData();
                      router.replace('/onboarding/welcome');
                    },
                  },
                ],
              );
            } catch (e) {
              console.error('Clear failed:', e);
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ],
    );
  }

  const selectedCurrencyLabel = CURRENCIES.find((c) => c.code === currencyCode);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── PROFILE SECTION ── */}
      <SectionCard title="PROFILE">
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex"
            placeholderTextColor="#444"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>MONTHLY BUDGET</Text>
          <TextInput
            style={styles.input}
            placeholder="1000.00"
            placeholderTextColor="#444"
            keyboardType="decimal-pad"
            value={monthlyBudget}
            onChangeText={setMonthlyBudget}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CURRENCY</Text>
          <TouchableOpacity style={styles.selectButton} onPress={handlePickCurrency}>
            <Text style={styles.selectButtonText}>
              {selectedCurrencyLabel
                ? `${selectedCurrencyLabel.symbol} ${selectedCurrencyLabel.code} — ${selectedCurrencyLabel.label}`
                : currencyCode}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, saving && { opacity: 0.6 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </SectionCard>

      {/* ── NOTIFICATIONS SECTION ── */}
      <SectionCard title="NOTIFICATIONS">
        {notifStatus !== 'granted' ? (
          <TouchableOpacity style={styles.permissionBanner} onPress={handleRequestNotifications}>
            <Ionicons name="notifications-off-outline" size={18} color="#FF4C4C" style={{ marginRight: 8 }} />
            <Text style={styles.permissionBannerText}>Tap to enable notifications</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Daily Digest</Text>
            <Text style={styles.switchSub}>Every day at 7:00 PM</Text>
          </View>
          <Switch
            value={dailyNotif}
            onValueChange={handleToggleDailyNotif}
            trackColor={{ false: '#222', true: '#00C896' }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Weekly Summary</Text>
            <Text style={styles.switchSub}>Every Sunday at 8:00 PM</Text>
          </View>
          <Switch
            value={weeklyNotif}
            onValueChange={handleToggleWeeklyNotif}
            trackColor={{ false: '#222', true: '#00C896' }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Monthly Report</Text>
            <Text style={styles.switchSub}>1st of each month at 9:00 AM</Text>
          </View>
          <Switch
            value={monthlyNotif}
            onValueChange={handleToggleMonthlyNotif}
            trackColor={{ false: '#222', true: '#00C896' }}
            thumbColor="#ffffff"
          />
        </View>
      </SectionCard>

      {/* ── AI MODEL SECTION ── */}
      <SectionCard title="AI MODEL">
        <View style={styles.modelBox}>
          <View style={styles.modelBoxLeft}>
            <Ionicons
              name={modelLoaded ? 'hardware-chip-outline' : 'cloud-download-outline'}
              size={28}
              color={modelLoaded ? '#00C896' : '#666'}
            />
          </View>
          <View style={styles.modelBoxRight}>
            <Text style={styles.modelName}>Qwen 2.5 — 0.5B</Text>
            <Text style={[styles.modelStatus, { color: modelLoaded ? '#00C896' : '#666' }]}>
              {modelLoaded ? 'Downloaded · Runs Locally' : 'Not Downloaded'}
            </Text>
            <Text style={styles.modelNote}>~300 MB · Never connects to internet</Text>
          </View>
        </View>

        {!modelLoaded && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#1a1a2e', borderColor: '#333' }]}
            onPress={() => router.push('/onboarding/model-download')}
          >
            <Ionicons name="cloud-download-outline" size={16} color="#58a6ff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#58a6ff', fontWeight: '700' }}>Download Model (WiFi Required)</Text>
          </TouchableOpacity>
        )}
      </SectionCard>

      {/* ── PERMISSIONS SECTION ── */}
      <SectionCard title="PERMISSIONS">
        <View style={styles.permRow}>
          <Ionicons
            name={notifStatus === 'granted' ? 'notifications-outline' : 'notifications-off-outline'}
            size={20}
            color={notifStatus === 'granted' ? '#00C896' : '#FF4C4C'}
            style={{ marginRight: 12 }}
          />
          <View style={styles.permInfo}>
            <Text style={styles.permLabel}>Notifications</Text>
            <Text style={[styles.permStatus, { color: notifStatus === 'granted' ? '#00C896' : '#FF4C4C' }]}>
              {notifStatus === 'granted' ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
          {notifStatus !== 'granted' && (
            <TouchableOpacity onPress={handleRequestNotifications} style={styles.grantButton}>
              <Text style={styles.grantText}>Grant</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.permRow}>
          <Ionicons
            name={biometricAvailable ? 'finger-print-outline' : 'lock-closed-outline'}
            size={20}
            color={biometricAvailable ? '#00C896' : '#666'}
            style={{ marginRight: 12 }}
          />
          <View style={styles.permInfo}>
            <Text style={styles.permLabel}>Biometric Auth</Text>
            <Text style={[styles.permStatus, { color: biometricAvailable ? '#00C896' : '#666' }]}>
              {biometricAvailable ? 'Available' : 'Not Available on Device'}
            </Text>
          </View>
        </View>

        {Platform.OS === 'android' && (
          <View style={styles.permRow}>
            <Ionicons name="chatbubble-outline" size={20} color="#666" style={{ marginRight: 12 }} />
            <View style={styles.permInfo}>
              <Text style={styles.permLabel}>SMS Reading</Text>
              <Text style={[styles.permStatus, { color: '#666' }]}>Android Only — Configure in System Settings</Text>
            </View>
          </View>
        )}
      </SectionCard>

      {/* ── DATA SECTION ── */}
      <SectionCard title="DATA MANAGEMENT">
        <TouchableOpacity style={styles.actionButton} onPress={handleExportData}>
          <Ionicons name="download-outline" size={16} color="#fbbf24" style={{ marginRight: 8 }} />
          <Text style={{ color: '#fbbf24', fontWeight: '700' }}>Export Transactions (JSON)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { marginTop: 12 }]}
          onPress={() => router.push('/import')}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#58a6ff" style={{ marginRight: 8 }} />
          <Text style={{ color: '#58a6ff', fontWeight: '700' }}>Import Bank Statement</Text>
        </TouchableOpacity>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerLabel}>DANGER ZONE</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleClearData}
          >
            <Ionicons name="trash-outline" size={16} color="#FF4C4C" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FF4C4C', fontWeight: '700' }}>Wipe All Data & Reset</Text>
          </TouchableOpacity>
        </View>
      </SectionCard>

      {/* ── ABOUT SECTION ── */}
      <SectionCard title="ABOUT">
        <View style={styles.aboutBox}>
          <Text style={styles.aboutAppName}>ExpensiU</Text>
          <Text style={styles.aboutTagline}>Your money. Your device. Your privacy.</Text>
          <View style={styles.aboutBadges}>
            <View style={styles.badge}>
              <Ionicons name="lock-closed-outline" size={12} color="#00C896" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>100% Offline</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#00C896" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>AES-256 Encrypted</Text>
            </View>
          </View>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
        </View>
      </SectionCard>

      {/* Bottom padding */}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
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
    color: '#ffffff',
    letterSpacing: -0.3,
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#555555',
    letterSpacing: 1.4,
    marginBottom: 16,
  },

  // Form fields
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#555555',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222222',
    padding: 14,
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222222',
    padding: 14,
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },

  // Buttons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222222',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '800',
  },
  dangerButton: {
    borderColor: '#2a1010',
    backgroundColor: '#150808',
  },
  dangerZone: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 16,
  },
  dangerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF4C4C',
    letterSpacing: 1.4,
    marginBottom: 12,
  },

  // Notifications / Switches
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1010',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a1515',
    padding: 12,
    marginBottom: 16,
  },
  permissionBannerText: {
    color: '#FF4C4C',
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
    borderBottomColor: '#1e1e1e',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  switchSub: {
    color: '#555555',
    fontSize: 11,
    marginTop: 2,
  },

  // AI Model
  modelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222222',
    padding: 16,
    marginBottom: 12,
  },
  modelBoxLeft: {
    marginRight: 16,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelBoxRight: {
    flex: 1,
  },
  modelName: {
    color: '#ffffff',
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
    color: '#444',
    fontSize: 11,
    marginTop: 4,
  },

  // Permissions
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  permInfo: {
    flex: 1,
  },
  permLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  permStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  grantButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  grantText: {
    color: '#58a6ff',
    fontSize: 12,
    fontWeight: '700',
  },

  // About
  aboutBox: {
    alignItems: 'center',
    padding: 8,
  },
  aboutAppName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 4,
  },
  aboutTagline: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 16,
    textAlign: 'center',
  },
  aboutBadges: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1f18',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a3a2a',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeText: {
    color: '#00C896',
    fontSize: 11,
    fontWeight: '700',
  },
  aboutVersion: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
