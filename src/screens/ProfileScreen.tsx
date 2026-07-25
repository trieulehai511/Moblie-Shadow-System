import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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

type AttributeCardProps = {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    value: number;
    label: string;
    gain?: number;
    rewardProgress: Animated.Value;
};

function AttributeCard({
    icon,
    value,
    label,
    gain = 0,
    rewardProgress,
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
        <Animated.View style={[styles.attributeCard, animatedCardStyle]}>
            <View style={styles.attributeIcon}>
                <MaterialCommunityIcons name={icon} size={23} color="#f4f4f5" />
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
    );
}

export default function ProfileScreen({ navigation }: any) {
    const [profile, setProfile] = useState<HunterProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [attributeReward, setAttributeReward] = useState<
        Partial<Record<'strength' | 'agility' | 'vitality', number>> | null
    >(null);
    const rewardProgress = useRef(new Animated.Value(0)).current;

    const rank = profile?.rankTier?.trim().toUpperCase() || 'E';
    const nextRank = profile?.nextRankTier?.trim().toUpperCase() || null;
    const rankProgressPercent = Math.min(
        Math.max(profile?.rankProgressPercent ?? 0, 0),
        100
    );
    const rpToNextRank = Math.max(profile?.rpToNextRank ?? 0, 0);


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
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{profile?.currentRp ?? 0}</Text>
                        <Text style={styles.summaryLabel}> RP</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{profile?.currentStreak ?? 0}</Text>
                        <Text style={styles.summaryLabel}> Streak</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{profile?.maxStreak ?? 0}</Text>
                        <Text style={styles.summaryLabel}> Best</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, styles.rankText, rankStyles[rank] || rankStyles.E]}>{profile?.rankTier || 'E'}</Text>
                        <Text style={styles.summaryLabel}> Rank</Text>
                    </View>
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
                            {rankProgressPercent.toFixed(2)}%
                        </Text>

                        <Text style={styles.remainingRpText}>
                            {nextRank
                                ? `${rpToNextRank} RP TO RANK ${nextRank}`
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
                        />
                        <AttributeCard
                            icon="run-fast"
                            value={profile?.agility ?? 0}
                            label="AGI"
                            gain={attributeReward?.agility}
                            rewardProgress={rewardProgress}
                        />
                        <AttributeCard
                            icon="heart-outline"
                            value={profile?.vitality ?? 0}
                            label="VIT"
                            gain={attributeReward?.vitality}
                            rewardProgress={rewardProgress}
                        />
                        <AttributeCard
                            icon="shield-outline"
                            value={profile?.shieldCount ?? 0}
                            label="SHIELDS"
                            rewardProgress={rewardProgress}
                        />
                    </View>
                </View>
            </ScrollView>
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
        width: '48.5%',
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

});
