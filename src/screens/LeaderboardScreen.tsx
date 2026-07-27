import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ThemeColors,
  themeColor,
  useAppTheme,
} from '../theme/ThemeContext';

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.text }]}>{t('leaderboard.title')}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColor(colors, '#080a0f'), justifyContent: 'center', alignItems: 'center' },
  text: { color: themeColor(colors, '#ffffff'), fontSize: 18, fontWeight: '700', letterSpacing: 1 },
});
