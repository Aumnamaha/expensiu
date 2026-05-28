export type TransactionCategory =
  | 'Food'
  | 'Transport'
  | 'Shopping'
  | 'Entertainment'
  | 'Health'
  | 'Utilities'
  | 'Transfer'
  | 'Salary'
  | 'Refund'
  | 'Other';

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
  name: string;
  monthly_budget_minor: number;
  currency_code: string;
  currency_symbol: string;
  locale: string;
  ai_model_downloaded: boolean;
  ai_model_version: string;
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

export interface ParsedTransaction {
  raw_text: string;
  amount_minor: number | null;
  currency_code: string | null;
  type: 'credit' | 'debit' | null;
  confidence: 'high' | 'low';
}
