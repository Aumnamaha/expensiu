import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authenticateUser, getLockoutRemaining } from '../services/securityService';

export default function LockScreen() {
  const [loading, setLoading] = useState(false);
  const [lockoutSecs, setLockoutSecs] = useState(getLockoutRemaining());

  // Prevent Screen Capture (no screenshots)
  useEffect(() => {
    try {
      const ScreenCapture = require('expo-screen-capture');
      ScreenCapture.preventScreenCaptureAsync();
    } catch (e) {
      // Ignored if package not installed
    }
  }, []);

  // Poll lockout timer if locked out
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutSecs > 0) {
      timer = setInterval(() => {
        const remaining = getLockoutRemaining();
        setLockoutSecs(remaining);
        if (remaining === 0) {
          clearInterval(timer);
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutSecs]);

  async function handleUnlock() {
    if (lockoutSecs > 0) return;
    setLoading(true);

    try {
      const success = await authenticateUser();
      if (success) {
        router.replace('/');
      } else {
        const remaining = getLockoutRemaining();
        if (remaining > 0) {
          setLockoutSecs(remaining);
        } else {
          Alert.alert(
            'Access Denied',
            'Authentication failed. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('LockScreen authentication failed:', error);
    } finally {
      setLoading(false);
    }
  }

  // Trigger unlock on mount automatically
  useEffect(() => {
    handleUnlock();
  }, []);

  return (
    <View style={styles.container}>
      {/* Superlist-style Branding */}
      <View style={styles.brandContainer}>
        <Text style={styles.wordmark}>ExpensiU</Text>
        <Text style={styles.tagline}>Your money. Your device. Your privacy.</Text>
      </View>

      {/* Lock Icon Indicator */}
      <View style={styles.lockContainer}>
        <Ionicons name="shield-checkmark-outline" size={64} color="#00C896" />
      </View>

      {/* Unlock Section */}
      <View style={styles.actionContainer}>
        {lockoutSecs > 0 ? (
          <View style={styles.lockoutBox}>
            <Text style={styles.lockoutText}>Temporarily Locked Out</Text>
            <Text style={styles.lockoutTimer}>Try again in {lockoutSecs}s</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={handleUnlock}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <>
                <Ionicons name="finger-print-outline" size={24} color="#080808" style={{ marginRight: 8 }} />
                <Text style={styles.unlockButtonText}>Tap to Unlock</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Security Badge Footer */}
      <View style={styles.footer}>
        <Ionicons name="lock-closed-outline" size={14} color="#555" style={{ marginRight: 4 }} />
        <Text style={styles.footerText}>100% Offline • AES-256 Encrypted</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808', // Pitch black
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  wordmark: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    letterSpacing: -0.2,
  },
  lockContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#222222',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff', // Clean white contrast button
    width: '100%',
    maxWidth: 260,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#080808',
  },
  lockoutBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1010',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a1515',
    width: '100%',
    maxWidth: 280,
  },
  lockoutText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  lockoutTimer: {
    color: '#ffc9c9',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#555555',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
