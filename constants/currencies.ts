export interface Currency {
  code: string;
  symbol: string;
  name: string;
  minor_unit: number;
  decimal_separator: string;
  thousands_separator: string;
  locale: string;
}

export const CURRENCIES: Record<string, Currency> = {
  USD: { code: 'USD', symbol: '$', name: 'United States Dollar', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', minor_unit: 100, decimal_separator: '.', thousands_separator: '.', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound Sterling', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-GB' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'hi-IN' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'zh-CN' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', minor_unit: 1, decimal_separator: '.', thousands_separator: ',', locale: 'ja-JP' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'United Arab Emirates Dirham', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'ar-AE' },
  SAR: { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'ar-SA' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', minor_unit: 100, decimal_separator: ',', thousands_separator: '.', locale: 'pt-BR' },
  MXN: { code: 'MXN', symbol: '$', name: 'Mexican Peso', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'es-MX' },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', minor_unit: 100, decimal_separator: ',', thousands_separator: '.', locale: 'id-ID' },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'fil-PH' },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'vi-VN' },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'sw-KE' },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-NG' },
  GHS: { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-GH' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'af-ZA' },
  EGP: { code: 'EGP', symbol: 'ج.م', name: 'Egyptian Pound', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'ar-EG' },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'ur-PK' },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'bn-BD' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'th-TH' },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'ms-MY' },
  SGD: { code: 'SGD', symbol: '$', name: 'Singapore Dollar', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'zh-SG' },
  HKD: { code: 'HKD', symbol: '$', name: 'Hong Kong Dollar', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'zh-HK' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', minor_unit: 1, decimal_separator: '.', thousands_separator: ',', locale: 'ko-KR' },
  CHF: { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', minor_unit: 100, decimal_separator: '.', thousands_separator: "'", locale: 'de-CH' },
  SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'sv-SE' },
  NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'no-NO' },
  DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'da-DK' },
  AUD: { code: 'AUD', symbol: '$', name: 'Australian Dollar', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: '$', name: 'Canadian Dollar', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-CA' },
  NZD: { code: 'NZD', symbol: '$', name: 'New Zealand Dollar', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-NZ' },
  ARS: { code: 'ARS', symbol: '$', name: 'Argentine Peso', minor_unit: 100, decimal_separator: ',', thousands_separator: '.', locale: 'es-AR' },
  CLP: { code: 'CLP', symbol: '$', name: 'Chilean Peso', minor_unit: 100, decimal_separator: ',', thousands_separator: '.', locale: 'es-CL' },
  COP: { code: 'COP', symbol: '$', name: 'Colombian Peso', minor_unit: 100, decimal_separator: ',', thousands_separator: '.', locale: 'es-CO' },
  PEN: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'es-PE' },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'tr-TR' },
  UAH: { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'uk-UA' },
  PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', minor_unit: 100, decimal_separator: ',', thousands_separator: ' ', locale: 'pl-PL' },
  CZK: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'cs-CZ' },
  HUF: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'hu-HU' },
  RON: { code: 'RON', symbol: 'lei', name: 'Romanian Leu', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'ro-RO' },
  RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble', minor_unit: 100, decimal_separator: '.', thousands_separator: ' ', locale: 'ru-RU' },
  ILS: { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'he-IL' },
  QAR: { code: 'QAR', symbol: '﷼', name: 'Qatari Riyal', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'ar-QA' },
  KWD: { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', minor_unit: 1000, decimal_separator: '.', thousands_separator: ',', locale: 'ar-KW' },
  BHD: { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar', minor_unit: 1000, decimal_separator: '.', thousands_separator: ',', locale: 'ar-BH' },
  OMR: { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', minor_unit: 1000, decimal_separator: '.', thousands_separator: ',', locale: 'ar-OM' },
  PKD: { code: 'PKD', symbol: 'Rs', name: 'Pakistani Rupee (new)', minor_unit: 100, decimal_separator: '.', thousands_separator: ',', locale: 'en-PK' },
};

export function getCurrency(currencyCode: string): Currency | undefined {
  return CURRENCIES[currencyCode] || undefined;
}

export function getDefaultCurrency(locale?: string): string {
  if (locale?.includes('en-US') || !locale) return 'USD';
  if (locale?.includes('hi')) return 'INR';
  if (locale?.includes('de')) return 'EUR';
  if (locale?.includes('es')) return 'USD';
  if (locale?.includes('fr')) return 'EUR';
  if (locale?.includes('zh')) return 'CNY';
  if (locale?.includes('ja')) return 'JPY';
  if (locale?.includes('ar')) return 'SAR';
  return 'USD';
}

// ============================================================================
// Static Exchange Rates (relative to USD = 1.0)
// These are offline fallback rates. The app auto-updates them monthly from
// https://open.er-api.com/v6/latest/USD (free, no-auth, privacy-preserving).
// ============================================================================

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  CNY: 7.24,
  JPY: 157.0,
  AED: 3.67,
  SAR: 3.75,
  BRL: 5.05,
  MXN: 17.15,
  IDR: 15700.0,
  PHP: 56.5,
  VND: 25400.0,
  KES: 153.0,
  NGN: 1550.0,
  GHS: 15.4,
  ZAR: 18.5,
  EGP: 48.5,
  PKR: 278.0,
  BDT: 118.0,
  THB: 35.5,
  MYR: 4.72,
  SGD: 1.34,
  HKD: 7.82,
  KRW: 1350.0,
  CHF: 0.88,
  SEK: 10.8,
  NOK: 10.9,
  DKK: 6.88,
  AUD: 1.53,
  CAD: 1.36,
  NZD: 1.65,
  ARS: 870.0,
  CLP: 940.0,
  COP: 3950.0,
  PEN: 3.75,
  TRY: 32.5,
  UAH: 41.0,
  PLN: 4.0,
  CZK: 23.5,
  HUF: 365.0,
  RON: 4.6,
  RUB: 92.0,
  ILS: 3.65,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.376,
  OMR: 0.385,
  PKD: 278.0,
};

// ============================================================================
// Currency Conversion Utility
// ============================================================================

/**
 * Convert an amount (in minor units) from one currency to another.
 * Uses the provided rates map, falling back to DEFAULT_EXCHANGE_RATES.
 *
 * @param amountMinor - The amount in minor currency units (e.g. cents)
 * @param fromCode   - Source currency code (e.g. 'USD')
 * @param toCode     - Target currency code (e.g. 'INR')
 * @param rates      - Optional custom rates map (from live API cache)
 * @returns Converted amount in minor units, rounded to nearest integer
 */
export function convertCurrency(
  amountMinor: number,
  fromCode: string,
  toCode: string,
  rates?: Record<string, number>
): number {
  if (fromCode === toCode) return amountMinor;

  const rateMap = rates || DEFAULT_EXCHANGE_RATES;
  const fromRate = rateMap[fromCode];
  const toRate = rateMap[toCode];

  if (!fromRate || !toRate) {
    console.warn(`Exchange rate missing for ${fromCode} or ${toCode}, returning original amount`);
    return amountMinor;
  }

  // Convert: amount_in_USD = amountMinor / fromRate, then amount_in_target = USD * toRate
  return Math.round((amountMinor / fromRate) * toRate);
}
