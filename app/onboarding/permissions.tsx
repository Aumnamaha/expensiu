import { useRouter } from "expo-router";
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';

export default function PermissionsScreen() {
  const router = useRouter();
  const [smsGranted, setSmsGranted] = useState(false);
  const [notificationListenerGranted, setNotificationListenerGranted] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  async function handlePermissionRequests(): Promise<void> {
    // Request SMS permission (Android)
    try {
      const smsPermission = require('expo-file-system').requestPermissionsAsync({ readMediaPermission: true });
      setSmsGranted(true);
    } catch (error) {
      console.error('SMS permission failed:', error);
    }

    // Request notification permission
    try {
      const notifPermissions = require('expo-notifications').getPermissionsAsync();
      setNotificationListenerGranted(true);
    } catch (error) {
      console.error('Notification permission failed:', error);
    }

    // Check biometric availability
    try {
      const auth = require('expo-local-authentication');
      const enrolled = await auth.isDeviceEnrolledAsync();
      setBiometricAvailable(enrolled?.supportedType !== false);
    } catch (error) {
      console.error('Biometric check failed:', error);
    }

    Alert.alert('Permissions', 'Permission requests have been submitted.');
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Enable Permissions</Text>
      <Text style={styles.subtitle}>Allow ExpensiU to access necessary features</Text>

      {/* Permission Cards */}
      <View style={styles.permissionCard}>
        <View style={[styles.permissionIcon, smsGranted ? styles.granted : styles.pending]}>
          <Text>{smsGranted ? '✓' : '?'}</Text>
        </View>
        <View style={styles.permissionInfo}>
          <Text style={styles.permissionTitle}>SMS Access</Text>
          <Text style={styles.permissionDesc}>Parse incoming SMS notifications for transactions</Text>
          <Text style={styles.permissionNote}>Required: READ_SMS, RECEIVE_SMS</Text>
        </View>
      </View>

      <View style={styles.permissionCard}>
        <View style={[styles.permissionIcon, notificationListenerGranted ? styles.granted : styles.pending]}>
          <Text>{notificationListenerGranted ? '✓' : '?'}</Text>
        </View>
        <View style={styles.permissionInfo}>
          <Text style={styles.permissionTitle}>Notifications</Text>
          <Text style={styles.permissionDesc}>Receive push notifications and summaries</Text>
          <Text style={styles.permissionNote}>Required: Notification permissions</Text>
        </View>
      </View>

      <View style={styles.permissionCard}>
        <View style={[styles.permissionIcon, biometricAvailable ? styles.granted : styles.pending]}>
          <Text>{biometricAvailable ? '✓' : '🔒'}</Text>
        </View>
        <View style={styles.permissionInfo}>
          <Text style={styles.permissionTitle}>Biometric Lock</Text>
          <Text style={styles.permissionDesc}>Secure access with fingerprint/Face ID</Text>
          <Text style={styles.permissionNote}>Required: USE_BIOMETRIC, USE_FINGERPRINT</Text>
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.actionButton, smsGranted && notificationListenerGranted && biometricAvailable ? styles.grActionButton : styles.disabledButton]}
        onPress={() => { handlePermissionRequests(); router.push("/onboarding/model-download"); }}
        disabled={false}
      >
        {smsGranted && notificationListenerGranted && biometricAvailable ? (
          <Text style={{ color: '#fff' }}>✓ Proceed to AI Model</Text>
        ) : (
          <Text style={{ color: '#8b949e' }}>Enable All Permissions</Text>
        )}
      </TouchableOpacity>

      {/* Data Privacy Notice */}
      <View style={styles.noticeContainer}>
        <Text style={styles.noticeIcon}>🔒</Text>
        <Text style={styles.noticeText}>
          ExpensiU never sends your data to any server. All processing happens on your device.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#e0e0e0', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#8b949e' },
  permissionCard: { flexDirection: 'row', backgroundColor: '#161b22', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center', gap: 12 },
  permissionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#30363d', justifyContent: 'center', alignItems: 'center', fontSize: 20 },
  granted: { backgroundColor: '#4ade80' },
  pending: { backgroundColor: '#fbbf24' },
  permissionInfo: { flex: 1 },
  permissionTitle: { fontSize: 16, fontWeight: 'bold', color: '#e0e0e0' },
  permissionDesc: { fontSize: 13, color: '#8b949e', marginTop: 2 },
  permissionNote: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  actionButton: { backgroundColor: '#1f6feb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 32 },
  grActionButton: { backgroundColor: '#4ade80' },
  disabledButton: { opacity: 0.5 },
  noticeContainer: { flexDirection: 'row', backgroundColor: '#1f2937', borderRadius: 12, padding: 16, alignItems: 'center' },
  noticeIcon: { fontSize: 24, marginRight: 12 },
  noticeText: { flex: 1, color: '#8b949e', fontSize: 14 },
});
