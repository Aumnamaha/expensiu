import { useEffect } from 'react';
import { Stack } from 'expo-router';

export default function OnboardingIndex() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" options={{ title: 'Welcome', presentation: 'card' }} />
      <Stack.Screen name="permissions" options={{ title: 'Permissions', presentation: 'card' }} />
      <Stack.Screen name="questionnaire" options={{ title: 'Questionnaire', presentation: 'card' }} />
      <Stack.Screen name="model-download" options={{ title: 'AI Model Download', presentation: 'card' }} />
    </Stack>
  );
}
