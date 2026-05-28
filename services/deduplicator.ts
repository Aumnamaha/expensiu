import type { Transaction } from '@/types';
import type { ParsedTransaction } from './smsParser';

export function isDuplicate(
  incoming: ParsedTransaction,
  existingTransactions: Transaction[]
): boolean {
  // Check if this parsed transaction matches any existing by key properties
  // ParsedTransaction doesn't have id/date - use amount/currency/type for basic matching
  for (const existing of existingTransactions) {
    // Skip if amounts significantly differ (> 1% difference to avoid false positives)
    const incomingAmount = incoming.amount_minor || 0;
    const existingAmount = parseFloat((existing as any).amount_minor || '0');
    if (existingAmount !== 0 && Math.abs(incomingAmount - existingAmount) / existingAmount > 0.01) {
      continue;
    }

    // Amount and currency match (parsed amounts may already be in minor units)
    const amountMatch = incoming.amount_minor === parseFloat((existing as any).amount_minor || '0');
    const currencyMatch = incoming.currency_code === (existing as any).currency_code;
    const typeMatch = incoming.type === (existing as any).type;

    if (amountMatch && currencyMatch && typeMatch) {
      return true;
    }
  }

  return false;
}
