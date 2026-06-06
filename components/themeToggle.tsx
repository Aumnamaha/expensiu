import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toggleTheme, getCurrentTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const [currentThemeName, setCurrentThemeName] = React.useState<string>('');

  React.useEffect(() => {
    loadCurrentTheme();
  }, []);

  async function loadCurrentTheme() {
    try {
      const theme = await getCurrentTheme();
      setCurrentThemeName(theme);
    } catch (e) {
      console.error('Failed to load current theme:', e);
    }
  }

  async function handleToggle() {
    toggleTheme();
    loadCurrentTheme();
  }

  const getThemeIcon = () => {
    switch (currentThemeName) {
      case 'dark':
        return 'moon-outline';
      case 'light':
        return 'sunny-outline';
      case 'ocean':
        return 'water-outline';
      case 'forest':
        return 'leaf-outline';
      default:
        return 'moon-outline';
    }
  };

  const getThemeLabel = () => {
    switch (currentThemeName) {
      case 'dark':
        return 'Dark';
      case 'light':
        return 'Light';
      case 'ocean':
        return 'Ocean';
      case 'forest':
        return 'Forest';
      default:
        return 'Dark';
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleToggle}
      activeOpacity={0.8}
    >
      <Ionicons name={getThemeIcon()} size={20} color="#ffffff" />
      <Text style={styles.label}>{getThemeLabel()}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#e0e0e0',
    marginLeft: 4,
  },
});
