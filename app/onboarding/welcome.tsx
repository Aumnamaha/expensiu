import { useRouter } from "expo-router";
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/onboarding/permissions");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>💰</Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.foreground }]}>ExpensiU</Text>

      {/* Tagline */}
      <Text style={[styles.tagline, { color: colors.primary }]}>Your money. Your device.</Text>

      {/* Description */}
      <Text style={styles.description}>
        Track your expenses privately and intelligently, with AI-powered insights that never leave your device.
      </Text>

      {/* Feature highlights */}
      <View style={styles.featuresContainer}>
        <Feature highlight="🔒 100% Offline" colors={colors} />
        <Feature highlight="📱 All currencies & countries" colors={colors} />
        <Feature highlight="🤖 Local AI Intelligence" colors={colors} />
        <Feature highlight="🛡️ Biometric Protection" colors={colors} />
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={[styles.getStartedButton, { backgroundColor: colors.primary }]}
        onPress={handleStart}
        activeOpacity={0.8}
      >
        <Text style={styles.getStartedText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

interface FeatureProps {
  highlight: string;
  colors: any;
}

class Feature extends React.Component<FeatureProps> {
  render(): JSX.Element {
    const { highlight, colors } = this.props;
    return (
      <View style={styles.featureRow}>
        <Text style={[styles.featureCheck, { color: colors.primary }]}>✓</Text>
        <Text style={[styles.featureText, { color: colors.foreground }]}>{highlight}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoContainer: { marginBottom: 24 },
  logoIcon: { fontSize: 80 },
  title: { fontSize: 44, fontWeight: '900', marginTop: 12, letterSpacing: -1 },
  tagline: { fontSize: 20, fontWeight: '700', marginTop: 4, letterSpacing: -0.2 },
  description: { color: '#64748b', fontSize: 16, textAlign: 'center', maxWidth: 300, marginTop: 16, marginBottom: 24, lineHeight: 24 },
  featuresContainer: { alignItems: 'flex-start', gap: 12, padding: 20, marginVertical: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  featureCheck: { fontSize: 20, marginRight: 12, fontWeight: '800' },
  featureText: { fontSize: 15, fontWeight: '600' },
  getStartedButton: { paddingHorizontal: 54, paddingVertical: 18, borderRadius: 30, marginTop: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  getStartedText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
