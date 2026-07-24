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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';
import {
    ActiveQuestSession,
    DailyQuestResponse,
    QuestItem,
    TrainingPace,
} from '../models/QuestModel';

type TokenPayload = {
    sub: string;
    username?: string;
};

const SESSION_PREFIX = 'shadow_quest_session_';
const PING_INTERVAL_SECONDS = 10;

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

export default function DailyQuestScreen() {
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

    const sessionRef = useRef<ActiveQuestSession | null>(null);
    const workoutItemRef = useRef<QuestItem | null>(null);
    const pingTickRef = useRef(0);
    const pingInFlightRef = useRef(false);
    const initialOrderRef = useRef<string[]>([]);

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
                throw new Error('Authentication token not found.');
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
                'Unable to synchronize today’s quest.'
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [sortQuest]);

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
        async (current: ActiveQuestSession, showError = false) => {
            if (pingInFlightRef.current) return;
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
                if (showError) {
                    setErrorMessage(
                        error.response?.data?.message ||
                        'Unable to synchronize final progress.'
                    );
                }
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
                pingTickRef.current >= PING_INTERVAL_SECONDS ||
                isLastTrainingSecond
            ) {
                pingTickRef.current = 0;
                void syncProgress(current, isLastTrainingSecond);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [session?.isPaused, session?.itemId, saveSession, syncProgress]);

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
            if (!quest) throw new Error('The System returned no quest data.');
            setQuestData(sortQuest(quest));
        } catch (error: any) {
            setErrorMessage(
                error.response?.data?.message ||
                error.message ||
                'Quest initialization failed.'
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
            if (!timing) throw new Error('Training timing was not returned.');

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
                'Unable to start this exercise.'
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
                'Unable to reset this exercise.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    const completeWorkout = async () => {
        if (!workoutItem || actionLoading) return;

        setActionLoading(true);
        setErrorMessage(null);
        try {
            const response = await api.patch(
                `/daily-quest/item/${workoutItem.id}/complete`
            );
            const quest = unwrapQuest(response.data);
            if (!quest) throw new Error('Updated quest data was not returned.');

            removeSession(workoutItem.id);
            setQuestData(sortQuest(quest));
            setSession(null);
            setWorkoutItem(null);

            if (quest.completed) {
                Alert.alert(
                    'QUEST COMPLETE',
                    'Physical attributes increased. The System has recorded your progress.'
                );
            } else {
                Alert.alert('Exercise Complete', 'Progress successfully recorded.');
            }
        } catch (error: any) {
            setErrorMessage(
                error.response?.data?.message ||
                error.message ||
                'Completion could not be recorded.'
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
            .toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            })
            .toUpperCase()
        : 'TODAY';

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#72bce0" />
                <Text style={styles.loadingText}>SYNCHRONIZING SYSTEM DATA...</Text>
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
                        {bonus ? 'OPTIONAL' : 'REQUIRED'}
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
                                    <Feather name="check" size={14} color="#ffffff" />
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
                                <Feather name="info" size={18} color="#8d919b" />
                            </TouchableOpacity>
                        </View>

                        {item.completed ? (
                            <View style={styles.doneButton}>
                                <Feather name="check-circle" size={14} color="#9ca3af" />
                                <Text style={styles.doneButtonText}>DONE</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.trainButton}
                                onPress={() => void openWorkout(item)}
                            >
                                <Text style={styles.trainButtonText}>
                                    {item.status === 'IN_PROGRESS' ||
                                    (item.accumulatedSeconds ?? 0) > 0
                                        ? 'RESUME'
                                        : 'TRAIN'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.ambientGlowTop} pointerEvents="none" />
            <View style={styles.ambientGlowBottom} pointerEvents="none" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#72bce0"
                    />
                }
            >
                <View style={styles.pageHeader}>
                    <View>
                        <View style={styles.systemLabelRow}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.systemLabel}>SYSTEM ONLINE</Text>
                        </View>
                        <Text style={styles.pageTitle}>DAILY DIRECTIVE</Text>
                        <Text style={styles.pageDate}>{questDateLabel}</Text>
                    </View>
                    <View style={styles.headerMark}>
                        <MaterialCommunityIcons
                            name="lightning-bolt"
                            size={25}
                            color="#8fd8fb"
                        />
                    </View>
                </View>

                <LinearGradient
                    colors={['rgba(25,38,50,0.98)', 'rgba(14,16,22,0.98)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.statusCard}
                >
                    <View style={styles.cardAccentLine} />
                    <View style={styles.statusIdentity}>
                        <View style={styles.statusIcon}>
                            <MaterialCommunityIcons
                                name="sword-cross"
                                size={26}
                                color="#72bce0"
                            />
                        </View>
                        <View>
                            <Text style={styles.eyebrow}>CURRENT STATUS</Text>
                            <View style={styles.levelRow}>
                                <Text style={styles.levelText}>Level 1</Text>
                                <Text style={styles.rankText}>[E-Rank]</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>EXP PROGRESS</Text>
                        <Text style={styles.progressValue}>
                            {progress}% ({completedMain}/{mainItems.length})
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
                            ? 'DAILY DIRECTIVE CLEARED'
                            : `${Math.max(0, mainItems.length - completedMain)} MISSION${mainItems.length - completedMain === 1 ? '' : 'S'} REMAINING`}
                    </Text>
                </LinearGradient>

                <LinearGradient
                    colors={['rgba(18,20,27,0.99)', 'rgba(10,11,15,0.99)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.questCard}
                >
                    <View style={styles.questHeader}>
                        <View>
                            <Text style={styles.mandatoryBadge}>! MANDATORY</Text>
                            <Text style={styles.questTitle}>DAILY QUEST</Text>
                            <Text style={styles.questSubtitle}>
                                Preparation to Become Strong
                            </Text>
                        </View>
                        <View style={styles.questHeaderIcon}>
                            <MaterialCommunityIcons
                                name="dumbbell"
                                size={28}
                                color="#72bce0"
                            />
                        </View>
                    </View>

                    {errorMessage && !workoutItem ? (
                        <View style={styles.errorBox}>
                            <Feather name="alert-triangle" size={16} color="#f87171" />
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                    ) : null}

                    {!questData?.questItems?.length ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <Feather name="clock" size={28} color="#72bce0" />
                            </View>
                            <Text style={styles.emptyTitle}>NO EXERCISES TODAY</Text>
                            <Text style={styles.emptyDescription}>
                                {questData?.restDay
                                    ? 'Today is a rest day. Request a new challenge anyway?'
                                    : 'No quest has been assigned. Initialize today’s directive now.'}
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
                                    <ActivityIndicator size="small" color="#071017" />
                                ) : (
                                    <Feather name="zap" size={17} color="#071017" />
                                )}
                                <Text style={styles.generateButtonText}>
                                    {generating
                                        ? 'INITIALIZING...'
                                        : 'INITIALIZE TODAY’S QUEST'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {renderQuestGroup(
                                'MAIN MISSIONS',
                                'Complete these to clear today’s quest',
                                mainItems
                            )}
                            {renderQuestGroup(
                                'BONUS CHALLENGES',
                                `${completedBonus}/${bonusItems.length} complete · Optional`,
                                bonusItems,
                                true
                            )}
                        </>
                    )}
                </LinearGradient>
            </ScrollView>

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
                                    <Feather name="x" size={22} color="#c4c7ce" />
                                </TouchableOpacity>

                                <Text style={styles.categoryBadge}>
                                    {detailItem?.category || 'EXERCISE'}
                                </Text>
                                <Text style={styles.modalTitle}>
                                    {detailItem?.exerciseName}
                                </Text>
                                <Text style={styles.modalTarget}>
                                    Target Stat:{' '}
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
                                    EXERCISE DESCRIPTION
                                </Text>
                                <Text style={styles.detailText}>
                                    {detailItem?.description ||
                                        'No description is available for this exercise.'}
                                </Text>

                                <View style={styles.detailStats}>
                                    <View style={styles.detailStatCard}>
                                        <Text style={styles.detailStatLabel}>TARGET SETS</Text>
                                        <Text style={styles.detailStatValue}>
                                            {detailItem?.targetSets} Sets
                                        </Text>
                                    </View>
                                    <View style={styles.detailStatCard}>
                                        <Text style={styles.detailStatLabel}>TARGET REPS</Text>
                                        <Text style={styles.detailStatValue}>
                                            {detailItem?.targetReps} Reps
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
                                            SAFETY NOTES
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
                                            color="#72bce0"
                                        />
                                        <Text style={styles.videoButtonText}>
                                            WATCH TUTORIAL VIDEO
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
                                    <Feather name="x" size={22} color="#c4c7ce" />
                                </TouchableOpacity>

                                <Text style={styles.categoryBadge}>
                                    {workoutItem?.category || 'TRAINING'}
                                </Text>
                                <Text style={styles.modalTitle}>
                                    {workoutItem?.exerciseName}
                                </Text>
                                <Text style={styles.modalTarget}>
                                    Target:{' '}
                                    <Text style={styles.accentText}>
                                        {workoutItem?.targetSets} Sets ×{' '}
                                        {workoutItem?.targetReps} Reps
                                    </Text>
                                </Text>

                                {!session ? (
                                    <View style={styles.paceSection}>
                                        <Text style={styles.detailHeading}>
                                            SELECT TRAINING INTENSITY
                                        </Text>
                                        <Text style={styles.detailText}>
                                            The System will calculate your training and
                                            recovery intervals.
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
                                                        {option.title}
                                                    </Text>
                                                    <Text style={styles.paceSubtitle}>
                                                        {option.subtitle}
                                                    </Text>
                                                </View>
                                                {selectedPace === option.value ? (
                                                    <Feather
                                                        name="check-circle"
                                                        size={19}
                                                        color="#72bce0"
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
                                                    color="#071017"
                                                />
                                            ) : (
                                                <Feather
                                                    name="play"
                                                    size={17}
                                                    color="#071017"
                                                />
                                            )}
                                            <Text style={styles.primaryButtonText}>
                                                {actionLoading
                                                    ? 'ACTIVATING...'
                                                    : 'START TRAINING'}
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
                                                    ? 'TRAINING'
                                                    : 'RESTING'}
                                            </Text>
                                            <Text style={styles.setText}>
                                                SET {session.currentSet}/
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
                                            <Text style={styles.timerValue}>
                                                {formatTime(session.timeLeft)}
                                            </Text>
                                            <Text style={styles.timerLabel}>
                                                {session.isFinishing
                                                    ? 'SYNCING'
                                                    : session.phase === 'training'
                                                        ? 'TRAINING'
                                                        : 'RESTING'}
                                            </Text>
                                        </View>

                                        <View style={styles.serverProgressHeader}>
                                            <Text style={styles.serverProgressText}>
                                                SERVER PROGRESS
                                            </Text>
                                            <Text style={styles.serverProgressText}>
                                                {session.accumulatedSeconds}s /{' '}
                                                {session.totalRequiredSeconds}s
                                            </Text>
                                        </View>
                                        <View style={styles.progressTrack}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: `${Math.min(
                                                            100,
                                                            (session.accumulatedSeconds /
                                                                Math.max(
                                                                    1,
                                                                    session.totalRequiredSeconds
                                                                )) *
                                                                100
                                                        )}%`,
                                                    },
                                                ]}
                                            />
                                        </View>

                                        <View style={styles.controlRow}>
                                            <TouchableOpacity
                                                style={styles.controlButton}
                                                onPress={() => {
                                                    if (
                                                        session.timeLeft === 0 &&
                                                        session.accumulatedSeconds <
                                                            session.totalRequiredSeconds
                                                    ) {
                                                        void syncProgress(session, true);
                                                        return;
                                                    }
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
                                                        session.timeLeft === 0 &&
                                                        session.accumulatedSeconds <
                                                            session.totalRequiredSeconds
                                                            ? 'refresh-cw'
                                                            : session.isPaused
                                                                ? 'play'
                                                                : 'pause'
                                                    }
                                                    size={17}
                                                    color="#e5e7eb"
                                                />
                                                <Text style={styles.controlButtonText}>
                                                    {session.timeLeft === 0 &&
                                                    session.accumulatedSeconds <
                                                        session.totalRequiredSeconds
                                                        ? 'RETRY SYNC'
                                                        : session.isPaused
                                                            ? 'RESUME'
                                                            : 'PAUSE'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[
                                                    styles.controlButton,
                                                    styles.resetButton,
                                                ]}
                                                disabled={actionLoading}
                                                onPress={resetWorkout}
                                            >
                                                <Feather
                                                    name="rotate-ccw"
                                                    size={17}
                                                    color="#f87171"
                                                />
                                                <Text style={styles.resetButtonText}>
                                                    RESET
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
                                                        color="#071017"
                                                    />
                                                ) : (
                                                    <Feather
                                                        name="award"
                                                        size={18}
                                                        color="#071017"
                                                    />
                                                )}
                                                <Text
                                                    style={styles.completeButtonText}
                                                >
                                                    {actionLoading
                                                        ? 'RECORDING...'
                                                        : 'COMPLETE & CLAIM REWARD'}
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

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, paddingTop: 18, paddingBottom: 44, gap: 18 },
    ambientGlowTop: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        top: -130,
        right: -100,
        backgroundColor: 'rgba(69, 164, 214, 0.09)',
    },
    ambientGlowBottom: {
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: 120,
        bottom: 40,
        left: -160,
        backgroundColor: 'rgba(80, 110, 180, 0.05)',
    },
    pageHeader: {
        minHeight: 88,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 3,
        marginBottom: 2,
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
        backgroundColor: '#6ee7b7',
        marginRight: 7,
        shadowColor: '#6ee7b7',
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 3,
    },
    systemLabel: {
        color: '#7f8792',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.8,
    },
    pageTitle: {
        color: '#f8fafc',
        fontSize: 25,
        lineHeight: 29,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    pageDate: {
        color: '#72bce0',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.4,
        marginTop: 5,
    },
    headerMark: {
        width: 48,
        height: 48,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.28)',
        backgroundColor: 'rgba(114,188,224,0.08)',
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
        borderColor: 'rgba(114,188,224,0.22)',
        borderRadius: 16,
        padding: 19,
        overflow: 'hidden',
        shadowColor: '#000000',
        shadowOpacity: 0.28,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    cardAccentLine: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: '#72bce0',
    },
    statusIdentity: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    statusIcon: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: 'rgba(5,9,14,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    eyebrow: {
        color: colors.muted,
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
        color: colors.muted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    progressValue: { color: colors.muted, fontSize: 11, fontWeight: '700' },
    progressTrack: {
        height: 9,
        borderRadius: 5,
        backgroundColor: 'rgba(3,5,8,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
        backgroundColor: colors.accent,
    },
    progressHint: {
        color: '#65717d',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1.2,
        textAlign: 'right',
        marginTop: 8,
    },
    questCard: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.09)',
        borderRadius: 16,
        padding: 17,
        shadowColor: '#000000',
        shadowOpacity: 0.24,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 5,
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 16,
        marginBottom: 20,
    },
    questHeaderIcon: {
        width: 50,
        height: 50,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.18)',
        backgroundColor: 'rgba(114,188,224,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mandatoryBadge: {
        alignSelf: 'flex-start',
        color: colors.accent,
        backgroundColor: 'rgba(114,188,224,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.25)',
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
        fontSize: 27,
        fontWeight: '900',
        letterSpacing: 1.1,
    },
    questSubtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
    errorBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(248,113,113,0.08)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 14,
        gap: 8,
    },
    errorText: { flex: 1, color: '#fca5a5', fontSize: 12, lineHeight: 17 },
    questGroup: { marginBottom: 22 },
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
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.7,
    },
    groupSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
    requiredBadge: {
        color: colors.accent,
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.35)',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    bonusBadge: {
        color: colors.bonus,
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.35)',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    questItem: {
        backgroundColor: 'rgba(10,12,17,0.88)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.09)',
        borderRadius: 12,
        padding: 13,
        marginBottom: 11,
        shadowColor: '#000000',
        shadowOpacity: 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    questItemPending: { borderLeftWidth: 3, borderLeftColor: colors.accent },
    questItemBonus: { borderLeftWidth: 3, borderLeftColor: colors.bonus },
    questItemComplete: { opacity: 0.62, borderLeftWidth: 3, borderLeftColor: '#60636c' },
    questItemMain: { flexDirection: 'row', alignItems: 'center' },
    stateIcon: {
        width: 28,
        height: 28,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: 'rgba(114,188,224,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    stateIconComplete: { borderColor: '#747780', backgroundColor: '#35373e' },
    pendingDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.accent,
    },
    bonusDot: { backgroundColor: colors.bonus },
    exerciseTextBlock: { flex: 1 },
    exerciseName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    exerciseTarget: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginTop: 4,
    },
    completedText: { textDecorationLine: 'line-through', color: colors.muted },
    infoButton: { padding: 7, marginLeft: 5 },
    trainButton: {
        alignSelf: 'flex-end',
        backgroundColor: colors.accent,
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 9,
        marginTop: 12,
        shadowColor: colors.accent,
        shadowOpacity: 0.2,
        shadowRadius: 7,
        elevation: 3,
    },
    trainButtonText: {
        color: '#071017',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.7,
    },
    doneButton: {
        alignSelf: 'flex-end',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 5,
    },
    doneButtonText: {
        color: '#9ca3af',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    emptyState: { alignItems: 'center', paddingVertical: 28 },
    emptyIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: 'rgba(114,188,224,0.08)',
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
        color: colors.muted,
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
        color: '#071017',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    buttonDisabled: { opacity: 0.55 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2,3,6,0.88)',
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
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
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
        color: colors.accent,
        backgroundColor: 'rgba(114,188,224,0.09)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    modalTitle: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '900',
        marginTop: 10,
    },
    modalTarget: { color: colors.muted, fontSize: 13, marginTop: 5, marginBottom: 20 },
    accentText: { color: colors.accent, fontWeight: '800' },
    detailImage: {
        width: '100%',
        height: 180,
        borderRadius: 9,
        backgroundColor: '#0b0c10',
        marginBottom: 20,
    },
    detailHeading: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.9,
        marginBottom: 7,
        marginTop: 4,
    },
    detailText: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 18 },
    detailStats: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    detailStatCard: {
        flex: 1,
        backgroundColor: '#0d0e12',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
    },
    detailStatLabel: {
        color: colors.muted,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    detailStatValue: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 5 },
    warningText: { color: '#fbbf24' },
    videoButton: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(114,188,224,0.35)',
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
        backgroundColor: '#0d0e12',
        borderRadius: 9,
        paddingHorizontal: 14,
        marginBottom: 9,
    },
    paceOptionActive: {
        borderColor: colors.accent,
        backgroundColor: 'rgba(114,188,224,0.07)',
    },
    paceText: { flex: 1, marginLeft: 12 },
    paceTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
    paceSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
    primaryButton: {
        height: 46,
        borderRadius: 7,
        backgroundColor: colors.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
    },
    primaryButtonText: {
        color: '#071017',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    timerSection: { alignItems: 'stretch' },
    phaseRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    phaseBadge: {
        color: colors.accent,
        backgroundColor: 'rgba(114,188,224,0.1)',
        borderRadius: 4,
        paddingHorizontal: 9,
        paddingVertical: 5,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    restBadge: { color: '#6ee7b7', backgroundColor: 'rgba(16,185,129,0.1)' },
    setText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
    timerCircle: {
        width: 190,
        height: 190,
        borderRadius: 95,
        borderWidth: 5,
        borderColor: colors.accent,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 25,
        backgroundColor: '#0a0b0f',
    },
    timerCircleRest: { borderColor: '#6ee7b7' },
    timerValue: {
        color: colors.text,
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: 1,
    },
    timerLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.4,
        marginTop: 3,
    },
    serverProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 7,
    },
    serverProgressText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
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
        color: '#e5e7eb',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    resetButton: { borderColor: 'rgba(248,113,113,0.35)' },
    resetButtonText: {
        color: '#f87171',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    completeButton: {
        minHeight: 48,
        backgroundColor: colors.accent,
        borderRadius: 7,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    completeButtonText: {
        color: '#071017',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    modalError: {
        marginTop: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(248,113,113,0.08)',
        padding: 10,
    },
});
