import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Register Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  text: {
    color: '#fff',
    fontSize: 20,
  },
});

export default RegisterScreen;