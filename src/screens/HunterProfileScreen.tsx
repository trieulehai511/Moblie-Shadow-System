import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  HapticTouchableOpacity as TouchableOpacity,
} from '../components/HapticPressables';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { HunterProfileResponse } from '../models/ProfileModel';
import { getProfileByHunterCode } from '../services/profileService';
import {
  ThemeColors,
  useAppTheme,
} from '../theme/ThemeContext';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'HunterProfile'
>;

export default function HunterProfileScreen({
  route,
  navigation,
}: Props) {
  const { hunterCode } = route.params;
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const [profile, setProfile] =
    useState<HunterProfileResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getProfileByHunterCode(hunterCode);
      setProfile(data);
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ??
        t('hunterProfile.notFound')
      );
    } finally {
      setLoading(false);
    }
  }, [hunterCode, t]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons
          name="account-alert-outline"
          size={50}
          color={colors.danger}
        />

        <Text style={styles.errorText}>
          {error ?? t('hunterProfile.notFound')}
        </Text>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{t('hunterProfile.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rank = profile.rankTier?.trim().toUpperCase()[0] || 'E';
  const rankColor = getRankColor(rank);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Feather
            name="chevron-left"
            size={28}
            color={colors.text}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerEyebrow}>{t('hunterProfile.archive')}</Text>
          <Text style={styles.headerTitle}>{t('hunterProfile.title')}</Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={[styles.avatarGlow, { borderColor: rankColor }]}>
            <View style={styles.avatarContainer}>
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              ) : (
                <MaterialCommunityIcons
                  name="shield-account"
                  size={70}
                  color={colors.mutedText}
                />
              )}
            </View>
            <View style={[styles.rankSeal, { backgroundColor: rankColor }]}>
              <Text style={styles.rankSealText}>{rank}</Text>
            </View>
          </View>

          <Text style={styles.fullName}>{profile.fullName}</Text>
          <View style={styles.codePill}>
            <MaterialCommunityIcons
              name="identifier"
              size={15}
              color={colors.accent}
            />
            <Text style={styles.hunterCode}>{profile.hunterCode}</Text>
          </View>
          <Text style={styles.profileMeta}>
            {t('hunterProfile.ageLine', { age: profile.age })}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profile.currentRp}
            </Text>
            <Text style={styles.statLabel}>RP</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profile.currentStreak}
            </Text>
            <Text style={styles.statLabel}>{t('hunterProfile.streak')}</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.maxStreak}</Text>
            <Text style={styles.statLabel}>{t('hunterProfile.best')}</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: rankColor }]}>
              {rank}
            </Text>
            <Text style={styles.statLabel}>{t('hunterProfile.rank')}</Text>
          </View>
        </View>

        <View style={styles.combatSection}>
          <Text style={styles.combatTitle}>{t('hunterProfile.combatAttributes')}</Text>

          <View style={styles.attributes}>
            <AttributeItem
              label="STR"
              value={profile.strength}
              colors={colors}
              icon="sword-cross"
            />

            <AttributeItem
              label="AGI"
              value={profile.agility}
              colors={colors}
              icon="run-fast"
            />

            <AttributeItem
              label="VIT"
              value={profile.vitality}
              colors={colors}
              icon="heart-outline"
            />

            <AttributeItem
              label={t('hunterProfile.shields')}
              value={profile.shieldCount}
              colors={colors}
              icon="shield-outline"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
type AttributeItemProps = {
  label: string;
  value: number;
  colors: ThemeColors;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

function AttributeItem({
  label,
  value,
  colors,
  icon,
}: AttributeItemProps) {
  return (
    <View
      style={[
        attributeStyles.item,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View
        style={[
          attributeStyles.icon,
          {
            borderColor: colors.border,
            backgroundColor: colors.elevated,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={21} color={colors.text} />
      </View>
      <Text
        style={[
          attributeStyles.value,
          { color: colors.text },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          attributeStyles.label,
          { color: colors.mutedText },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const getRankColor = (rank: string) => {
  const colors: Record<string, string> = {
    S: '#c084fc',
    A: '#ef4444',
    B: '#facc15',
    C: '#34d399',
    D: '#60a5fa',
    E: '#c58a2a',
  };
  return colors[rank] ?? colors.E;
};

const attributeStyles = StyleSheet.create({
  item: {
    width: '48.5%',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 13,
  },

  icon: {
    width: 44,
    height: 44,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 19,
  },

  value: {
    fontSize: 21,
    fontWeight: '800',
  },

  label: {
    position: 'absolute',
    left: 70,
    bottom: 14,
    fontSize: 11,
    fontWeight: '800',
  },
});

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
      paddingTop: 52,
      paddingHorizontal: 14,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    headerButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },

    headerTitleBlock: {
      alignItems: 'center',
    },

    headerEyebrow: {
      marginBottom: 2,
      color: colors.accent,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 2.1,
    },

    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 1.4,
    },

    content: {
      paddingHorizontal: 16,
      paddingTop: 22,
      paddingBottom: 50,
    },

    heroCard: {
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 28,
      paddingBottom: 25,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },

    avatarGlow: {
      width: 136,
      height: 136,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderRadius: 68,
    },

    avatarContainer: {
      width: 124,
      height: 124,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: colors.surface,
      borderRadius: 62,
      backgroundColor: colors.elevated,
    },

    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: 62,
    },

    rankSeal: {
      position: 'absolute',
      right: -1,
      bottom: 4,
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.surface,
      borderRadius: 18,
    },

    rankSealText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
    },

    awakenedLabel: {
      marginTop: 20,
      color: colors.accent,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 2.3,
    },

    fullName: {
      marginTop: 7,
      color: colors.text,
      fontSize: 26,
      fontWeight: '900',
      textAlign: 'center',
    },

    codePill: {
      marginTop: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },

    hunterCode: {
      color: colors.mutedText,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },

    profileMeta: {
      marginTop: 13,
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '600',
    },

    statsRow: {
      width: '100%',
      marginTop: 25,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },

    statItem: {
      alignItems: 'center',
    },

    statValue: {
      color: colors.text,
      fontSize: 23,
      fontWeight: '900',
    },

    statLabel: {
      marginTop: 4,
      color: colors.mutedText,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },

    attributes: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 12,
      gap: 10,
    },

    combatSection: {
      width: '100%',
      marginTop: 30,
      paddingTop: 22,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    combatTitle: {
      marginBottom: 20,
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1.5,
      textAlign: 'center',
    },

    errorText: {
      marginTop: 15,
      color: colors.mutedText,
      textAlign: 'center',
    },

    backButton: {
      marginTop: 20,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.accent,
    },

    backButtonText: {
      color: colors.contrastText,
      fontWeight: '800',
    },
  });
