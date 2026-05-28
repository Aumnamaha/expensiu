import { CURRENCIES } from '@/constants/currencies';

// ============================================================================
// Symbol to Currency Code Mapping (ISO 4217)
// ============================================================================

// ============================================================================
// Symbol to Currency Code Mapping (ISO 4217) - FIXED DUPLICATES
// Use pattern: '$_ARS' for context-aware currency codes like Chilean Peso, etc.
// ============================================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  // Primary currencies
  '₹': 'INR',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  'CNY': 'CNY',

  // Context-aware codes with underscore prefix
  '₦': 'NGN',
  'ARS_ARS': 'ARS',
  'CLP_CLP': 'CLP',
  'COP_COP': 'COP',
  '₲': 'PYG',

  // Additional global currencies
  'Rp': 'IDR',
  '₱': 'PHP',
  '₫': 'VND',   // Vietnamese Dong
  'KSh': 'KES', // Kenyan Shilling
  '₵': 'GHS',   // Ghanaian Cedi
  'R': 'ZAR',   // South African Rand
  'ج.م': 'EGP', // Egyptian Pound
  '₨': 'PKR',   // Pakistani Rupee
  '৳': 'BDT',   // Bangladeshi Taka
  '฿': 'THB',   // Thai Baht
  'RM': 'MYR',  // Malaysian Ringgit
  '$_SGD': 'SGD', // Singapore Dollar (unique key)
  'Fr': 'CHF',  // Swiss Franc
  'kr_SEK': 'SEK', // Swedish Krona (unique key)
  'kr_NOK': 'NOK', // Norwegian Krone (unique key)
  'kr_DKK': 'DKK', // Danish Krone (unique key)
  '$_AUD': 'AUD', // Australian Dollar (unique key)
  '$_CAD': 'CAD', // Canadian Dollar (unique key)
  '$_NZD': 'NZD', // New Zealand Dollar (unique key)
  'S/': 'PEN',  // Peruvian Sol
  '₺': 'TRY',   // Turkish Lira
  '₴': 'UAH',   // Ukrainian Hryvnia
  'zł': 'PLN',  // Polish Zloty
  'Kč': 'CZK',  // Czech Koruna
  'Ft': 'HUF',  // Hungarian Forint
  'lei': 'RON', // Romanian Leu
  '₽': 'RUB',   // Russian Ruble
  '₪': 'ILS',  // Israeli New Shekel
  '﷼': 'QAR',  // Qatari Riyal
  'د.ك': 'KWD', // Kuwaiti Dinar
  '.د.ب': 'BHD',// Bahraini Dinar
  'ر.ع.': 'OMR',// Omani Rial

  // Legacy/ambiguous symbols (handle with care)
  'Rs': 'PKR',  // Indian Rupee alternate spelling (ambiguous with Pakistani)
  'Rs_Indian': 'INR', // Indian Rupee alternate (dot variant) - unique key
};

// ============================================================================
// Number Format Detection Enums (using single-char codes)
// ============================================================================

type NumberFormat = 'US' | 'EUROPEAN' | 'SPACE' | 'NO_DECIMAL';

