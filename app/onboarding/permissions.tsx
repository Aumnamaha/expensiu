import { useRouter, Href } from "expo-router";
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

interface LocalAuthenticationType {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
}

const LocalAuthentication = require('expo-local-authentication') as LocalAuthenticationType;

export default function PermissionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [smsGranted, setSmsGranted] = useState(false);
  const [notificationListenerGranted, setNotificationListenerGranted] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    // Check initial biometric state
    LocalAuthentication.hasHardwareAsync().then(hasHardware => {
      LocalAuthentication.isEnrolledAsync().then(isEnrolled => {
        setBiometricAvailable(hasHardware && isEnrolled);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  async function handlePermissionRequests(): Promise<void> {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Request SMS permission (Android only)
    try {
      if ((require('react-native').Platform as any).OS === 'android') {
        const smsResult = await require('react-native').PermissionsAndroid.request(
          'android.permission.READ_SMS'
        );
        setSmsGranted(smsResult === 'granted');
      } else {
        setSmsGranted(true);
      }
    } catch (error) {
      console.error('SMS permission failed:', error);
      setSmsGranted(false);
    }

    // Request notification permission
    try {
      const { status } = await require('expo-notifications').requestPermissionsAsync();
      setNotificationListenerGranted(status === 'granted');
    } catch (error) {
      console.error('Notification permission failed:', error);
      setNotificationListenerGranted(false);
    }

    // Check biometric availability
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
    } catch (error) {
      console.error('Biometric check failed:', error);
      setBiometricAvailable(false);
    }

    // Navigate to questionnaire
    router.replace('/onboarding/questionnaire' as Href);
  }

  const allGranted = smsGranted && notificationListenerGranted && biometricAvailable;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={[styles.title, { color: colors.foreground }]}>Enable Permissions</Text>
      <Text style={styles.subtitle}>Allow ExpensiU to access necessary features</Text>
 
      {/* Permission Cards */}
      <View style={[styles.permissionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.permissionIcon, smsGranted ? styles.granted : styles.pending]}>
          <Ionicons 
            name={smsGranted ? "checkmark-sharp" : "chatbubble-ellipses-outline"} 
            size={18} 
            color="#fff" 
          />
        </View>
        <View style={styles.permissionInfo}>
          <Text style={[styles.permissionTitle, { color: colors.foreground }]}>SMS Access</Text>
          <Text style={styles.permissionDesc}>Parse incoming SMS notifications for transactions</Text>
          <Text style={styles.permissionNote}>Required: READ_SMS, RECEIVE_SMS</Text>
        </View>
      </View>

      <View style={[styles.permissionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.permissionIcon, notificationListenerGranted ? styles.granted : styles.pending]}>
          <Ionicons 
            name={notificationListenerGranted ? "checkmark-sharp" : "notifications-outline"} 
            size={18} 
            color="#fff" 
          />
        </View>
        <View style={styles.permissionInfo}>
          <Text style={[styles.permissionTitle, { color: colors.foreground }]}>Notifications</Text>
          <Text style={styles.permissionDesc}>Receive push notifications and summaries</Text>
          <Text style={styles.permissionNote}>Required: Notification permissions</Text>
        </View>
      </View>

      <View style={[styles.permissionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.permissionIcon, biometricAvailable ? styles.granted : styles.pending]}>
          <Ionicons 
            name={biometricAvailable ? "checkmark-sharp" : "lock-closed-outline"} 
            size={18} 
            color="#fff" 
          />
        </View>
        <View style={styles.permissionInfo}>
          <Text style={[styles.permissionTitle, { color: colors.foreground }]}>Biometric Lock</Text>
          <Text style={styles.permissionDesc}>Secure access with fingerprint/Face ID</Text>
          <Text style={styles.permissionNote}>Required: USE_BIOMETRIC, USE_FINGERPRINT</Text>
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          { backgroundColor: colors.primary },
          allGranted && { backgroundColor: '#10B981' }
        ]}
        onPress={handlePermissionRequests}
      >
        <Text style={styles.buttonText}>
          {allGranted ? '✓ Proceed to Questionnaire' : 'Enable Permissions & Continue'}
        </Text>
      </TouchableOpacity>

      {/* Data Privacy Notice */}
      <View style={[styles.noticeContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.noticeIcon}>🛡️</Text>
        <Text style={styles.noticeText}>
          ExpensiU never sends your data to any server. All processing happens locally on your device.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 32 },
  permissionCard: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 16, alignItems: 'center', gap: 16 },
  permissionIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  granted: { backgroundColor: '#10B981' },
  pending: { backgroundColor: '#F59E0B' },
  permissionInfo: { flex: 1 },
  permissionTitle: { fontSize: 16, fontWeight: '700' },
  permissionDesc: { fontSize: 13, color: '#64748b', marginTop: 2, lineHeight: 18 },
  permissionNote: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  actionButton: { borderRadius: 30, paddingVertical: 18, alignItems: 'center', marginTop: 24, marginBottom: 32 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  noticeContainer: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 18, alignItems: 'center' },
  noticeIcon: { fontSize: 24, marginRight: 12 },
  noticeText: { flex: 1, color: '#64748b', fontSize: 14, lineHeight: 20 }
});
