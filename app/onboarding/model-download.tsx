import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { PremiumAlert } from '../../components/PremiumAlert';

const MODEL_SIZE_MB = 300;

export default function ModelDownloadScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [stepText, setStepText] = useState('Checking model...');

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<any[]>([]);

  useEffect(() => {
    checkModelStatus();
  }, []);

  function showCustomAlert(title: string, message: string, buttons?: any[]) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(buttons || []);
    setAlertVisible(true);
  }

  async function checkModelStatus() {
    try {
      const downloaded = await require('../../services/aiEngine').isModelDownloaded();
      setModelLoaded(downloaded);
      setStepText(downloaded ? 'Model downloaded' : 'Ready to download');
    } catch (error) {
      console.log('Error checking model status:', error);
      setStepText('Ready to download');
    }
  }

  async function handleStartDownload() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDownloading(true);
    setDownloadProgress(0);
    setStepText('Checking WiFi connection...');

    try {
      // WiFi check happens inside services/aiEngine
      console.log('Starting model download...');
      setStepText('Downloading model (~300MB)...');
      await require('../../services/aiEngine').downloadModel(updateProgress);

      setStepText('Verifying model...');
      await verifyModel();

      setModelLoaded(true);
      setStepText('Ready!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      showCustomAlert(
        'Download Complete',
        'Your local AI model has been successfully downloaded.',
        [{ text: 'OK', onPress: handleBack }]
      );
    } catch (error: any) {
      console.error('Download error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      
      showCustomAlert(
        'Download Failed',
        error?.message || String(error) || 'Unable to download model.',
        [
          { text: 'Retry', onPress: handleStartDownload },
          { text: 'Cancel', style: 'cancel', onPress: () => setAlertVisible(false) }
        ]
      );
    } finally {
      setDownloading(false);
    }
  }

  function updateProgress(percent: number) {
    setDownloadProgress(percent);
  }

  async function verifyModel() {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const { MODEL_LOCAL_PATH } = require('../../services/aiEngine');
      const fileInfo = await require('expo-file-system').getInfoAsync(MODEL_LOCAL_PATH);
      if (!fileInfo || !fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Model verification failed');
      }
    } catch (error) {
      throw new Error('Model not found at expected location');
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };


  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>AI Model Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🧠</Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.foreground }]}>Local AI Model</Text>
      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        One-time download (~{MODEL_SIZE_MB}MB). After download, your AI works entirely offline.
      </Text>

      {/* Status Card */}
      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons
          name={modelLoaded ? 'checkmark-circle' : 'cloud-download-outline'}
          size={36}
          color={modelLoaded ? colors.success : colors.secondary}
          style={{ marginBottom: 12 }}
        />
        <Text style={[styles.statusTitle, { color: colors.foreground }]}>
          {modelLoaded ? 'AI Model Ready' : 'Download Required'}
        </Text>
        <Text style={[styles.statusDesc, { color: colors.secondary }]}>
          {modelLoaded
            ? 'Qwen 2.5 0.5B model is active. multilingual transaction parsing is enabled.'
            : 'Multilingual statement parsing requires downloading the local AI brain.'}
        </Text>
      </View>

      {/* Action Section */}
      <View style={styles.actionContainer}>
        {modelLoaded ? (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.success }]}
            onPress={handleBack}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              downloading && { opacity: 0.7 }
            ]}
            onPress={handleStartDownload}
            disabled={downloading}
          >
            {downloading ? (
              <View style={styles.row}>
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>{Math.round(downloadProgress)}%</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Download Model</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      {downloading && downloadProgress > 0 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${downloadProgress}%`, backgroundColor: colors.primary }
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.foreground }]}>{stepText}</Text>
        </View>
      )}

      {/* Warning for Skipping during onboarding (kept only as secondary info) */}
      {!modelLoaded && !downloading && (
        <View style={[styles.warningBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="wifi-outline" size={20} color={colors.secondary} style={{ marginBottom: 4 }} />
          <Text style={[styles.warningText, { color: colors.secondary }]}>
            Please connect to WiFi. Download is around 300MB.
          </Text>
        </View>
      )}

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
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 64, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
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
  logoContainer: { marginBottom: 16, marginTop: 12 },
  logoIcon: { fontSize: 80 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 22, maxWidth: 300 },
  statusCard: {
    width: '100%',
    borderRadius: 16, // Consistent border radius of 16px for cards
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  statusDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  actionContainer: { width: '100%', alignItems: 'center' },
  button: {
    width: '100%',
    maxWidth: 280,
    paddingVertical: 16,
    borderRadius: 30, // Button radius
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center' },
  progressContainer: { width: '100%', maxWidth: 280, marginTop: 24, alignItems: 'center' },
  progressBarBg: { height: 6, borderRadius: 3, width: '100%', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressText: { marginTop: 10, fontSize: 12, fontWeight: '600' },
  warningBox: {
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 32,
    maxWidth: 280,
  },
  warningText: { fontSize: 12, textAlign: 'center', fontWeight: '500' },
});
