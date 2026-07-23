// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import api from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const [userName, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!userName.trim() || !password.trim()) {
            Alert.alert('Notice', 'Please enter both Username and Passcode');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/login', { userName, password });
            const token = response.data?.result?.token || response.data?.token;

            if (token) {
                await AsyncStorage.setItem('token', token);
                navigation.replace('MainApp');
            } else {
                Alert.alert('Error', 'Token not found in response');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Login failed!';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Top Logo & Title */}
                <View style={styles.headerContainer}>
                    <MaterialCommunityIcons
                        name="boxing-glove"
                        size={42}
                        color="#ffffff"
                        style={styles.logoIcon}
                    />
                    <Text style={styles.title}>
                        LOGIN
                    </Text>
                </View>

                {/* Form Inputs */}
                <View style={styles.form}>
                    {/* USERNAME */}
                    <Text style={styles.label}>USERNAME</Text>
                    <View style={styles.inputWrapper}>
                        <Feather name="credit-card" size={18} color="#6e7681" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your registered ID"
                            placeholderTextColor="#484f58"
                            value={userName}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

                    {/* PASSCODE */}
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>PASSCODE</Text>

                    </View>
                    <View style={styles.inputWrapper}>
                        <Feather name="key" size={18} color="#6e7681" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#484f58"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Feather
                                name={showPassword ? 'eye-off' : 'eye'}
                                size={18}
                                color="#6e7681"
                            />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => Alert.alert('Notice', 'Feature coming soon!')}>
                        <Text style={styles.recoverText}>Recover?</Text>
                    </TouchableOpacity>
                    {/* LOGIN BUTTON */}
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#0d1117" />
                        ) : (
                            <View style={styles.buttonContent}>
                                <Feather name="log-in" size={18} color="#0d1117" style={{ marginRight: 8 }} />
                                <Text style={styles.buttonText}>Login</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* FOOTER */}
                    <View style={styles.footerRow}>
                        <Text style={styles.footerText}>New Hunter? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.signUpText}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#080a0f', // Đen chuẩn tối giản
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
        color: '#ffffff',
        letterSpacing: 2,
    },
    cursor: {
        color: '#ffffff',
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
        color: '#8b949e',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    recoverText: {
        color: '#8b949e',
        fontSize: 12,
        marginTop: 12,
        alignSelf: 'flex-end',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f131a',
        borderWidth: 1,
        borderColor: '#21262d',
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
        color: '#ffffff',
        fontSize: 14,
    },
    button: {
        backgroundColor: '#f0f6fc', // Nút trắng nổi bật
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
        color: '#0d1117',
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
        color: '#8b949e',
        fontSize: 13,
    },
    signUpText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
});