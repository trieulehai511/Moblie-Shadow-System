import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import {
    // ...
    TextStyle,
} from 'react-native';
import { HunterProfileResponse } from '../models/ProfileModel';



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

const attributeMessages: Record<AttributeLabel, string[]> = {
    STR: [
        'Your strength is still far too weak.',
        'Your combat power has improved, but it is not enough to overwhelm your enemies.',
        'Your strength is beginning to become formidable.',
        'Your strikes now surpass those of most ordinary Hunters.',
        'Your strength is approaching its natural limit.',
        'Extraordinary strength. Human limits no longer apply to you.',
    ],
    AGI: [
        'Your speed and reflexes are still far too slow.',
        'You have become faster, but not fast enough to escape every threat.',
        'Your reflexes are becoming remarkably sharp.',
        'Your speed now surpasses that of most ordinary Hunters.',
        'Your movement is approaching its natural limit.',
        'Extraordinary speed. Almost no one can keep up with you.',
    ],
    VIT: [
        'Your stamina and endurance are still far too weak.',
        'You have grown tougher, but you are not ready for a prolonged battle.',
        'Your body can now endure severe trials.',
        'Your endurance now surpasses that of most ordinary Hunters.',
        'Your vitality is approaching its natural limit.',
        'Extraordinary endurance. Your body barely knows fatigue.',
    ],
};

const getAttributeMessage = (attribute: AttributeLabel, value: number) => {
    const level =
        value < 20 ? 0 :
        value < 40 ? 1 :
        value < 60 ? 2 :
        value < 80 ? 3 :
        value < 100 ? 4 : 5;

    return attributeMessages[attribute][level];
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
    const hasGain = gain > 0;
    const animatedCardStyle = hasGain
        ? {
            borderColor: rewardProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['#373940', '#82b89d'],
            }),
            backgroundColor: rewardProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['#111216', 'rgba(130,184,157,0.12)'],
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
                        color="#f4f4f5"
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
    const [profile, setProfile] = useState<HunterProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
                'Error',
                error.response?.data?.message || 'Failed to load Hunter status!'
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

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
            Alert.alert('Copied', 'Hunter ID copied to clipboard.');
        } catch (error) {
            console.log('Copy Hunter ID error:', error);
            Alert.alert('Error', 'Unable to copy Hunter ID.');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.post('/auth/logout');
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
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.loadingText}>SYNCING HUNTER DATA...</Text>
            </View>
        );
    }

    const displayName = profile?.fullName || profile?.userName || 'Hunter';
    const userName = profile?.userName || 'HUNTER';

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#ffffff"
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
                                color="#dbeafe"
                            />
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        activeOpacity={0.8}
                        onPress={handleLogout}
                    >
                        <Feather name="log-out" size={25} color="#72bce0" />
                    </TouchableOpacity>
                </View>
                <View style={styles.identityRow}>
                    <Text style={styles.username}>{userName}</Text>
                    <TouchableOpacity
                        style={styles.editButton}
                        activeOpacity={0.8}
                        onPress={() =>
                            Alert.alert('Edit Profile', 'This feature is not implemented yet.')
                        }
                    >
                        <Text style={styles.editButtonText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.summaryRow}>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: 'RANK POINT',
                            shortLabel: 'RP',
                            description: 'Points accumulated to determine your Hunter rank.',
                            value: currentRp,
                            message: nextRank
                                ? `${rpToNextRank} RP remaining to reach Rank ${nextRank}.`
                                : 'You have reached the highest rank.',
                            color: '#72bce0',
                        })}
                    >
                        <Text style={styles.summaryValue}>{profile?.currentRp ?? 0}</Text>
                        <Text style={styles.summaryLabel}> RP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: 'CURRENT STREAK',
                            description: 'The number of consecutive days you completed an activity.',
                            value: profile?.currentStreak ?? 0,
                            message: 'Maintain your streak and prove your discipline.',
                            color: '#f97316',
                        })}
                    >
                        <Text style={styles.summaryValue}>{profile?.currentStreak ?? 0}</Text>
                        <Text style={styles.summaryLabel}> Streak</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: 'BEST STREAK',
                            description: 'The longest activity streak you have ever achieved.',
                            value: profile?.maxStreak ?? 0,
                            message: 'Surpass the record you set for yourself.',
                            color: '#eab308',
                        })}
                    >
                        <Text style={styles.summaryValue}>{profile?.maxStreak ?? 0}</Text>
                        <Text style={styles.summaryLabel}> Best</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.summaryItem}
                        activeOpacity={0.7}
                        onPress={() => setSelectedInfo({
                            title: 'HUNTER RANK',
                            description: 'Your rank represents your growth as a Hunter.',
                            value: rank,
                            message: nextRank
                                ? `Your next promotion is Rank ${nextRank}.`
                                : 'You have reached the highest rank.',
                            color: rankStyles[rank]?.color as string ?? '#9a6b19',
                        })}
                    >
                        <Text style={[styles.summaryValue, styles.rankText, rankStyles[rank] || rankStyles.E]}>{profile?.rankTier || 'E'}</Text>
                        <Text style={styles.summaryLabel}> Rank</Text>
                    </TouchableOpacity>
                </View>

                <View
                    style={styles.rankProgressCard}
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={
                        nextRank
                            ? `Progress to Rank ${nextRank}`
                            : 'Maximum rank reached'
                    }
                    accessibilityValue={{
                        min: 0,
                        max: 100,
                        now: Math.round(rankProgressPercent),
                        text: nextRank
                            ? `${rpToNextRank} RP remaining`
                            : 'Maximum rank reached',
                    }}


                >
                    <View style={styles.rankProgressHeader}>
                        <Text style={styles.rankProgressTitle}>
                            RANK PROGRESS
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
                                : 'MAXIMUM RANK REACHED'}
                        </Text>
                    </View>

                </View>
                <View style={styles.profileDetails}>
                    <Text style={styles.fullName}>{displayName}</Text>
                    <Text style={styles.description}>
                        Awakened Hunter <Text style={styles.dot}>•</Text> Age: {profile?.age ?? 'N/A'}
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
                                accessibilityLabel="Copy Hunter ID"
                                onPress={handleCopyHunterCode}
                            >
                                <Feather name="copy" size={16} color="#72bce0" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>COMBAT ATTRIBUTES</Text>

                    <View style={styles.attributeGrid}>
                        <AttributeCard
                            icon="sword-cross"
                            value={profile?.strength ?? 0}
                            label="STR"
                            gain={attributeReward?.strength}
                            rewardProgress={rewardProgress}
                            onPress={() => openAttributeInfo(
                                'STRENGTH',
                                'STR',
                                'Measures physical power and direct attack strength.',
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
                                'AGILITY',
                                'AGI',
                                'Measures speed, reflexes, and evasion ability.',
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
                                'VITALITY',
                                'VIT',
                                'Measures stamina, endurance, and physical resilience.',
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
                                title: 'SHIELD',
                                shortLabel: 'SHIELD',
                                description: 'A Shield protects your activity streak when you miss a mission.',
                                value: profile?.shieldCount ?? 0,
                                message: (profile?.shieldCount ?? 0) > 0
                                    ? 'Your streak is currently protected.'
                                    : 'You do not have a Shield protecting your streak.',
                                color: '#60a5fa',
                            })}
                        />
                    </View>
                </View>
            </ScrollView>

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
                            <Text style={styles.modalEyebrow}>SYSTEM ANALYSIS</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setSelectedInfo(null)}
                                accessibilityRole="button"
                                accessibilityLabel="Close information"
                            >
                                <Feather name="x" size={19} color="#777982" />
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
                                        CURRENT VALUE
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
                                        SYSTEM VERDICT
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

