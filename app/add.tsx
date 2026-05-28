import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Transaction, TransactionCategory } from '../types';
import { insertTransaction, getUserProfile } from '../db/database';

const WINDOW_WIDTH = Dimensions.get('window').width;

export default function AddTransactionScreen() {
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

      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
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

  const categories: TransactionCategory[] = [
    'Food', 'Transport', 'Shopping', 'Entertainment', 'Health',
    'Utilities', 'Transfer', 'Salary', 'Refund', 'Other'
  ];

  const categoryEmojis: Record<string, string> = {
    Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
    Health: '💊', Utilities: '💡', Transfer: '💸', Salary: '💰', Refund: '🔄', Other: '📦',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{params.tx ? 'Edit Expense' : 'Add Expense'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>AMOUNT</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.currencyPrefix}>{currencyCode === 'INR' ? '₹' : '$'}</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor="#333"
            keyboardType="decimal-pad"
            value={amountMinor}
            onChangeText={setAmountMinor}
            maxLength={10}
            autoFocus
          />
        </View>
      </View>

      {/* Type Selector (Credit/Debit) */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, type === 'debit' && styles.typeButtonActive]}
          onPress={() => setType('debit')}
        >
          <Text style={[styles.typeText, type === 'debit' && styles.typeTextActive]}>Expense / Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, type === 'credit' && styles.typeButtonActive]}
          onPress={() => setType('credit')}
        >
          <Text style={[styles.typeText, type === 'credit' && styles.typeTextActive]}>Income / In</Text>
        </TouchableOpacity>
      </View>

      {/* Source */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>PAYMENT SOURCE</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Cash, HDFC Card, Venmo"
          placeholderTextColor="#444"
          value={source}
          onChangeText={setSource}
        />
      </View>

      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>DESCRIPTION / MERCHANT</Text>
        <TextInput
          style={styles.input}
          placeholder="What did you buy?"
          placeholderTextColor="#444"
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Date */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>DATE (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={date.split('T')[0]}
          onChangeText={(val) => setDate(val + 'T' + new Date().toISOString().split('T')[1])}
        />
      </View>

      {/* Category Selector Grid */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryCard,
                selectedCategory === cat && styles.categoryCardActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={styles.categoryEmoji}>{categoryEmojis[cat]}</Text>
              <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
        <Text style={styles.saveText}>Save Transaction</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  content: {
    padding: 20,
    paddingTop: 64,
    paddingBottom: 48,
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
    color: '#ffffff',
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
    color: '#555555',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    paddingBottom: 8,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#222222',
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  typeButtonActive: {
    backgroundColor: '#ffffff',
  },
  typeText: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '700',
  },
  typeTextActive: {
    color: '#080808',
  },
  input: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#222222',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: (WINDOW_WIDTH - 56) / 2, // 2 items per row
    backgroundColor: '#121212',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222222',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryCardActive: {
    borderColor: '#ffffff',
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  categoryText: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#080808',
  },
});
