import React, { useEffect } from 'react';
import './src/i18n';

import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './src/navigation/types';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import HunterProfileScreen from './src/screens/HunterProfileScreen';
import { listenForFcmTokenChanges } from './src/services/notificationService';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { colors, mode } = useAppTheme();
  const navigationTheme: Theme = {
    dark: mode === 'dark',
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void listenForFcmTokenChanges()
      .then((listener) => {
        unsubscribe = listener;
      })
      .catch((error) => {
        console.warn('FCM token listener is unavailable:', error);
      });

    return () => unsubscribe?.();
  }, []);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="MainApp" component={MainTabNavigator} />
        <Stack.Screen name="HunterProfile" component={HunterProfileScreen}/>
      </Stack.Navigator>


    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
