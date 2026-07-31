import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import api from './api';

const DEVICE_TOKEN_STORAGE_KEY = 'shadow_system_fcm_token';

async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Shadow System',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
        });

        const currentPermission = await Notifications.getPermissionsAsync();
        if (currentPermission.status === 'granted') {
            return true;
        }

        const requestedPermission =
            await Notifications.requestPermissionsAsync();
        return requestedPermission.status === 'granted';
    }

    const {
        AuthorizationStatus,
        getMessaging,
        requestPermission,
    } = await import('@react-native-firebase/messaging');
    const authorizationStatus = await requestPermission(getMessaging());
    return (
        authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        authorizationStatus === AuthorizationStatus.PROVISIONAL
    );
}

async function sendTokenToBackend(fcmToken: string): Promise<void> {
    await api.post('/notifications/devices', {
        fcmToken,
        deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
    await AsyncStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, fcmToken);
}

export async function registerCurrentDevice(): Promise<string | null> {
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) {
        return null;
    }

    const { getMessaging, getToken } =
        await import('@react-native-firebase/messaging');
    const fcmToken = await getToken(getMessaging());
    await sendTokenToBackend(fcmToken);
    return fcmToken;
}

export async function listenForFcmTokenChanges(): Promise<() => void> {
    const { getMessaging, onTokenRefresh } =
        await import('@react-native-firebase/messaging');

    return onTokenRefresh(getMessaging(), async (fcmToken) => {
        try {
            const accessToken = await AsyncStorage.getItem('token');
            if (accessToken) {
                await sendTokenToBackend(fcmToken);
            }
        } catch (error) {
            console.warn('Update FCM token failed:', error);
        }
    });
}

export async function removeCurrentDevice(): Promise<void> {
    const fcmToken = await AsyncStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    if (!fcmToken) {
        return;
    }

    await api.delete('/notifications/devices', {
        params: { fcmToken },
    });
    await AsyncStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
}

export async function removeAllDevices(): Promise<void> {
    await api.delete('/notifications/devices/all');
    await AsyncStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
}
