import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { importCSV, importOFX, importPDF } from '../services/statementImporter';
import type { Transaction } from '../types';

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
    accentColor: '#00C896',
    mimeTypes: ['.csv', '.xls', '.xlsx', '*/*'],
  },
  {
    id: 'ofx',
    icon: 'server-outline',
    title: 'OFX / QFX',
    subtitle: 'US, UK, Australian banks',
    accentColor: '#58a6ff',
    mimeTypes: ['.ofx', '.qfx', '*/*'],
  },
  {
    id: 'pdf',
    icon: 'document-outline',
    title: 'PDF Statement',
    subtitle: 'Any bank statement PDF',
    accentColor: '#d29922',
    mimeTypes: ['.pdf'],
  },
];

export default function ImportStatementsScreen() {
  const [loading, setLoading] = useState<ImportType | null>(null);
  const [lastResult, setLastResult] = useState<{
    type: ImportType;
    count: number;
  } | null>(null);

  async function handleImport(importType: ImportType) {
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
        Alert.alert(
          'Nothing Imported',
          'No new transactions were found in the file. The file may be empty, already imported, or in an unsupported format.',
        );
      } else {
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
      Alert.alert('Import Error', error?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Statement</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* SUBTITLE */}
      <Text style={styles.subtitle}>
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
                wasSuccess && { borderColor: item.accentColor },
              ]}
              onPress={() => handleImport(item.id)}
              disabled={loading !== null}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${item.accentColor}18` }]}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={item.accentColor} />
                ) : wasSuccess ? (
                  <Ionicons name="checkmark-circle" size={28} color={item.accentColor} />
                ) : (
                  <Ionicons name={item.icon} size={28} color={item.accentColor} />
                )}
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>

              {wasSuccess && lastResult && (
                <View style={[styles.successBadge, { backgroundColor: `${item.accentColor}18` }]}>
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
      <View style={styles.privacyBanner}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#00C896" style={{ marginRight: 10 }} />
        <View style={styles.privacyText}>
          <Text style={styles.privacyTitle}>100% Private</Text>
          <Text style={styles.privacyDesc}>
            Your file is read locally and immediately discarded. ExpensiU never stores your original file.
          </Text>
        </View>
      </View>

      {/* Supported formats note */}
      <Text style={styles.formatNote}>
        Supported: .csv, .xlsx, .ofx, .qfx, .pdf
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
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
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#555555',
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
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    padding: 16,
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
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#555555',
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
    backgroundColor: '#0d1f18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a3a2a',
    padding: 16,
    marginBottom: 16,
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    color: '#00C896',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  privacyDesc: {
    color: '#3d6b56',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  formatNote: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
