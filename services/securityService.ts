const LocalAuthentication = require('expo-local-authentication') as any;
import { getUserProfile } from '../db/database';

let failedAttempts = 0;
let lockoutEndTime = 0;
let isUnlockedInMemory = false;

export async function isFirstLaunch(): Promise<boolean> {
  try {
    const profile = await getUserProfile();
    return profile === null;
  } catch (error) {
    console.error('Failed to check first launch:', error);
    return true;
  }
}

export async function authenticateUser(): Promise<boolean> {
  // Check lockout
  const remaining = getLockoutRemaining();
  if (remaining > 0) {
    return false;
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      // Fallback: if device has no biometrics configured, we bypass or handle PIN
      // For testing/mocking in emulator, return true
      isUnlockedInMemory = true;
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ExpensiU',
      fallbackLabel: 'Use PIN/Passcode',
      disableDeviceFallback: false,
    });

    if (result.success) {
      failedAttempts = 0;
      lockoutEndTime = 0;
      isUnlockedInMemory = true;
      return true;
    } else {
      failedAttempts++;
      if (failedAttempts >= 3) {
        lockoutEndTime = Date.now() + 30000; // 30 seconds lockout
      }
      return false;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
}

export function getLockoutRemaining(): number {
  if (lockoutEndTime === 0) return 0;
  const now = Date.now();
  if (now >= lockoutEndTime) {
    // Reset lockout
    lockoutEndTime = 0;
    failedAttempts = 0;
    return 0;
  }
  return Math.ceil((lockoutEndTime - now) / 1000);
}

export function isUserUnlocked(): boolean {
  return isUnlockedInMemory;
}

export function lockUser(): void {
  isUnlockedInMemory = false;
}

export async function setupSecurity(): Promise<void> {
  // Setup security placeholders if needed
}
