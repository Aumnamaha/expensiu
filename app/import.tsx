import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { importCSV, importOFX, importPDF } from '../services/statementImporter';
import type { Transaction } from '../types';
import { useTheme } from '../hooks/useTheme';

type ImportType = 'csv' | 'ofx' | 'pdf';

const IMPORT_TYPES: {
  id: ImportType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accentColor: string;
  mimeTypes: ("*/*" | `.${string}`)[];
}[] = [
  {
    id: 'csv',
    icon: 'document-text-outline',
    title: 'CSV / Excel',
    subtitle: 'Most banks worldwide',
    accentColor: '#10B981',
    mimeTypes: ['.csv', '.xls', '.xlsx', '*/*'],
  },
  {
    id: 'ofx',
    icon: 'server-outline',
    title: 'OFX / QFX',
    subtitle: 'US, UK, Australian banks',
    accentColor: '#3b82f6',
    mimeTypes: ['.ofx', '.qfx', '*/*'],
  },
  {
    id: 'pdf',
    icon: 'document-outline',
    title: 'PDF Statement',
    subtitle: 'Any bank statement PDF',
    accentColor: '#fbbf24',
    mimeTypes: ['.pdf'],
  },
];

export default function ImportStatementsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState<ImportType | null>(null);
  const [lastResult, setLastResult] = useState<{
    type: ImportType;
    count: number;
  } | null>(null);

  async function handleImport(importType: ImportType) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const importConfig = IMPORT_TYPES.find((t) => t.id === importType)!;
    setLoading(importType);
    setLastResult(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: importConfig.mimeTypes,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setLoading(null);
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        Alert.alert('Error', 'Could not read the selected file.');
        setLoading(null);
        return;
      }

      const uri = asset.uri;
      let importedTransactions: Transaction[] = [];

      switch (importType) {
        case 'csv':
          importedTransactions = await importCSV(uri);
          break;
        case 'ofx':
          importedTransactions = await importOFX(uri);
          break;
        case 'pdf':
          importedTransactions = await importPDF(uri);
          break;
      }

      const count = importedTransactions.length;
      setLastResult({ type: importType, count });

      if (count === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert(
          'Nothing Imported',
          'No new transactions were found in the file. The file may be empty, already imported, or in an unsupported format.',
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
          'Import Complete',
          `${count} new transaction${count !== 1 ? 's' : ''} imported. All stored locally on your device.`,
          [
            { text: 'View Transactions', onPress: () => router.push('/summary?period=monthly') },
            { text: 'Done', style: 'cancel' },
          ],
        );
      }
    } catch (error: any) {
      console.error(`Import ${importType} failed:`, error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Import Error', error?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(null);
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Import Statement</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* SUBTITLE */}
      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        Pick a file from your device. All parsing happens locally — your data never leaves.
      </Text>

      {/* IMPORT OPTION CARDS */}
      <View style={styles.cardGrid}>
        {IMPORT_TYPES.map((item) => {
          const isLoading = loading === item.id;
          const wasSuccess = lastResult?.type === item.id;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.importCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                wasSuccess && { borderColor: item.accentColor },
              ]}
              onPress={() => handleImport(item.id)}
              disabled={loading !== null}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${item.accentColor}15` }]}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={item.accentColor} />
                ) : wasSuccess ? (
                  <Ionicons name="checkmark-circle" size={28} color={item.accentColor} />
                ) : (
                  <Ionicons name={item.icon} size={28} color={item.accentColor} />
                )}
              </View>

              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>{item.subtitle}</Text>

              {wasSuccess && lastResult && (
                <View style={[styles.successBadge, { backgroundColor: `${item.accentColor}15` }]}>
                  <Text style={[styles.successBadgeText, { color: item.accentColor }]}>
                    {lastResult.count} imported
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* PRIVACY BADGE */}
      <View style={[styles.privacyBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} style={{ marginRight: 12, marginTop: 2 }} />
        <View style={styles.privacyText}>
          <Text style={[styles.privacyTitle, { color: colors.success }]}>100% Private</Text>
          <Text style={[styles.privacyDesc, { color: colors.secondary }]}>
            Your file is read locally and immediately discarded. ExpensiU never stores your original file.
          </Text>
        </View>
      </View>

      {/* Supported formats note */}
      <Text style={[styles.formatNote, { color: colors.secondary }]}>
        Supported: .csv, .xlsx, .ofx, .qfx, .pdf
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  subtitle: {
    fontSize: 13,
    marginBottom: 28,
    lineHeight: 20,
    fontWeight: '500',
  },
  cardGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 32,
  },
  importCard: {
    flex: 1,
    borderRadius: 16, // Consistent border radius of 16px for cards
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  successBadge: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  successBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16, // Consistent border radius of 16px for cards
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  privacyDesc: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  formatNote: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
