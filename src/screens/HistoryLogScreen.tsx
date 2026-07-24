import React, { useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    SectionList,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

import api from '../services/api';
import {
    QuestLogItem,
    QuestLogPage,
    QuestLogApiResponse,
} from '../models/QuestLogModel';

type TokenPayload = {
    sub: string;
};

const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

function HistoryLog() {
    const [logs, setLogs] = useState<QuestLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            const decoded = jwtDecode<TokenPayload>(token);
            const hunterId = decoded.sub;

            const response = await api.get<QuestLogApiResponse>(`/quest-logs/hunter/${hunterId}`, {
                params: {
                    page: 0,
                    size: 20,
                    sort: 'createdAt,desc',
                },
            });
            const page: QuestLogPage = response.data.result;
            setLogs(page.content);
        } catch (error: any) {
            console.log('Fetch quest logs error:', error);

            setError(
                error.response?.data?.message ||
                error.message ||
                'Failed to retrieve quest history'
            );
        } finally {
            setLoading(false);
        }
    }

    const sections = useMemo(() => {
        const groupedLogs = logs.reduce<Record<string, QuestLogItem[]>>(
            (groups, log) => {
                const date = log.logDate || 'Unknown Date';

                if (!groups[date]) {
                    groups[date] = [];
                }

                groups[date].push(log);

                return groups;
            },
            {}
        );
        const today = new Date();
        const logDates = Object.keys(groupedLogs).sort();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 29);
        const startDate =
            logDates.length > 0
                ? new Date(
                    Math.max(
                        new Date(`${logDates[0]}T00:00:00`).getTime(),
                        thirtyDaysAgo.getTime()
                    )
                )
                : thirtyDaysAgo;
        const result = [];
        const currentDate = new Date(today);

        // Đi ngược từ hôm nay về ngày có log cũ nhất.
        while (currentDate >= startDate) {
            const dateKey = formatDateKey(currentDate);

            result.push({
                title: dateKey,
                data: groupedLogs[dateKey] || [],
            });

            currentDate.setDate(currentDate.getDate() - 1);
        }
        return result;
    }, [logs]);
    useEffect(() => { fetchLogs(); }, []);



    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#72bce0" />
                <Text style={styles.loadingText}>
                    RETRIEVING SYSTEM LOGS...
                </Text>
            </View>
        );
    }
    return (
        <View style={styles.container}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <SectionList
                sections={sections}
                keyExtractor={item => item.id}
                renderSectionHeader={({ section }) => {
                    const didNothing = section.data.length === 0;

                    return (
                        <View style={styles.dateHeader}>
                            <Text style={styles.dateText}>
                                {section.title}
                            </Text>

                            {didNothing ? (
                                <Text style={styles.lazyText}>
                                    DO NOTHING TODAY
                                </Text>
                            ) : (
                                <Text style={styles.entryText}>
                                    {
                                    section.data.length === 1 
                                    ? '${section.data.length} ENTRY'
                                    : `${section.data.length} ENTRIES`
                                    }
                                </Text>
                            )}
                        </View>
                    );
                }}
                renderItem={({ item }) => (
                    <View style={styles.logCard}>
                        <View style={styles.logMeta}>
                            <Text style={styles.statusText}>
                                {item.status === 'COMPLETED'
                                    ? 'SUCCESS'
                                    : item.status}
                            </Text>

                            <Text style={styles.statText}>
                                +{item.targetStat}
                            </Text>
                        </View>

                        <Text style={styles.exerciseName}>
                            {item.exerciseName}
                        </Text>

                        <Text style={styles.description}>
                            Completed: {item.completedSets} Sets ×{' '}
                            {item.completedReps} Reps
                        </Text>
                    </View>
                )}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#08090d',
        padding: 16,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#08090d',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#72bce0',
        marginTop: 12,
    },
    errorText: {
        color: '#f87171',
        marginBottom: 12,
    },
    logCard: {
        backgroundColor: '#12141a',
        borderWidth: 1,
        borderColor: '#30333c',
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
    },
    exerciseName: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
    },
    description: {
        color: '#9297a1',
        marginTop: 6,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#08090d',
        borderBottomWidth: 1,
        borderBottomColor: '#30333c',
        paddingVertical: 12,
        marginBottom: 12,
    },

    lazyText: {
        color: '#f87171',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    entryText: {
        color: '#6ee7b7',
        fontSize: 10,
        fontWeight: '700',
    },

    dateText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },

    logMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },

    statusText: {
        color: '#6ee7b7',
        fontSize: 11,
        fontWeight: '800',
    },

    statText: {
        color: '#b9a7ff',
        fontSize: 12,
        fontWeight: '800',
    },
});

export default HistoryLog