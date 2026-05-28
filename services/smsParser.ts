import { detectCurrency, parseAmount, detectDirection } from './currencyDetector';

// ============================================================================
// Transaction Parser - Hybrid Regex First, AI Fallback
// ============================================================================

export interface ParsedTransaction {
  raw_text: string;
  amount_minor: number | null;
  currency_code: string | null;
  type: 'credit' | 'debit' | null;
  confidence: 'high' | 'low';
  merchant?: string;
}

// ============================================================================
// Rejection Filters (Early Exit - Invalid Messages)
// ============================================================================

const OTP_KEYWORDS = ['otp', 'verification code', 'pin', 'verify'];

function containsOTPKeyword(body: string): boolean {
  const lowerBody = body.toLowerCase();

  // Check for OTP/verification keywords
  if (/otp|verification code/i.test(lowerBody)) return true;

  return false;
}

const SHORT_MESSAGE_THRESHOLD = 20;

// iOS Note: iOS does not allow reading SMS content from other apps for privacy reasons.
// On iOS, this parser is only used when the app requests its own local notifications
// via expo-notifications. Android uses the @flyerhq/react-native-android-sms-listener package.
function isMessageValid(body: string): boolean {
  // Step a.1: Reject OTP and verification messages
  if (containsOTPKeyword(body)) {
    return false;
  }

  // Step a.2: Reject very short messages with no substance
  if (body.length < SHORT_MESSAGE_THRESHOLD) {
    return false;
  }

  // Step a.3: Reject messages without numeric content
  if (!/[\d]/.test(body)) {
    return false;
  }

  return true;
}

// ============================================================================
// Core ParseSMS Function - The Main Entry Point
// ============================================================================

// Internal parser for processing SMS text (confidence-based routing)
export function parseSMS(
  body: string,
  sender: string = ''
): ParsedTransaction | null {
  // Step a: Reject invalid messages early (stateless check)
  if (!isMessageValid(body)) {
    return null;
  }

  // Step b: Detect currency
  const currencyDetection = detectCurrency(body);
  if (!currencyDetection) {
    // No currency detected - create low-confidence entry for AI fallback
    return {
      raw_text: body,
      amount_minor: null,
      currency_code: null,
      type: null,
      confidence: 'low',
    };
  }

  // Step c: Parse amount (returns minor units as integer)
  const parsedAmount = parseAmount(body, 'en');
  if (parsedAmount === null) {
    // Cannot parse amount - create low-confidence entry for AI fallback
    return {
      raw_text: body,
      amount_minor: null,
      currency_code: currencyDetection.code,
      type: null,
      confidence: 'low',
    };
  }

  // Step d: Detect direction/type
  const direction = detectDirection(body);
  if (direction) {
    // All three found with confidence - return high-confidence result
    return {
      raw_text: body,
      amount_minor: parsedAmount,
      currency_code: currencyDetection.code,
      type: direction,
      confidence: 'high',
    };
  } else {
    // Type ambiguous - low confidence for AI fallback
    return {
      raw_text: body,
      amount_minor: parsedAmount,
      currency_code: currencyDetection.code,
      type: null,
      confidence: 'low',
    };
  }
}

// ============================================================================
// Merchant Extraction Logic (Inline - No Separate Export Needed)
// ============================================================================

// Deduplicator Integration Note:
// When startSMSListener() is implemented in Prompt 7, it will call this deduplicator check
// before insertTransaction(): await deduplicator.checkForDuplicates(transactionId);
const BANK_NAMES = ['hdfc', 'icici', 'axis', 'sbi', 'kotak', 'hdfc bank', 'sicredi'];
const COMMON_WORDS = ['the', 'and', 'or', 'at', 'on', 'in', 'to', 'for', 'of', 'is', 'was', 'are'];

function isMerchantName(word: string): boolean {
  const cleanWord = word.toLowerCase().trim();

  if (BANK_NAMES.some(bank => cleanWord.includes(bank))) return false;
  if (COMMON_WORDS.includes(cleanWord)) return false;
  if (['usd', 'eur', 'inr', 'gbp', 'jpy'].includes(cleanWord.toUpperCase())) return false;

  if (cleanWord.length < 2) return false;

  const firstChar = cleanWord[0];
  const rest = cleanWord.slice(1);
  return /^[A-Za-z]+$/.test(cleanWord) && (firstChar === cleanWord[0].toUpperCase() || /[A-Z]/.test(rest));
}

function extractMerchant(text: string): string | null {
  const lowerText = text.toLowerCase();

  let cleanedText = text;
  const amountMatch = text.match(/(-?\d+(?:[,']\d+)*)\s*(USD|EUR|INR|GBP|JPY)?$/i);
  if (amountMatch) {
    cleanedText = text.substring(0, text.length - amountMatch[0].length).trim();
  }

  const words = cleanedText.split(/\s+/).filter(w => w.length > 1);

  let bestMerchant = '';
  for (const word of words) {
    if (isMerchantName(word)) {
      bestMerchant = word.length > bestMerchant.length ? word : bestMerchant;
    } else {
      for (let i = words.length - 1; i >= Math.max(0, words.indexOf(word) - 2); i--) {
        const phrase = words.slice(i, words.indexOf(word) + 1).join(' ');
        if (isMerchantName(phrase)) {
          const cleanPhrase = phrase.toLowerCase();
          if (!BANK_NAMES.some(b => cleanPhrase.includes(b))) {
            if (phrase.length > bestMerchant.length) {
              bestMerchant = phrase;
            }
          }
        }
      }
    }
  }

  return bestMerchant;
}

export function startSMSListener(): void {
  // iOS Note: iOS does not allow reading SMS content from other apps for privacy reasons.
  // On iOS, this listener is a no-op, and we rely on the Notification Listener only.
  if (require('react-native').Platform.OS === 'ios') {
    console.log('SMS reading is not supported on iOS.');
    return;
  }

  try {
    const SmsListener = require('@flyerhq/react-native-android-sms-listener');
    if (!SmsListener || !SmsListener.default) {
      console.log('SmsListener package is not available or registered.');
      return;
    }

    SmsListener.default.addListener(async (message: any) => {
      if (!message || !message.body) return;

      const parsed = parseSMS(message.body, message.originatingAddress || '');
      if (!parsed) return;

      const { insertTransaction, getAllTransactions } = require('../db/database');
      const { isDuplicate } = require('./deduplicator');
      const { enhanceTransaction } = require('./aiEngine');

      const existingTransactions = await getAllTransactions(100, 0);

      // Check duplicates
      if (isDuplicate(parsed, existingTransactions)) {
        console.log('Duplicate SMS transaction detected, skipping.');
        return;
      }

      let tx;
      if (parsed.confidence === 'high') {
        tx = {
          id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          amount_minor: parsed.amount_minor || 0,
          currency_code: parsed.currency_code || 'USD',
          currency_symbol: parsed.currency_code === 'INR' ? '₹' : '$',
          type: parsed.type || 'debit',
          source: message.originatingAddress || 'sms',
          description: message.body,
          merchant: extractMerchant(message.body) || 'Merchant',
          category: 'Other' as any,
          date: new Date().toISOString(),
          raw_text: message.body,
          capture_method: 'sms' as const,
          language_detected: 'en',
          is_verified: true,
          created_at: new Date().toISOString()
        };
      } else {
        tx = await enhanceTransaction(parsed);
      }

      await insertTransaction(tx);
    });
    console.log('Android SMS Listener started successfully.');
  } catch (error) {
    console.error('Failed to start SMS listener:', error);
  }
}
