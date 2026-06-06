import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { authenticateUser, getLockoutRemaining } from '../services/securityService';
import { useTheme } from '../hooks/useTheme';

export default function LockScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [lockoutSecs, setLockoutSecs] = useState(getLockoutRemaining());

  // Prevent Screen Capture
  useEffect(() => {
    try {
      const ScreenCapture = require('expo-screen-capture');
      ScreenCapture.preventScreenCaptureAsync();
    } catch (e) {}
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);

    try {
      const success = await authenticateUser();
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/');
      } else {
        const remaining = getLockoutRemaining();
        if (remaining > 0) {
          setLockoutSecs(remaining);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
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

  useEffect(() => {
    handleUnlock();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Superlist-style Branding */}
      <View style={styles.brandContainer}>
        <Text style={[styles.wordmark, { color: colors.foreground }]}>ExpensiU</Text>
        <Text style={[styles.tagline, { color: colors.secondary }]}>Your money. Your device. Your privacy.</Text>
      </View>

      {/* Lock Icon Indicator */}
      <View style={[styles.lockContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={64} color={colors.success} />
      </View>

      {/* Unlock Section */}
      <View style={styles.actionContainer}>
        {lockoutSecs > 0 ? (
          <View style={[styles.lockoutBox, { borderColor: colors.danger, backgroundColor: 'rgba(239, 68, 68, 0.05)' }]}>
            <Text style={[styles.lockoutText, { color: colors.danger }]}>Temporarily Locked Out</Text>
            <Text style={[styles.lockoutTimer, { color: colors.foreground }]}>Try again in {lockoutSecs}s</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.unlockButton, { backgroundColor: colors.primary }]}
            onPress={handleUnlock}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="finger-print-outline" size={24} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.unlockButtonText}>Tap to Unlock</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Security Badge Footer */}
      <View style={styles.footer}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.secondary} style={{ marginRight: 4 }} />
        <Text style={[styles.footerText, { color: colors.secondary }]}>100% Offline • AES-256 Encrypted</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontWeight: '900',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    marginTop: 8,
    letterSpacing: -0.2,
    fontWeight: '500',
  },
  lockContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
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
    width: '100%',
    maxWidth: 260,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  lockoutBox: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    width: '100%',
    maxWidth: 280,
  },
  lockoutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  lockoutTimer: {
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
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
