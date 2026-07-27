import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('leaderboard.title')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080a0f', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#ffffff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
});
