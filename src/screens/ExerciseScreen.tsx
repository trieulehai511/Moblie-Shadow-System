import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Exercise } from '../models/QuestModel';
import {
  ThemeColors,
  themeColor,
  useAppTheme,
} from '../theme/ThemeContext';

type SelectionMode = 'all' | 'custom';
type NewExercise = {
  name: string;
  category: string;
  targetStat: string;
  baseSets: string;
  baseReps: string;
  description: string;
  tutorialVideoUrl: string;
  safetyTips: string;
};

const MINIMUM_PER_CATEGORY = 6;
const CATEGORIES = [
  { key: 'CHEST', icon: 'arm-flex-outline' as const },
  { key: 'CALISTHENICS', icon: 'human-handsup' as const },
  { key: 'LEGS', icon: 'run' as const },
  { key: 'LOWER', icon: 'human' as const },
  { key: 'CARDIO', icon: 'heart-pulse' as const },
];
const TARGET_STATS = ['STR', 'AGI', 'VIT'];
const EMPTY_EXERCISE: NewExercise = {
  name: '',
  category: 'CHEST',
  targetStat: 'STR',
  baseSets: '3',
  baseReps: '10',
  description: '',
  tutorialVideoUrl: '',
  safetyTips: '',
};

const unwrapList = (data: any): Exercise[] => {
  const value = data?.result ?? data;
  return Array.isArray(value) ? value : [];
};