const styles = StyleSheet.create({
    header1: {
        display: 'flex',
        justifyContent: 'space-between',
        flexDirection: 'row',
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#08090d',
    },
    container: {
        flex: 1,
        backgroundColor: '#08090d',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#08090d',
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
        color: '#8b8d96',
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
        backgroundColor: '#0d1520',
        borderWidth: 4.5,
        borderColor: '#343741',
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
        color: '#ffffff',
        fontSize: 30,
        lineHeight: 36,
        fontWeight: '800',
        marginRight: 22,
    },
    editButton: {
        minHeight: 42,
        paddingHorizontal: 18,
        backgroundColor: '#292a2f',
        borderWidth: 1,
        borderColor: '#41434a',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editButtonText: {
        color: '#f5f5f5',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.4,
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
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '800',
    },
    summaryLabel: {
        color: '#a5a5ae',
        fontSize: 16,
        fontWeight: '500',
    },
    profileDetails: {
        marginBottom: 46,
    },
    fullName: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
    },
    description: {
        color: '#c4c4ca',
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '500',
    },
    dot: {
        color: '#e5e7eb',
    },
    hunterCode: {
        color: '#9b9ca4',
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
        color: '#a9a9b2',
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
        backgroundColor: '#111216',
        borderWidth: 1,
        borderColor: '#373940',
        borderRadius: 13,
        flexDirection: 'row',
        alignItems: 'center',
    },
    attributeIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#25272d',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    attributeContent: {
        flex: 1,
    },
    attributeGain: {
        color: '#82b89d',
        fontSize: 15,
        fontWeight: '800',
        marginLeft: 8,
    },
    attributeValue: {
        color: '#ffffff',
        fontSize: 21,
        lineHeight: 24,
        fontWeight: '800',
    },
    attributeLabel: {
        color: '#9aa6c2',
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
        backgroundColor: '#111216',
        borderWidth: 1,
        borderColor: '#373940',
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
        color: '#a9a9b2',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.4,
    },
    rankProgressRanks: {
        fontSize: 15,
        fontWeight: '800',
    },
    rankProgressSeparator: {
        color: '#a9a9b2',
        textShadowRadius: 0,
    },
    progressTrack: {
        width: '100%',
        height: 10,
        backgroundColor: '#292a2f',
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#72bce0',
        borderRadius: 5,
    },
    rankProgressFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    progressPercentText: {
        color: '#9b9ca4',
        fontSize: 12,
        fontWeight: '700',
    },
    remainingRpText: {
        color: '#ffffff',
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
        backgroundColor: 'rgba(0, 0, 0, 0.28)',
    },
    infoModal: {
        backgroundColor: 'rgba(10, 11, 14, 0.78)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.13)',
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
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
        color: '#666872',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2.2,
    },
    modalTitle: {
        color: '#f4f4f5',
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
        backgroundColor: '#121317',
        borderWidth: 1,
        borderColor: '#25272d',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalDescription: {
        color: '#9a9ca5',
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
        color: '#62646d',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.8,
    },
    modalValueLabel: {
        color: '#d6d7dc',
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
        color: '#62646d',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.7,
        marginBottom: 6,
    },
    modalMessage: {
        color: '#d2d3d8',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        fontStyle: 'italic',
    },

});
