import { useState, useEffect } from 'react';
import { getTransactionsByRange, getDB, deleteTransaction } from '@/db/database';
import type { Transaction } from '@/types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions(): Promise<void> {
    try {
      // Get last 30 days of transactions
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const txs: any[] = await getTransactionsByRange(new Date(thirtyDaysFromNow), new Date()) as any[];
      setTransactions(txs || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  }

  async function addTransaction(transaction: any): Promise<void> {
    try {
      const db = await getDB();
      await db.runAsync(`
        INSERT INTO transactions (
          id, amount_minor, currency_code, currency_symbol, type, source,
          description, merchant, category, date, raw_text, capture_method,
          language_detected, is_verified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transaction.id || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        (transaction as any).amount_minor || 0,
        (transaction as any).currency_code || 'USD',
        '$',
        (transaction as any).type || 'debit',
        'manual',
        (transaction as any).description || '',
        (transaction as any).merchant || '',
        (transaction as any).category || 'Other',
        (transaction as any).date || new Date().toISOString(),
        (transaction as any).raw_text || '',
        (transaction as any).capture_method || 'manual',
        (transaction as any).language_detected || 'en',
        0,
        new Date().toISOString(),
      ]);

      fetchTransactions(); // Refresh list
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  }

  async function deleteTransactionById(id: string): Promise<void> {
    await deleteTransaction(id);
    fetchTransactions(); // Refresh list
  }

  async function verifyTransaction(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.runAsync(`UPDATE transactions SET is_verified = 1 WHERE id = ?`, [id]);
      fetchTransactions();
    } catch (error) {
      console.error('Failed to verify transaction:', error);
    }
  }

  async function markAsDuplicate(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.runAsync(`UPDATE transactions SET is_verified = 0 WHERE id = ?`, [id]);
    } catch (error) {
      console.error('Failed to mark as duplicate:', error);
    }
  }

  return {
    transactions,
    addTransaction,
    deleteTransactionById,
    verifyTransaction,
    markAsDuplicate,
  };
}
