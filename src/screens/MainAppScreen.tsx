import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  HapticTouchableOpacity as TouchableOpacity,
} from '../components/HapticPressables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import {
  ThemeColors,
  themeColor,
  useAppTheme,
} from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'MainApp'>;

function MainAppScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('main.welcome')}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedText }]}>{t('main.loginSuccess')}</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: themeColor(colors, '#121212'),
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: themeColor(colors, '#fff'),
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: themeColor(colors, '#888888'),
    marginBottom: 30,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
  },
  buttonText: {
    color: themeColor(colors, '#fff'),
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MainAppScreen;
