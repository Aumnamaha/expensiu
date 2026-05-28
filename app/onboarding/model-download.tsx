import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';

// ============================================================================
// Onboarding Model Download Screen
// ============================================================================

// Note: The AI model is required for multilingual parsing (ISO 639-1 language detection).
// Without it, the app can only parse English transactions using regex fallback.
// This screen cannot be skipped - users must download the model to unlock full features.

const MODEL_SIZE_MB = 300; // Approximate size of Qwen2.5 0.5B model

export default function ModelDownloadScreen() {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [wifiStatus, setWifiStatus] = useState<'connected' | 'disconnected'>(
    require('@react-native-community/netinfo').fetch().isInternetReachable ? 'connected' : 'disconnected'
  );
  const [stepText, setStepText] = useState('Ready to download');

  useEffect(() => {
    // Auto-navigate if model already downloaded
    checkModelStatus();
  }, []);

  async function checkModelStatus() {
    try {
      await require('@/services/aiEngine').isModelDownloaded();

      // Model exists - navigate to permissions screen automatically
      await require('expo-router').link('/onboarding/permissions');
    } catch (error) {
      console.log('Model not yet downloaded, showing download screen');
    }
  }

  async function handleStartDownload() {
    if (wifiStatus === 'disconnected') {
      Alert.alert(
        'No WiFi Connection',
        'Connect to WiFi to continue downloading the AI model.',
        [{ text: 'OK' }]
      );
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    setStepText('Checking model...');

    try {
      // Step 1: Check if already downloaded
      await require('@/services/aiEngine').isModelDownloaded();

      // Model exists - complete automatically
      Alert.alert(
        'Model Ready!',
        'Your AI brain is ready to go. Navigating to permissions...',
        [
          {
            text: 'OK',
            onPress: () => require('expo-router').link('/onboarding/permissions'),
          },
        ]
      );

    } catch (error) {
      // Not downloaded yet - start download
      console.log('Starting model download...');
      setStepText('Downloading model...');
      await require('@/services/aiEngine').downloadModel(updateProgress);

      setStepText('Verifying download...');
      await verifyModel();

      setStepText('Ready!');
    } finally {
      setDownloading(false);
    }
  }

  function updateProgress(percent: number) {
    setDownloadProgress(percent);
  }

  async function verifyModel() {
    // Wait briefly to show "Verifying" state (in real app, this would be actual verification)
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Verify model exists
      // Check if model file exists by trying to read its metadata
      try {
        const cacheDir = require('expo-file-system').cacheDirectory;
        const modelPath = cacheDir ? `${cacheDir}/MLC/qwen2.5-0.5b.onnx` : '';
        const stat = await require('expo-file-system').statAsync(modelPath || '');

        if (!stat || stat.size === 0) {
          throw new Error('Model verification failed');
        }

        console.log(`Model verified. Size: ${(stat.size / (1024 * 1024)).toFixed(1)}MB`);
      } catch (error) {
        throw new Error('Model not found at expected location');
      }

    } catch (error: any) {
      Alert.alert(
        'Download Failed',
        error?.message || String(error) || 'Unable to verify model download.',
        [{ text: 'Retry', onPress: handleStartDownload }]
      );
      setDownloading(false);
      throw new Error(String(error));
    }
  }

  const progressPercent = downloadProgress;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🧠</Text>
      </View>

      {/* Header */}
      <Text style={styles.title}>Setting up your AI brain</Text>
      <Text style={styles.subtitle}>One-time download (~{MODEL_SIZE_MB}MB). After this, everything runs on your device. Forever offline.</Text>

      {/* WiFi Status Indicator */}
      {wifiStatus === 'connected' ? (
        <View style={[styles.statusContainer, styles.statusConnected]}>
          <Text style={styles.statusIcon}>✅</Text>
          <Text style={styles.statusText}>WiFi connected</Text>
        </View>
      ) : (
        <View style={[styles.statusContainer, styles.statusDisconnected]}>
          <Text style={styles.statusIcon}>📶</Text>
          <Text style={styles.statusText}>Connect to WiFi to continue</Text>
        </View>
      )}

      {/* Download Button */}
      <TouchableOpacity
        style={[
          styles.downloadButton,
          downloading && { opacity: 0.7 },
        ]}
        onPress={handleStartDownload}
        disabled={downloading || wifiStatus === 'disconnected'}
      >
        {downloading ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.buttonText}>{stepText}</Text>
          </>
        ) : (
          <Text style={styles.buttonText}>Download AI Model</Text>
        )}
      </TouchableOpacity>

      {/* Progress Bar */}
      {downloadProgress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%`, backgroundColor: progressPercent >= 100 ? '#4ade80' : '#60a5fa' },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progressPercent)}%</Text>
        </View>
      )}

      {/* Info Cards */}
      <View style={styles.infoContainer}>
        <InfoCard icon="🔒" title="100% Private" desc="Model stays on your device" />
        <InfoCard icon="⚡" title="Fast AI" desc="No internet needed after download" />
        <InfoCard icon="🌍" title="Multilingual" desc="Works in 20+ languages" />
      </View>

      {/* Warning for skipping */}
      <View style={styles.warningContainer}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>This screen cannot be skipped. The AI is required for multilingual parsing and advanced features.</Text>
      </View>
    </ScrollView>
  );
}

// ============================================================================
// Info Card Component
// ============================================================================

function InfoCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoDesc}>{desc}</Text>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  logoContainer: { marginBottom: 24, marginTop: -80 },
  logoIcon: { fontSize: 80, textAlign: 'center' },
  title: { color: '#e0e0e0', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginVertical: 16 },
  subtitle: { color: '#8b949e', fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  statusContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'flex-start' },
  statusIcon: { fontSize: 20 },
  statusText: { color: '#8b949e', fontSize: 13, marginLeft: 8 },
  statusConnected: { backgroundColor: '#166534' },
  statusDisconnected: { backgroundColor: '#991b1b' },
  downloadButton: { backgroundColor: '#1f6feb', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, marginBottom: 16, width: '100%', alignItems: 'center', maxWidth: 280 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  progressContainer: { flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: 32 },
  progressBarBg: { height: 8, borderRadius: 4, backgroundColor: '#30363d', overflow: 'hidden', width: '100%', maxWidth: 280 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressText: { marginTop: 8, color: '#e0e0e0', fontSize: 16 },
  infoContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  infoCard: { alignItems: 'center', marginHorizontal: 12 },
  infoIcon: { fontSize: 32, marginBottom: 8 },
  infoTitle: { color: '#e0e0e0', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  infoDesc: { color: '#8b949e', fontSize: 12, textAlign: 'center', marginTop: 4 },
  warningContainer: { backgroundColor: '#301a1a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, maxWidth: 300 },
  warningIcon: { fontSize: 32, marginBottom: 8 },
  warningText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
