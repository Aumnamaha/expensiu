import * as Notifications from 'expo-notifications';
import { ParsedTransaction } from './smsParser';

// ============================================================================
// Notification Listener Service (Android Only)
// ============================================================================

// This file implements a notification listener using BIND_NOTIFICATION_LISTENER_SERVICE permission.
// Note: iOS does not allow reading notification content from other apps for privacy reasons.
// iOS relies on the app requesting its own local notifications and using standard
// Expo notification APIs. Android allows permission-based monitoring of all notifications.

// ============================================================================
// Promotional/PSPU Keyword Detection (Multi-language aware)
// ============================================================================

const PROMO_KEYWORDS_EN = ['offer', 'discount', 'deal', 'sale', 'coupon', 'off', 'free', 'promotion'];

const PROMO_PATTERNS = [
  /offre|promotion|promo|sold out|gratis/i,
  /przelewy|przylewka/i,
  /angebot|rabatt/i,
  /अफर|बोनस|फ्री|पैकेज|डिस्काउंट|सेल/i,
  /[أع][ر]اب|تخفيضات|تسويق|عرض خاص|خصم/i,
  /(promo|promotional|advertisement)/i,
];

function isPromotionalNotification(text: string): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  for (const keyword of PROMO_KEYWORDS_EN) {
    if (lowerText.includes(keyword)) {
      return true;
    }
  }

  for (const pattern of PROMO_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// OTP/Verification Notification Detection (internal)
// ============================================================================

const OTP_INDICATORS = ['otp', 'verification code', 'pin code', 'verify'];

function isOTPNotification(text: string): boolean {
  const lowerText = text.toLowerCase();

  for (const indicator of OTP_INDICATORS) {
    if (lowerText.includes(indicator)) {
      return true;
    }
  }

  if (/^otp\s*[:.]/i.test(text) || /your code is/i.test(text) || /your otp/i.test(text)) {
    return true;
  }

  return false;
}

// ============================================================================
// Contains Number Check (internal helper)
// ============================================================================

function containsNumber(text: string): boolean {
  if (!text) return false;

  // Check for digits in any numeral system (Western + Arabic-Indic)
  return /[\d٠-٩]/.test(text);
}

// ============================================================================
// Contains Currency Indicator Check (internal helper)
// ============================================================================

function containsCurrencyIndicator(text: string): boolean {
  if (!text) return false;

  return /[_$€£₹¥₩₽₦₵]/.test(text);
}

// ============================================================================
// Should Process Notification Filter
// ============================================================================

export function shouldProcessNotification(text: string): boolean {
  // Must contain a number AND currency indicator
  if (!containsNumber(text) || !containsCurrencyIndicator(text)) {
    return false;
  }

  // Must not be OTP or promotional
  if (isOTPNotification(text)) {
    return false;
  }
  if (isPromotionalNotification(text)) {
    return false;
  }

  return true;
}

// ============================================================================
// Start Notification Listener Service
// ============================================================================

export async function startNotificationListener(): Promise<void> {
  try {
    const permissions = await Notifications.getPermissionsAsync();

    if (permissions.status !== 'granted') {
      console.log('Notification permission not enabled. Please enable in Settings.');
      return;
    }

    console.log('Notification listener service active');
  } catch (error) {
    console.error('Failed to check notification listener:', error);
  }
}

// ============================================================================
// Process Notification Callback Interface
// ============================================================================

interface ProcessedNotification {
  text: string;
  merchant?: string;
  capture_method: 'notification';
  timestamp: number;
}

// ============================================================================
// Handle Received Notifications (Called when notification received)
// ============================================================================

export async function handleNotificationReceived(notificationEvent: any): Promise<ProcessedNotification[]> {
  const notifications: ProcessedNotification[] = [];

  try {
    let text = '';

    if (notificationEvent.notification?.title) {
      text += notificationEvent.notification.title + ' ';
    }

    if (notificationEvent.notification?.body) {
      text += notificationEvent.notification.body;
    }

    // Skip if not processable
    if (!shouldProcessNotification(text)) {
      return notifications;
    }

    // Parse with currency detector and amount parser
    const parsedTransaction = await parseNotificationText(text);

    if (parsedTransaction) {
      if (parsedTransaction.confidence === 'high') {
        console.log('Direct insert from notification:', parsedTransaction);
      } else {
        console.log('AI enhance needed from notification:', parsedTransaction);
      }
    }

  } catch (error) {
    console.error('Failed to process notification:', error);
  }

  return notifications;
}

// ============================================================================
// Parse Notification Text (internal helper - reuses Currency Detector and SMS Parser Logic)
// ============================================================================

async function parseNotificationText(text: string): Promise<ParsedTransaction | null> {
  // Import parser functions from currencyDetector (stateless pure functions)
  const { detectCurrency, parseAmount, detectDirection } = await import('./currencyDetector');

  // Step 1: Currency detection (stateless)
  const currencyDetection = detectCurrency(text);
  if (!currencyDetection) {
    return null;
  }

  // Step 2: Amount parsing (returns minor units as integer)
  const amountMinor = parseAmount(text, 'en');
  if (amountMinor === null) {
    return null;
  }

  // Step 3: Direction detection
  const direction = detectDirection(text);
  if (!direction) {
    return null;
  }

  // All three fields detected - high confidence!
  return {
    raw_text: text,
    amount_minor: amountMinor,
    currency_code: currencyDetection.code,
    type: direction,
    confidence: 'high',
  };
}

// Note: notification listener config is managed via app.json permissions and
// startNotificationListener() checks. No separate config storage needed.

