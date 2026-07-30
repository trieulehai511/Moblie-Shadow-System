import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    HapticTouchableOpacity as TouchableOpacity,
} from '../components/HapticPressables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import {
    // ...
    TextStyle,
} from 'react-native';
import { HunterProfileResponse } from '../models/ProfileModel';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
    UserLanguage,
    UserRegion,
    UserSetting,
    UserTheme,
} from '../models/UserSettingModel';

import {
    getMySettings,
    toAppLanguage,
    updateMySettings,
} from '../services/settingService';
import { updateMyProfile } from '../services/profileService';
import {
    ThemeColors,
    themeColor,
    useAppTheme,
} from '../theme/ThemeContext';

const LANGUAGE_OPTIONS: Array<{
    value: UserLanguage;
    label: string;
    flag: string;
}> = [
        { value: 'VI', label: 'Tiếng Việt', flag: '🇻🇳' },
        { value: 'EN', label: 'English', flag: '🇺🇸' },
        { value: 'JA', label: '日本語', flag: '🇯🇵' },
        { value: 'KO', label: '한국어', flag: '🇰🇷' },
    ];

const THEME_OPTIONS: Array<{
    value: UserTheme;
    labelKey: string;
}> = [
        { value: 'SYSTEM', labelKey: 'settings.themeSystem' },
        { value: 'LIGHT', labelKey: 'settings.themeLight' },
        { value: 'DARK', labelKey: 'settings.themeDark' },
    ];

const REGION_OPTIONS: Array<{
    value: UserRegion;
    label: string;
    flag: string;
}> = [
        { value: 'VN', label: 'Việt Nam', flag: '🇻🇳' },
        { value: 'US', label: 'United States', flag: '🇺🇸' },
        { value: 'JP', label: 'Japan', flag: '🇯🇵' },
        { value: 'KR', label: 'South Korea', flag: '🇰🇷' },
        { value: 'SG', label: 'Singapore', flag: '🇸🇬' },
    ];

const rankStyles: Record<string, TextStyle> = {
    S: {
        color: '#d8b4fe',
        textShadowColor: 'rgba(168, 85, 247, 0.5)',
    },
    A: {
        color: '#ef1010',
        textShadowColor: 'rgba(239, 68, 68, 0.5)',
    },
    B: {
        color: '#fde047',
        textShadowColor: 'rgba(245, 158, 11, 0.5)',
    },
    C: {
        color: '#20ec9b',
        textShadowColor: 'rgba(16, 185, 129, 0.5)',
    },
    D: {
        color: '#93c5fd',
        textShadowColor: 'rgba(59, 130, 246, 0.5)',
    },
    E: {
        color: '#9a6b19',
        textShadowColor: 'rgba(110, 109, 38, 0.4)',
    },
};

type ProfileInfoModal = {
    title: string;
    shortLabel?: string;
    description: string;
    value?: number | string;
    message?: string;
    color?: string;
};

type AttributeLabel = 'STR' | 'AGI' | 'VIT';

const attributeMessageKeys: Record<AttributeLabel, string[]> = {
    STR: [
        'profile.attributeMessages.strength.weak',
        'profile.attributeMessages.strength.improved',
        'profile.attributeMessages.strength.formidable',
        'profile.attributeMessages.strength.surpass',
        'profile.attributeMessages.strength.limit',
        'profile.attributeMessages.strength.extraordinary',
    ],
    AGI: [
        'profile.attributeMessages.agility.weak',
        'profile.attributeMessages.agility.improved',
        'profile.attributeMessages.agility.formidable',
        'profile.attributeMessages.agility.surpass',
        'profile.attributeMessages.agility.limit',
        'profile.attributeMessages.agility.extraordinary',
    ],
    VIT: [
        'profile.attributeMessages.vitality.weak',
        'profile.attributeMessages.vitality.improved',
        'profile.attributeMessages.vitality.formidable',
        'profile.attributeMessages.vitality.surpass',
        'profile.attributeMessages.vitality.limit',
        'profile.attributeMessages.vitality.extraordinary',
    ],
};

const getAttributeMessage = (attribute: AttributeLabel, value: number) => {
    const level =
        value < 20 ? 0 :
            value < 40 ? 1 :
                value < 60 ? 2 :
                    value < 80 ? 3 :
                        value < 100 ? 4 : 5;

    return i18n.t(attributeMessageKeys[attribute][level]);
};

type AttributeCardProps = {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    value: number;
    label: string;
    gain?: number;
    rewardProgress: Animated.Value;
    onPress?: () => void;
};

