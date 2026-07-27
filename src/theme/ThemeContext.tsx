import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import { UserSetting, UserTheme } from '../models/UserSettingModel';

const SETTINGS_STORAGE_KEY = 'shadow_system_settings';

export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  mutedText: string;
  accent: string;
  danger: string;
  contrastText: string;
};

const palettes: Record<ThemeMode, ThemeColors> = {
  dark: {
    background: '#080a0f',
    surface: '#0d1117',
    elevated: '#11161d',
    border: '#21262d',
    text: '#f0f6fc',
    mutedText: '#8b949e',
    accent: '#72bce0',
    danger: '#f87171',
    contrastText: '#071017',
  },
  light: {
    background: '#f4f7fa',
    surface: '#ffffff',
    elevated: '#eef3f7',
    border: '#d7e0e7',
    text: '#17202a',
    mutedText: '#647383',
    accent: '#1976a3',
    danger: '#c43d3d',
    contrastText: '#ffffff',
  },
};

type ThemeContextValue = {
  preference: UserTheme;
  mode: ThemeMode;
  colors: ThemeColors;
  setThemePreference: (preference: UserTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveMode = (
  preference: UserTheme,
  systemScheme: ColorSchemeName
): ThemeMode => {
  if (preference === 'LIGHT') return 'light';
  if (preference === 'DARK') return 'dark';
  return systemScheme === 'light' ? 'light' : 'dark';
};

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setThemePreference] = useState<UserTheme>('SYSTEM');

  useEffect(() => {
    const restoreTheme = async () => {
      const cached = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!cached) return;

      try {
        const settings = JSON.parse(cached) as Partial<UserSetting>;
        if (
          settings.theme === 'SYSTEM' ||
          settings.theme === 'LIGHT' ||
          settings.theme === 'DARK'
        ) {
          setThemePreference(settings.theme);
        }
      } catch (error) {
        console.log('Restore theme error:', error);
      }
    };

    void restoreTheme();
  }, []);

  const mode = resolveMode(preference, systemScheme);
  const value = useMemo(
    () => ({
      preference,
      mode,
      colors: palettes[mode],
      setThemePreference,
    }),
    [mode, preference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider');
  }
  return context;
}

const LIGHT_NEUTRAL_MAP: Record<string, keyof ThemeColors> = {
  '#08090d': 'background',
  '#080a0f': 'background',
  '#121212': 'background',
  '#0d1117': 'surface',
  '#0f131a': 'surface',
  '#111216': 'elevated',
  '#11161d': 'elevated',
  '#161b22': 'elevated',
  '#21262d': 'border',
  '#272c35': 'border',
  '#30363d': 'border',
  '#373940': 'border',
  '#ffffff': 'text',
  '#fff': 'text',
  '#f0f6fc': 'text',
  '#f4f4f5': 'text',
  '#e5e7eb': 'text',
  '#d2d3d8': 'text',
  '#c4c7ce': 'text',
  '#8b949e': 'mutedText',
  '#8d919b': 'mutedText',
  '#777982': 'mutedText',
  '#777d88': 'mutedText',
  '#6e7681': 'mutedText',
  '#6f737c': 'mutedText',
  '#616670': 'mutedText',
  '#484f58': 'mutedText',
  '#071017': 'contrastText',
};

export const themeColor = (colors: ThemeColors, color: string): string => {
  const normalized = color.toLowerCase();
  const token = LIGHT_NEUTRAL_MAP[normalized];
  if (token) return colors[token];

  const isLightTheme = colors.background === palettes.light.background;
  if (!isLightTheme) return color;

  const hexMatch = normalized.match(/^#([0-9a-f]{6})$/);
  if (hexMatch) {
    const value = hexMatch[1];
    const channels = [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
    const spread = Math.max(...channels) - Math.min(...channels);
    const brightness =
      channels.reduce((total, channel) => total + channel, 0) / 3;

    if (brightness < 45 && spread <= 40) {
      return colors.elevated;
    }

    if (spread <= 14) {
      if (brightness < 25) return colors.elevated;
      if (brightness < 80) return colors.border;
      if (brightness < 180) return colors.mutedText;
      return colors.text;
    }
  }

  const rgbaMatch = normalized.match(
    /^rgba\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*([\\d.]+)\\s*\\)$/
  );
  if (rgbaMatch) {
    const red = Number(rgbaMatch[1]);
    const green = Number(rgbaMatch[2]);
    const blue = Number(rgbaMatch[3]);
    const alpha = Number(rgbaMatch[4]);
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);

    if (spread <= 14 && red + green + blue > 0 && alpha >= 0.7) {
      return `rgba(255,255,255,${alpha})`;
    }
    if (spread <= 14 && red >= 240) {
      return `rgba(23,32,42,${alpha})`;
    }
  }

  return color;
};
