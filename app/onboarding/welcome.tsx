import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>💰</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>ExpensiU</Text>

      {/* Tagline */}
      <Text style={styles.tagline}>Your money. Your device.</Text>

      {/* Description */}
      <Text style={styles.description}>
        Track your expenses privately and intelligently, with AI-powered insights that never leave your device.
      </Text>

      {/* Feature highlights */}
      <View style={styles.featuresContainer}>
        <Feature highlight="🔒 100% Offline" />
        <Feature highlight="📱 All currencies & countries" />
        <Feature highlight="🤖 Local AI Intelligence" />
        <Feature highlight="🛡️ Biometric Protection" />
      </View>

      {/* CTA Button */}
      <TouchableOpacity style={styles.getStartedButton}>
        <Text style={styles.getStartedText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

interface FeatureProps {
  highlight: string;
}

class Feature extends React.Component<FeatureProps> {
  render(): JSX.Element {
    const { highlight } = this.props;
    return (
      <View style={styles.featureRow}>
        <Text style={styles.featureCheck}>✓</Text>
        <Text style={styles.featureText}>{highlight}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoContainer: { marginBottom: 32 },
  logoIcon: { fontSize: 80 },
  title: { color: '#e0e0e0', fontSize: 42, fontWeight: 'bold', marginTop: 16 },
  tagline: { color: '#1f6feb', fontSize: 24, fontStyle: 'italic', marginTop: 4 },
  description: { color: '#8b949e', fontSize: 16, textAlign: 'center', maxWidth: 300, marginTop: 16, marginBottom: 32 },
  featuresContainer: { alignItems: 'center', gap: 8, padding: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  featureCheck: { fontSize: 20, marginRight: 8 },
  featureText: { color: '#e0e0e0', fontSize: 16 },
  getStartedButton: { backgroundColor: '#1f6feb', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 12, marginTop: 40 },
  getStartedText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
