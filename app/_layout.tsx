import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { initDB } from '../db/database';
import { authenticateUser, lockUser } from '../services/securityService';
import { handleNotificationTap } from '../services/notificationEngine';

// Notification configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let backgroundTimestamp = 0;

export default function RootLayout() {
  useEffect(() => {
    async function initialize() {
      try {
        await initDB();
        const profile = await require('../db/database').getUserProfile();
        
        if (!profile) {
          // Route to welcome onboarding screen
          router.replace('/onboarding/welcome');
          return;
        }

        const authed = await authenticateUser();
        if (authed) {
          router.replace('/');
        } else {
          router.replace('/lock');
        }
      } catch (e) {
        console.error('Initialization error:', e);
        router.replace('/onboarding/welcome');
      }
    }

    initialize();

    // Notification tap handler
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        handleNotificationTap(response);
      } catch (e) {
        console.error('Failed to handle notification tap:', e);
      }
    });

    // App state listener for background locking
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background') {
        backgroundTimestamp = Date.now();
      } else if (nextAppState === 'active') {
        if (backgroundTimestamp > 0 && Date.now() - backgroundTimestamp > 30000) {
          lockUser();
          router.replace('/lock');
        }
        backgroundTimestamp = 0;
      }
    });

    return () => {
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="summary" />
      <Stack.Screen name="add" />
      <Stack.Screen name="import" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="lock" />
      
      <Stack.Screen name="onboarding/welcome" />
      <Stack.Screen name="onboarding/permissions" />
      <Stack.Screen name="onboarding/model-download" />
    </Stack>
  );
}
