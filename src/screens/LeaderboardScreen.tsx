import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>LEADERBOARD SCREEN</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080a0f', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#ffffff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
});