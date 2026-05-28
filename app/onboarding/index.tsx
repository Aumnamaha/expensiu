import { useEffect } from 'react';
import { Stack } from 'expo-router';

export default function OnboardingIndex() {
  useEffect(() => {
    // Check if AI model already downloaded
    const aiModelPath = require('expo-file-system').cacheDirectory + 'MLC/qwen2.5-0.5b.onnx';
    require('expo-file-system').readAsStringAsync(aiModelPath).catch(async (error: any) => {
      try {
        // Model not found, go to download screen
        const navigation = require('expo-router').useRouter() as any;
        navigation.push('/onboarding/model-download');
      } catch (e) {}
    });
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" options={({ navigation }: { navigation?: any }) => ({
        title: 'Welcome',
        presentation: 'card'
      })} />
      <Stack.Screen name="permissions" options={({ navigation }: { navigation?: any }) => ({
        title: 'Permissions',
        presentation: 'modal'
      })} />
      <Stack.Screen name="model-download" options={({ navigation }: { navigation?: any }) => ({
        title: 'AI Model Download',
        presentation: 'card'
      })} />
    </Stack>
  );
}
