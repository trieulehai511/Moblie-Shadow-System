import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    AppState,
    Image,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';
import {
    ActiveQuestSession,
    DailyQuestResponse,
    QuestItem,
    TrainingPace,
} from '../models/QuestModel';
import { useTranslation } from 'react-i18next';
import {
    ThemeColors,
    themeColor,
    useAppTheme,
} from '../theme/ThemeContext';

type TokenPayload = {
    sub: string;
    username?: string;
};

type AttributeName = 'strength' | 'agility' | 'vitality';
type AttributeValues = Partial<Record<AttributeName, number>>;

type CompletionReward = {
    message: string;
    attributeGains: AttributeValues;
};

const SESSION_PREFIX = 'shadow_quest_session_';
const ATTRIBUTE_GAINS_PREFIX = 'shadow_quest_attribute_gains_';
const PING_INTERVAL_SECONDS = 10;
const ATTRIBUTE_NAMES: AttributeName[] = ['strength', 'agility', 'vitality'];
const ATTRIBUTE_LABELS: Record<AttributeName, string> = {
    strength: 'STR',
    agility: 'AGI',
    vitality: 'VIT',
};
const COMPLETION_MESSAGE_KEYS = [
    'dailyQuest.completionMessages.attributes',
    'dailyQuest.completionMessages.effort',
    'dailyQuest.completionMessages.stronger',
    'dailyQuest.completionMessages.progress',
] as const;

const PACE_OPTIONS: Array<{
    value: TrainingPace;
    icon: React.ComponentProps<typeof Feather>['name'];
    title: string;
    subtitle: string;
}> = [
    { value: 'STRONG', icon: 'zap', title: 'STRONG', subtitle: 'Fast & Heavy' },
    { value: 'AVERAGE', icon: 'activity', title: 'AVERAGE', subtitle: 'Moderate' },
    { value: 'WEAK', icon: 'feather', title: 'WEAK', subtitle: 'Light' },
];

const unwrapQuest = (data: any): DailyQuestResponse | null =>
    (data?.result ?? data ?? null) as DailyQuestResponse | null;

const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

const getAttributes = (data: any): AttributeValues => {
    const profile = data?.result ?? data ?? {};
    return Object.fromEntries(
        ATTRIBUTE_NAMES
            .filter(attribute => typeof profile[attribute] === 'number')
            .map(attribute => [attribute, profile[attribute]])
    ) as AttributeValues;
};

const getAttributeGains = (
    before: AttributeValues,
    after: AttributeValues
): AttributeValues =>
    Object.fromEntries(
        ATTRIBUTE_NAMES
            .filter(
                attribute =>
                    typeof before[attribute] === 'number' &&
                    typeof after[attribute] === 'number'
            )
            .map(attribute => [
                attribute,
                Math.max(0, after[attribute]! - before[attribute]!),
            ])
    ) as AttributeValues;

const addAttributeGains = (
    current: AttributeValues,
    added: AttributeValues
): AttributeValues =>
    Object.fromEntries(
        ATTRIBUTE_NAMES.map(attribute => [
            attribute,
            (current[attribute] ?? 0) + (added[attribute] ?? 0),
        ])
    ) as AttributeValues;

