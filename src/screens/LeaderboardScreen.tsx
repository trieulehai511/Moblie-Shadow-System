import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
    ThemeColors,
    themeColor,
    useAppTheme,
} from '../theme/ThemeContext';
import { LeaderboardHunter } from '../models/LeaderboardModel';
import { getLeaderboard } from '../services/leaderboardService';
import { getProfileByHunterCode } from '../services/profileService';

export default function LeaderboardScreen({ navigation, }: any) {
    const [hunters, setHunters] = useState<LeaderboardHunter[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const [searchCode, setSearchCode] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef<TextInput>(null);

    const openSearch = () => {
        setSearchOpen(true);
        setSearchError(null);
        requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    const closeSearch = () => {
        Keyboard.dismiss();
        setSearchOpen(false);
        setSearchCode('');
        setSearchError(null);
    };

    const handleSearch = async () => {
        if (searching) return;

        const hunterCode = searchCode.trim().toUpperCase();

        if (!hunterCode) {
            setSearchError(t('leaderboard.searchRequired'));
            return;
        }

        Keyboard.dismiss();
        setSearchCode(hunterCode);
        setSearchError(null);
        setSearching(true);

        try {
            await getProfileByHunterCode(hunterCode);

            setSearchOpen(false);
            setSearchCode('');
            navigation.getParent()?.navigate(
                'HunterProfile',
                { hunterCode }
            );
        } catch (requestError: any) {
            setSearchError(
                requestError.response?.data?.message ??
                t('leaderboard.hunterNotFound')
            );
        } finally {
            setSearching(false);
        }
    };

    const styles = useMemo(
        () => createStyles(colors),
        [colors]
    );

    const fetchLeaderboard = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            try {
                const data = await getLeaderboard();
                setHunters(data);
            } catch (requestError: any) {
                console.log('Fetch leaderboard error:', requestError);

                setError(
                    requestError.response?.data?.message ??
                    t('leaderboard.loadFailed')
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        }, [t]
    );
    useEffect(() => {
        void fetchLeaderboard();
    }, [fetchLeaderboard]);

    const getPositionColor = (position: number) => {
        switch (position) {
            case 1:
                return '#facc15';
            case 2:
                return '#cbd5e1';
            case 3:
                return '#d97706';
            default:
                return colors.mutedText;
        }
    };
    const getPositionIcon = (position: number) => {
        if (position === 1) return 'crown';
        if (position === 2 || position === 3) return 'medal';
        return null;
    };

    const renderHunter = ({ item }: { item: LeaderboardHunter }) => {
        const positionColor = getPositionColor(item.position);
        const positionIcon = getPositionIcon(item.position);
        const isTopThree = item.position <= 3;
        return (
            <TouchableOpacity
                style={[
                    styles.hunterCard,
                    isTopThree && styles.topHunterCard,
                    item.position === 1 && styles.firstHunterCard,
                ]}
                activeOpacity={0.75}
                onPress={() =>
                    navigation.getParent()?.navigate(
                        'HunterProfile',
                        {
                            hunterCode: item.hunterCode,
                        }
                    )
                }
            >
                <View style={styles.positionContainer}>
                    {positionIcon ? (
                        <MaterialCommunityIcons
                            name={positionIcon}
                            size={25}
                            color={positionColor}
                        />
                    ) : (
                        <Text style={styles.positionText}>
                            {item.position}
                        </Text>
                    )}
                </View>

                <View style={styles.avatarContainer}>
                    {item.avatar ? (
                        <Image
                            source={{ uri: item.avatar }}
                            style={styles.avatar}
                            resizeMode="cover"
                        />
                    ) : (
                        <MaterialCommunityIcons
                            name="shield-account"
                            size={34}
                            color={colors.mutedText}
                        />
                    )}
                    <View
                        style={[
                            styles.rankBadge,
                            { borderColor: positionColor },
                        ]}
                    >
                        <Text
                            style={[
                                styles.rankBadgeText,
                                { color: positionColor },
                            ]}
                        >
                            {item.rankTier.trim().toUpperCase()[0] || 'E'}
                        </Text>
                    </View>
                </View>

                <View style={styles.hunterInfo}>
                    <Text style={styles.fullName} numberOfLines={1}>
                        {item.fullName}
                    </Text>

                    <Text style={styles.hunterCode} numberOfLines={1}>
                        {item.hunterCode}
                    </Text>

                    <View style={styles.statsRow}>
                        <Text style={styles.rankText}>
                            RANK {item.rankTier}
                        </Text>

                        <Text style={styles.streakText}>
                            🔥 {item.currentStreak}
                        </Text>
                    </View>
                </View>

                <View style={styles.rpContainer}>
                    <Text style={styles.rpValue}>
                        {item.currentRp}
                    </Text>
                    <Text style={styles.rpLabel}>RP</Text>
                </View>
            </TouchableOpacity>
        );
    }
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.loadingText}>
                    {t('leaderboard.loading')}
                </Text>
            </View>
        );
    }

    if (error && hunters.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={45}
                    color={colors.danger}
                />

                <Text style={styles.errorText}>
                    {t('leaderboard.loadFailed')}
                </Text>

                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => void fetchLeaderboard()}
                >
                    <Text style={styles.retryButtonText}>
                        {t('leaderboard.retry')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {searchOpen ? (
                    <View style={styles.compactSearch}>
                        <View style={styles.searchInputWrapper}>
                            <MaterialCommunityIcons
                                name="badge-account-outline"
                                size={20}
                                color={colors.mutedText}
                            />
                            <TextInput
                                ref={searchInputRef}
                                style={styles.searchInput}
                                value={searchCode}
                                onChangeText={(value) => {
                                    setSearchCode(value);
                                    setSearchError(null);
                                }}
                                placeholder={t('leaderboard.searchPlaceholder')}
                                placeholderTextColor={colors.mutedText}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                returnKeyType="search"
                                editable={!searching}
                                onSubmitEditing={() => void handleSearch()}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.headerIconButton}
                            onPress={() => void handleSearch()}
                            disabled={searching}
                            accessibilityRole="button"
                            accessibilityLabel={t('leaderboard.search')}
                        >
                            {searching ? (
                                <ActivityIndicator size="small" color={colors.accent} />
                            ) : (
                                <MaterialCommunityIcons
                                    name="magnify"
                                    size={24}
                                    color={colors.accent}
                                />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerIconButton}
                            onPress={closeSearch}
                            disabled={searching}
                            accessibilityRole="button"
                            accessibilityLabel={t('leaderboard.closeSearch')}
                        >
                            <MaterialCommunityIcons
                                name="close"
                                size={24}
                                color={colors.mutedText}
                            />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.headerTitleRow}>
                        <View>
                            <Text style={styles.title}>
                                {t('leaderboard.title')}
                            </Text>
                            <Text style={styles.subtitle}>
                                {t('leaderboard.subtitle', { count: hunters.length })}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.headerIconButton}
                            onPress={openSearch}
                            accessibilityRole="button"
                            accessibilityLabel={t('leaderboard.openSearch')}
                        >
                            <MaterialCommunityIcons
                                name="magnify"
                                size={27}
                                color={colors.text}
                            />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {searchError ? (
                <Text style={styles.searchError}>
                    {searchError}
                </Text>
            ) : null}
            <FlatList
                data={hunters}
                keyExtractor={(item) => item.hunterCode}
                renderItem={renderHunter}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => void fetchLeaderboard(true)}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {t('leaderboard.empty')}
                        </Text>
                    </View>
                }
            />
        </View>
    );

}
const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },

        centerContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 30,
            backgroundColor: colors.background,
        },

        header: {
            paddingTop: 56,
            paddingHorizontal: 18,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },

        headerTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        headerIconButton: {
            width: 42,
            height: 42,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 21,
        },

        title: {
            color: colors.text,
            fontSize: 25,
            fontWeight: '800',
            letterSpacing: 1.5,
        },

        subtitle: {
            marginTop: 5,
            color: colors.mutedText,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.4,
        },

        listContent: {
            paddingHorizontal: 14,
            paddingVertical: 18,
            paddingBottom: 40,
        },

        hunterCard: {
            minHeight: 88,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            backgroundColor: colors.surface,
        },

        topHunterCard: {
            borderColor: themeColor(colors, 'rgba(114,188,224,0.25)'),
            backgroundColor: colors.elevated,
        },

        firstHunterCard: {
            borderColor: themeColor(colors, 'rgba(250,204,21,0.34)'),
        },

        separator: {
            height: 10,
        },

        positionContainer: {
            width: 38,
            justifyContent: 'center',
            alignItems: 'center',
        },

        positionText: {
            color: colors.mutedText,
            fontSize: 17,
            fontWeight: '800',
        },

        avatarContainer: {
            width: 54,
            height: 54,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: 27,
            backgroundColor: colors.elevated,
        },

        avatar: {
            width: '100%',
            height: '100%',
            borderRadius: 27,
        },

        rankBadge: {
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: 23,
            height: 23,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderRadius: 12,
            backgroundColor: colors.surface,
        },

        rankBadgeText: {
            fontSize: 10,
            fontWeight: '900',
        },

        hunterInfo: {
            flex: 1,
            minWidth: 0,
            marginLeft: 12,
            marginRight: 8,
        },

        fullName: {
            color: colors.text,
            fontSize: 15,
            fontWeight: '800',
        },

        hunterCode: {
            marginTop: 3,
            color: colors.mutedText,
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.4,
        },

        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 6,
            gap: 10,
        },

        rankText: {
            color: colors.accent,
            fontSize: 11,
            fontWeight: '800',
        },

        streakText: {
            color: colors.mutedText,
            fontSize: 11,
            fontWeight: '700',
        },

        rpContainer: {
            minWidth: 48,
            alignItems: 'flex-end',
        },

        rpValue: {
            color: colors.text,
            fontSize: 20,
            fontWeight: '900',
        },

        rpLabel: {
            color: colors.accent,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 1,
        },

        loadingText: {
            marginTop: 14,
            color: colors.mutedText,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1,
        },

        errorText: {
            marginTop: 14,
            color: colors.mutedText,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
        },

        retryButton: {
            marginTop: 20,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 9,
            backgroundColor: colors.accent,
        },

        retryButtonText: {
            color: colors.contrastText,
            fontSize: 13,
            fontWeight: '800',
        },

        emptyContainer: {
            paddingVertical: 80,
            alignItems: 'center',
        },

        emptyText: {
            color: colors.mutedText,
            fontSize: 14,
        },
        compactSearch: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },

        searchInputWrapper: {
            flex: 1,
            height: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            paddingHorizontal: 13,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.surface,
        },

        searchInput: {
            flex: 1,
            height: '100%',
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
        },

        searchError: {
            marginTop: 8,
            marginHorizontal: 16,
            color: colors.danger,
            fontSize: 12,
            fontWeight: '600',
        },
    });
