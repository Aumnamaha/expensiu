import { Transaction, TransactionCategory } from '../types';

export function formatAmount(
  minor: number,
  currencyCode: string,
  locale: string = 'en-US'
): string {
  const major = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
  }).format(major);
}

export function calculateNetBalance(credit: number, debit: number): number {
  return credit - debit;
}

export function calculateBudgetRatio(debit: number, budget: number): number {
  if (budget === 0) return 0;
  return debit / budget;
}

export function groupByCategory(transactions: Transaction[]): Record<TransactionCategory, Transaction[]> {
  const grouped: Record<TransactionCategory, Transaction[]> = {
    Food: [],
    Transport: [],
    Shopping: [],
    Entertainment: [],
    Health: [],
    Utilities: [],
    Transfer: [],
    Salary: [],
    Refund: [],
    Other: [],
  };

  for (const tx of transactions) {
    if (tx.category && grouped[tx.category]) {
      grouped[tx.category].push(tx);
    } else {
      grouped['Other'].push(tx);
    }
  }

  return grouped;
}

export function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  const grouped: Record<string, Transaction[]> = {};

  for (const tx of transactions) {
    const dateKey = tx.date.split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(tx);
  }

  return grouped;
}

export function getTopCategory(transactions: Transaction[]): TransactionCategory | null {
  const totals: Record<string, number> = {};

  for (const tx of transactions) {
    if (!tx.category) continue;
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount_minor;
  }

  let topCategory: TransactionCategory | null = null;
  let maxAmount = -Infinity;

  for (const [category, amount] of Object.entries(totals)) {
    if (amount > maxAmount) {
      maxAmount = amount;
      topCategory = category as TransactionCategory;
    }
  }

  return topCategory || null;
}