export default function ExerciseScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SelectionMode>('all');
  const [activeCategory, setActiveCategory] = useState('CHEST');
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newExercise, setNewExercise] = useState<NewExercise>(EMPTY_EXERCISE);
  const [newImage, setNewImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadExercises = useCallback(async () => {
    try {
      setError(null);
      const [allResponse, selectedResponse] = await Promise.all([
        api.get('/exercise'),
        api.get('/exercise/selected'),
      ]);
      const all = unwrapList(allResponse.data);
      const selected = unwrapList(selectedResponse.data);
      setExercises(all);
      setSelectedIds(new Set(selected.map(item => item.id)));
      setMode(selected.length ? 'custom' : 'all');
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        t('exercise.loadFailed')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    CATEGORIES.forEach(category => {
      result[category.key] = 0;
    });
    exercises.forEach(exercise => {
      if (selectedIds.has(exercise.id)) {
        result[exercise.category] = (result[exercise.category] || 0) + 1;
      }
    });
    return result;
  }, [exercises, selectedIds]);

  const visibleExercises = useMemo(
    () => exercises.filter(exercise => exercise.category === activeCategory),
    [activeCategory, exercises]
  );

  const invalidCategories = useMemo(
    () => CATEGORIES.filter(category => (counts[category.key] || 0) < MINIMUM_PER_CATEGORY),
    [counts]
  );

  const toggleExercise = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    if (mode === 'custom' && invalidCategories.length) {
      Alert.alert(
        t('exercise.rejectedTitle'),
        t('exercise.minimumWarning', {
          count: MINIMUM_PER_CATEGORY,
          categories: invalidCategories.map(category => category.key).join(', '),
        })
      );
      return;
    }

    setSaving(true);
    try {
      await api.post(
        '/exercise/select',
        mode === 'all' ? [] : Array.from(selectedIds)
      );
      Alert.alert(t('common.success'), t(`exercise.saved.${mode}`));
    } catch (requestError: any) {
      Alert.alert(
        t('common.error'),
        requestError.response?.data?.message ||
        requestError.message ||
        t('exercise.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    void loadExercises();
  };

  const updateNewExercise = (key: keyof NewExercise, value: string) => {
    setNewExercise(previous => ({ ...previous, [key]: value }));
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('common.notice'), t('exercise.create.photoPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setNewImage(result.assets[0]);
  };

  const closeCreate = () => {
    if (creating) return;
    setShowCreate(false);
    setNewExercise(EMPTY_EXERCISE);
    setNewImage(null);
  };

  const createExercise = async () => {
    const name = newExercise.name.trim();
    const baseSets = Number(newExercise.baseSets);
    const baseReps = Number(newExercise.baseReps);
    if (!name) {
      Alert.alert(t('exercise.create.missingTitle'), t('exercise.create.nameRequired'));
      return;
    }
    if (
      !Number.isInteger(baseSets) || baseSets < 1 ||
      !Number.isInteger(baseReps) || baseReps < 1
    ) {
      Alert.alert(t('exercise.create.missingTitle'), t('exercise.create.invalidTargets'));
      return;
    }

    setCreating(true);
    try {
      const form = new FormData();
      form.append('name', name);
      form.append('category', newExercise.category);
      form.append('targetStat', newExercise.targetStat);
      form.append('baseSets', String(baseSets));
      form.append('baseReps', String(baseReps));
      if (newExercise.description.trim()) form.append('description', newExercise.description.trim());
      if (newExercise.tutorialVideoUrl.trim()) form.append('tutorialVideoUrl', newExercise.tutorialVideoUrl.trim());
      if (newExercise.safetyTips.trim()) form.append('safetyTips', newExercise.safetyTips.trim());
      if (newImage) {
        form.append('image', {
          uri: newImage.uri,
          name: newImage.fileName || `exercise-${Date.now()}.jpg`,
          type: newImage.mimeType || 'image/jpeg',
        } as any);
      }

      const response = await api.post('/exercise', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const created = (response.data?.result ?? response.data) as Exercise;
      setExercises(previous => [...previous, created]);
      setSelectedIds(previous => new Set(previous).add(created.id));
      setMode('custom');
      setActiveCategory(created.category);
      setShowCreate(false);
      setNewExercise(EMPTY_EXERCISE);
      setNewImage(null);
      Alert.alert(
        t('common.success'),
        t('exercise.create.success', { name: created.name })
      );
    } catch (requestError: any) {
      Alert.alert(
        t('common.error'),
        requestError.response?.data?.message ||
        requestError.message ||
        t('exercise.create.failed')
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>{t('exercise.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('exercise.title')}</Text>
            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.8}
              onPress={() => setShowCreate(true)}
            >
              <Feather name="plus" size={20} color={colors.contrastText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{t('exercise.subtitle')}</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={20} color={colors.danger} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>{t('exercise.syncError')}</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <TouchableOpacity onPress={() => void loadExercises()}>
              <Feather name="refresh-cw" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.segment}>
            {(['all', 'custom'] as SelectionMode[]).map(option => {
              const active = mode === option;
              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.8}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => setMode(option)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t(`exercise.mode.${option}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {mode === 'custom' ? (
            <Text style={[
              styles.configurationHint,
              !invalidCategories.length && styles.configurationHintValid,
            ]}>
              {invalidCategories.length
                ? t('exercise.groupsRemaining', { count: invalidCategories.length })
                : t('exercise.ready')}
            </Text>
          ) : null}
        </View>

        {mode === 'custom' ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryStrip}
            >
              {CATEGORIES.map(category => {
                const active = activeCategory === category.key;
                const valid = (counts[category.key] || 0) >= MINIMUM_PER_CATEGORY;
                return (
                  <TouchableOpacity
                    key={category.key}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setActiveCategory(category.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.categoryName,
                      active && styles.categoryNameActive,
                    ]}>
                      {category.key}
                    </Text>
                    <View style={[
                      styles.countBadge,
                      valid && styles.countBadgeValid,
                    ]}>
                      <Text style={[
                        styles.countText,
                        valid && styles.countTextValid,
                      ]}>
                        {counts[category.key] || 0}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.listHeader}>
              <View>
                <Text style={styles.categoryTitle}>
                  {t(`exercise.categories.${activeCategory}`)}
                </Text>
                <Text style={styles.listCount}>
                  {t('exercise.available', { count: visibleExercises.length })}
                </Text>
              </View>
              <Text style={[
                styles.categoryProgress,
                (counts[activeCategory] || 0) >= MINIMUM_PER_CATEGORY &&
                styles.categoryProgressValid,
              ]}>
                {counts[activeCategory] || 0}/{MINIMUM_PER_CATEGORY}
              </Text>
            </View>

            <View style={styles.exerciseList}>
              {visibleExercises.map(exercise => {
                const selected = selectedIds.has(exercise.id);
                return (
                  <TouchableOpacity
                    key={exercise.id}
                    activeOpacity={0.78}
                    style={[styles.exerciseCard, selected && styles.exerciseCardSelected]}
                    onPress={() => toggleExercise(exercise.id)}
                  >
                    <View style={[styles.check, selected && styles.checkSelected]}>
                      {selected ? (
                        <Feather name="check" size={15} color={colors.contrastText} />
                      ) : null}
                    </View>
                    <View style={styles.exerciseCopy}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {exercise.baseSets} {t('exercise.sets')} · {exercise.baseReps}{' '}
                        {t('exercise.reps')} · {exercise.targetStat}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={() => setPreview(exercise)}
                      hitSlop={8}
                    >
                      <Feather name="chevron-right" size={18} color={colors.mutedText} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
              {!visibleExercises.length ? (
                <View style={styles.empty}>
                  <MaterialCommunityIcons
                    name="dumbbell"
                    size={28}
                    color={colors.mutedText}
                  />
                  <Text style={styles.emptyText}>{t('exercise.empty')}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.allModeCard}>
            <View style={styles.allModeCopy}>
              <Text style={styles.allModeTitle}>{t('exercise.allModeTitle')}</Text>
              <Text style={styles.allModeText}>{t('exercise.allModeText')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={saving}
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={save}
        >
          {saving ? (
            <ActivityIndicator color={colors.contrastText} />
          ) : (
            <>
              <Feather name="save" size={18} color={colors.contrastText} />
              <Text style={styles.saveText}>{t('exercise.save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={Boolean(preview)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPreview(null)} />
          {preview ? (
            <View style={styles.modalCard}>
              {preview.imageUrl ? (
                <Image source={{ uri: preview.imageUrl }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <MaterialCommunityIcons name="weight-lifter" size={56} color={colors.border} />
                </View>
              )}
              <View style={styles.modalBody}>
                <View style={styles.modalTopRow}>
                  <Text style={styles.modalBadge}>{preview.category}</Text>
                  <TouchableOpacity onPress={() => setPreview(null)}>
                    <Feather name="x" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalTitle}>{preview.name}</Text>
                <Text style={styles.modalStats}>
                  {preview.baseSets} {t('exercise.sets')} × {preview.baseReps}{' '}
                  {t('exercise.reps')} · {preview.targetStat}
                </Text>
                <Text style={styles.detailLabel}>{t('exercise.description')}</Text>
                <Text style={styles.detailText}>
                  {preview.description || t('exercise.noDescription')}
                </Text>
                {preview.safetyTips ? (
                  <View style={styles.safetyBox}>
                    <Feather name="shield" size={18} color={colors.accent} />
                    <Text style={styles.safetyText}>{preview.safetyTips}</Text>
                  </View>
                ) : null}
                {preview.tutorialVideoUrl ? (
                  <TouchableOpacity
                    style={styles.tutorialButton}
                    onPress={() => void Linking.openURL(preview.tutorialVideoUrl!)}
                  >
                    <Feather name="play-circle" size={18} color={colors.text} />
                    <Text style={styles.tutorialText}>{t('exercise.tutorial')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCreate}
      >
        <SafeAreaView style={styles.createScreen}>
          <KeyboardAvoidingView
            style={styles.createScreen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.createHeader}>
              <TouchableOpacity onPress={closeCreate} disabled={creating}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.createTitle}>{t('exercise.create.title')}</Text>
              <TouchableOpacity onPress={() => void createExercise()} disabled={creating}>
                <Text style={[styles.doneText, creating && styles.disabled]}>
                  {t('exercise.create.submit')}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
              <TouchableOpacity
                style={styles.imagePicker}
                activeOpacity={0.8}
                onPress={() => void pickImage()}
              >
                {newImage ? (
                  <Image source={{ uri: newImage.uri }} style={styles.newImage} />
                ) : (
                  <>
                    <View style={styles.uploadIcon}>
                      <Feather name="image" size={24} color={colors.accent} />
                    </View>
                    <Text style={styles.imagePickerTitle}>{t('exercise.create.addImage')}</Text>
                    <Text style={styles.imagePickerHint}>{t('exercise.create.imageHint')}</Text>
                  </>
                )}
                {newImage ? (
                  <View style={styles.changeImageBadge}>
                    <Feather name="edit-2" size={13} color={colors.contrastText} />
                    <Text style={styles.changeImageText}>{t('exercise.create.change')}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>{t('exercise.create.name')} *</Text>
              <TextInput
                value={newExercise.name}
                onChangeText={value => updateNewExercise('name', value)}
                placeholder={t('exercise.create.namePlaceholder')}
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>{t('exercise.create.category')}</Text>
              <View style={styles.optionWrap}>
                {CATEGORIES.map(category => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.formOption,
                      newExercise.category === category.key && styles.formOptionActive,
                    ]}
                    onPress={() => updateNewExercise('category', category.key)}
                  >
                    <Text style={[
                      styles.formOptionText,
                      newExercise.category === category.key && styles.formOptionTextActive,
                    ]}>
                      {category.key}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('exercise.create.targetStat')}</Text>
              <View style={styles.optionWrap}>
                {TARGET_STATS.map(stat => (
                  <TouchableOpacity
                    key={stat}
                    style={[
                      styles.formOption,
                      newExercise.targetStat === stat && styles.formOptionActive,
                    ]}
                    onPress={() => updateNewExercise('targetStat', stat)}
                  >
                    <Text style={[
                      styles.formOptionText,
                      newExercise.targetStat === stat && styles.formOptionTextActive,
                    ]}>
                      {stat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.numberRow}>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>{t('exercise.create.baseSets')}</Text>
                  <TextInput
                    value={newExercise.baseSets}
                    onChangeText={value => updateNewExercise('baseSets', value)}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.numberField}>
                  <Text style={styles.fieldLabel}>{t('exercise.create.baseReps')}</Text>
                  <TextInput
                    value={newExercise.baseReps}
                    onChangeText={value => updateNewExercise('baseReps', value)}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>

              {([
                ['description', 'description', true],
                ['safetyTips', 'safetyTips', true],
                ['tutorialVideoUrl', 'tutorialVideo', false],
              ] as const).map(([key, label, multiline]) => (
                <View key={key}>
                  <Text style={styles.fieldLabel}>{t(`exercise.create.${label}`)}</Text>
                  <TextInput
                    value={newExercise[key]}
                    onChangeText={value => updateNewExercise(key, value)}
                    placeholder={t(`exercise.create.${label}Placeholder`)}
                    placeholderTextColor={colors.mutedText}
                    multiline={multiline}
                    autoCapitalize={key === 'tutorialVideoUrl' ? 'none' : 'sentences'}
                    keyboardType={key === 'tutorialVideoUrl' ? 'url' : 'default'}
                    style={[styles.input, multiline && styles.textArea]}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.createSubmit, creating && styles.disabled]}
                disabled={creating}
                onPress={() => void createExercise()}
              >
                {creating ? (
                  <ActivityIndicator color={colors.contrastText} />
                ) : (
                  <>
                    <Feather name="plus-circle" size={19} color={colors.contrastText} />
                    <Text style={styles.createSubmitText}>{t('exercise.create.submit')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.mutedText, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 102 },
  header: { paddingBottom: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.7 },
  createButton: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: colors.text,
  },
  subtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 320 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 16,
    borderRadius: 14, borderWidth: 1, borderColor: themeColor(colors, 'rgba(248,113,113,.35)'),
    backgroundColor: themeColor(colors, 'rgba(248,113,113,.08)'),
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  errorText: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  controls: { marginBottom: 24 },
  sectionLabel: { color: colors.mutedText, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  segment: {
    flexDirection: 'row', padding: 3, gap: 3,
    borderRadius: 11, backgroundColor: colors.elevated,
  },
  segmentButton: {
    flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', borderRadius: 9,
  },
  segmentButtonActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.mutedText, fontSize: 11, fontWeight: '800' },
  segmentTextActive: { color: colors.text },
  configurationHint: { color: colors.danger, fontSize: 11, marginTop: 9, textAlign: 'right' },
  configurationHintValid: { color: colors.success },
  categoryStrip: { gap: 22, paddingBottom: 22 },
  categoryChip: {
    height: 32, flexDirection: 'row', gap: 6, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  categoryChipActive: { borderBottomColor: colors.text },
  categoryName: { color: colors.mutedText, fontSize: 11, fontWeight: '800' },
  categoryNameActive: { color: colors.text },
  countBadge: { minWidth: 18, alignItems: 'center' },
  countBadgeValid: {},
  countText: { color: colors.danger, fontSize: 9, fontWeight: '800' },
  countTextValid: { color: colors.success },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  categoryTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  listCount: { color: colors.mutedText, fontSize: 11, fontWeight: '600', marginTop: 3 },
  categoryProgress: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  categoryProgressValid: { color: colors.success },
  exerciseList: { gap: 1 },
  exerciseCard: {
    minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  exerciseCardSelected: {
    borderBottomColor: themeColor(colors, 'rgba(114,188,224,.45)'),
  },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.border },
  checkSelected: { alignItems: 'center', justifyContent: 'center', borderColor: colors.accent, backgroundColor: colors.accent },
  exerciseCopy: { flex: 1, marginLeft: 12 },
  exerciseName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  exerciseMeta: { color: colors.mutedText, fontSize: 11, marginTop: 5 },
  infoButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  empty: {
    paddingVertical: 34, gap: 10, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.border, borderRadius: 14,
  },
  emptyText: { color: colors.mutedText, fontSize: 13 },
  allModeCard: {
    paddingVertical: 8, paddingHorizontal: 2,
  },
  allModeCopy: { flex: 1 },
  allModeTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 5 },
  allModeText: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 76, paddingHorizontal: 20,
    paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  saveButton: {
    width: '100%', height: 48, borderRadius: 13, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text,
  },
  saveText: { color: colors.contrastText, fontSize: 12, fontWeight: '800', letterSpacing: .3 },
  disabled: { opacity: .55 },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', padding: 14,
    backgroundColor: 'rgba(0,0,0,.66)',
  },
  modalCard: {
    maxHeight: '86%', overflow: 'hidden', borderRadius: 24, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  previewImage: { width: '100%', height: 210, backgroundColor: colors.elevated },
  previewPlaceholder: { height: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated },
  modalBody: { padding: 20 },
  modalTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalBadge: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  modalTitle: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: 8 },
  modalStats: { color: colors.mutedText, fontSize: 12, marginTop: 6, marginBottom: 20 },
  detailLabel: { color: colors.mutedText, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 },
  detailText: { color: colors.text, fontSize: 13, lineHeight: 20 },
  safetyBox: {
    flexDirection: 'row', gap: 10, padding: 12, marginTop: 16, borderRadius: 12,
    backgroundColor: colors.elevated,
  },
  safetyText: { flex: 1, color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  tutorialButton: {
    height: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 14,
  },
  tutorialText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  createScreen: { flex: 1, backgroundColor: colors.background },
  createHeader: {
    height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancelText: { color: colors.mutedText, fontSize: 14, fontWeight: '600' },
  createTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  doneText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  formContent: { padding: 20, paddingBottom: 44 },
  imagePicker: {
    height: 176, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', backgroundColor: colors.surface, marginBottom: 24,
  },
  uploadIcon: {
    width: 48, height: 48, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.elevated, marginBottom: 10,
  },
  imagePickerTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  imagePickerHint: { color: colors.mutedText, fontSize: 11, marginTop: 4 },
  newImage: { width: '100%', height: '100%' },
  changeImageBadge: {
    position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 5,
    alignItems: 'center', paddingHorizontal: 10, height: 30, borderRadius: 9,
    backgroundColor: colors.text,
  },
  changeImageText: { color: colors.contrastText, fontSize: 10, fontWeight: '800' },
  fieldLabel: {
    color: colors.mutedText, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, marginBottom: 8, marginTop: 15,
  },
  input: {
    minHeight: 48, paddingHorizontal: 14, color: colors.text, fontSize: 14,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  textArea: { minHeight: 92, paddingTop: 13, textAlignVertical: 'top' },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formOption: {
    height: 38, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  formOptionActive: { borderColor: colors.text, backgroundColor: colors.text },
  formOptionText: { color: colors.mutedText, fontSize: 10, fontWeight: '800' },
  formOptionTextActive: { color: colors.contrastText },
  numberRow: { flexDirection: 'row', gap: 12 },
  numberField: { flex: 1 },
  createSubmit: {
    height: 52, marginTop: 26, borderRadius: 14, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text,
  },
  createSubmitText: { color: colors.contrastText, fontSize: 12, fontWeight: '800' },
});
