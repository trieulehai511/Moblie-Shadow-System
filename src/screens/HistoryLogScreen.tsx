import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';
import {
    QuestLogApiResponse,
    QuestLogItem,
    QuestLogPage,
} from '../models/QuestLogModel';

type TokenPayload = {
    sub: string;
};

type HistorySection = {
    title: string;
    data: QuestLogItem[];
};

const HISTORY_DAYS = 30;

const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTime = (createdAt?: string) => {
    if (!createdAt) return 'SYSTEM';

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return 'SYSTEM';

    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const formatStatus = (status?: string) =>
    status?.toUpperCase() === 'COMPLETED'
        ? 'SUCCESS'
        : status?.toUpperCase() || 'RECORDED';

export default function HistoryLogScreen() {
    const [logs, setLogs] = useState<QuestLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedDate, setExpandedDate] = useState(() =>
        formatDateKey(new Date())
    );
    const initializedExpandedDate = useRef(false);

    const fetchLogs = useCallback(async () => {
        try {
            setError(null);

            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }

            const hunterId = jwtDecode<TokenPayload>(token).sub;
            const response = await api.get<QuestLogApiResponse>(
                `/quest-logs/hunter/${hunterId}`,
                {
                    params: {
                        page: 0,
                        size: 100,
                        sort: 'createdAt,desc',
                    },
                }
            );

            const page: QuestLogPage = response.data.result;
            setLogs(page.content ?? []);
        } catch (fetchError: any) {
            console.log('Fetch quest logs error:', fetchError);
            setError(
                fetchError.response?.data?.message ||
                fetchError.message ||
                'Failed to retrieve quest history'
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    const handleRefresh = () => {
        setRefreshing(true);
        void fetchLogs();
    };

    const sections = useMemo<HistorySection[]>(() => {
        const groupedLogs = logs.reduce<Record<string, QuestLogItem[]>>(
            (groups, log) => {
                const date = log.logDate || 'Unknown Date';
                if (!groups[date]) groups[date] = [];
                groups[date].push(log);
                return groups;
            },
            {}
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const oldestAllowedDate = new Date(today);
        oldestAllowedDate.setDate(today.getDate() - (HISTORY_DAYS - 1));

        const logDates = Object.keys(groupedLogs)
            .filter(date => date !== 'Unknown Date')
            .sort();

        const firstLogDate = logDates.length
            ? new Date(`${logDates[0]}T00:00:00`)
            : today;

        const startDate = new Date(
            Math.max(firstLogDate.getTime(), oldestAllowedDate.getTime())
        );

        const result: HistorySection[] = [];
        const currentDate = new Date(today);

        while (currentDate >= startDate) {
            const dateKey = formatDateKey(currentDate);
            result.push({
                title: dateKey,
                data: groupedLogs[dateKey] ?? [],
            });
            currentDate.setDate(currentDate.getDate() - 1);
        }

        return result;
    }, [logs]);

    const activeDays = sections.filter(section => section.data.length > 0).length;
    const missedDays = sections.length - activeDays;

    useEffect(() => {
        if (loading || initializedExpandedDate.current) return;

        const newestActiveDate =
            sections.find(section => section.data.length > 0)?.title ??
            sections[0]?.title;

        if (newestActiveDate) {
            setExpandedDate(newestActiveDate);
        }
        initializedExpandedDate.current = true;
    }, [loading, sections]);

    const displaySections = useMemo(
        () =>
            sections.map(section => ({
                title: section.title,
                entries: section.data,
                data: expandedDate === section.title ? section.data : [],
            })),
        [expandedDate, sections]
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <View style={styles.loadingIcon}>
                    <ActivityIndicator size="large" color="#72bce0" />
                </View>
                <Text style={styles.loadingText}>RETRIEVING SYSTEM LOGS...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <SectionList
                sections={displaySections}
                keyExtractor={item => item.id}
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#72bce0"
                    />
                }
                ListHeaderComponent={
                    <View style={styles.historyHeader}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>History</Text>
                            <Feather name="clock" size={20} color="#6f737c" />
                        </View>

                        <Text style={styles.subtitle}>
                            Last {sections.length} day{sections.length === 1 ? '' : 's'}
                            <Text style={styles.summarySeparator}>  ·  </Text>
                            <Text style={styles.activeSummary}>
                                {activeDays} active
                            </Text>
                            <Text style={styles.summarySeparator}>  ·  </Text>
                            <Text style={styles.missedSummary}>
                                {missedDays} missed
                            </Text>
                        </Text>

                        {error ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}
                    </View>
                }
                renderSectionHeader={({ section }) => {
                    const didNothing = section.entries.length === 0;
                    const entryCount = section.entries.length;
                    const isExpanded = expandedDate === section.title;

                    return (
                        <Pressable
                            style={({ pressed }) => [
                                styles.dateHeader,
                                pressed && !didNothing && styles.dateHeaderPressed,
                            ]}
                            disabled={didNothing}
                            onPress={() =>
                                setExpandedDate(current =>
                                    current === section.title
                                        ? ''
                                        : section.title
                                )
                            }
                        >
                            <View
                                style={[
                                    styles.timelineDot,
                                    didNothing && styles.timelineDotMissed,
                                ]}
                            />

                            <View style={styles.dateInformation}>
                                <Text style={styles.dateText}>{section.title}</Text>
                            </View>

                            <View style={styles.sectionActions}>
                                <Text
                                    style={[
                                        styles.sectionStatus,
                                        didNothing && styles.missedStatus,
                                    ]}
                                >
                                    {didNothing
                                        ? 'Missed'
                                        : `${entryCount} ${
                                            entryCount === 1 ? 'entry' : 'entries'
                                        }`}
                                </Text>

                                {!didNothing ? (
                                    <Feather
                                        name={
                                            isExpanded
                                                ? 'chevron-up'
                                                : 'chevron-down'
                                        }
                                        size={15}
                                        color="#616670"
                                    />
                                ) : null}
                            </View>
                        </Pressable>
                    );
                }}
                renderItem={({ item }) => {
                    const successful = item.status?.toUpperCase() === 'COMPLETED';

                    return (
                        <View style={styles.timelineItem}>
                            <View style={styles.timelineLine} />

                            <View style={styles.logCard}>
                                <View style={styles.logMain}>
                                    <Text style={styles.timeText}>
                                        {formatTime(item.createdAt)}
                                    </Text>
                                    <View style={styles.logContent}>
                                        <Text style={styles.exerciseName}>
                                            {item.exerciseName}
                                        </Text>
                                        <Text style={styles.exerciseDetails}>
                                            {item.completedSets} sets
                                            <Text style={styles.detailSeparator}>  ·  </Text>
                                            {item.completedReps} reps
                                            <Text style={styles.detailSeparator}>  ·  </Text>
                                            <Text style={styles.statText}>
                                                {item.targetStat || 'STAT'}
                                            </Text>
                                        </Text>
                                    </View>
                                </View>

                                <Text
                                    style={[
                                        styles.statusText,
                                        !successful && styles.statusFailed,
                                    ]}
                                >
                                    {formatStatus(item.status)}
                                </Text>
                            </View>
                        </View>
                    );
                }}
                ListFooterComponent={<View style={styles.footerSpace} />}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#08090d',
    },
    ambientGlow: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        top: -150,
        right: -120,
        backgroundColor: 'rgba(67,157,205,0.09)',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 30,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#08090d',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingIcon: {
        width: 68,
        height: 68,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.22)',
        backgroundColor: 'rgba(114,188,224,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#72bce0',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginTop: 16,
    },
    historyHeader: {
        marginBottom: 34,
    },
    systemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    onlineDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6ee7b7',
        marginRight: 7,
    },
    systemLabel: {
        color: '#7f8792',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleBlock: {
        flex: 1,
        marginRight: 16,
    },
    title: {
        color: '#f8fafc',
        fontSize: 30,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    subtitle: {
        color: '#777b84',
        fontSize: 13,
        lineHeight: 19,
        marginTop: 9,
    },
    summarySeparator: {
        color: '#3f4249',
    },
    activeSummary: {
        color: '#aeb2ba',
    },
    missedSummary: {
        color: '#b46e73',
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.25)',
        backgroundColor: 'rgba(114,188,224,0.07)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCard: {
        minHeight: 78,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        paddingHorizontal: 16,
        marginTop: 22,
        overflow: 'hidden',
    },
    summaryMetric: {
        minWidth: 62,
    },
    summaryValue: {
        color: '#ffffff',
        fontSize: 23,
        fontWeight: '900',
    },
    missedValue: {
        color: '#f87171',
    },
    summaryLabel: {
        color: '#9297a1',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.8,
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 34,
        backgroundColor: '#30333c',
        marginHorizontal: 15,
    },
    syncedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(110,231,183,0.07)',
        borderRadius: 20,
        paddingHorizontal: 9,
        paddingVertical: 7,
        marginLeft: 'auto',
    },
    syncedText: {
        color: '#6ee7b7',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(248,113,113,0.07)',
        borderRadius: 8,
        padding: 10,
        marginTop: 12,
    },
    errorText: {
        flex: 1,
        color: '#fca5a5',
        fontSize: 11,
        lineHeight: 16,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 36,
        marginBottom: 2,
        marginTop: 8,
        borderRadius: 6,
    },
    dateHeaderPressed: {
        backgroundColor: 'rgba(255,255,255,0.025)',
    },
    timelineDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#8b929c',
        marginLeft: 3,
        marginRight: 14,
    },
    timelineDotMissed: {
        backgroundColor: '#70474c',
    },
    dateInformation: {
        flex: 1,
    },
    dateText: {
        color: '#c9ccd2',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    dateSubtitle: {
        color: '#9297a1',
        fontSize: 9,
        marginTop: 3,
    },
    missedSubtitle: {
        color: '#a66b70',
    },
    sectionBadge: {
        borderRadius: 20,
        backgroundColor: 'rgba(114,188,224,0.08)',
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    sectionBadgeText: {
        color: '#72bce0',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    missedBadge: {
        backgroundColor: 'rgba(248,113,113,0.08)',
    },
    missedBadgeText: {
        color: '#f87171',
    },
    sectionStatus: {
        color: '#737983',
        fontSize: 10,
        fontWeight: '500',
    },
    sectionActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    missedStatus: {
        color: '#9a5d62',
    },
    timelineItem: {
        position: 'relative',
        paddingLeft: 20,
    },
    timelineLine: {
        position: 'absolute',
        left: 6,
        top: -2,
        bottom: 0,
        width: 1,
        backgroundColor: '#24262c',
    },
    logCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#202228',
        paddingVertical: 15,
        marginBottom: 3,
    },
    cardAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: '#6ee7b7',
    },
    cardAccentFailed: {
        backgroundColor: '#f87171',
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#292d36',
        paddingBottom: 9,
        marginBottom: 12,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timeText: {
        width: 42,
        color: '#555a63',
        fontSize: 10,
        fontWeight: '500',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#6ee7b7',
        marginRight: 5,
    },
    statusDotFailed: {
        backgroundColor: '#f87171',
    },
    statusText: {
        color: '#789b8c',
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    statusFailed: {
        color: '#f87171',
    },
    exerciseName: {
        color: '#e4e6ea',
        fontSize: 15,
        fontWeight: '600',
    },
    logMain: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    logContent: {
        flex: 1,
    },
    exerciseDetails: {
        color: '#686d76',
        fontSize: 11,
        marginTop: 5,
    },
    detailSeparator: {
        color: '#34373d',
    },
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metric: {
        minWidth: 45,
    },
    metricValue: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '900',
    },
    metricLabel: {
        color: '#9297a1',
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.7,
        marginTop: 2,
    },
    metricDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#30333c',
        marginHorizontal: 13,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(185,167,255,0.08)',
        borderRadius: 20,
        paddingHorizontal: 9,
        paddingVertical: 6,
        marginLeft: 'auto',
    },
    statText: {
        color: '#8c829e',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    footerSpace: {
        height: 30,
    },
});
