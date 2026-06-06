// ============================================================================
// Exchange Rate Service — Monthly Self-Updating Engine
// 
// On app startup, checks if cached rates are older than 30 days. If so, fetches
// fresh rates from https://open.er-api.com/v6/latest/USD (free, no auth, no
// tracking). Falls back to static DEFAULT_EXCHANGE_RATES if offline.
//
// Privacy: Only a single GET request is made. No user data is sent.
// ============================================================================

import { DEFAULT_EXCHANGE_RATES } from '../constants/currencies';

// In-memory cache for the current session
let _cachedRates: Record<string, number> | null = null;
let _lastFetchTimestamp: number = 0;

const RATE_UPDATE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const API_URL = 'https://open.er-api.com/v6/latest/USD';
const RATE_STORAGE_KEY = 'expensiu_exchange_rates';
const RATE_TIMESTAMP_KEY = 'expensiu_exchange_rates_ts';

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the current exchange rates. Prefers cached live rates, falls back to statics.
 */
export function getExchangeRates(): Record<string, number> {
  return _cachedRates || DEFAULT_EXCHANGE_RATES;
}

/**
 * Initialize rates on app startup. Loads from AsyncStorage, and if stale (>30 days),
 * fetches new rates in the background.
 */
export async function initExchangeRates(): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;

    // Load cached rates from persistent storage
    const storedRates = await AsyncStorage.getItem(RATE_STORAGE_KEY);
    const storedTimestamp = await AsyncStorage.getItem(RATE_TIMESTAMP_KEY);

    if (storedRates) {
      try {
        _cachedRates = JSON.parse(storedRates);
        _lastFetchTimestamp = storedTimestamp ? parseInt(storedTimestamp, 10) : 0;
      } catch {
        _cachedRates = null;
        _lastFetchTimestamp = 0;
      }
    }

    // Check if rates need updating (older than 30 days or never fetched)
    const now = Date.now();
    if (!_cachedRates || (now - _lastFetchTimestamp) > RATE_UPDATE_INTERVAL_MS) {
      // Fetch in background — don't block app startup
      fetchAndCacheRates().catch((err) => {
        console.log('Background rate update skipped (likely offline):', err?.message);
      });
    }
  } catch (error) {
    console.log('initExchangeRates: Using static fallback rates', error);
  }
}

/**
 * Force-fetch fresh rates from the API and save to cache.
 * Returns true on success, false on failure.
 */
export async function fetchAndCacheRates(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(API_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data.rates || typeof data.rates !== 'object') {
      throw new Error('Invalid API response shape');
    }

    // Validate the rates object has at least a few expected currencies
    const rates = data.rates as Record<string, number>;
    if (!rates.EUR || !rates.GBP || !rates.INR) {
      throw new Error('API response missing key currencies');
    }

    // Ensure USD = 1.0 (it's the base)
    rates.USD = 1.0;

    // Persist to AsyncStorage
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const now = Date.now();

    await AsyncStorage.setItem(RATE_STORAGE_KEY, JSON.stringify(rates));
    await AsyncStorage.setItem(RATE_TIMESTAMP_KEY, String(now));

    // Update in-memory cache
    _cachedRates = rates;
    _lastFetchTimestamp = now;

    console.log(`Exchange rates updated (${Object.keys(rates).length} currencies)`);
    return true;
  } catch (error: any) {
    console.log('fetchAndCacheRates failed:', error?.message);
    return false;
  }
}

/**
 * Returns the timestamp of the last successful rate update, or 0 if never.
 */
export function getLastRateUpdateTimestamp(): number {
  return _lastFetchTimestamp;
}

/**
 * Returns true if rates have been fetched at least once from the API.
 */
export function hasLiveRates(): boolean {
  return _cachedRates !== null && _lastFetchTimestamp > 0;
}
