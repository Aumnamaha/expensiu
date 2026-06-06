import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { TransactionCategory } from '../types';

// ============================================================================
// Database Constants
// ============================================================================

const DB_KEY = 'expensiu_db_key';
const DB_PATH = `${FileSystem.documentDirectory}.expensiu/data.db`;

// ============================================================================
// Types (must match types/index.ts definitions)
// ============================================================================

export interface Transaction {
  id: string;
  amount_minor: number;
  currency_code: string;
  currency_symbol: string;
  type: 'credit' | 'debit';
  source: string;
  description: string;
  merchant: string;
  category: TransactionCategory;
  date: string;
  raw_text: string;
  capture_method: 'sms' | 'notification' | 'import' | 'manual';
  language_detected: string;
  is_verified: boolean;
  created_at: string;
}

export interface UserProfile {
  id: number;
  name?: string;
  monthly_budget_minor?: number;
  currency_code?: string;
  currency_symbol?: string;
  locale?: string;
  ai_model_downloaded: boolean;
  ai_model_version?: string;
  created_at?: string;
}

export interface NotificationSummary {
  period: 'daily' | 'weekly' | 'monthly';
  total_credit_minor: number;
  total_debit_minor: number;
  net_balance_minor: number;
  currency_code: string;
  transaction_count: number;
  top_category: TransactionCategory;
  tone: 'winning' | 'heads_up' | 'warning' | 'critical';
}

export interface DailySummaryRow {
  id: string;
  date: string;
  total_credit_minor?: number;
  total_debit_minor?: number;
  transaction_count?: number;
  top_category?: string;
  invalidated?: number;
  updated_at?: string;
}

export interface AISummary {
  period: 'weekly' | 'monthly';
  content: string;
  period_key: string;
  created_at: string;
}

// ============================================================================
// Database Singleton
// ============================================================================

let dbInstance: SQLite.SQLiteDatabase | null = null;

function generateRandomKey(): string {
  const arr = new Uint8Array(32);
  if (typeof global !== 'undefined' && (global as any).crypto && (global as any).crypto.getRandomValues) {
    (global as any).crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 32; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function initDB(): Promise<void> {
  try {
    let key = await SecureStore.getItemAsync(DB_KEY);
    if (!key) {
      key = generateRandomKey();
      await SecureStore.setItemAsync(DB_KEY, key);
    }

    // Hidden directory prefix comment: The .expensiu folder name prefix makes it hidden on most file explorers
    const dbDir = `${FileSystem.documentDirectory}.expensiu`;
    const dirInfo = await FileSystem.getInfoAsync(dbDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }

    dbInstance = await SQLite.openDatabaseAsync('data.db');
    
    // Pass key to SQLCipher
    await dbInstance.execAsync(`PRAGMA key = '${key}';`);
    
    await createTablesIfNotExists();
  } catch (e) {
    console.error('Failed to initialize database:', e);
    throw e;
  }
}

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance!;
}

// ============================================================================
// Database Helper Functions
// ============================================================================

async function createTablesIfNotExists(): Promise<void> {
  // ============================================================================
  // transactions table
  // ============================================================================
  const db = await getDB();
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        amount_minor INTEGER NOT NULL,
        currency_code TEXT NOT NULL,
        currency_symbol TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
        source TEXT,
        description TEXT,
        merchant TEXT,
        category TEXT,
        date TEXT NOT NULL,
        raw_text TEXT,
        capture_method TEXT CHECK (capture_method IN ('sms', 'notification', 'import', 'manual')),
        language_detected TEXT,
        is_verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )`);
  } catch (e) {
    console.error('Failed to create transactions table:', e);
  }

  // ============================================================================
  // user_profile table
  // ============================================================================
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name TEXT,
        monthly_budget_minor INTEGER,
        currency_code TEXT DEFAULT 'USD',
        currency_symbol TEXT DEFAULT '$',
        locale TEXT DEFAULT 'en',
        ai_model_downloaded INTEGER DEFAULT 0,
        ai_model_version TEXT,
        created_at TEXT
      )`);
  } catch (e) {
    console.error('Failed to create user_profile table:', e);
  }

  // ============================================================================
  // daily_summary_cache table
  // ============================================================================
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS daily_summary_cache (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        total_credit_minor INTEGER,
        total_debit_minor INTEGER,
        transaction_count INTEGER,
        top_category TEXT,
        invalidated INTEGER DEFAULT 0,
        updated_at TEXT
      )`);
  } catch (e) {
    console.error('Failed to create daily_summary_cache table:', e);
  }

  // ============================================================================
  // ai_summaries table
  // ============================================================================
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS ai_summaries (
        period TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        period_key TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);
  } catch (e) {
    console.error('Failed to create ai_summaries table:', e);
  }

  // Create indexes for faster queries
  try {
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
  } catch (e) {
    console.debug('Could not create date index:', e);
  }

  try {
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`);
  } catch (e) {
    console.debug('Could not create category index:', e);
  }

  try {
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_verified ON transactions(is_verified)`);
  } catch (e) {
    console.debug('Could not create verified index:', e);
  }
}

// ============================================================================
// Transaction Operations
// ============================================================================

export async function insertTransaction(tx: Transaction): Promise<void> {
  const db = await getDB();

  try {
    // Use runAsync for INSERT/UPDATE (doesn't return rows)
    await db.runAsync(
      `INSERT OR REPLACE INTO transactions (
        id, amount_minor, currency_code, currency_symbol, type, source,
        description, merchant, category, date, raw_text, capture_method,
        language_detected, is_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.amount_minor,
        tx.currency_code,
        tx.currency_symbol,
        tx.type,
        tx.source || '',
        tx.description || '',
        tx.merchant || '',
        tx.category || '',
        tx.date,
        tx.raw_text || '',
        tx.capture_method || 'manual',
        tx.language_detected || 'en',
        tx.is_verified ? 1 : 0,
        tx.created_at || new Date().toISOString(),
      ]
    );
  } catch (e) {
    console.error('Failed to insert transaction:', e);
  }
}

