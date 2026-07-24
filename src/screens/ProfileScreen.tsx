import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

interface HunterProfile {
    userName: string;
    hunterCode: string;
    fullName: string;
    age: number;
    currentRp: number;
    rankTier: string;
    currentStreak: number;
    maxStreak: number;
    shieldCount: number;
    strength: number;
    agility: number;
    vitality: number;
    avatar?: string;
}

type AttributeCardProps = {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    value: number;
    label: string;
};

function AttributeCard({ icon, value, label }: AttributeCardProps) {
    return (
        <View style={styles.attributeCard}>
            <View style={styles.attributeIcon}>
                <MaterialCommunityIcons name={icon} size={23} color="#f4f4f5" />
            </View>
            <View>
                <Text style={styles.attributeValue}>{value}</Text>
                <Text style={styles.attributeLabel}>{label}</Text>
            </View>
        </View>
    );
}

export default function ProfileScreen({ navigation }: any) {
    const [profile, setProfile] = useState<HunterProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProfile = useCallback(async () => {
        try {
            const response = await api.get('/auth/me');
            setProfile(response.data.result);
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

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProfile();
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
                        <Text style={styles.summaryValue}>{profile?.rankTier || 'E'}</Text>
                        <Text style={styles.summaryLabel}> Rank</Text>
                    </View>
                </View>

                <View style={styles.profileDetails}>
                    <Text style={styles.fullName}>{displayName}</Text>
                    <Text style={styles.description}>
                        Awakened Hunter <Text style={styles.dot}>•</Text> Age: {profile?.age ?? 'N/A'}
                    </Text>
                    <Text style={styles.hunterCode}>
                        ID: {profile?.hunterCode || 'UNASSIGNED'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>COMBAT ATTRIBUTES</Text>

                    <View style={styles.attributeGrid}>
                        <AttributeCard
                            icon="sword-cross"
                            value={profile?.strength ?? 0}
                            label="STR"
                        />
                        <AttributeCard
                            icon="run-fast"
                            value={profile?.agility ?? 0}
                            label="AGI"
                        />
                        <AttributeCard
                            icon="heart-outline"
                            value={profile?.vitality ?? 0}
                            label="VIT"
                        />
                        <AttributeCard
                            icon="shield-outline"
                            value={profile?.shieldCount ?? 0}
                            label="SHIELDS"
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header1:{
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
        marginTop: 6,
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
});