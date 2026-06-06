import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DARK_THEME, LIGHT_THEME, OCEAN_THEME, FOREST_THEME, ThemeColors, DEFAULT_THEME, ALL_THEMES, ThemeName } from '../constants/theme';

const THEME_KEY = 'expensiu_theme';
const DEFAULT_THEME_NAME = 'dark';

export interface ThemeConfig {
  colors: ThemeColors;
  currentThemeName: ThemeName;
  cycle: () => void;
  setTheme: (theme: ThemeType | ThemeName) => void;
  toggle: () => void;
}

export type ThemeType = 'dark' | 'light' | 'ocean' | 'forest';

// ============================================================================
// Theme Hook
// ============================================================================

export function useTheme(): ThemeConfig {
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_THEME);
  const [currentThemeName, setCurrentThemeName] = useState<ThemeName>(DEFAULT_THEME_NAME as ThemeName);

  // Load theme from storage on mount
  useEffect(() => {
    loadTheme();
  }, []);

  async function loadTheme() {
    try {
      let themeId: string | null = await SecureStore.getItemAsync(THEME_KEY);

      if (!themeId || themeId === DEFAULT_THEME_NAME) {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);
        themeId = (savedTheme ?? DEFAULT_THEME_NAME) as string;
        await SecureStore.setItemAsync(THEME_KEY, themeId);
      }

      if (themeId && ALL_THEMES.hasOwnProperty(themeId)) {
        setThemeColors(ALL_THEMES[themeId as ThemeName]);
        setCurrentThemeName(themeId as ThemeName);
        return;
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }

    // Fallback to default
    setThemeColors(DEFAULT_THEME);
    setCurrentThemeName('dark');
  }

  function cycleTheme(): void {
    const themes: ThemeName[] = ['dark', 'light', 'ocean', 'forest', 'slate'];
    const currentIndex = themes.indexOf(currentThemeName);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    SecureStore.setItemAsync(THEME_KEY, nextTheme).then(() => {
      AsyncStorage.setItem(THEME_KEY, nextTheme);
    }).catch(console.error);

    setThemeColors(ALL_THEMES[nextTheme]);
    setCurrentThemeName(nextTheme as ThemeName);
  }

  function setTheme(theme: ThemeType | ThemeName): void {
    SecureStore.setItemAsync(THEME_KEY, theme).then(() => {
      AsyncStorage.setItem(THEME_KEY, theme);
    }).catch(console.error);

    setThemeColors(ALL_THEMES[theme as ThemeName]);
    setCurrentThemeName(theme as ThemeName);
  }

  function toggleTheme(): void {
    cycleTheme();
  }

  return {
    colors: themeColors,
    currentThemeName,
    cycle: cycleTheme,
    setTheme,
    toggle: toggleTheme,
  };
}

export async function toggleTheme(): Promise<void> {
  const themes: ThemeName[] = ['dark', 'light', 'ocean', 'forest', 'slate'];
  try {
    let current: string | null = await AsyncStorage.getItem(THEME_KEY);
    if (!current) {
      current = await SecureStore.getItemAsync(THEME_KEY);
    }

    const currentIndex = themes.indexOf(current as ThemeName);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    await AsyncStorage.setItem(THEME_KEY, nextTheme);
    await SecureStore.setItemAsync(THEME_KEY, nextTheme);
  } catch (error) {
    console.error('Failed to toggle theme:', error);
  }
}

export async function getCurrentTheme(): Promise<ThemeName> {
  try {
    const stored = await AsyncStorage.getItem(THEME_KEY);
    if (!stored) {
      const secureStored = await SecureStore.getItemAsync(THEME_KEY);
      return (secureStored || 'dark') as ThemeName;
    }
    return stored as ThemeName;
  } catch (error) {
    console.error('Failed to get current theme:', error);
    return 'dark';
  }
}

export async function setCurrentTheme(theme: ThemeType | ThemeName): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, theme as string);
    await SecureStore.setItemAsync(THEME_KEY, theme as string);
  } catch (error) {
    console.error('Failed to set theme:', error);
  }
}