export async function getAllTransactions(
  limit: number = 100,
  offset: number = 0
): Promise<Transaction[]> {
  const db = await getDB();

  try {
    const rows = await db.getAllAsync<Transaction>(`
      SELECT * FROM transactions
      ORDER BY date DESC, id DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return rows.map(row => ({
      id: row.id || '',
      amount_minor: row.amount_minor || 0,
      currency_code: row.currency_code || '',
      currency_symbol: row.currency_symbol || '$',
      type: (row.type as 'credit' | 'debit') || 'debit',
      source: row.source || '',
      description: row.description || '',
      merchant: row.merchant || '',
      category: (row.category as TransactionCategory) || 'Other',
      date: row.date || '',
      raw_text: row.raw_text,
      capture_method: (row.capture_method as 'sms' | 'notification' | 'import' | 'manual') || 'manual',
      language_detected: row.language_detected || 'en',
      is_verified: !!row.is_verified,
      created_at: row.created_at,
    }));
  } catch (e) {
    console.error('Failed to get all transactions:', e);
    return [];
  }
}

export async function getTransactionsByRange(
  start: Date,
  end: Date
): Promise<Transaction[]> {
  const db = await getDB();
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  try {
    const rows = await db.getAllAsync<Transaction>(`
      SELECT * FROM transactions
      WHERE substr(date, 1, 10) BETWEEN ? AND ?
      ORDER BY date DESC, id DESC
    `, [startDate, endDate]);

    return rows.map(row => ({
      id: row.id || '',
      amount_minor: row.amount_minor || 0,
      currency_code: row.currency_code || '',
      currency_symbol: row.currency_symbol || '$',
      type: (row.type as 'credit' | 'debit') || 'debit',
      source: row.source || '',
      description: row.description || '',
      merchant: row.merchant || '',
      category: (row.category as TransactionCategory) || 'Other',
      date: row.date || '',
      raw_text: row.raw_text,
      capture_method: (row.capture_method as 'sms' | 'notification' | 'import' | 'manual') || 'manual',
      language_detected: row.language_detected || 'en',
      is_verified: !!row.is_verified,
      created_at: row.created_at,
    }));
  } catch (e) {
    console.error('Failed to get transactions by range:', e);
    return [];
  }
}

export async function getTransactionsByCategory(
  category: string
): Promise<Transaction[]> {
  const db = await getDB();

  try {
    const rows = await db.getAllAsync<Transaction>(`
      SELECT * FROM transactions
      WHERE category = ?
      ORDER BY date DESC, id DESC
      LIMIT 100
    `, [category]);

    return rows.map(row => ({
      id: row.id || '',
      amount_minor: row.amount_minor || 0,
      currency_code: row.currency_code || '',
      currency_symbol: row.currency_symbol || '$',
      type: (row.type as 'credit' | 'debit') || 'debit',
      source: row.source || '',
      description: row.description || '',
      merchant: row.merchant || '',
      category: (row.category as TransactionCategory) || 'Other',
      date: row.date || '',
      raw_text: row.raw_text,
      capture_method: (row.capture_method as 'sms' | 'notification' | 'import' | 'manual') || 'manual',
      language_detected: row.language_detected || 'en',
      is_verified: !!row.is_verified,
      created_at: row.created_at,
    }));
  } catch (e) {
    console.error('Failed to get transactions by category:', e);
    return [];
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDB();

  try {
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  } catch (e) {
    console.error('Failed to delete transaction:', e);
  }
}

// ============================================================================
// Summary Functions (Pure SQL Aggregation - No AI)
// ============================================================================

export async function getDailySummary(date: string): Promise<NotificationSummary> {
  const db = await getDB();

  try {
    // Check cache first
    const cachedRow = await db.getFirstAsync<DailySummaryRow>(
      'SELECT * FROM daily_summary_cache WHERE id = ? AND invalidated = 0',
      [date]
    );

    if (cachedRow) {
      return buildNotificationSummary(cachedRow);
    }

    // Compute from transactions using pure SQL aggregation
    const summaryRows = await db.getAllAsync<DailySummaryRow>(
      `SELECT
        date,
        SUM(CASE WHEN type = 'credit' THEN amount_minor ELSE 0 END) as total_credit_minor,
        SUM(CASE WHEN type = 'debit' THEN amount_minor ELSE 0 END) as total_debit_minor,
        COUNT(*) as transaction_count,
        GROUP_CONCAT(category, ',') as categories
      FROM transactions
      WHERE substr(date, 1, 10) = ? AND is_verified = 1
      GROUP BY substr(date, 1, 10)
      LIMIT 1`,
      [date]
    );

    if (summaryRows.length === 0) {
      // No data for this date
      return buildEmptySummary(date);
    }

    const row = summaryRows[0] as DailySummaryRow;

    // Determine top category from grouped data (simplified - would need expanded query for accurate grouping)
    const topCategory = 'Other';

    return buildNotificationSummary({
      id: `${date}`,
      date,
      total_credit_minor: row.total_credit_minor || 0,
      total_debit_minor: row.total_debit_minor || 0,
      transaction_count: row.transaction_count || 0,
      top_category: topCategory,
      invalidated: 0,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to get daily summary:', e);
    return buildEmptySummary(date);
  }
}

function buildNotificationSummary(
  row: Partial<DailySummaryRow> & { total_credit_minor?: number; total_debit_minor?: number },
  currencyCode: string = 'USD'
): NotificationSummary {
  const netBalanceMinor = (row.total_credit_minor || 0) - (row.total_debit_minor || 0);

  // Determine tone based on net balance
  let tone: NotificationSummary['tone'] = 'heads_up';
  const netMajor = Math.round(netBalanceMinor / 100);

  if (netMajor >= 200) {
    tone = 'winning';
  } else if (netMajor < -50 && Math.abs(netMajor) > 500) {
    tone = 'critical';
  } else if (netMajor < -100) {
    tone = 'warning';
  }

  return {
    period: 'daily',
    total_credit_minor: row.total_credit_minor || 0,
    total_debit_minor: row.total_debit_minor || 0,
    net_balance_minor: netBalanceMinor,
    currency_code: currencyCode,
    transaction_count: row.transaction_count || 0,
    top_category: (row.top_category as TransactionCategory) || 'Other',
    tone: tone,
  };
}

function buildEmptySummary(date: string): NotificationSummary {
  return {
    period: 'daily',
    total_credit_minor: 0,
    total_debit_minor: 0,
    net_balance_minor: 0,
    currency_code: 'USD',
    transaction_count: 0,
    top_category: 'Other',
    tone: 'winning',
  };
}

export async function getWeeklySummary(): Promise<NotificationSummary> {
  const db = await getDB();

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // SQL aggregation for weekly summary
    const weeklyData = (await db.getAllAsync<{
      total_credit_minor: number;
      total_debit_minor: number;
      transaction_count: number;
    }>(`
      SELECT
        SUM(CASE WHEN type = 'credit' THEN amount_minor ELSE 0 END) as total_credit_minor,
        SUM(CASE WHEN type = 'debit' THEN amount_minor ELSE 0 END) as total_debit_minor,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE date >= ? AND is_verified = 1
    `, [sevenDaysAgo.toISOString()])) || [];

    if (weeklyData.length === 0) {
      return buildEmptySummary('weekly');
    }

    const row = weeklyData[0] as DailySummaryRow;

    // Get currency from most recent transaction
    let currencyCode = 'USD';
    try {
      const lastTxRow = await db.getFirstAsync<{ currency_code: string | null }>(
        'SELECT currency_code FROM transactions ORDER BY date DESC, id DESC LIMIT 1'
      );
      if (lastTxRow) {
        currencyCode = lastTxRow.currency_code || 'USD';
      }
    } catch (e) {
      console.error('Failed to get currency:', e);
    }

    // Cache the summary
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR REPLACE INTO daily_summary_cache (id, date, total_credit_minor, total_debit_minor, transaction_count, top_category, invalidated, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      ['weekly', 'weekly', row.total_credit_minor || 0, row.total_debit_minor || 0, row.transaction_count || 0, 'Other', now]
    );

    return {
      period: 'weekly',
      total_credit_minor: row.total_credit_minor || 0,
      total_debit_minor: row.total_debit_minor || 0,
      net_balance_minor: (row.total_credit_minor || 0) - (row.total_debit_minor || 0),
      currency_code: currencyCode,
      transaction_count: row.transaction_count || 0,
      top_category: 'Other' as const,
      tone: 'winning' as const,
    };
  } catch (e) {
    console.error('Failed to get weekly summary:', e);
    return buildEmptySummary('weekly');
  }
}

export async function getMonthlySummary(): Promise<NotificationSummary> {
  const db = await getDB();

  try {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    // SQL aggregation for monthly summary
    const monthlyData = (await db.getAllAsync<{
      total_credit_minor: number;
      total_debit_minor: number;
      transaction_count: number;
    }>(`
      SELECT
        SUM(CASE WHEN type = 'credit' THEN amount_minor ELSE 0 END) as total_credit_minor,
        SUM(CASE WHEN type = 'debit' THEN amount_minor ELSE 0 END) as total_debit_minor,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE date >= ? AND is_verified = 1
    `, [firstDayOfMonth.toISOString()])) || [];

    if (monthlyData.length === 0) {
      return buildEmptySummary('monthly');
    }

    const row = monthlyData[0] as DailySummaryRow;

    // Get currency from most recent transaction
    let currencyCode = 'USD';
    try {
      const lastTxRow = await db.getFirstAsync<{ currency_code: string | null }>(
        'SELECT currency_code FROM transactions ORDER BY date DESC, id DESC LIMIT 1'
      );
      if (lastTxRow) {
        currencyCode = lastTxRow.currency_code || 'USD';
      }
    } catch (e) {
      console.error('Failed to get currency:', e);
    }

    // Cache the summary
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR REPLACE INTO daily_summary_cache (id, date, total_credit_minor, total_debit_minor, transaction_count, top_category, invalidated, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      ['monthly', 'monthly', row.total_credit_minor || 0, row.total_debit_minor || 0, row.transaction_count || 0, 'Other', now]
    );

    return {
      period: 'monthly',
      total_credit_minor: row.total_credit_minor || 0,
      total_debit_minor: row.total_debit_minor || 0,
      net_balance_minor: (row.total_credit_minor || 0) - (row.total_debit_minor || 0),
      currency_code: currencyCode,
      transaction_count: row.transaction_count || 0,
      top_category: 'Other' as const,
      tone: 'winning' as const,
    };
  } catch (e) {
    console.error('Failed to get monthly summary:', e);
    return buildEmptySummary('monthly');
  }
}

// ============================================================================
// User Profile Operations
// ============================================================================

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getDB();

  try {
    const row = (await db.getFirstAsync<{
      id: number;
      name: string | null;
      monthly_budget_minor: number | null;
      currency_code: string | null;
      currency_symbol: string | null;
      locale: string | null;
      ai_model_downloaded: number | null;
      ai_model_version: string | null;
      created_at: string | null;
    }>('SELECT * FROM user_profile WHERE id = 1')) as any | null;

    if (!row) {
      return null;
    }

    return {
      id: row.id || 1,
      name: row.name,
      monthly_budget_minor: row.monthly_budget_minor,
      currency_code: row.currency_code || 'USD',
      currency_symbol: row.currency_symbol || '$',
      locale: row.locale || 'en',
      ai_model_downloaded: !!row.ai_model_downloaded,
      ai_model_version: row.ai_model_version,
      created_at: row.created_at,
    };
  } catch (e) {
    console.error('Failed to get user profile:', e);
    return null;
  }
}

export async function saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
  const db = await getDB();

  try {
    if (profile.currency_code) {
      const oldProfile = await getUserProfile();
      if (oldProfile && oldProfile.currency_code && oldProfile.currency_code !== profile.currency_code) {
        const { getExchangeRates } = require('../services/exchangeRateService');
        const rates = getExchangeRates();
        await convertAllTransactionsCurrency(
          oldProfile.currency_code,
          profile.currency_code,
          profile.currency_symbol || '$',
          rates
        );
      }
    }

    await db.runAsync(
      'INSERT OR REPLACE INTO user_profile (id, name, monthly_budget_minor, currency_code, currency_symbol, locale, ai_model_downloaded, ai_model_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        profile.name || null,
        profile.monthly_budget_minor !== undefined ? profile.monthly_budget_minor : null,
        profile.currency_code || 'USD',
        profile.currency_symbol || '$',
        profile.locale || 'en',
        profile.ai_model_downloaded === true ? 1 : (profile.ai_model_downloaded === false ? 0 : null),
        profile.ai_model_version || null,
        new Date().toISOString(),
      ]
    );
  } catch (e) {
    console.error('Failed to save user profile:', e);
  }
}

// ============================================================================
// Currency Conversion — Batch Update All Transactions
// ============================================================================

/**
 * Convert all transactions and the user budget from one currency to another.
 * This is called when the user changes their default currency in settings.
 *
 * @param fromCode - Current currency code (e.g. 'USD')
 * @param toCode   - New currency code (e.g. 'INR')
 * @param toSymbol - New currency symbol (e.g. '₹')
 * @param rates    - Exchange rate map (USD-based). If not provided, uses statics.
 */
export async function convertAllTransactionsCurrency(
  fromCode: string,
  toCode: string,
  toSymbol: string,
  rates?: Record<string, number>
): Promise<void> {
  if (fromCode === toCode) return;

  const { convertCurrency } = require('../constants/currencies');
  const db = await getDB();

  try {
    // 1. Fetch all transactions
    const transactions = await db.getAllAsync<{
      id: string;
      amount_minor: number;
      currency_code: string;
    }>('SELECT id, amount_minor, currency_code FROM transactions');

    if (transactions && transactions.length > 0) {
      // 2. Batch-convert each transaction
      for (const tx of transactions) {
        const txFromCode = tx.currency_code || fromCode;
        const convertedAmount = convertCurrency(tx.amount_minor, txFromCode, toCode, rates);

        await db.runAsync(
          'UPDATE transactions SET amount_minor = ?, currency_code = ?, currency_symbol = ? WHERE id = ?',
          [convertedAmount, toCode, toSymbol, tx.id]
        );
      }

      console.log(`Converted ${transactions.length} transactions from ${fromCode} to ${toCode}`);
    }

    // 3. Convert the monthly budget in user_profile
    const profile = await db.getFirstAsync<{
      monthly_budget_minor: number | null;
    }>('SELECT monthly_budget_minor FROM user_profile WHERE id = 1');

    if (profile && profile.monthly_budget_minor) {
      const convertedBudget = convertCurrency(profile.monthly_budget_minor, fromCode, toCode, rates);
      await db.runAsync(
        'UPDATE user_profile SET monthly_budget_minor = ? WHERE id = 1',
        [convertedBudget]
      );
      console.log(`Converted budget from ${fromCode} to ${toCode}: ${profile.monthly_budget_minor} -> ${convertedBudget}`);
    }

    // 4. Invalidate daily summary cache so it gets rebuilt from converted values
    await db.runAsync('DELETE FROM daily_summary_cache');
    console.log('Daily summary cache cleared after currency conversion');

  } catch (e) {
    console.error('Failed to convert transactions currency:', e);
    throw e; // Re-throw so callers can show error feedback
  }
}

// ============================================================================
// Data Wipe and Security Operations
// ============================================================================

export async function wipeAllData(): Promise<void> {
  const db = await getDB();

  try {
    // Delete all rows from all tables
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM user_profile');
    await db.runAsync('DELETE FROM daily_summary_cache');
    await db.runAsync('DELETE FROM ai_summaries');

    // VACUUM overwrites freed SQLite pages, preventing data recovery from the raw file
    await db.execAsync('VACUUM');

  } catch (e) {
    console.error('Failed to wipe data:', e);
  } finally {
    // Delete and regenerate the encryption key
    try {
      await SecureStore.deleteItemAsync(DB_KEY);

      // Generate new random key for the empty database
      const nodeCrypto = await require('crypto');
      const newKey = nodeCrypto.randomBytes(32).toString('hex');
      await SecureStore.setItemAsync(DB_KEY, newKey);
    } catch (keyError) {
      console.error('Failed to regenerate encryption key after wipe:', keyError);
    }
  }
}

// ============================================================================
// Export Operations
// ============================================================================

export async function exportAllTransactionsJSON(): Promise<string> {
  const db = await getDB();

  try {
    // Select all data (note: SQLite stores integers as numbers, JSON handles conversion)
    const transactions: Transaction[] = await db.getAllAsync<Transaction>(`
      SELECT id, amount_minor, currency_code, currency_symbol, type, source,
        description, merchant, category, date, raw_text, capture_method,
        language_detected, is_verified, created_at
      FROM transactions
      ORDER BY date DESC, id DESC
    `);

    return JSON.stringify(transactions, null, 2);
  } catch (e) {
    console.error('Failed to export transactions:', e);
    return '[]';
  }
}

export async function invalidateDailySummaryCache(date: string): Promise<void> {
  const db = await getDB();

  try {
    await db.runAsync(
      'UPDATE daily_summary_cache SET invalidated = 1, updated_at = datetime(\'now\') WHERE id = ? OR (period = \'daily\' AND date = ?)',
      [date, date]
    );
  } catch (e) {
    console.error('Failed to invalidate cache:', e);
  }
}

export async function getAISummary(period: 'weekly' | 'monthly'): Promise<AISummary | null> {
  const db = await getDB();
  try {
    const row = await db.getFirstAsync<AISummary>(
      'SELECT * FROM ai_summaries WHERE period = ?',
      [period]
    );
    return row || null;
  } catch (e) {
    console.error('Failed to get AI summary:', e);
    return null;
  }
}

export async function saveAISummary(summary: AISummary): Promise<void> {
  const db = await getDB();
  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO ai_summaries (period, content, period_key, created_at) VALUES (?, ?, ?, ?)',
      [summary.period, summary.content, summary.period_key, summary.created_at]
    );
  } catch (e) {
    console.error('Failed to save AI summary:', e);
  }
}
