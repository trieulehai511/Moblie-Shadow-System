import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, ScrollView, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import {
  HapticTouchableOpacity as TouchableOpacity,
} from '../components/HapticPressables';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import {
  ThemeColors,
  themeColor,
  useAppTheme,
} from '../theme/ThemeContext';



function RegisterScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [userName, setUserName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPasswordConfirm, setShowPasswordConfirm] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [age, setAge] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);


  const handleRegister = async () => {
    if (userName.trim() === '' || password.trim() === '' || confirmPassword.trim() === '' || fullName.trim() === '' || age.trim() === '') {
      Alert.alert(t('common.notice'), t('register.fillAllFields'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.notice'), t('register.passwordMismatch'));
      return;
    }

    if (isNaN(Number(age)) || Number(age) <= 0) {
      Alert.alert(t('common.notice'), t('register.invalidAge'));
      return;
    }
    // if (Number(age) < 16) {
    //   Alert.alert('Notice', 'You must be at least 16 years old to register');
    //   return;
    // }
    setLoading(true);
    try {
      const response = await api.post('/hunter', { userName, password, profile: { fullName, age: Number(age) } });
      if (response.status === 200 || response.status === 201 || response.data?.code === 200) {
        Alert.alert(t('common.success'), t('register.success'));
        navigation.replace('Login');
      }

    } catch (error: any) {
      const msg = error.response?.data?.message || t('register.failed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }

  }


  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          {/* title */}
          <MaterialCommunityIcons
            name="boxing-glove"
            size={42}
            color={themeColor(colors, '#ffffff')}
          // style={styles.logoIcon}
          />
          <Text style={[styles.title, { color: colors.text }]}>
            {t('register.title')}
          </Text>
        </View>
        {/* Form inputs */}
        <View style={styles.form}>
          <Text style={styles.label}>{t('register.username')}</Text>
          <View style={styles.inputWrapper}>

            <TextInput
              placeholderTextColor={themeColor(colors, '#484f58')}
              style={styles.input}
              autoCapitalize="none"
              placeholder={t('register.usernamePlaceholder')}
              value={userName}
              onChangeText={setUserName}
            />
          </View>
          <Text style={styles.label}>{t('register.passcode')}</Text>
          <View style={styles.inputWrapper}>

            <TextInput
              placeholderTextColor={themeColor(colors, '#484f58')}
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}

            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={18}
                color={themeColor(colors, '#6e7681')}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>{t('register.confirmPasscode')}</Text>
          <View style={styles.inputWrapper}>

            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={confirmPassword}
              placeholderTextColor={themeColor(colors, '#484f58')}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPasswordConfirm}
            />

            <TouchableOpacity onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}>
              <Feather
                name={showPasswordConfirm ? 'eye-off' : 'eye'}
                size={18}
                color={themeColor(colors, '#6e7681')}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>{t('register.fullName')}</Text>
          <View style={styles.inputWrapper}>

            <TextInput
              placeholder={t('register.fullNamePlaceholder')}
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
              placeholderTextColor={themeColor(colors, '#484f58')}
            />
          </View>
          <Text style={styles.label}>{t('register.age')}</Text>
          <View style={styles.inputWrapper}>

            <TextInput
              keyboardType="number-pad"
              placeholder={t('register.agePlaceholder')}
              maxLength={3}
              value={age}
              onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
              style={styles.input}
              placeholderTextColor={themeColor(colors, '#484f58')}
            />
          </View>
          <TouchableOpacity style={styles.button} disabled={loading} onPress={handleRegister}>
            {loading ? (
              <ActivityIndicator color={themeColor(colors, '#0d1117')} />
            ) : (
              <Text style={styles.buttonText}>{t('register.submit')}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{t('register.hasAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.registerText}>{t('register.signIn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColor(colors, '#080a0f'), // Đen chuẩn tối giản
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  text: {
    color: themeColor(colors, '#fff'),
    fontSize: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoIcon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: themeColor(colors, '#ffffff'),
    letterSpacing: 2,
  },
  cursor: {
    color: themeColor(colors, '#ffffff'),
    fontWeight: '300',
  },
  form: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  label: {
    color: themeColor(colors, '#8b949e'),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  recoverText: {
    color: themeColor(colors, '#8b949e'),
    fontSize: 12,
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColor(colors, '#0f131a'),
    borderWidth: 1,
    borderColor: themeColor(colors, '#21262d'),
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: themeColor(colors, '#ffffff'),
    fontSize: 14,
  },
  button: {
    backgroundColor: themeColor(colors, '#f0f6fc'), // Nút trắng nổi bật
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: themeColor(colors, '#0d1117'),
    fontWeight: '700',
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: themeColor(colors, '#8b949e'),
    fontSize: 13,
  },
  registerText: {
    color: themeColor(colors, '#ffffff'),
    fontSize: 13,
    fontWeight: '700',
  },
});

export default RegisterScreen;
