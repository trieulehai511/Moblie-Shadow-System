import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>HUNTER PROFILE SCREEN</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080a0f', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#ffffff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
});