// ============================================================================
// Theme System for ExpensiU
// Contains all theme color palettes including: Dark, Light, Ocean Blue, Forest Green
// ============================================================================

export type ThemeType = 'dark' | 'light' | 'ocean' | 'forest' | 'slate';

export interface ThemeColors {
  background: string;
  surface: string;
  foreground: string;
  border: string;
  primary: string;
  secondary: string;
  success: string;
  danger: string;
  warning: string;
}

// ============================================================================
// Theme Palettes
// ============================================================================

export const DARK_THEME: ThemeColors = {
  background: '#0d0d0d',
  surface: '#121212',
  foreground: '#e0e0e0',
  border: '#2a2a2a',
  primary: '#1f6feb',
  secondary: '#525252',
  success: '#4ade80',
  danger: '#f87171',
  warning: '#fbbf24',
};

export const LIGHT_THEME: ThemeColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  foreground: '#1a1a1a',
  border: '#e5e5e5',
  primary: '#3b82f6',
  secondary: '#737373',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

export const OCEAN_THEME: ThemeColors = {
  background: '#0a1628',
  surface: '#112240',
  foreground: '#e0f2fe',
  border: '#1d3c5f',
  primary: '#0ea5e9', // Ocean blue accent
  secondary: '#334e7a',
  success: '#22d3ee',
  danger: '#ef4444',
  warning: '#fbbf24',
};

export const FOREST_THEME: ThemeColors = {
  background: '#0a1a0f',
  surface: '#132b16',
  foreground: '#ecfdf5',
  border: '#164e38',
  primary: '#22c55e', // Forest green accent
  secondary: '#376a47',
  success: '#4ade80',
  danger: '#ef4444',
  warning: '#fbbf24',
};

export const SLATE_THEME: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  foreground: '#0f172a', // Slate dark text
  border: '#e2e8f0', // Slate light border
  primary: '#6366F1', // Indigo accent
  secondary: '#64748b', // Slate medium
  success: '#10B981', // Emerald green
  danger: '#EF4444', // Red
  warning: '#F59E0B', // Amber yellow
};

export const ALL_THEMES = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
  ocean: OCEAN_THEME,
  forest: FOREST_THEME,
  slate: SLATE_THEME,
} as const;

export type ThemeKeys = keyof typeof ALL_THEMES;

export type ThemeName = keyof typeof ALL_THEMES;

// ============================================================================
// Default Theme (Dark)
// ============================================================================

export const DEFAULT_THEME: ThemeColors = DARK_THEME;
