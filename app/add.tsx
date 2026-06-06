import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Transaction, TransactionCategory } from '../types';
import { insertTransaction, getUserProfile } from '../db/database';
import { useTheme } from '../hooks/useTheme';

const WINDOW_WIDTH = Dimensions.get('window').width;

export default function AddTransactionScreen() {
  const { colors } = useTheme();
  const [amountMinor, setAmountMinor] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory>('Other');
  const [date, setDate] = useState(new Date().toISOString());
  const [type, setType] = useState<'credit' | 'debit'>('debit');

  const params = useLocalSearchParams<{ tx?: string }>();

  useEffect(() => {
    loadDefaults();
  }, []);

  async function loadDefaults() {
    try {
      const profile = await getUserProfile();
      if (profile?.currency_code) {
        setCurrencyCode(profile.currency_code);
      }
    } catch (e) {
      console.error('Failed to load profile defaults:', e);
    }
  }

  useEffect(() => {
    if (params.tx) {
      try {
        const existing = JSON.parse(params.tx as string);
        setAmountMinor((existing.amount_minor / 100).toString());
        setCurrencyCode(existing.currency_code);
        setDescription(existing.description ?? '');
        setSource(existing.source || '');
        setSelectedCategory(existing.category as any ?? 'Other');
        setDate(existing.date);
        setType(existing.type);
      } catch (e) {}
    }
  }, [params]);

  async function handleSubmit() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const amountVal = parseFloat(amountMinor);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    if (!source.trim()) {
      Alert.alert('Validation Error', 'Please specify a payment source (e.g. HDFC, Cash).');
      return;
    }

    try {
      const minorAmt = Math.round(amountVal * 100);
      const isEdit = !!params.tx;
      const id = isEdit ? JSON.parse(params.tx as string).id : `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', BRL: 'R$' };
      const currencySymbol = symbols[currencyCode.toUpperCase()] || '$';

      const transaction: Transaction = {
        id,
        amount_minor: minorAmt,
        currency_code: currencyCode,
        currency_symbol: currencySymbol,
        type,
        source: source.trim(),
        description: description.trim(),
        merchant: description.trim() || source.trim(),
        category: selectedCategory,
        date,
        raw_text: `Manually added/edited transaction.`,
        capture_method: 'manual',
        language_detected: 'en',
        is_verified: true,
        created_at: new Date().toISOString()
      };

      await insertTransaction(transaction);
      router.back();
    } catch (error) {
      console.error('Failed to save manual transaction:', error);
      Alert.alert('Error', 'Failed to save transaction.');
    }
  }

  const handleCategoryPress = (cat: TransactionCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedCategory(cat);
  };

  const handleTypePress = (newType: 'credit' | 'debit') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setType(newType);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };

  const categories: TransactionCategory[] = [
    'Food', 'Transport', 'Shopping', 'Entertainment', 'Health',
    'Utilities', 'Transfer', 'Salary', 'Refund', 'Other'
  ];

  const categoryEmojis: Record<string, string> = {
    Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
    Health: '💊', Utilities: '💡', Transfer: '💸', Salary: '💰', Refund: '🔄', Other: '📦',
  };

  const currencySymbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', BRL: 'R$'
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Bottom Sheet Drag Handle */}
      <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {params.tx ? 'Edit Expense' : 'Add Expense'}
        </Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close-outline" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>AMOUNT</Text>
        <View style={[styles.amountInputRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.currencyPrefix, { color: colors.foreground }]}>
            {currencySymbols[currencyCode.toUpperCase()] || currencyCode}
          </Text>
          <TextInput
            style={[styles.amountInput, { color: colors.foreground }]}
            placeholder="0.00"
            placeholderTextColor={colors.secondary}
            keyboardType="decimal-pad"
            value={amountMinor}
            onChangeText={setAmountMinor}
            maxLength={10}
            autoFocus
          />
        </View>
      </View>

      {/* Type Selector (Credit/Debit) */}
      <View style={[styles.typeSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            type === 'debit' && [styles.typeButtonActive, { backgroundColor: colors.primary }]
          ]}
          onPress={() => handleTypePress('debit')}
        >
          <Text style={[styles.typeText, type === 'debit' && styles.typeTextActive]}>Expense / Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeButton,
            type === 'credit' && [styles.typeButtonActive, { backgroundColor: colors.primary }]
          ]}
          onPress={() => handleTypePress('credit')}
        >
          <Text style={[styles.typeText, type === 'credit' && styles.typeTextActive]}>Income / In</Text>
        </TouchableOpacity>
      </View>

      {/* Source */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>PAYMENT SOURCE</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          placeholder="e.g. Cash, HDFC Card, Venmo"
          placeholderTextColor={colors.secondary}
          value={source}
          onChangeText={setSource}
        />
      </View>

      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>DESCRIPTION / MERCHANT</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          placeholder="What did you buy?"
          placeholderTextColor={colors.secondary}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Date */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>DATE (YYYY-MM-DD)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          value={date.split('T')[0]}
          onChangeText={(val) => setDate(val + 'T' + new Date().toISOString().split('T')[1])}
        />
      </View>

      {/* Category Selector Grid */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1
                  }
                ]}
                onPress={() => handleCategoryPress(cat)}
              >
                <Text style={styles.categoryEmoji}>{categoryEmojis[cat]}</Text>
                <Text style={[
                  styles.categoryText,
                  { color: isSelected ? colors.foreground : colors.secondary }
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.primary }]}
        onPress={handleSubmit}
        activeOpacity={0.8}
      >
        <Text style={styles.saveText}>Save Transaction</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 48,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: 12,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  typeButtonActive: {
    // shadow effects or active state styling handled inline
  },
  typeText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  typeTextActive: {
    color: '#ffffff',
  },
  input: {
    borderRadius: 12, // Consistent border radius of 12px for inputs
    padding: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: (WINDOW_WIDTH - 56) / 2, // 2 items per row
    borderRadius: 16, // Consistent border radius of 16px for cards
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
});