function AttributeCard({
    icon,
    value,
    label,
    gain = 0,
    rewardProgress,
    onPress
}: AttributeCardProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const hasGain = gain > 0;
    const animatedCardStyle = hasGain
        ? {
            borderColor: rewardProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [
                    themeColor(colors, '#373940'),
                    themeColor(colors, '#82b89d'),
                ],
            }),
            backgroundColor: rewardProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [
                    themeColor(colors, '#111216'),
                    themeColor(colors, 'rgba(130,184,157,0.12)'),
                ],
            }),
            transform: [
                {
                    scale: rewardProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.035],
                    }),
                },
            ],
        }
        : undefined;

    return (
        <TouchableOpacity
            style={styles.attributeTouchable}
            activeOpacity={0.75}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label} attribute, current value ${value}`}
        >
            <Animated.View style={[styles.attributeCard, animatedCardStyle]}>
                <View style={styles.attributeIcon}>
                    <MaterialCommunityIcons
                        name={icon}
                        size={23}
                        color={themeColor(colors, '#f4f4f5')}
                    />
                </View>

                <View style={styles.attributeContent}>
                    <Text style={styles.attributeValue}>{value}</Text>
                    <Text style={styles.attributeLabel}>{label}</Text>
                </View>

                {hasGain ? (
                    <Animated.Text
                        style={[
                            styles.attributeGain,
                            { opacity: rewardProgress },
                        ]}
                    >
                        +{gain}
                    </Animated.Text>
                ) : null}
            </Animated.View>
        </TouchableOpacity>
    );
}

export default function ProfileScreen({ navigation }: any) {
    const { t } = useTranslation();
    const { colors, setThemePreference } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [selectedSettingsSection, setSelectedSettingsSection] = useState<
        'profile' | 'language' | 'theme' | 'region' | null
    >(null);
    const [settings, setSettings] = useState<UserSetting | null>(null);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [profile, setProfile] = useState<HunterProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editFullName, setEditFullName] = useState('');
    const [editAge, setEditAge] = useState('');
    const [editAvatar, setEditAvatar] =
        useState<ImagePicker.ImagePickerAsset | null>(null);
    const [profileSaving, setProfileSaving] = useState(false);
    const [attributeReward, setAttributeReward] = useState<
        Partial<Record<'strength' | 'agility' | 'vitality', number>> | null
    >(null);
    const [selectedInfo, setSelectedInfo] =
        useState<ProfileInfoModal | null>(null);
    const rewardProgress = useRef(new Animated.Value(0)).current;

    const rank = profile?.rankTier?.trim().toUpperCase() || 'E';
    const nextRank = profile?.nextRankTier?.trim().toUpperCase() || null;
    const rankProgressPercent = Math.min(
        Math.max(profile?.rankProgressPercent ?? 0, 0),
        100
    );
    const rpToNextRank = Math.max(profile?.rpToNextRank ?? 0, 0);
    const currentRp = Math.max(profile?.currentRp ?? 0, 0);
    const nextRankRp = currentRp + rpToNextRank;


    const fetchProfile = useCallback(async () => {
        try {
            const response = await api.get('/auth/me');
            setProfile(response.data.result);

            const storedReward = await AsyncStorage.getItem(
                'shadow_system_attribute_reward'
            );
            if (storedReward) {
                try {
                    const reward = JSON.parse(storedReward) as {
                        attributeGains?: Partial<
                            Record<'strength' | 'agility' | 'vitality', number>
                        >;
                    };
                    setAttributeReward(reward.attributeGains ?? null);
                } catch (rewardError) {
                    console.log('Read attribute reward error:', rewardError);
                } finally {
                    await AsyncStorage.removeItem(
                        'shadow_system_attribute_reward'
                    );
                }
            }
        } catch (error: any) {
            console.log('Fetch profile error:', error);
            Alert.alert(
                t('common.error'),
                error.response?.data?.message || t('profile.loadFailed')
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    useFocusEffect(
        useCallback(() => {
            void fetchProfile();
        }, [fetchProfile])
    );

    useEffect(() => {
        if (!attributeReward) return;

        rewardProgress.setValue(0);
        Animated.sequence([
            Animated.timing(rewardProgress, {
                toValue: 1,
                duration: 350,
                useNativeDriver: false,
            }),
            Animated.delay(1100),
            Animated.timing(rewardProgress, {
                toValue: 0,
                duration: 500,
                useNativeDriver: false,
            }),
        ]).start(() => setAttributeReward(null));
    }, [attributeReward, rewardProgress]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProfile();
    };

    const handleCopyHunterCode = async () => {
        if (!profile?.hunterCode) {
            return;
        }

        try {
            await Clipboard.setStringAsync(profile.hunterCode);
            Alert.alert(t('profile.copied'), t('profile.copySuccess'));
        } catch (error) {
            console.log('Copy Hunter ID error:', error);
            Alert.alert(t('common.error'), t('profile.copyFailed'));
        }
    };

    const handleLogout = () => {
        Alert.alert(
            t('profile.logout'),
            t('profile.logoutConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('profile.logout'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (token) {
                                await api.post('/auth/logout', { token });
                            }
                        } catch (error) {
                            console.log('Logout error:', error);
                        } finally {
                            await AsyncStorage.removeItem('token');
                            navigation.getParent()?.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    };

    const openSettings = async () => {
        setSelectedSettingsSection(null);
        setSettingsLoading(true);
        setSettingsVisible(true);
        try {
            const savedSettings = await getMySettings();
            setSettings(savedSettings);
        } catch (error: any) {
            Alert.alert(
                t('common.error'),
                error.response?.data?.message || t('settings.loadFailed')
            );
        } finally {
            setSettingsLoading(false);
        }
    }
    const changeSetting = async (
        field: 'language' | 'theme' | 'region',
        value: UserLanguage | UserTheme | UserRegion
    ) => {
        if (!settings || settingsSaving) {
            return;
        }

        const previousSettings = settings;

        const nextSettings: UserSetting = {
            ...settings,
            [field]: value,
        };

        // Cập nhật UI trước
        setSettings(nextSettings);
        setSettingsSaving(true);

        if (field === 'language') {
            await i18n.changeLanguage(
                toAppLanguage(value as UserLanguage)
            );
        }
        if (field === 'theme') {
            setThemePreference(value as UserTheme);
        }

        try {
            const updatedSettings = await updateMySettings({
                region: nextSettings.region,
                language: nextSettings.language,
                theme: nextSettings.theme,
            });

            setSettings(updatedSettings);

            await AsyncStorage.setItem(
                'shadow_system_settings',
                JSON.stringify(updatedSettings)
            );
        } catch (error: any) {
            // Trả lại setting cũ khi API lỗi
            setSettings(previousSettings);

            if (field === 'language') {
                await i18n.changeLanguage(
                    toAppLanguage(previousSettings.language)
                );
            }
            if (field === 'theme') {
                setThemePreference(previousSettings.theme);
            }

            Alert.alert(
                t('common.error'),
                error.response?.data?.message || t('settings.saveFailed')
            );
        } finally {
            setSettingsSaving(false);
        }
    };

    const openProfileEditor = () => {
        setEditFullName(profile?.fullName ?? '');
        setEditAge(profile?.age ? String(profile.age) : '');
        setEditAvatar(null);
        setSelectedSettingsSection('profile');
    };

    const pickAvatar = async () => {
        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
            Alert.alert(
                t('common.notice'),
                t('profile.photoPermissionRequired')
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setEditAvatar(result.assets[0]);
        }
    };

    const saveProfile = async () => {
        const fullName = editFullName.trim();
        const age = Number(editAge);

        if (!fullName) {
            Alert.alert(t('common.notice'), t('profile.fullNameRequired'));
            return;
        }

        if (!Number.isInteger(age) || age < 16) {
            Alert.alert(t('common.notice'), t('profile.minimumAge'));
            return;
        }

        setProfileSaving(true);
        try {
            const updatedProfile = await updateMyProfile(
                {
                    fullName,
                    age,
                    avatar: editAvatar ? undefined : profile?.avatar,
                },
                editAvatar ?? undefined
            );
            setProfile(updatedProfile);
            setSelectedSettingsSection(null);
            Alert.alert(t('common.success'), t('profile.updateSuccess'));
        } catch (error: any) {
            Alert.alert(
                t('common.error'),
                error.response?.data?.message || t('profile.updateFailed')
            );
        } finally {
            setProfileSaving(false);
        }
    };
    const openAttributeInfo = (
        title: string,
        shortLabel: AttributeLabel,
        description: string,
        value: number,
        color: string
    ) => {
        setSelectedInfo({
            title,
            shortLabel,
            description,
            value,
            message: getAttributeMessage(shortLabel, value),
            color,
        });
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={themeColor(colors, '#ffffff')} />
                <Text style={styles.loadingText}>{t('profile.loading')}</Text>
            </View>
        );
    }

    const displayName = profile?.fullName || profile?.userName || 'Hunter';
    const userName = profile?.userName || 'HUNTER';

    return (
        <SafeAreaView
            style={[styles.safeArea, { backgroundColor: colors.background }]}
            edges={['top']}
        >
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={themeColor(colors, '#ffffff')}
                    />
                }
            >

                <View style={styles.header1}>

                    <View style={styles.avatarWrapper}>
                        {profile?.avatar ? (
                            <Image
                                source={{ uri: profile.avatar }}
                                style={styles.avatar}
                                resizeMode="cover"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="shield-account"
                                size={62}
                                color={themeColor(colors, '#dbeafe')}
                            />
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        activeOpacity={0.8}
                        onPress={openSettings}
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.title')}
                    >
                        <Feather name="menu" size={27} color={themeColor(colors, '#72bce0')} />
                    </TouchableOpacity>
                </View>
                <View style={styles.identityRow}>
                    <Text style={styles.username}>{userName}</Text>
                </View>

                <View style={styles.summaryRow}>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: t('profile.rankPoint'),
                            shortLabel: 'RP',
                            description: t('profile.rankPointDescription'),
                            value: currentRp,
                            message: nextRank
                                ? t('profile.rpRemaining', { count: rpToNextRank, rank: nextRank })
                                : t('profile.highestRank'),
                            color: themeColor(colors, '#72bce0'),
                        })}
                    >
                        <Text style={styles.summaryValue}>{profile?.currentRp ?? 0}</Text>
                        <Text style={styles.summaryLabel}> RP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: t('profile.currentStreak'),
                            description: t('profile.currentStreakDescription'),
                            value: profile?.currentStreak ?? 0,
                            message: t('profile.maintainStreak'),
                            color: themeColor(colors, '#f97316'),
                        })}
                    >
                        <Text style={styles.summaryValue}>{profile?.currentStreak ?? 0}</Text>
                        <Text style={styles.summaryLabel}> {t('profile.streak')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: t('profile.bestStreak'),
                            description: t('profile.bestStreakDescription'),
                            value: profile?.maxStreak ?? 0,
                            message: t('profile.surpassRecord'),
                            color: themeColor(colors, '#eab308'),
                        })}
                    >
                        <Text style={styles.summaryValue}>{profile?.maxStreak ?? 0}</Text>
                        <Text style={styles.summaryLabel}> {t('profile.best')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: t('profile.hunterRank'),
                            description: t('profile.hunterRankDescription'),
                            value: rank,
                            message: nextRank
                                ? t('profile.nextPromotion', { rank: nextRank })
                                : t('profile.highestRank'),
                            color: rankStyles[rank]?.color as string ?? '#9a6b19',
                        })}
                    >
                        <Text style={[styles.summaryValue, styles.rankText, rankStyles[rank] || rankStyles.E]}>{profile?.rankTier || 'E'}</Text>
                        <Text style={styles.summaryLabel}> {t('profile.rank')}</Text>
                    </TouchableOpacity>
                </View>

                <View
                    style={styles.rankProgressCard}
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={
                        nextRank
                            ? `Progress to Rank ${nextRank}`
                            : t('profile.maximumRank')
                    }
                    accessibilityValue={{
                        min: 0,
                        max: 100,
                        now: Math.round(rankProgressPercent),
                        text: nextRank
                            ? `${rpToNextRank} RP remaining`
                            : t('profile.maximumRank'),
                    }}


                >
                    <View style={styles.rankProgressHeader}>
                        <Text style={styles.rankProgressTitle}>
                            {t('profile.rankProgress')}
                        </Text>
                        <Text style={styles.rankProgressRanks}>
                            <Text
                                style={[
                                    styles.rankText,
                                    rankStyles[rank] || rankStyles.E,
                                ]}
                            >
                                {rank}
                            </Text>
                            {nextRank ? (
                                <>
                                    <Text style={styles.rankProgressSeparator}>
                                        {' → '}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.rankText,
                                            rankStyles[nextRank] || rankStyles.E,
                                        ]}
                                    >
                                        {nextRank}
                                    </Text>
                                </>
                            ) : (
                                <Text style={styles.rankProgressSeparator}>
                                    {' • MAX'}
                                </Text>
                            )}
                        </Text>
                    </View>
                    <View style={styles.progressTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${rankProgressPercent}%`,
                                },
                            ]}
                        />
                    </View>

                    <View style={styles.rankProgressFooter}>
                        <Text style={styles.progressPercentText}>
                            {nextRank
                                ? `${currentRp} / ${nextRankRp} RP`
                                : `${currentRp} RP`}
                        </Text>

                        <Text style={styles.remainingRpText}>
                            {nextRank
                                ? `${rankProgressPercent.toFixed(2)}% • ${rpToNextRank} RP LEFT`
                                : t('profile.maximumRank')}
                        </Text>
                    </View>

                </View>
                <View style={styles.profileDetails}>
                    <Text style={styles.fullName}>{displayName}</Text>
                    <Text style={styles.description}>
                        {t('profile.awakenedHunter')} <Text style={styles.dot}>•</Text> {t('profile.age')}: {profile?.age ?? t('common.notAvailable')}
                    </Text>
                    <View style={styles.hunterCodeRow}>
                        <Text style={styles.hunterCode}>
                            ID: {profile?.hunterCode || 'UNASSIGNED'}
                        </Text>
                        {profile?.hunterCode ? (
                            <TouchableOpacity
                                style={styles.copyButton}
                                activeOpacity={0.65}
                                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                                accessibilityRole="button"
                                accessibilityLabel={t('profile.copyHunterId')}
                                onPress={handleCopyHunterCode}
                            >
                                <Feather name="copy" size={16} color={themeColor(colors, '#72bce0')} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('profile.combatAttributes')}</Text>

                    <View style={styles.attributeGrid}>
                        <AttributeCard
                            icon="sword-cross"
                            value={profile?.strength ?? 0}
                            label="STR"
                            gain={attributeReward?.strength}
                            rewardProgress={rewardProgress}
                            onPress={() => openAttributeInfo(
                                t('profile.strength'),
                                'STR',
                                t('profile.strengthDescription'),
                                profile?.strength ?? 0,
                                '#ef4444'
                            )}
                        />
                        <AttributeCard
                            icon="run-fast"
                            value={profile?.agility ?? 0}
                            label="AGI"
                            gain={attributeReward?.agility}
                            rewardProgress={rewardProgress}
                            onPress={() => openAttributeInfo(
                                t('profile.agility'),
                                'AGI',
                                t('profile.agilityDescription'),
                                profile?.agility ?? 0,
                                '#22c55e'
                            )}
                        />
                        <AttributeCard
                            icon="heart-outline"
                            value={profile?.vitality ?? 0}
                            label="VIT"
                            gain={attributeReward?.vitality}
                            rewardProgress={rewardProgress}
                            onPress={() => openAttributeInfo(
                                t('profile.vitality'),
                                'VIT',
                                t('profile.vitalityDescription'),
                                profile?.vitality ?? 0,
                                '#f97316'
                            )}
                        />
                        <AttributeCard
                            icon="shield-outline"
                            value={profile?.shieldCount ?? 0}
                            label="SHIELDS"
                            rewardProgress={rewardProgress}
                            onPress={() => setSelectedInfo({
                                title: t('profile.shield'),
                                shortLabel: 'SHIELD',
                                description: t('profile.shieldDescription'),
                                value: profile?.shieldCount ?? 0,
                                message: (profile?.shieldCount ?? 0) > 0
                                    ? t('profile.shieldProtected')
                                    : t('profile.shieldUnprotected'),
                                color: themeColor(colors, '#60a5fa'),
                            })}
                        />
                    </View>
                </View>
            </ScrollView>
            <Modal
                visible={settingsVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => {
                    if (selectedSettingsSection) {
                        setSelectedSettingsSection(null);
                    } else {
                        setSettingsVisible(false);
                    }
                }}
            >
                <View style={styles.settingsBackdrop}>
                    <SafeAreaView
                        style={[
                            styles.settingsSheet,
                            { backgroundColor: colors.surface },
                        ]}
                    >
                        <View style={styles.settingsHeader}>
                            {selectedSettingsSection ? (
                                <TouchableOpacity
                                    style={styles.settingsHeaderButton}
                                    onPress={() => setSelectedSettingsSection(null)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('settings.back')}
                                >
                                    <Feather
                                        name="chevron-left"
                                        size={25}
                                        color={themeColor(colors, '#ffffff')}
                                    />
                                </TouchableOpacity>
                            ) : null}

                            <Text
                                style={[styles.settingsTitle, { color: colors.text }]}
                            >
                                {selectedSettingsSection
                                    ? selectedSettingsSection === 'profile'
                                        ? t('profile.edit')
                                        : t(`settings.${selectedSettingsSection}`)
                                    : t('settings.title')}
                            </Text>

                            <TouchableOpacity
                                style={styles.settingsHeaderButton}
                                onPress={() => {
                                    setSelectedSettingsSection(null);
                                    setSettingsVisible(false);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t('common.close')}
                            >
                                <Feather name="x" size={24} color={themeColor(colors, '#ffffff')} />
                            </TouchableOpacity>
                        </View>

                        {selectedSettingsSection === 'profile' ? (
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            >
                                <ScrollView
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <View style={styles.editProfileForm}>
                                        <TouchableOpacity
                                            style={styles.editAvatarButton}
                                            onPress={pickAvatar}
                                            disabled={profileSaving}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('profile.changeAvatar')}
                                        >
                                            {editAvatar?.uri || profile?.avatar ? (
                                                <Image
                                                    source={{
                                                        uri:
                                                            editAvatar?.uri ??
                                                            profile?.avatar,
                                                    }}
                                                    style={styles.editAvatar}
                                                />
                                            ) : (
                                                <MaterialCommunityIcons
                                                    name="shield-account"
                                                    size={58}
                                                    color={colors.text}
                                                />
                                            )}
                                            <View style={styles.editAvatarBadge}>
                                                <Feather
                                                    name="camera"
                                                    size={16}
                                                    color="#ffffff"
                                                />
                                            </View>
                                        </TouchableOpacity>
                                        <Text style={styles.editAvatarHint}>
                                            {t('profile.changeAvatar')}
                                        </Text>

                                        <Text style={styles.editLabel}>
                                            {t('register.fullName')}
                                        </Text>
                                        <TextInput
                                            style={styles.editInput}
                                            value={editFullName}
                                            onChangeText={setEditFullName}
                                            editable={!profileSaving}
                                            maxLength={100}
                                            placeholder={t('register.fullNamePlaceholder')}
                                            placeholderTextColor={colors.mutedText}
                                            returnKeyType="next"
                                        />

                                        <Text style={styles.editLabel}>
                                            {t('profile.age')}
                                        </Text>
                                        <TextInput
                                            style={styles.editInput}
                                            value={editAge}
                                            onChangeText={value =>
                                                setEditAge(
                                                    value.replace(/[^0-9]/g, '')
                                                )
                                            }
                                            editable={!profileSaving}
                                            keyboardType="number-pad"
                                            maxLength={3}
                                            placeholder={t('register.agePlaceholder')}
                                            placeholderTextColor={colors.mutedText}
                                        />

                                        <TouchableOpacity
                                            style={[
                                                styles.saveProfileButton,
                                                profileSaving &&
                                                    styles.saveProfileButtonDisabled,
                                            ]}
                                            onPress={saveProfile}
                                            disabled={profileSaving}
                                        >
                                            {profileSaving ? (
                                                <ActivityIndicator color="#081018" />
                                            ) : (
                                                <Text style={styles.saveProfileButtonText}>
                                                    {t('profile.saveChanges')}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </KeyboardAvoidingView>
                        ) : settingsLoading || !settings ? (
                            <View style={styles.settingsLoading}>
                                <ActivityIndicator size="large" color={themeColor(colors, '#72bce0')} />
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {selectedSettingsSection === 'language' ? (
                                    <View style={styles.settingsOptions}>
                                    {LANGUAGE_OPTIONS.map(option => {
                                        const selected =
                                            settings.language === option.value;

                                        return (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.settingsOption,
                                                    {
                                                        backgroundColor: colors.elevated,
                                                        borderColor: colors.border,
                                                    },
                                                    selected && styles.settingsOptionSelected,
                                                ]}
                                                disabled={settingsSaving}
                                                onPress={() =>
                                                    changeSetting('language', option.value)
                                                }
                                            >
                                                <View style={styles.settingsOptionLabel}>
                                                    <Text style={styles.settingsFlag}>
                                                        {option.flag}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.settingsOptionText,
                                                            { color: colors.text },
                                                        ]}
                                                    >
                                                        {option.label}
                                                    </Text>
                                                </View>

                                                {selected ? (
                                                    <Feather
                                                        name="check"
                                                        size={18}
                                                        color={themeColor(colors, '#72bce0')}
                                                    />
                                                ) : null}
                                            </TouchableOpacity>
                                        );
                                    })}
                                    </View>
                                ) : null}

                                {selectedSettingsSection === 'theme' ? (
                                    <View style={styles.settingsOptions}>
                                    {THEME_OPTIONS.map(option => {
                                        const selected = settings.theme === option.value;

                                        return (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.settingsOption,
                                                    {
                                                        backgroundColor: colors.elevated,
                                                        borderColor: colors.border,
                                                    },
                                                    selected && styles.settingsOptionSelected,
                                                ]}
                                                disabled={settingsSaving}
                                                onPress={() =>
                                                    changeSetting('theme', option.value)
                                                }
                                            >
                                                <View style={styles.settingsOptionLabel}>
                                                    <View
                                                        style={[
                                                            styles.themeColorCircle,
                                                            option.value === 'LIGHT' &&
                                                                styles.themeColorLight,
                                                            option.value === 'DARK' &&
                                                                styles.themeColorDark,
                                                        ]}
                                                    >
                                                        {option.value === 'SYSTEM' ? (
                                                            <>
                                                                <View
                                                                    style={styles.themeColorSystemLight}
                                                                />
                                                                <View
                                                                    style={styles.themeColorSystemDark}
                                                                />
                                                            </>
                                                        ) : null}
                                                    </View>
                                                    <Text
                                                        style={[
                                                            styles.settingsOptionText,
                                                            { color: colors.text },
                                                        ]}
                                                    >
                                                        {t(option.labelKey)}
                                                    </Text>
                                                </View>

                                                {selected ? (
                                                    <Feather
                                                        name="check"
                                                        size={18}
                                                        color={themeColor(colors, '#72bce0')}
                                                    />
                                                ) : null}
                                            </TouchableOpacity>
                                        );
                                    })}
                                    </View>
                                ) : null}

                                {selectedSettingsSection === 'region' ? (
                                    <View style={styles.settingsOptions}>
                                    {REGION_OPTIONS.map(option => {
                                        const selected = settings.region === option.value;

                                        return (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.settingsOption,
                                                    {
                                                        backgroundColor: colors.elevated,
                                                        borderColor: colors.border,
                                                    },
                                                    selected && styles.settingsOptionSelected,
                                                ]}
                                                disabled={settingsSaving}
                                                onPress={() =>
                                                    changeSetting('region', option.value)
                                                }
                                            >
                                                <View style={styles.settingsOptionLabel}>
                                                    <Text style={styles.settingsFlag}>
                                                        {option.flag}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.settingsOptionText,
                                                            { color: colors.text },
                                                        ]}
                                                    >
                                                        {option.label}
                                                    </Text>
                                                </View>

                                                {selected ? (
                                                    <Feather
                                                        name="check"
                                                        size={18}
                                                        color={themeColor(colors, '#72bce0')}
                                                    />
                                                ) : null}
                                            </TouchableOpacity>
                                        );
                                    })}
                                    </View>
                                ) : null}

                                {selectedSettingsSection === null ? (
                                    <View style={styles.settingsMenu}>
                                        <TouchableOpacity
                                            style={[
                                                styles.settingsMenuItem,
                                                {
                                                    backgroundColor: colors.elevated,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                            onPress={openProfileEditor}
                                        >
                                            <View style={styles.settingsMenuItemStart}>
                                                <Feather
                                                    name="edit-3"
                                                    size={20}
                                                    color={colors.accent}
                                                />
                                                <Text
                                                    style={[
                                                        styles.settingsMenuLabel,
                                                        { color: colors.text },
                                                    ]}
                                                >
                                                    {t('profile.edit')}
                                                </Text>
                                            </View>
                                            <Feather
                                                name="chevron-right"
                                                size={21}
                                                color={colors.mutedText}
                                            />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.settingsMenuItem,
                                                {
                                                    backgroundColor: colors.elevated,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                            onPress={() =>
                                                setSelectedSettingsSection('language')
                                            }
                                        >
                                            <View style={styles.settingsMenuItemStart}>
                                                <Feather
                                                    name="globe"
                                                    size={20}
                                                    color={themeColor(colors, '#72bce0')}
                                                />
                                                <View>
                                                    <Text
                                                        style={[
                                                            styles.settingsMenuLabel,
                                                            { color: colors.text },
                                                        ]}
                                                    >
                                                        {t('settings.language')}
                                                    </Text>
                                                    <Text style={styles.settingsMenuValue}>
                                                        {(() => {
                                                            const option =
                                                                LANGUAGE_OPTIONS.find(
                                                                    item =>
                                                                        item.value ===
                                                                        settings.language
                                                                );
                                                            return option
                                                                ? `${option.flag} ${option.label}`
                                                                : settings.language;
                                                        })()}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Feather
                                                name="chevron-right"
                                                size={21}
                                                color={themeColor(colors, '#616670')}
                                            />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.settingsMenuItem,
                                                {
                                                    backgroundColor: colors.elevated,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                            onPress={() =>
                                                setSelectedSettingsSection('theme')
                                            }
                                        >
                                            <View style={styles.settingsMenuItemStart}>
                                                <Feather
                                                    name="moon"
                                                    size={20}
                                                    color={themeColor(colors, '#72bce0')}
                                                />
                                                <View>
                                                    <Text
                                                        style={[
                                                            styles.settingsMenuLabel,
                                                            { color: colors.text },
                                                        ]}
                                                    >
                                                        {t('settings.theme')}
                                                    </Text>
                                                    <Text style={styles.settingsMenuValue}>
                                                        {t(
                                                            THEME_OPTIONS.find(
                                                                option =>
                                                                    option.value === settings.theme
                                                            )?.labelKey ??
                                                                'settings.themeSystem'
                                                        )}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Feather
                                                name="chevron-right"
                                                size={21}
                                                color={themeColor(colors, '#616670')}
                                            />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.settingsMenuItem,
                                                {
                                                    backgroundColor: colors.elevated,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                            onPress={() =>
                                                setSelectedSettingsSection('region')
                                            }
                                        >
                                            <View style={styles.settingsMenuItemStart}>
                                                <Feather
                                                    name="map-pin"
                                                    size={20}
                                                    color={themeColor(colors, '#72bce0')}
                                                />
                                                <View>
                                                    <Text
                                                        style={[
                                                            styles.settingsMenuLabel,
                                                            { color: colors.text },
                                                        ]}
                                                    >
                                                        {t('settings.region')}
                                                    </Text>
                                                    <Text style={styles.settingsMenuValue}>
                                                        {(() => {
                                                            const option =
                                                                REGION_OPTIONS.find(
                                                                    item =>
                                                                        item.value ===
                                                                        settings.region
                                                                );
                                                            return option
                                                                ? `${option.flag} ${option.label}`
                                                                : settings.region;
                                                        })()}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Feather
                                                name="chevron-right"
                                                size={21}
                                                color={themeColor(colors, '#616670')}
                                            />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.settingsMenuItem,
                                                styles.settingsLogoutMenuItem,
                                            ]}
                                            disabled={settingsSaving}
                                            onPress={handleLogout}
                                        >
                                            <View style={styles.settingsMenuItemStart}>
                                                <Feather
                                                    name="log-out"
                                                    size={20}
                                                    color={themeColor(colors, '#f87171')}
                                                />
                                                <Text style={styles.settingsLogoutText}>
                                                    {t('profile.logout')}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}

                                {settingsSaving ? (
                                    <ActivityIndicator
                                        style={styles.settingsSaving}
                                        color={themeColor(colors, '#72bce0')}
                                    />
                                ) : null}
                            </ScrollView>
                        )}
                    </SafeAreaView>
                </View>
            </Modal>
            <Modal
                visible={selectedInfo !== null}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setSelectedInfo(null)}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setSelectedInfo(null)}
                >
                    <BlurView
                        pointerEvents="none"
                        intensity={38}
                        tint="systemThinMaterialDark"
                        style={StyleSheet.absoluteFill}
                    />
                    <View
                        pointerEvents="none"
                        style={styles.modalDimOverlay}
                    />
                    <Pressable
                        style={styles.infoModal}
                        onPress={event => event.stopPropagation()}
                    >
                        <BlurView
                            pointerEvents="none"
                            intensity={70}
                            tint="systemUltraThinMaterialDark"
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.modalGrabber} />
                        <View
                            style={[
                                styles.modalAccent,
                                { backgroundColor: selectedInfo?.color ?? '#72bce0' },
                            ]}
                        />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalEyebrow}>{t('profile.systemAnalysis')}</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setSelectedInfo(null)}
                                accessibilityRole="button"
                                accessibilityLabel={t('common.close')}
                            >
                                <Feather name="x" size={19} color={themeColor(colors, '#777982')} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalTitleRow}>
                            <View
                                style={[
                                    styles.modalStatusDot,
                                    { backgroundColor: selectedInfo?.color ?? '#72bce0' },
                                ]}
                            />
                            <Text style={styles.modalTitle}>{selectedInfo?.title}</Text>
                        </View>
                        <Text style={styles.modalDescription}>
                            {selectedInfo?.description}
                        </Text>
                        {selectedInfo?.value !== undefined ? (
                            <View style={styles.modalValueBox}>
                                <View>
                                    <Text style={styles.modalValueCaption}>
                                        {t('profile.currentValue')}
                                    </Text>
                                    {selectedInfo.shortLabel ? (
                                        <Text style={styles.modalValueLabel}>
                                            {selectedInfo.shortLabel}
                                        </Text>
                                    ) : null}
                                </View>
                                <Text
                                    style={[
                                        styles.modalValue,
                                        { color: selectedInfo.color ?? '#ffffff' },
                                    ]}
                                >
                                    {selectedInfo.value}
                                </Text>
                            </View>
                        ) : null}
                        {selectedInfo?.message ? (
                            <View style={styles.modalMessageBox}>
                                <View style={styles.modalMessageContent}>
                                    <Text style={styles.modalMessageLabel}>
                                        {t('profile.systemVerdict')}
                                    </Text>
                                    <Text style={styles.modalMessage}>
                                        “{selectedInfo.message}”
                                    </Text>
                                </View>
                            </View>
                        ) : null}
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView >
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    header1: {
        display: 'flex',
        justifyContent: 'space-between',
        flexDirection: 'row',
    },
    safeArea: {
        flex: 1,
        backgroundColor: themeColor(colors, '#08090d'),
    },
    container: {
        flex: 1,
        backgroundColor: themeColor(colors, '#08090d'),
    },
    centerContainer: {
        flex: 1,
        backgroundColor: themeColor(colors, '#08090d'),
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        textShadowOffset: {
            width: 0,
            height: 0,
        },
        textShadowRadius: 15,
    },
    loadingText: {
        color: themeColor(colors, '#8b8d96'),
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginTop: 12,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 28,
        paddingBottom: 40,
    },
    avatarWrapper: {
        width: 116,
        height: 116,
        borderRadius: 58,
        backgroundColor: themeColor(colors, '#0d1520'),
        borderWidth: 4.5,
        borderColor: themeColor(colors, '#343741'),
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 22,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 22,
    },
    username: {
        color: themeColor(colors, '#ffffff'),
        fontSize: 30,
        lineHeight: 36,
        fontWeight: '800',
        marginRight: 22,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    summaryValue: {
        color: themeColor(colors, '#ffffff'),
        fontSize: 24,
        fontWeight: '800',
    },
    summaryLabel: {
        color: themeColor(colors, '#a5a5ae'),
        fontSize: 16,
        fontWeight: '500',
    },
    profileDetails: {
        marginBottom: 46,
    },
    fullName: {
        color: themeColor(colors, '#ffffff'),
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
    },
    description: {
        color: themeColor(colors, '#c4c4ca'),
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '500',
    },
    dot: {
        color: themeColor(colors, '#e5e7eb'),
    },
    hunterCode: {
        color: themeColor(colors, '#9b9ca4'),
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 1.2,
    },
    hunterCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    copyButton: {
        marginLeft: 10,
        padding: 3,
    },
    section: {
        borderTopWidth: 1,
        borderTopColor: '#32343b',
        paddingTop: 22,
        marginHorizontal: -16,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        color: themeColor(colors, '#a9a9b2'),
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 1.7,
        textAlign: 'center',
        marginBottom: 26,
    },
    attributeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 14,
    },
    attributeCard: {
        width: '100%',
        minHeight: 76,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: themeColor(colors, '#111216'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#373940'),
        borderRadius: 13,
        flexDirection: 'row',
        alignItems: 'center',
    },
    attributeIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: themeColor(colors, '#25272d'),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    attributeContent: {
        flex: 1,
    },
    attributeGain: {
        color: themeColor(colors, '#82b89d'),
        fontSize: 15,
        fontWeight: '800',
        marginLeft: 8,
    },
    attributeValue: {
        color: themeColor(colors, '#ffffff'),
        fontSize: 21,
        lineHeight: 24,
        fontWeight: '800',
    },
    attributeLabel: {
        color: themeColor(colors, '#9aa6c2'),
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.7,
        marginTop: 2,
    },
    logoutButton: {
        height: 40,
        marginTop: 34,
        borderRadius: 9,
        borderWidth: 0,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        justifyContent: 'center',
        alignSelf: 'flex-start',
        transform: [{ translateY: -40 }],
        gap: 9,
    },
    rankProgressCard: {
        backgroundColor: themeColor(colors, '#111216'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#373940'),
        borderRadius: 13,
        padding: 16,
        marginBottom: 28,
    },
    rankProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    rankProgressTitle: {
        color: themeColor(colors, '#a9a9b2'),
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.4,
    },
    rankProgressRanks: {
        fontSize: 15,
        fontWeight: '800',
    },
    rankProgressSeparator: {
        color: themeColor(colors, '#a9a9b2'),
        textShadowRadius: 0,
    },
    progressTrack: {
        width: '100%',
        height: 10,
        backgroundColor: themeColor(colors, '#292a2f'),
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: themeColor(colors, '#72bce0'),
        borderRadius: 5,
    },
    rankProgressFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    progressPercentText: {
        color: themeColor(colors, '#9b9ca4'),
        fontSize: 12,
        fontWeight: '700',
    },
    remainingRpText: {
        color: themeColor(colors, '#ffffff'),
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    attributeTouchable: {
        width: '48.5%',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    modalDimOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: themeColor(colors, 'rgba(0, 0, 0, 0.28)'),
    },
    infoModal: {
        backgroundColor: themeColor(colors, 'rgba(10, 11, 14, 0.78)'),
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(255, 255, 255, 0.13)'),
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 28,
        overflow: 'hidden',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.5,
        shadowRadius: 28,
        elevation: 18,
    },
    modalGrabber: {
        width: 38,
        height: 5,
        borderRadius: 3,
        backgroundColor: themeColor(colors, 'rgba(255, 255, 255, 0.2)'),
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalAccent: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 2,
        opacity: 0.75,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalEyebrow: {
        color: themeColor(colors, '#666872'),
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2.2,
    },
    modalTitle: {
        color: themeColor(colors, '#f4f4f5'),
        fontSize: 25,
        lineHeight: 31,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: themeColor(colors, '#121317'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#25272d'),
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalDescription: {
        color: themeColor(colors, '#9a9ca5'),
        fontSize: 15,
        lineHeight: 22,
        marginTop: 9,
        paddingRight: 12,
    },
    modalValueBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        marginTop: 20,
    },
    modalValueCaption: {
        color: themeColor(colors, '#62646d'),
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.8,
    },
    modalValueLabel: {
        color: themeColor(colors, '#d6d7dc'),
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 1.4,
        marginTop: 7,
    },
    modalValue: {
        fontSize: 34,
        lineHeight: 40,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    modalMessageBox: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.09)',
        marginTop: 14,
        paddingTop: 18,
    },
    modalMessageContent: {
        paddingHorizontal: 2,
    },
    modalMessageLabel: {
        color: themeColor(colors, '#62646d'),
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.7,
        marginBottom: 6,
    },
    modalMessage: {
        color: themeColor(colors, '#d2d3d8'),
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    settingsBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: themeColor(colors, 'rgba(0, 0, 0, 0.65)'),
    },

    settingsSheet: {
        maxHeight: '90%',
        backgroundColor: themeColor(colors, '#0d1117'),
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
    },

    settingsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },

    settingsHeaderButton: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },

    settingsTitle: {
        flex: 1,
        color: themeColor(colors, '#ffffff'),
        fontSize: 22,
        fontWeight: '800',
    },

    settingsLoading: {
        minHeight: 300,
        justifyContent: 'center',
        alignItems: 'center',
    },

    settingsSectionTitle: {
        color: themeColor(colors, '#8b949e'),
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 18,
        marginBottom: 10,
        textTransform: 'uppercase',
    },

    settingsOptions: {
        gap: 8,
    },

    settingsMenu: {
        gap: 10,
    },

    editProfileForm: {
        paddingBottom: 12,
    },

    editAvatarButton: {
        width: 112,
        height: 112,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 56,
        borderWidth: 3,
        borderColor: colors.accent,
        backgroundColor: colors.elevated,
    },

    editAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 56,
    },

    editAvatarBadge: {
        position: 'absolute',
        right: 0,
        bottom: 3,
        width: 34,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 17,
        borderWidth: 2,
        borderColor: colors.surface,
        backgroundColor: colors.accent,
    },

    editAvatarHint: {
        marginTop: 10,
        marginBottom: 24,
        color: colors.accent,
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },

    editLabel: {
        marginBottom: 8,
        color: colors.mutedText,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },

    editInput: {
        minHeight: 52,
        marginBottom: 18,
        paddingHorizontal: 15,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 11,
        backgroundColor: colors.elevated,
    },

    saveProfileButton: {
        height: 52,
        marginTop: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 11,
        backgroundColor: colors.accent,
    },

    saveProfileButtonDisabled: {
        opacity: 0.6,
    },

    saveProfileButtonText: {
        color: '#081018',
        fontSize: 15,
        fontWeight: '800',
    },

    settingsMenuItem: {
        minHeight: 64,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: themeColor(colors, '#11161d'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#21262d'),
        borderRadius: 12,
    },

    settingsMenuItemStart: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
    },

    settingsMenuLabel: {
        color: themeColor(colors, '#e5e7eb'),
        fontSize: 15,
        fontWeight: '700',
    },

    settingsMenuValue: {
        color: themeColor(colors, '#777d88'),
        fontSize: 12,
        marginTop: 3,
    },

    settingsLogoutMenuItem: {
        marginTop: 10,
        borderColor: themeColor(colors, 'rgba(248, 113, 113, 0.35)'),
        backgroundColor: themeColor(colors, 'rgba(248, 113, 113, 0.06)'),
    },

    settingsOption: {
        minHeight: 48,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: themeColor(colors, '#11161d'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#21262d'),
        borderRadius: 10,
    },

    settingsOptionSelected: {
        borderColor: themeColor(colors, '#72bce0'),
        backgroundColor: themeColor(colors, 'rgba(114, 188, 224, 0.1)'),
    },

    settingsOptionLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    settingsFlag: {
        fontSize: 24,
    },

    settingsOptionText: {
        color: themeColor(colors, '#e5e7eb'),
        fontSize: 15,
        fontWeight: '600',
    },

    themeColorCircle: {
        width: 26,
        height: 26,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: 13,
        borderWidth: 1,
        borderColor: themeColor(colors, '#4b5563'),
    },

    themeColorLight: {
        backgroundColor: '#f8fafc',
        borderColor: '#cbd5e1',
    },

    themeColorDark: {
        backgroundColor: '#080a0f',
        borderColor: '#4b5563',
    },

    themeColorSystemLight: {
        width: '50%',
        height: '100%',
        backgroundColor: '#f8fafc',
    },

    themeColorSystemDark: {
        width: '50%',
        height: '100%',
        backgroundColor: '#080a0f',
    },

    settingsLogoutButton: {
        height: 50,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 9,
        marginTop: 28,
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(248, 113, 113, 0.4)'),
        borderRadius: 10,
        backgroundColor: themeColor(colors, 'rgba(248, 113, 113, 0.08)'),
    },

    settingsLogoutText: {
        color: themeColor(colors, '#f87171'),
        fontSize: 15,
        fontWeight: '700',
    },

    settingsSaving: {
        marginTop: 14,
    },

});
