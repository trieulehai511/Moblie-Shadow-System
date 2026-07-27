// src/screens/LoginScreen.tsx
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import api from '../services/api';
import i18n from '../i18n';
import {
    getMySettings,
    toAppLanguage,
} from '../services/settingService';
import {
    ThemeColors,
    themeColor,
    useAppTheme,
} from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const { colors, setThemePreference } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [userName, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!userName.trim() || !password.trim()) {
            Alert.alert(t('common.notice'), t('auth.missingCredentials'));
            return;
        }

        setLoading(true);
        try {
            await AsyncStorage.removeItem('token');
            const response = await api.post('/auth/login', { userName, password });
            const token = response.data?.result?.token || response.data?.token;

            if (token) {
                await AsyncStorage.setItem('token', token);

                try {
                    const settings = await getMySettings();
                    const language = toAppLanguage(settings.language);

                    await i18n.changeLanguage(language);
                    setThemePreference(settings.theme);

                    await AsyncStorage.setItem(
                        'shadow_system_settings',
                        JSON.stringify(settings)
                    );
                } catch (settingsError) {
                    console.log('Load user settings error:', settingsError);
                }

                navigation.replace('MainApp', {
                    screen: 'DailyQuest',
                });
            } else {
                Alert.alert(t('common.error'), t('auth.tokenNotFound'));
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || t('auth.loginFailed');
            Alert.alert(t('common.error'), msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Top Logo & Title */}
                <View style={styles.headerContainer}>
                    <MaterialCommunityIcons
                        name="boxing-glove"
                        size={42}
                        color={themeColor(colors, '#ffffff')}
                        style={styles.logoIcon}
                    />
                    <Text style={[styles.title, { color: colors.text }]}>
                        {t('auth.title')}
                    </Text>
                </View>

                {/* Form Inputs */}
                <View style={styles.form}>
                    {/* USERNAME */}
                    <Text style={[styles.label, { color: colors.mutedText }]}>{t('auth.username')}</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Feather name="credit-card" size={18} color={themeColor(colors, '#6e7681')} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder={t('auth.usernamePlaceholder')}
                            placeholderTextColor={themeColor(colors, '#484f58')}
                            value={userName}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

                    {/* PASSCODE */}
                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: colors.mutedText }]}>{t('auth.passcode')}</Text>

                    </View>
                    <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Feather name="key" size={18} color={themeColor(colors, '#6e7681')} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder="••••••••"
                            placeholderTextColor={themeColor(colors, '#484f58')}
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
                    <TouchableOpacity
                        onPress={() =>
                            Alert.alert(
                                t('common.notice'),
                                t('auth.featureComingSoon')
                            )
                        }
                    >
                        <Text style={styles.recoverText}>{t('auth.recover')}</Text>
                    </TouchableOpacity>
                    {/* LOGIN BUTTON */}
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={themeColor(colors, '#0d1117')} />
                        ) : (
                            <View style={styles.buttonContent}>
                                <Feather name="log-in" size={18} color={themeColor(colors, '#0d1117')} style={{ marginRight: 8 }} />
                                <Text style={styles.buttonText}>{t('auth.login')}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* FOOTER */}
                    <View style={styles.footerRow}>
                        <Text style={styles.footerText}>{t('auth.newHunter')} </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.signUpText}>{t('auth.signUp')}</Text>
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
    signUpText: {
        color: themeColor(colors, '#ffffff'),
        fontSize: 13,
        fontWeight: '700',
    },
});