const US_NUMBER_PATTERN = /\d{1,3}(?:[,']\d{3})*(?:\.|\s*\d{1,2})?/;
const EUROPEAN_NUMBER_PATTERN = /\d{1,3}(?:[.](?:\d{3})(?:[,'])?)*[,']?\d{0,2}/;
const SPACE_THOUSANDS_PATTERN = /\d[\s]\d{3}(?:,\d{2})?/;
const NO_DECIMAL_PATTERN = /\d+|[,']\d+([.,]?\d{0,2})?/;

// ============================================================================
// Number Format Detection
// ============================================================================

function detectNumberFormat(amountString: string): NumberFormat {
  if (/[,']/.test(amountString)) {
    const commaPos = amountString.indexOf(',');
    const dotPos = amountString.indexOf('.');

    if (commaPos > -1) {
      // Check if comma appears after any digits (likely decimal or thousands separator)
      return 'EUROPEAN';
    }
  }

  if (/\s/.test(amountString) && /[,']/.test(amountString)) {
    return 'SPACE';
  }

  if (!/[,.]|\s/.test(amountString) || amountString.length <= 6) {
    return 'NO_DECIMAL';
  }

  // Default to US format for ambiguous cases (most common globally)
  return 'US';
}

// ============================================================================
// Numeral System Detection (Western vs Arabic-Indic)
// ============================================================================

const ARABIC_INDIC_NUMBERS_REGEX = /[٠-٩]/;

function useArabicNumerals(amountString: string): boolean {
  return ARABIC_INDIC_NUMBERS_REGEX.test(amountString);
}

// ============================================================================
// Main Currency Detection Function
// ============================================================================

export function detectCurrency(text: string): { code: string; symbol: string; locale: string } | null {
  const lowerText = text.toLowerCase();

  // Step a: Symbol match (highest priority)
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) {
      return { code, symbol, locale: 'en' };
    }
  }

  // Step b: ISO code match (whole word only, case-insensitive)
  for (const [code] of Object.entries(CURRENCIES)) {
    const isoPattern = new RegExp(`\\b${code}\\b`, 'i');
    if (isoPattern.test(text)) {
      return { code, symbol: CURRENCIES[code].symbol, locale: CURRENCIES[code].locale };
    }
  }

  // Step c: Country context detection
  const contextKeywords: Record<string, string> = {
    'rupees': 'INR', 'dollars': 'USD', 'euros': 'EUR', 'pounds': 'GBP',
    'dirhams': 'AED', 'riyals': 'SAR', 'shillings': 'KES', 'naira': 'NGN',
    'pesos': 'MXN', 'yen': 'JPY', 'won': 'KRW',
    'ringgit': 'MYR', 'baht': 'THB', 'dong': 'VND', 'rupiah': 'IDR'
  };

  for (const [word, code] of Object.entries(contextKeywords)) {
    if (lowerText.includes(word)) {
      return { code, symbol: CURRENCIES[code].symbol, locale: CURRENCIES[code].locale };
    }
  }

  // Step d: Return null if undetectable
  return null;
}

// ============================================================================
// Amount Parsing with Full Global Format Support
// ============================================================================

function normalizeToUSFormat(amountString: string): string {
  // Remove Arabic-Indic numerals and convert to Western digits
  let normalized = amountString.replace(/[٠-٩]/g, (m) => {
    const arabicDigits = '۰۱۲۳۴۵۶۷۸۹';
    const westernDigits = '0123456789';
    return westernDigits[arabicDigits.indexOf(m)];
  });

  // Remove comma if no dot present (could be thousands separator)
  if (!normalized.includes('.') && normalized.includes(',')) {
    // Check if this is European format (comma as decimal)
    const lastComma = normalized.lastIndexOf(',');
    const remainingAfterComma = normalized.substring(lastComma);
    if (remainingAfterComma.length <= 3) {
      // Comma is decimal separator in European format
      return normalized.replace(',', '.');
    }
  }

  // Remove all thousands separators
  normalized = normalized.replace(/[,\'\s]/g, '');

  return normalized;
}

function parseUSFormat(amountString: string): number | null {
  const normalized = normalizeToUSFormat(amountString);

  if (!normalized) return null;

  const value = parseFloat(normalized);
  if (isNaN(value)) return null;

  // Multiply by 100 to get minor units
  return Math.round(value * 100);
}

function parseNoDecimal(amountString: string): number | null {
  const normalized = normalizeToUSFormat(amountString).substring(0, 4); // First 4 digits max
  const value = parseInt(normalized, 10);

  if (isNaN(value) || value === 0) return null;

  // YEN and WON have no minor units (or they're 1)
  // Return as-is since these currencies don't use standard rounding
  return value;
}

export function parseAmount(text: string, locale: string): number | null {
  const lowerText = text.toLowerCase();

  // Skip non-numeric content check
  if (!/[\d]/.test(text)) {
    return null;
  }

  // Detect and handle Arabic numerals (Persian/Urdu)
  const arabicNumeralsDetected = ARABIC_INDIC_NUMBERS_REGEX.test(text);

  // Step a: Try US/UK format (comma as thousands, dot as decimal)
  let match = text.match(US_NUMBER_PATTERN);
  if (match) {
    const usMatch = normalizeToUSFormat(match[0]);
    if (!isNaN(parseFloat(usMatch))) {
      return parseUSFormat(usMatch);
    }
  }

  // Step b: Try European format (dot as thousands, comma as decimal)
  match = text.match(EUROPEAN_NUMBER_PATTERN);
  if (match) {
    let euMatch = match[0];

    // Handle space-thousands format with European decimals
    if (/[\s]+/.test(match[0]) && /[,]/.test(match[0])) {
      const parts = match[0].split(/\s+/);
      if (parts.length >= 2) {
        euMatch = `${parts[parts.length - 1]}${parts.slice(0, -1).join('')}`;
      }
    }

    // Extract decimal part if present
    const decimalPos = euMatch.lastIndexOf(',');
    if (decimalPos > -1) {
      const decimalDigits = euMatch.substring(decimalPos + 1);
      if (decimalDigits.length >= 2) {
        return parseFloat(normalizeToUSFormat(euMatch)) * 100;
      }
    } else {
      // No decimal separator found - assume integer amount
      const value = parseInt(normalizeToUSFormat(euMatch), 10);
      if (!isNaN(value)) {
        return Math.round(value * 100);
      }
    }
  }

  // Step c: Try space-thousands format (French/Russian style)
  match = text.match(SPACE_THOUSANDS_PATTERN);
  if (match) {
    let spaceMatch = normalizeToUSFormat(match[0]);
    return parseUSFormat(spaceMatch);
  }

  // Step d: No decimal format (Japan/Korea style)
  match = text.match(NO_DECIMAL_PATTERN);
  if (match) {
    // YEN and WON - return as-is without multiplying by 100
    if (locale.includes('JP') || locale.includes('KR')) {
      const value = parseInt(normalizeToUSFormat(match[0]), 10);
      if (!isNaN(value)) return value;
    }

    // All other currencies - multiply by 100
    return Math.round(parseFloat(normalizeToUSFormat(match[0])) * 100);
  }

  // Step e: Fallback to basic float parsing (last resort)
  const fallbackMatch = text.match(/[-+]?\d+([.,]\d+)?/);
  if (fallbackMatch) {
    const str = normalizeToUSFormat(fallbackMatch[0]);
    const value = parseFloat(str);
    if (!isNaN(value)) {
      return Math.round(value * 100);
    }
  }

  // Cannot parse - return null
  return null;
}

// ============================================================================
// Direction Detection (Credit/Debit)
// ============================================================================

const CREDIT_KEYWORDS_LIST: string[] = [
  'received', 'credited', 'deposit', 'transfer in', 'refund', 'credit card',
  'credited', 'incoming', 'inbound', 'sent to', 'payout', 'income'
];

const DEBIT_KEYWORDS_LIST: string[] = [
  'debit', 'paid', 'charged', 'gas', 'coffee', 'uber', 'amazon', 'food',
  'purchase', 'bought', 'spending', 'withdrawn', 'outgoing', 'outbound'
];

export function detectDirection(
  text: string,
  languageHint?: string
): 'credit' | 'debit' | null {
  const lowerText = text.toLowerCase();

  // Check credit keywords first
  for (const kw of CREDIT_KEYWORDS_LIST) {
    if (lowerText.includes(kw)) {
      return 'credit';
    }
  }

  // Check debit keywords second
  for (const kw of DEBIT_KEYWORDS_LIST) {
    if (lowerText.includes(kw)) {
      return 'debit';
    }
  }

  // Null - ambiguous, will be sent to AI fallback
  return null;
}

// ============================================================================
// Extract Merchant Name from Text
// ============================================================================

const BANK_NAMES = ['hdfc', 'icici', 'axis', 'sbi', 'kotak', 'hdfc bank', 'sicredi'];
const COMMON_WORDS = ['the', 'and', 'or', 'at', 'on', 'in', 'to', 'for', 'of', 'is', 'was', 'are'];

function isMerchantName(word: string): boolean {
  const cleanWord = word.toLowerCase().trim();

  if (BANK_NAMES.some(bank => cleanWord.includes(bank))) return false;
  if (COMMON_WORDS.includes(cleanWord)) return false;
  if (['usd', 'eur', 'inr', 'gbp', 'jpy'].includes(cleanWord.toUpperCase())) return false;

  // Check length and capitalization patterns
  if (cleanWord.length < 2) return false;

  // Look for capitalized words or mixed case
  const firstChar = cleanWord[0];
  const rest = cleanWord.slice(1);
  return /^[A-Za-z]+$/.test(cleanWord) && (firstChar === cleanWord[0].toUpperCase() || /[A-Z]/.test(rest));
}

export function extractMerchant(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Remove amount from end of text
  let cleanedText = text;
  const amountMatch = text.match(/(-?\d+(?:[,']\d+)*)\s*(USD|EUR|INR|GBP|JPY)?$/i);
  if (amountMatch) {
    cleanedText = text.substring(0, text.length - amountMatch[0].length).trim();
  }

  // Extract potential merchant names (capitalized phrases)
  const words = cleanedText.split(/\s+/).filter(w => w.length > 1);

  // Find longest matching capitalized phrase
  let bestMerchant = '';
  for (const word of words) {
    if (isMerchantName(word)) {
      bestMerchant = word.length > bestMerchant.length ? word : bestMerchant;
    } else {
      // Check multi-word phrases ending in the current word
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

  return bestMerchant ? bestMerchant.charAt(0).toUpperCase() + bestMerchant.slice(1) : null;
}
