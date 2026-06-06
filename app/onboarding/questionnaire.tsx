import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../hooks/useTheme';
import { saveUserProfile } from '../../db/database';

type QuestionType = 1 | 2 | 3 | 4;

interface QuestionOption {
  id: string;
  label: string;
  emoji: string;
  isTheme?: boolean;
  themeType?: 'dark' | 'light' | 'ocean' | 'forest' | 'slate';
}

interface QuestionData {
  question: string;
  options: QuestionOption[];
}

const QUESTIONS: Record<QuestionType, QuestionData> = {
  1: {
    question: "What's your money goal?",
    options: [
      { id: 'save', label: 'Save more money', emoji: '💰' },
      { id: 'track', label: 'Track my spending', emoji: '📊' },
      { id: 'budget', label: 'Stick to a budget', emoji: '🎯' },
      { id: 'habits', label: 'Build better habits', emoji: '🌱' },
    ],
  },
  2: {
    question: "How often do you spend?",
    options: [
      { id: 'daily', label: 'Multiple times daily', emoji: '🛒' },
      { id: 'weekly', label: 'A few times a week', emoji: '📅' },
      { id: 'monthly', label: 'Monthly mostly', emoji: '🗓️' },
      { id: 'rarely', label: 'Rarely, big purchases', emoji: '💳' },
    ],
  },
  3: {
    question: "What matters most to you?",
    options: [
      { id: 'privacy', label: 'Total privacy', emoji: '🔒' },
      { id: 'speed', label: 'Quick entry', emoji: '⚡' },
      { id: 'insights', label: 'Detailed insights', emoji: '📈' },
      { id: 'reminders', label: 'Smart reminders', emoji: '🔔' },
    ],
  },
  4: {
    question: "Pick your vibe:",
    options: [
      { id: 'dark', label: 'Dark & minimal', emoji: '🌙', isTheme: true, themeType: 'dark' },
      { id: 'light', label: 'Light & clean', emoji: '☀️', isTheme: true, themeType: 'light' },
      { id: 'ocean', label: 'Ocean blue', emoji: '🌊', isTheme: true, themeType: 'ocean' },
      { id: 'forest', label: 'Forest green', emoji: '🌿', isTheme: true, themeType: 'forest' },
      { id: 'slate', label: 'Slate clean', emoji: '🏢', isTheme: true, themeType: 'slate' },
    ],
  },
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function QuestionnaireScreen() {
  const router = useRouter();
  const { colors, setTheme } = useTheme();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionType>(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentQuestion / 4,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentQuestion]);

  const handleOptionPress = async (option: QuestionOption) => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Save current selection locally
    const newAnswers = { ...answers, [currentQuestion]: option.id };
    setAnswers(newAnswers);

    // Preview theme immediately if Q4
    if (option.isTheme && option.themeType) {
      setTheme(option.themeType);
    }

    if (currentQuestion < 4) {
      // Slide out to Left
      Animated.timing(slideAnim, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setCurrentQuestion((prev) => (prev + 1) as QuestionType);
        slideAnim.setValue(SCREEN_WIDTH);
        // Slide in from Right
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setIsAnimating(false);
        });
      });
    } else {
      // Save answers to user profile and navigate to Home
      try {
        await AsyncStorage.setItem('@expensiu:money_goal', newAnswers[1] || '');
        await AsyncStorage.setItem('@expensiu:spend_frequency', newAnswers[2] || '');
        await AsyncStorage.setItem('@expensiu:what_matters', newAnswers[3] || '');
        await AsyncStorage.setItem('@expensiu:vibe', option.themeType || 'dark');

        // Initialise standard user profile in database
        const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', BRL: 'R$' };
        await saveUserProfile({
          name: 'Friend',
          monthly_budget_minor: 100000,
          currency_code: 'USD',
          currency_symbol: '$',
          locale: 'en',
          ai_model_downloaded: false,
          ai_model_version: '',
        });
      } catch (err) {
        console.error('Failed to save profile answers:', err);
      }

      // Final slide animation and transition to home
      Animated.timing(slideAnim, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        router.replace('/');
      });
    }
  };

  const handleBack = () => {
    if (isAnimating || currentQuestion <= 1) return;
    setIsAnimating(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Slide out to Right
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentQuestion((prev) => (prev - 1) as QuestionType);
      slideAnim.setValue(-SCREEN_WIDTH);
      // Slide in from Left
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
      });
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header and Progress section */}
      <View style={styles.header}>
        {currentQuestion > 1 ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}

        {/* Progress dots */}
        <View style={styles.dotsContainer}>
          {[1, 2, 3, 4].map((step) => (
            <View
              key={step}
              style={[
                styles.dot,
                { backgroundColor: colors.border },
                currentQuestion === step && [styles.activeDot, { backgroundColor: colors.primary, width: 24 }],
              ]}
            />
          ))}
        </View>

        <View style={styles.backButtonPlaceholder} />
      </View>

      {/* Progress Bar Line */}
      <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: colors.primary,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Sliding Content Window */}
      <View style={styles.slideWindow}>
        <Animated.View style={[styles.slideContainer, { transform: [{ translateX: slideAnim }] }]}>
          <Text style={[styles.questionTitle, { color: colors.foreground }]}>
            {QUESTIONS[currentQuestion].question}
          </Text>

          <ScrollView
            style={styles.scrollStyle}
            contentContainerStyle={styles.optionsScrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {QUESTIONS[currentQuestion].options.map((option) => {
              const isSelected = answers[currentQuestion] === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleOptionPress(option)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <Text style={[styles.optionLabel, { color: colors.foreground, fontWeight: isSelected ? '700' : '600' }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    height: 8,
    borderRadius: 4,
  },
  progressBarBg: {
    height: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  slideWindow: {
    flex: 1,
    overflow: 'hidden',
  },
  slideContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  questionTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  scrollStyle: {
    flex: 1,
  },
  optionsScrollContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 16,
  },
});