export default function DailyQuestScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const navigation = useNavigation<any>();
    const [questData, setQuestData] = useState<DailyQuestResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [hunterId, setHunterId] = useState<string | null>(null);
    const [detailItem, setDetailItem] = useState<QuestItem | null>(null);
    const [workoutItem, setWorkoutItem] = useState<QuestItem | null>(null);
    const [session, setSession] = useState<ActiveQuestSession | null>(null);
    const [selectedPace, setSelectedPace] = useState<TrainingPace>('AVERAGE');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [completionReward, setCompletionReward] =
        useState<CompletionReward | null>(null);

    const sessionRef = useRef<ActiveQuestSession | null>(null);
    const workoutItemRef = useRef<QuestItem | null>(null);
    const pingTickRef = useRef(0);
    const pingInFlightRef = useRef(false);
    const initialOrderRef = useRef<string[]>([]);
    const rewardOpacity = useRef(new Animated.Value(0)).current;
    const rewardScale = useRef(new Animated.Value(0.94)).current;

    useEffect(() => {
        if (!completionReward) return;

        rewardOpacity.setValue(0);
        rewardScale.setValue(0.94);
        Animated.parallel([
            Animated.timing(rewardOpacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.spring(rewardScale, {
                toValue: 1,
                damping: 15,
                stiffness: 170,
                mass: 0.8,
                useNativeDriver: true,
            }),
        ]).start();
    }, [completionReward, rewardOpacity, rewardScale]);

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    useEffect(() => {
        workoutItemRef.current = workoutItem;
    }, [workoutItem]);

    const sortQuest = useCallback((quest: DailyQuestResponse) => {
        if (initialOrderRef.current.length === 0) {
            initialOrderRef.current = quest.questItems.map(item => item.id);
            return quest;
        }

        const positions = new Map(
            initialOrderRef.current.map((id, index) => [id, index])
        );
        return {
            ...quest,
            questItems: [...quest.questItems].sort(
                (a, b) =>
                    (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
                    (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER)
            ),
        };
    }, []);

    const saveSession = useCallback((nextSession: ActiveQuestSession) => {
        void AsyncStorage.setItem(
            `${SESSION_PREFIX}${nextSession.itemId}`,
            JSON.stringify(nextSession)
        );
    }, []);

    const removeSession = useCallback((itemId: string) => {
        void AsyncStorage.removeItem(`${SESSION_PREFIX}${itemId}`);
    }, []);

    const fetchQuest = useCallback(async () => {
        try {
            setErrorMessage(null);

            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error(t('dailyQuest.authTokenMissing'));
            }

            const decoded = jwtDecode<TokenPayload>(token);
            setHunterId(decoded.sub);

            const response = await api.get('/daily-quest/today');
            const quest = unwrapQuest(response.data);
            setQuestData(quest ? sortQuest(quest) : null);
        } catch (error: any) {
            console.log('Fetch daily quest error:', error);
            setErrorMessage(
                error.response?.data?.message ||
                error.message ||
                t('dailyQuest.syncFailed')
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [sortQuest, t]);

    useEffect(() => {
        fetchQuest();
    }, [fetchQuest]);

    const pauseCurrentSession = useCallback(() => {
        const current = sessionRef.current;
        if (!current || current.isPaused) return;

        const paused = { ...current, isPaused: true };
        sessionRef.current = paused;
        setSession(paused);
        saveSession(paused);
    }, [saveSession]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (nextState !== 'active') {
                pauseCurrentSession();
            }
        });
        return () => subscription.remove();
    }, [pauseCurrentSession]);

    const syncProgress = useCallback(
        async (current: ActiveQuestSession): Promise<number | null> => {
            if (pingInFlightRef.current) return null;
            pingInFlightRef.current = true;

            try {
                const response = await api.post(
                    `/daily-quest/item/${current.itemId}/ping-progress`
                );
                const serverAccumulated =
                    response.data?.result?.accumulatedSeconds ??
                    current.accumulatedSeconds;

                setSession(previous => {
                    if (!previous || previous.itemId !== current.itemId) {
                        return previous;
                    }
                    const updated = {
                        ...previous,
                        accumulatedSeconds: serverAccumulated,
                        isFinishing: false,
                    };
                    saveSession(updated);
                    return updated;
                });
                return serverAccumulated;
            } catch (error: any) {
                console.log('Progress sync error:', error);
                setSession(previous => {
                    if (!previous || previous.itemId !== current.itemId) {
                        return previous;
                    }
                    const updated = { ...previous, isFinishing: false };
                    saveSession(updated);
                    return updated;
                });
                return null;
            } finally {
                pingInFlightRef.current = false;
            }
        },
        [saveSession]
    );

    useEffect(() => {
        if (!session || session.isPaused) return;

        const interval = setInterval(() => {
            const current = sessionRef.current;
            const item = workoutItemRef.current;
            if (!current || current.isPaused) return;

            const isLastTrainingSecond =
                current.phase === 'training' &&
                Boolean(item) &&
                current.currentSet >= (item?.targetSets ?? 0) &&
                current.timeLeft <= 1;

            setSession(previous => {
                if (!previous || previous.isPaused) return previous;

                let timeLeft = previous.timeLeft - 1;
                let phase = previous.phase;
                let currentSet = previous.currentSet;

                if (timeLeft <= 0) {
                    if (previous.phase === 'training') {
                        if (
                            workoutItemRef.current &&
                            previous.currentSet >= workoutItemRef.current.targetSets
                        ) {
                            const finished = {
                                ...previous,
                                timeLeft: 0,
                                isPaused: true,
                                isFinishing:
                                    previous.accumulatedSeconds <
                                    previous.totalRequiredSeconds,
                            };
                            saveSession(finished);
                            return finished;
                        }
                        phase = 'rest';
                        timeLeft = previous.restSeconds;
                    } else {
                        phase = 'training';
                        timeLeft = previous.secondsPerSet;
                        currentSet += 1;
                    }
                }

                const updated = {
                    ...previous,
                    timeLeft,
                    phase,
                    currentSet,
                };
                saveSession(updated);
                return updated;
            });

            pingTickRef.current += 1;
            if (
                pingTickRef.current >= PING_INTERVAL_SECONDS &&
                !isLastTrainingSecond
            ) {
                pingTickRef.current = 0;
                void syncProgress(current);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [session?.isPaused, session?.itemId, saveSession, syncProgress]);

    useEffect(() => {
        const needsFinalSync =
            session?.timeLeft === 0 &&
            session.accumulatedSeconds < session.totalRequiredSeconds;

        if (!needsFinalSync) return;

        let cancelled = false;

        const retryFinalSync = async () => {
            const current = sessionRef.current;
            if (
                cancelled ||
                !current ||
                current.timeLeft !== 0 ||
                current.accumulatedSeconds >= current.totalRequiredSeconds
            ) {
                return;
            }

            setSession(previous =>
                previous ? { ...previous, isFinishing: true } : previous
            );
            await syncProgress(current);
        };

        void retryFinalSync();
        const retryInterval = setInterval(retryFinalSync, 5000);

        return () => {
            cancelled = true;
            clearInterval(retryInterval);
        };
    }, [
        session?.timeLeft,
        session?.accumulatedSeconds,
        session?.totalRequiredSeconds,
        syncProgress,
    ]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchQuest();
    };

    const handleGenerateQuest = async () => {
        if (!hunterId || generating) return;

        setGenerating(true);
        setErrorMessage(null);
        try {
            const response = await api.post(
                `/daily-quest/hunter/${hunterId}/generate`
            );
            const quest = unwrapQuest(response.data);
            if (!quest) throw new Error(t('dailyQuest.noQuestData'));
            setQuestData(sortQuest(quest));
        } catch (error: any) {
            setErrorMessage(
                error.response?.data?.message ||
                error.message ||
                t('dailyQuest.initializeFailed')
            );
        } finally {
            setGenerating(false);
        }
    };

    const openWorkout = async (item: QuestItem) => {
        setWorkoutItem(item);
        setErrorMessage(null);
        pingTickRef.current = 0;

        const saved = await AsyncStorage.getItem(`${SESSION_PREFIX}${item.id}`);
        const serverAccumulated = item.accumulatedSeconds ?? 0;
        const serverRequired = item.requiredSeconds ?? 0;

        if (saved) {
            try {
                const parsed = JSON.parse(saved) as ActiveQuestSession;
                const restored = {
                    ...parsed,
                    accumulatedSeconds: Math.max(
                        parsed.accumulatedSeconds,
                        serverAccumulated
                    ),
                    isPaused: true,
                };
                setSelectedPace(restored.pace);
                setSession(restored);
                saveSession(restored);
                return;
            } catch {
                await AsyncStorage.removeItem(`${SESSION_PREFIX}${item.id}`);
            }
        }

        if (serverRequired > 0 && serverAccumulated >= serverRequired) {
            const completedSession: ActiveQuestSession = {
                itemId: item.id,
                exerciseName: item.exerciseName,
                pace: 'AVERAGE',
                secondsPerSet: 0,
                restSeconds: 0,
                totalRequiredSeconds: serverRequired,
                accumulatedSeconds: serverAccumulated,
                currentSet: item.targetSets,
                phase: 'training',
                timeLeft: 0,
                isPaused: true,
            };
            setSession(completedSession);
            saveSession(completedSession);
            return;
        }

        if (item.status === 'IN_PROGRESS' || serverAccumulated > 0) {
            const secondsPerSet = Math.max(1, item.targetReps * 3);
            const restSeconds = 60;
            const calculatedRequired =
                secondsPerSet * item.targetSets +
                restSeconds * Math.max(0, item.targetSets - 1);
            const restored: ActiveQuestSession = {
                itemId: item.id,
                exerciseName: item.exerciseName,
                pace: 'AVERAGE',
                secondsPerSet,
                restSeconds,
                totalRequiredSeconds:
                    calculatedRequired || serverRequired || 100,
                accumulatedSeconds: serverAccumulated,
                currentSet: 1,
                phase: 'training',
                timeLeft: secondsPerSet,
                isPaused: true,
            };
            setSession(restored);
            saveSession(restored);
            return;
        }

        setSelectedPace('AVERAGE');
        setSession(null);
    };

    const closeWorkout = () => {
        pauseCurrentSession();
        setWorkoutItem(null);
        setErrorMessage(null);
    };

    const startWorkout = async () => {
        if (!workoutItem || actionLoading) return;

        setActionLoading(true);
        setErrorMessage(null);
        pingTickRef.current = 0;
        try {
            const response = await api.post(
                `/daily-quest/item/${workoutItem.id}/start?pace=${selectedPace}`
            );
            const timing = response.data?.result;
            if (!timing) throw new Error(t('dailyQuest.noTiming'));

            const nextSession: ActiveQuestSession = {
                itemId: workoutItem.id,
                exerciseName: workoutItem.exerciseName,
                pace: selectedPace,
                secondsPerSet: timing.secondsPerSet,
                restSeconds: timing.restSeconds,
                totalRequiredSeconds: timing.totalRequiredSeconds,
                accumulatedSeconds: 0,
                currentSet: 1,
                phase: 'training',
                timeLeft: timing.secondsPerSet,
                isPaused: false,
            };
            setSession(nextSession);
            saveSession(nextSession);
        } catch (error: any) {
            setErrorMessage(
                error.response?.data?.message ||
                error.message ||
                t('dailyQuest.startFailed')
            );
        } finally {
            setActionLoading(false);
        }
    };

    const resetWorkout = async () => {
        if (!workoutItem || actionLoading) return;

        setActionLoading(true);
        setErrorMessage(null);
        try {
            await api.post(`/daily-quest/item/${workoutItem.id}/reset`);
            removeSession(workoutItem.id);
            setSession(null);
            setWorkoutItem(null);
            await fetchQuest();
        } catch (error: any) {
            setErrorMessage(
                error.response?.data?.message ||
                t('dailyQuest.resetFailed')
            );
        } finally {
            setActionLoading(false);
        }
    };

    const confirmResetWorkout = () => {
        if (!workoutItem || actionLoading) return;

        const wasRunning = Boolean(sessionRef.current && !sessionRef.current.isPaused);
        pauseCurrentSession();
        let shouldResume = wasRunning;

        const resumeAfterCancel = () => {
            const current = sessionRef.current;
            if (!shouldResume || !current || current.timeLeft === 0) return;

            shouldResume = false;
            const resumed = { ...current, isPaused: false };
            sessionRef.current = resumed;
            setSession(resumed);
            saveSession(resumed);
        };

        Alert.alert(
            t('dailyQuest.resetTitle'),
            t('dailyQuest.resetConfirm', { name: workoutItem.exerciseName }),
            [
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                    onPress: resumeAfterCancel,
                },
                {
                    text: t('dailyQuest.reset'),
                    style: 'destructive',
                    onPress: () => {
                        shouldResume = false;
                        void resetWorkout();
                    },
                },
            ],
            {
                cancelable: true,
                onDismiss: resumeAfterCancel,
            }
        );
    };

    const completeWorkout = async () => {
        if (!workoutItem || actionLoading) return;

        setActionLoading(true);
        setErrorMessage(null);
        try {
            const completedItemId = workoutItem.id;
            const isMainQuestItem = workoutItem.type !== 'BONUS';
            const mainItemsBefore =
                questData?.questItems.filter(item => item.type !== 'BONUS') ?? [];
            const wasMainQuestCompleted =
                mainItemsBefore.length > 0 &&
                mainItemsBefore.every(item => item.completed);
            let attributesBefore: AttributeValues = {};

            if (isMainQuestItem) {
                try {
                    const profileBefore = await api.get('/auth/me');
                    attributesBefore = getAttributes(profileBefore.data);
                } catch (profileError) {
                    console.log('Read attributes before completion error:', profileError);
                }
            }

            const response = await api.patch(
                `/daily-quest/item/${completedItemId}/complete`
            );
            const quest = unwrapQuest(response.data);
            if (!quest) throw new Error('Updated quest data was not returned.');

            removeSession(completedItemId);
            setQuestData(sortQuest(quest));
            setSession(null);
            setWorkoutItem(null);

            const mainItemsAfter = quest.questItems.filter(
                item => item.type !== 'BONUS'
            );
            const isMainQuestCompleted =
                mainItemsAfter.length > 0 &&
                mainItemsAfter.every(item => item.completed);
            const questJustCleared =
                !wasMainQuestCompleted && isMainQuestCompleted;

            console.log('Quest reward check:', {
                wasMainQuestCompleted,
                isMainQuestCompleted,
                questCompletedFromServer: quest.completed,
                questJustCleared,
            });

            let accumulatedAttributeGains: AttributeValues = {};

            if (isMainQuestItem) {
                const storageKey = `${ATTRIBUTE_GAINS_PREFIX}${quest.id}`;

                try {
                    const storedAttributeGains =
                        await AsyncStorage.getItem(storageKey);
                    accumulatedAttributeGains = storedAttributeGains
                        ? (JSON.parse(storedAttributeGains) as AttributeValues)
                        : {};
                } catch (storageError) {
                    console.log('Read accumulated attribute gains error:', storageError);
                }

                try {
                    const profileAfter = await api.get('/auth/me');
                    const attributesAfter = getAttributes(profileAfter.data);
                    const currentAttributeGains = getAttributeGains(
                        attributesBefore,
                        attributesAfter
                    );
                    accumulatedAttributeGains = addAttributeGains(
                        accumulatedAttributeGains,
                        currentAttributeGains
                    );
                    await AsyncStorage.setItem(
                        storageKey,
                        JSON.stringify(accumulatedAttributeGains)
                    );
                } catch (profileError) {
                    console.log('Track attribute gains error:', profileError);
                }
            }

            if (questJustCleared) {
                setCompletionReward({
                    message:
                        t(COMPLETION_MESSAGE_KEYS[
                            Math.floor(Math.random() * COMPLETION_MESSAGE_KEYS.length)
                        ]),
                    attributeGains: accumulatedAttributeGains,
                });
                await AsyncStorage.removeItem(
                    `${ATTRIBUTE_GAINS_PREFIX}${quest.id}`
                );
            } else {
                Alert.alert(t('dailyQuest.exerciseComplete'), t('dailyQuest.progressRecorded'));
            }
        } catch (error: any) {
            setErrorMessage(
                error.response?.data?.message ||
                error.message ||
                t('dailyQuest.completeFailed')
            );
        } finally {
            setActionLoading(false);
        }
    };

    const mainItems = useMemo(
        () => questData?.questItems.filter(item => item.type !== 'BONUS') ?? [],
        [questData]
    );
    const bonusItems = useMemo(
        () => questData?.questItems.filter(item => item.type === 'BONUS') ?? [],
        [questData]
    );
    const completedMain = mainItems.filter(item => item.completed).length;
    const completedBonus = bonusItems.filter(item => item.completed).length;
    const progress =
        mainItems.length > 0
            ? Math.round((completedMain / mainItems.length) * 100)
            : 0;
    const questDateLabel = questData?.questDate
        ? new Date(`${questData.questDate}T00:00:00`)
            .toLocaleDateString(i18n.resolvedLanguage, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            })
            .toUpperCase()
        : t('dailyQuest.today').toUpperCase();

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={themeColor(colors, '#72bce0')} />
                <Text style={styles.loadingText}>{t('dailyQuest.loading')}</Text>
            </View>
        );
    }

    const renderQuestGroup = (
        title: string,
        subtitle: string,
        items: QuestItem[],
        bonus = false
    ) => {
        if (items.length === 0) return null;

        return (
            <View style={[styles.questGroup, bonus && styles.bonusGroup]}>
                <View style={styles.groupHeader}>
                    <View style={styles.groupHeaderText}>
                        <Text style={styles.groupTitle}>{title}</Text>
                        <Text style={styles.groupSubtitle}>{subtitle}</Text>
                    </View>
                    <Text style={bonus ? styles.bonusBadge : styles.requiredBadge}>
                        {bonus ? t('dailyQuest.optional') : t('dailyQuest.required')}
                    </Text>
                </View>

                {items.map(item => (
                    <View
                        key={item.id}
                        style={[
                            styles.questItem,
                            item.completed
                                ? styles.questItemComplete
                                : bonus
                                    ? styles.questItemBonus
                                    : styles.questItemPending,
                        ]}
                    >
                        <View style={styles.questItemMain}>
                            <View
                                style={[
                                    styles.stateIcon,
                                    item.completed && styles.stateIconComplete,
                                ]}
                            >
                                {item.completed ? (
                                    <Feather name="check" size={13} color={themeColor(colors, '#82b89d')} />
                                ) : (
                                    <View
                                        style={[
                                            styles.pendingDot,
                                            bonus && styles.bonusDot,
                                        ]}
                                    />
                                )}
                            </View>

                            <View style={styles.exerciseTextBlock}>
                                <Text
                                    style={[
                                        styles.exerciseName,
                                        item.completed && styles.completedText,
                                    ]}
                                >
                                    {item.exerciseName}
                                </Text>
                                <Text style={styles.exerciseTarget}>
                                    {item.targetSets} SETS × {item.targetReps} REPS
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.infoButton}
                                onPress={() => setDetailItem(item)}
                            >
                                <Feather name="info" size={16} color={themeColor(colors, '#717680')} />
                            </TouchableOpacity>

                            {item.completed ? (
                                <View style={styles.doneButton}>
                                    <Feather
                                        name="check-circle"
                                        size={14}
                                        color={themeColor(colors, '#82b89d')}
                                    />
                                    <Text style={styles.doneButtonText}>{t('dailyQuest.done').toUpperCase()}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.trainButton}
                                    activeOpacity={0.75}
                                    onPress={() => void openWorkout(item)}
                                >
                                    <Text style={styles.trainButtonText}>
                                        {item.status === 'IN_PROGRESS' ||
                                        (item.accumulatedSeconds ?? 0) > 0
                                            ? t('dailyQuest.resume').toUpperCase()
                                            : t('dailyQuest.train').toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView
            style={[styles.safeArea, { backgroundColor: colors.background }]}
            edges={['top']}
        >
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={themeColor(colors, '#72bce0')}
                    />
                }
            >
                <View style={styles.pageHeader}>
                    <View>
                        <Text style={styles.pageTitle}>{t('dailyQuest.title')}</Text>
                        <Text style={styles.pageDate}>{questDateLabel}</Text>
                    </View>
                    <Feather name="check-circle" size={20} color={themeColor(colors, '#6f737c')} />
                </View>

                <View style={styles.statusCard}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>{t('dailyQuest.today')}</Text>
                        <Text style={styles.progressValue}>
                            {completedMain} of {mainItems.length}
                        </Text>
                    </View>
                    <View style={styles.progressTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressHint}>
                        {questData?.completed
                            ? t('dailyQuest.completed')
                            : t('dailyQuest.remaining', { count: Math.max(0, mainItems.length - completedMain) })}
                    </Text>
                </View>

                <View style={styles.questCard}>
                    <View style={styles.questHeader}>
                        <View>
                            <Text style={styles.questTitle}>{t('dailyQuest.exercises')}</Text>
                            <Text style={styles.questSubtitle}>
                                Complete the required exercises for today.
                            </Text>
                        </View>
                    </View>

                    {errorMessage && !workoutItem ? (
                        <View style={styles.errorBox}>
                            <Feather name="alert-triangle" size={16} color={themeColor(colors, '#f87171')} />
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                    ) : null}

                    {!questData?.questItems?.length ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <Feather name="clock" size={28} color={themeColor(colors, '#72bce0')} />
                            </View>
                            <Text style={styles.emptyTitle}>{t('dailyQuest.emptyTitle')}</Text>
                            <Text style={styles.emptyDescription}>
                                {questData?.restDay
                                    ? t('dailyQuest.restDay')
                                    : t('dailyQuest.noAssignedQuest')}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.generateButton,
                                    (generating || !hunterId) && styles.buttonDisabled,
                                ]}
                                disabled={generating || !hunterId}
                                onPress={handleGenerateQuest}
                            >
                                {generating ? (
                                    <ActivityIndicator size="small" color={themeColor(colors, '#071017')} />
                                ) : (
                                    <Feather name="zap" size={17} color={themeColor(colors, '#071017')} />
                                )}
                                <Text style={styles.generateButtonText}>
                                    {generating
                                        ? t('dailyQuest.initializing')
                                        : t('dailyQuest.initializeToday')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {renderQuestGroup(
                                t('dailyQuest.mainExercises'),
                                t('dailyQuest.requiredToday'),
                                mainItems
                            )}
                            {renderQuestGroup(
                                t('dailyQuest.bonus'),
                                t('dailyQuest.bonusProgress', { completed: completedBonus, total: bonusItems.length }),
                                bonusItems,
                                true
                            )}
                        </>
                    )}
                </View>
            </ScrollView>

            <Modal
                visible={Boolean(completionReward)}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setCompletionReward(null)}
            >
                <View style={styles.rewardOverlay}>
                    <Animated.View
                        style={[
                            styles.rewardCard,
                            {
                                opacity: rewardOpacity,
                                transform: [{ scale: rewardScale }],
                            },
                        ]}
                    >
                        <View style={styles.rewardIcon}>
                            <Feather name="arrow-up" size={24} color={themeColor(colors, '#9ac3aa')} />
                        </View>

                        <Text style={styles.rewardEyebrow}>{t('dailyQuest.questComplete')}</Text>
                        <Text style={styles.rewardTitle}>{t('dailyQuest.attributesIncreased')}</Text>
                        <Text style={styles.rewardMessage}>
                            {completionReward?.message}
                        </Text>

                        <View style={styles.attributeChanges}>
                            {ATTRIBUTE_NAMES.map(attribute => {
                                const gain =
                                    completionReward?.attributeGains[attribute];
                                if (typeof gain !== 'number' || gain <= 0) {
                                    return null;
                                }

                                return (
                                    <View
                                        style={styles.attributeChangeRow}
                                        key={attribute}
                                    >
                                        <Text style={styles.attributeChangeLabel}>
                                            {ATTRIBUTE_LABELS[attribute]}
                                        </Text>
                                        <Text style={styles.attributeChangeValue}>
                                            +{gain}
                                        </Text>
                                    </View>
                                );
                            })}

                            {!ATTRIBUTE_NAMES.some(
                                attribute =>
                                    (completionReward?.attributeGains[attribute] ??
                                        0) > 0
                            ) ? (
                                <Text style={styles.rewardAppliedText}>
                                    {t('dailyQuest.rewardsApplied')}
                                </Text>
                            ) : null}
                        </View>

                        <View style={styles.rewardActions}>
                            <TouchableOpacity
                                style={styles.viewProfileButton}
                                onPress={async () => {
                                    if (completionReward) {
                                        await AsyncStorage.setItem(
                                            'shadow_system_attribute_reward',
                                            JSON.stringify({
                                                attributeGains:
                                                    completionReward.attributeGains,
                                                claimedAt: Date.now(),
                                            })
                                        );
                                    }
                                    setCompletionReward(null);
                                    navigation.navigate('Profile');
                                }}
                            >
                                <Text style={styles.viewProfileButtonText}>
                                    {t('dailyQuest.viewProfile')}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.rewardDoneButton}
                                onPress={() => setCompletionReward(null)}
                            >
                                <Text style={styles.rewardDoneButtonText}>{t('dailyQuest.done')}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            <Modal
                visible={Boolean(detailItem)}
                transparent
                animationType="fade"
                onRequestClose={() => setDetailItem(null)}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={styles.modalSafeArea}>
                        <ScrollView contentContainerStyle={styles.modalScrollContent}>
                            <View style={styles.modalCard}>
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={() => setDetailItem(null)}
                                >
                                    <Feather name="x" size={22} color={themeColor(colors, '#c4c7ce')} />
                                </TouchableOpacity>

                                <Text style={styles.categoryBadge}>
                                    {detailItem?.category || t('dailyQuest.exerciseCategory')}
                                </Text>
                                <Text style={styles.modalTitle}>
                                    {detailItem?.exerciseName}
                                </Text>
                                <Text style={styles.modalTarget}>
                                    {t('dailyQuest.targetStat')}:{' '}
                                    <Text style={styles.accentText}>
                                        {detailItem?.targetStat}
                                    </Text>
                                </Text>

                                {detailItem?.imageUrl ? (
                                    <Image
                                        source={{ uri: detailItem.imageUrl }}
                                        style={styles.detailImage}
                                        resizeMode="cover"
                                    />
                                ) : null}

                                <Text style={styles.detailHeading}>
                                    {t('dailyQuest.exerciseDescription')}
                                </Text>
                                <Text style={styles.detailText}>
                                    {detailItem?.description ||
                                        t('dailyQuest.noDescription')}
                                </Text>

                                <View style={styles.detailStats}>
                                    <View style={styles.detailStatCard}>
                                        <Text style={styles.detailStatLabel}>{t('dailyQuest.targetSets')}</Text>
                                        <Text style={styles.detailStatValue}>
                                            {t('dailyQuest.sets', { count: detailItem?.targetSets })}
                                        </Text>
                                    </View>
                                    <View style={styles.detailStatCard}>
                                        <Text style={styles.detailStatLabel}>{t('dailyQuest.targetReps')}</Text>
                                        <Text style={styles.detailStatValue}>
                                            {t('dailyQuest.reps', { count: detailItem?.targetReps })}
                                        </Text>
                                    </View>
                                </View>

                                {detailItem?.safetyTips ? (
                                    <>
                                        <Text
                                            style={[
                                                styles.detailHeading,
                                                styles.warningText,
                                            ]}
                                        >
                                            {t('dailyQuest.safetyNotes')}
                                        </Text>
                                        <Text style={styles.detailText}>
                                            {detailItem.safetyTips}
                                        </Text>
                                    </>
                                ) : null}

                                {detailItem?.tutorialVideoUrl ? (
                                    <TouchableOpacity
                                        style={styles.videoButton}
                                        onPress={() =>
                                            Linking.openURL(
                                                detailItem.tutorialVideoUrl as string
                                            )
                                        }
                                    >
                                        <Feather
                                            name="play-circle"
                                            size={18}
                                            color={themeColor(colors, '#72bce0')}
                                        />
                                        <Text style={styles.videoButtonText}>
                                            {t('dailyQuest.watchTutorial')}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>

            <Modal
                visible={Boolean(workoutItem)}
                transparent
                animationType="slide"
                onRequestClose={closeWorkout}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={styles.modalSafeArea}>
                        <ScrollView contentContainerStyle={styles.modalScrollContent}>
                            <View style={styles.modalCard}>
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={closeWorkout}
                                >
                                    <Feather name="x" size={22} color={themeColor(colors, '#c4c7ce')} />
                                </TouchableOpacity>

                                <Text style={styles.categoryBadge}>
                                    {workoutItem?.category || t('dailyQuest.training')}
                                </Text>
                                <Text style={styles.modalTitle}>
                                    {workoutItem?.exerciseName}
                                </Text>
                                <Text style={styles.modalTarget}>
                                    {t('dailyQuest.target')}:{' '}
                                    <Text style={styles.accentText}>
                                        {t('dailyQuest.sets', { count: workoutItem?.targetSets })} ×{' '}
                                        {t('dailyQuest.reps', { count: workoutItem?.targetReps })}
                                    </Text>
                                </Text>

                                {!session ? (
                                    <View style={styles.paceSection}>
                                        <Text style={styles.detailHeading}>
                                            {t('dailyQuest.selectIntensity')}
                                        </Text>
                                        <Text style={styles.detailText}>
                                            {t('dailyQuest.intensityDescription')}
                                        </Text>

                                        {PACE_OPTIONS.map(option => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.paceOption,
                                                    selectedPace === option.value &&
                                                        styles.paceOptionActive,
                                                ]}
                                                onPress={() =>
                                                    setSelectedPace(option.value)
                                                }
                                            >
                                                <Feather
                                                    name={option.icon}
                                                    size={20}
                                                    color={
                                                        selectedPace === option.value
                                                            ? '#72bce0'
                                                            : '#8d919b'
                                                    }
                                                />
                                                <View style={styles.paceText}>
                                                    <Text style={styles.paceTitle}>
                                                        {t(`dailyQuest.pace.${option.value}.title`)}
                                                    </Text>
                                                    <Text style={styles.paceSubtitle}>
                                                        {t(`dailyQuest.pace.${option.value}.subtitle`)}
                                                    </Text>
                                                </View>
                                                {selectedPace === option.value ? (
                                                    <Feather
                                                        name="check-circle"
                                                        size={19}
                                                        color={themeColor(colors, '#72bce0')}
                                                    />
                                                ) : null}
                                            </TouchableOpacity>
                                        ))}

                                        <TouchableOpacity
                                            style={[
                                                styles.primaryButton,
                                                actionLoading && styles.buttonDisabled,
                                            ]}
                                            disabled={actionLoading}
                                            onPress={startWorkout}
                                        >
                                            {actionLoading ? (
                                                <ActivityIndicator
                                                    size="small"
                                                    color={themeColor(colors, '#071017')}
                                                />
                                            ) : (
                                                <Feather
                                                    name="play"
                                                    size={17}
                                                    color={themeColor(colors, '#071017')}
                                                />
                                            )}
                                            <Text style={styles.primaryButtonText}>
                                                {actionLoading
                                                    ? t('dailyQuest.activating')
                                                    : t('dailyQuest.startTraining')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.timerSection}>
                                        <View style={styles.phaseRow}>
                                            <Text
                                                style={[
                                                    styles.phaseBadge,
                                                    session.phase === 'rest' &&
                                                        styles.restBadge,
                                                ]}
                                            >
                                                {session.phase === 'training'
                                                    ? t('dailyQuest.training')
                                                    : t('dailyQuest.resting')}
                                            </Text>
                                            <Text style={styles.setText}>
                                                {t('dailyQuest.set')} {session.currentSet}/
                                                {workoutItem?.targetSets}
                                            </Text>
                                        </View>

                                        <View
                                            style={[
                                                styles.timerCircle,
                                                session.phase === 'rest' &&
                                                    styles.timerCircleRest,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.timerValue,
                                                    session.phase === 'rest' &&
                                                        styles.timerValueRest,
                                                ]}
                                            >
                                                {formatTime(session.timeLeft)}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.timerLabel,
                                                    session.phase === 'rest' &&
                                                        styles.timerLabelRest,
                                                ]}
                                            >
                                                {session.isFinishing
                                                    ? t('dailyQuest.syncing')
                                                    : session.phase === 'training'
                                                        ? t('dailyQuest.training')
                                                        : t('dailyQuest.resting')}
                                            </Text>
                                        </View>

                                        {session.timeLeft === 0 &&
                                        session.accumulatedSeconds <
                                            session.totalRequiredSeconds ? (
                                            <View style={styles.savingStatus}>
                                                <ActivityIndicator
                                                    size="small"
                                                    color={themeColor(colors, '#72bce0')}
                                                />
                                                <View style={styles.savingStatusText}>
                                                    <Text style={styles.savingTitle}>
                                                        {t('dailyQuest.savingWorkout')}
                                                    </Text>
                                                    <Text style={styles.savingSubtitle}>
                                                        {t('dailyQuest.autoSync')}
                                                    </Text>
                                                </View>
                                            </View>
                                        ) : null}

                                        <View style={styles.controlRow}>
                                            {session.timeLeft > 0 ? (
                                                <TouchableOpacity
                                                    style={styles.controlButton}
                                                    onPress={() => {
                                                        const updated = {
                                                            ...session,
                                                            isPaused: !session.isPaused,
                                                        };
                                                        setSession(updated);
                                                        saveSession(updated);
                                                    }}
                                                >
                                                    <Feather
                                                        name={
                                                            session.isPaused
                                                                ? 'play'
                                                                : 'pause'
                                                        }
                                                        size={17}
                                                        color={themeColor(colors, '#e5e7eb')}
                                                    />
                                                    <Text
                                                        style={
                                                            styles.controlButtonText
                                                        }
                                                    >
                                                        {session.isPaused
                                                            ? t('dailyQuest.resume').toUpperCase()
                                                            : t('dailyQuest.pause').toUpperCase()}
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : null}

                                            <TouchableOpacity
                                                style={[
                                                    styles.controlButton,
                                                    styles.resetButton,
                                                    session.timeLeft === 0 &&
                                                        styles.resetButtonCompact,
                                                ]}
                                                disabled={actionLoading}
                                                onPress={confirmResetWorkout}
                                            >
                                                <Feather
                                                    name="rotate-ccw"
                                                    size={17}
                                                    color={themeColor(colors, '#f87171')}
                                                />
                                                <Text style={styles.resetButtonText}>
                                                    {t('dailyQuest.reset').toUpperCase()}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {session.accumulatedSeconds >=
                                        session.totalRequiredSeconds ? (
                                            <TouchableOpacity
                                                style={styles.completeButton}
                                                disabled={actionLoading}
                                                onPress={completeWorkout}
                                            >
                                                {actionLoading ? (
                                                    <ActivityIndicator
                                                        size="small"
                                                        color={themeColor(colors, '#071017')}
                                                    />
                                                ) : (
                                                    <Feather
                                                        name="award"
                                                        size={18}
                                                        color={themeColor(colors, '#071017')}
                                                    />
                                                )}
                                                <Text
                                                    style={styles.completeButtonText}
                                                >
                                                    {actionLoading
                                                        ? t('dailyQuest.recording')
                                                        : t('dailyQuest.completeAndClaim')}
                                                </Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                )}

                                {errorMessage ? (
                                    <View style={styles.modalError}>
                                        <Text style={styles.errorText}>
                                            {errorMessage}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const colors = {
    background: '#08090d',
    surface: '#111216',
    surfaceRaised: '#17191f',
    border: '#30323a',
    text: '#f5f5f5',
    muted: '#9699a3',
    accent: '#72bce0',
    bonus: '#fbbf24',
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, paddingTop: 22, paddingBottom: 44, gap: 20 },
    ambientGlowTop: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        top: -130,
        right: -100,
        backgroundColor: themeColor(colors, 'rgba(69, 164, 214, 0.09)'),
    },
    ambientGlowBottom: {
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: 120,
        bottom: 40,
        left: -160,
        backgroundColor: themeColor(colors, 'rgba(80, 110, 180, 0.05)'),
    },
    pageHeader: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    systemLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 7,
    },
    onlineDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: themeColor(colors, '#6ee7b7'),
        marginRight: 7,
        shadowColor: '#6ee7b7',
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 3,
    },
    systemLabel: {
        color: themeColor(colors, '#7f8792'),
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.8,
    },
    pageTitle: {
        color: themeColor(colors, '#f8fafc'),
        fontSize: 30,
        lineHeight: 35,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    pageDate: {
        color: themeColor(colors, '#747983'),
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: 0.3,
        marginTop: 3,
    },
    headerMark: {
        width: 48,
        height: 48,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(114,188,224,0.28)'),
        backgroundColor: themeColor(colors, 'rgba(114,188,224,0.08)'),
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '3deg' }],
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.3,
        marginTop: 14,
    },
    statusCard: {
        borderWidth: 1,
        borderColor: themeColor(colors, '#292c33'),
        backgroundColor: themeColor(colors, '#101116'),
        borderRadius: 10,
        padding: 15,
    },
    cardAccentLine: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: themeColor(colors, '#72bce0'),
    },
    statusIdentity: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    statusIcon: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: themeColor(colors, 'rgba(5,9,14,0.72)'),
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(114,188,224,0.22)'),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    eyebrow: {
        color: colors.mutedText,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        marginBottom: 3,
    },
    levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    levelText: { color: colors.text, fontSize: 22, fontWeight: '800' },
    rankText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 7,
    },
    progressLabel: {
        color: themeColor(colors, '#d8dbe0'),
        fontSize: 13,
        fontWeight: '600',
    },
    progressValue: { color: themeColor(colors, '#777c85'), fontSize: 12, fontWeight: '500' },
    progressTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: themeColor(colors, '#252830'),
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: themeColor(colors, '#8b929c'),
    },
    progressHint: {
        color: themeColor(colors, '#626771'),
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'right',
        marginTop: 7,
    },
    questCard: {
        paddingTop: 2,
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#292c33',
        paddingBottom: 15,
        marginBottom: 22,
    },
    questHeaderIcon: {
        width: 50,
        height: 50,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(114,188,224,0.18)'),
        backgroundColor: themeColor(colors, 'rgba(114,188,224,0.06)'),
        justifyContent: 'center',
        alignItems: 'center',
    },
    mandatoryBadge: {
        alignSelf: 'flex-start',
        color: colors.accent,
        backgroundColor: themeColor(colors, 'rgba(114,188,224,0.08)'),
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(114,188,224,0.25)'),
        borderRadius: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    questTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    questSubtitle: { color: themeColor(colors, '#777c85'), fontSize: 12, marginTop: 5 },
    errorBox: {
        flexDirection: 'row',
        backgroundColor: themeColor(colors, 'rgba(248,113,113,0.08)'),
        borderRadius: 8,
        padding: 12,
        marginBottom: 14,
        gap: 8,
    },
    errorText: { flex: 1, color: themeColor(colors, '#fca5a5'), fontSize: 12, lineHeight: 17 },
    questGroup: { marginBottom: 26 },
    bonusGroup: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 20,
        marginBottom: 0,
    },
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    groupHeaderText: { flex: 1, marginRight: 10 },
    groupTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    groupSubtitle: { color: themeColor(colors, '#686d76'), fontSize: 11, marginTop: 4 },
    requiredBadge: {
        color: themeColor(colors, '#777c85'),
        fontSize: 10,
        fontWeight: '500',
    },
    bonusBadge: {
        color: themeColor(colors, '#8a8067'),
        fontSize: 10,
        fontWeight: '500',
    },
    questItem: {
        minHeight: 68,
        backgroundColor: themeColor(colors, '#0f1014'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#272a31'),
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 11,
        marginBottom: 9,
    },
    questItemPending: {},
    questItemBonus: {},
    questItemComplete: {
        backgroundColor: themeColor(colors, 'rgba(99, 158, 124, 0.055)'),
        borderColor: themeColor(colors, 'rgba(99, 158, 124, 0.22)'),
    },
    questItemMain: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
    },
    stateIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: themeColor(colors, '#5d626c'),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    stateIconComplete: {
        borderColor: themeColor(colors, 'rgba(130,184,157,0.55)'),
        backgroundColor: themeColor(colors, 'rgba(130,184,157,0.08)'),
    },
    pendingDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: themeColor(colors, '#777d87'),
    },
    bonusDot: { backgroundColor: '#c084fc' },
    exerciseTextBlock: { flex: 1 },
    exerciseName: {
        color: themeColor(colors, '#e5e7eb'),
        fontSize: 15,
        lineHeight: 19,
        fontWeight: '600',
    },
    exerciseTarget: {
        color: themeColor(colors, '#666b74'),
        fontSize: 11,
        fontWeight: '500',
        marginTop: 5,
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: themeColor(colors, '#858b94'),
    },
    infoButton: {
        width: 32,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 3,
    },
    trainButton: {
        minWidth: 78,
        height: 36,
        borderRadius: 7,
        backgroundColor: themeColor(colors, '#d9dce1'),
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 5,
    },
    trainButtonText: {
        color: themeColor(colors, '#17191e'),
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    doneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minWidth: 70,
        height: 36,
        marginLeft: 5,
    },
    doneButtonText: {
        color: themeColor(colors, '#82b89d'),
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    emptyState: { alignItems: 'center', paddingVertical: 28 },
    emptyIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: themeColor(colors, 'rgba(114,188,224,0.08)'),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.9,
    },
    emptyDescription: {
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 20,
        fontSize: 13,
        marginTop: 8,
        marginBottom: 20,
        paddingHorizontal: 12,
    },
    generateButton: {
        minHeight: 44,
        backgroundColor: colors.accent,
        borderRadius: 7,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    generateButtonText: {
        color: themeColor(colors, '#071017'),
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    buttonDisabled: { opacity: 0.55 },
    rewardOverlay: {
        flex: 1,
        backgroundColor: themeColor(colors, 'rgba(3,4,7,0.84)'),
        justifyContent: 'center',
        alignItems: 'center',
        padding: 22,
    },
    rewardCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: themeColor(colors, '#15171c'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#343840'),
        borderRadius: 14,
        padding: 24,
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 12,
    },
    rewardIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: themeColor(colors, 'rgba(130,184,157,0.09)'),
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(130,184,157,0.25)'),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    rewardEyebrow: {
        color: themeColor(colors, '#82b89d'),
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.2,
        marginBottom: 7,
    },
    rewardTitle: {
        color: themeColor(colors, '#f2f3f5'),
        fontSize: 25,
        fontWeight: '700',
        letterSpacing: -0.4,
    },
    rewardMessage: {
        color: themeColor(colors, '#9297a0'),
        fontSize: 13,
        lineHeight: 20,
        marginTop: 10,
        marginBottom: 22,
    },
    attributeChanges: {
        backgroundColor: themeColor(colors, '#101116'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#292c33'),
        borderRadius: 9,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 24,
    },
    attributeChangeRow: {
        minHeight: 44,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#24272d',
    },
    attributeChangeLabel: {
        color: themeColor(colors, '#a5a9b1'),
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.7,
    },
    attributeChangeValue: {
        color: themeColor(colors, '#82b89d'),
        fontSize: 17,
        fontWeight: '700',
    },
    rewardAppliedText: {
        color: themeColor(colors, '#858a93'),
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
        paddingVertical: 14,
    },
    rewardActions: {
        flexDirection: 'row',
        gap: 10,
    },
    viewProfileButton: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: themeColor(colors, '#3a3e46'),
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewProfileButtonText: {
        color: themeColor(colors, '#c3c6cc'),
        fontSize: 12,
        fontWeight: '600',
    },
    rewardDoneButton: {
        flex: 1,
        height: 44,
        backgroundColor: themeColor(colors, '#e0e2e5'),
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rewardDoneButtonText: {
        color: themeColor(colors, '#17191e'),
        fontSize: 12,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: themeColor(colors, 'rgba(2,3,6,0.88)'),
        justifyContent: 'center',
    },
    modalSafeArea: { flex: 1, justifyContent: 'center' },
    modalScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        backgroundColor: themeColor(colors, '#111216'),
        borderWidth: 1,
        borderColor: themeColor(colors, '#2b2e35'),
        borderRadius: 10,
        padding: 20,
    },
    closeButton: {
        alignSelf: 'flex-end',
        padding: 5,
        marginTop: -7,
        marginRight: -7,
        marginBottom: 4,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        color: themeColor(colors, '#757a84'),
        fontSize: 10,
        fontWeight: '600',
    },
    modalTitle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '700',
        marginTop: 10,
    },
    modalTarget: { color: colors.mutedText, fontSize: 13, marginTop: 5, marginBottom: 20 },
    accentText: { color: themeColor(colors, '#b6bac2'), fontWeight: '600' },
    detailImage: {
        width: '100%',
        height: 180,
        borderRadius: 9,
        backgroundColor: themeColor(colors, '#0b0c10'),
        marginBottom: 20,
    },
    detailHeading: {
        color: themeColor(colors, '#bfc2c8'),
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 7,
        marginTop: 4,
    },
    detailText: { color: colors.mutedText, fontSize: 13, lineHeight: 20, marginBottom: 18 },
    detailStats: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    detailStatCard: {
        flex: 1,
        backgroundColor: themeColor(colors, '#0d0e12'),
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
    },
    detailStatLabel: {
        color: colors.mutedText,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    detailStatValue: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 5 },
    warningText: { color: themeColor(colors, '#fbbf24') },
    videoButton: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: themeColor(colors, 'rgba(114,188,224,0.35)'),
        borderRadius: 7,
        paddingVertical: 12,
    },
    videoButtonText: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.7,
    },
    paceSection: { marginTop: 2 },
    paceOption: {
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: themeColor(colors, '#0d0e12'),
        borderRadius: 9,
        paddingHorizontal: 14,
        marginBottom: 9,
    },
    paceOptionActive: {
        borderColor: themeColor(colors, '#656b75'),
        backgroundColor: themeColor(colors, 'rgba(255,255,255,0.03)'),
    },
    paceText: { flex: 1, marginLeft: 12 },
    paceTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
    paceSubtitle: { color: colors.mutedText, fontSize: 11, marginTop: 2 },
    primaryButton: {
        height: 46,
        borderRadius: 7,
        backgroundColor: themeColor(colors, '#d7d9dd'),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
    },
    primaryButtonText: {
        color: themeColor(colors, '#071017'),
        fontSize: 12,
        fontWeight: '700',
    },
    timerSection: { alignItems: 'stretch' },
    phaseRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    phaseBadge: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: 'rgba(25,118,163,0.12)',
    },
    restBadge: {
        color: colors.success,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.14)',
    },
    setText: { color: colors.mutedText, fontSize: 11, fontWeight: '800' },
    timerCircle: {
        width: 190,
        height: 190,
        borderRadius: 95,
        borderWidth: 2,
        borderColor: colors.accent,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 25,
        backgroundColor: 'rgba(25,118,163,0.10)',
        shadowColor: colors.accent,
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 4,
    },
    timerCircleRest: {
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.12)',
        shadowColor: '#22c55e',
    },
    timerValue: {
        color: colors.text,
        fontSize: 48,
        fontWeight: '700',
        letterSpacing: 1,
    },
    timerLabel: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        marginTop: 5,
    },
    timerValueRest: {
        color: colors.success,
    },
    timerLabelRest: {
        color: colors.success,
    },
    savingStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: themeColor(colors, '#30343b'),
        backgroundColor: themeColor(colors, 'rgba(255,255,255,0.02)'),
        borderRadius: 9,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    savingStatusText: { marginLeft: 11 },
    savingTitle: {
        color: themeColor(colors, '#b8bcc4'),
        fontSize: 10,
        fontWeight: '600',
    },
    savingSubtitle: { color: colors.mutedText, fontSize: 11, marginTop: 3 },
    controlRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    controlButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 7,
    },
    controlButtonText: {
        color: themeColor(colors, '#e5e7eb'),
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    resetButton: { borderColor: themeColor(colors, 'rgba(248,113,113,0.35)') },
    resetButtonCompact: { flex: 0, paddingHorizontal: 24 },
    resetButtonText: {
        color: themeColor(colors, '#f87171'),
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    completeButton: {
        minHeight: 48,
        backgroundColor: themeColor(colors, '#d7d9dd'),
        borderRadius: 7,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    completeButtonText: {
        color: themeColor(colors, '#071017'),
        fontSize: 11,
        fontWeight: '700',
    },
    modalError: {
        marginTop: 14,
        borderRadius: 7,
        backgroundColor: themeColor(colors, 'rgba(248,113,113,0.08)'),
        padding: 10,
    },
});
