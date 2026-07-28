import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
        'Không tìm thấy hồ sơ Hunter.'
      );
    } finally {
      setLoading(false);
    }
  }, [hunterCode]);

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
          {error ?? 'Không tìm thấy Hunter.'}
        </Text>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>QUAY LẠI</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

        <Text style={styles.headerTitle}>
          HUNTER PROFILE
        </Text>

        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarContainer}>
          {profile.avatar ? (
            <Image
              source={{ uri: profile.avatar }}
              style={styles.avatar}
            />
          ) : (
            <MaterialCommunityIcons
              name="shield-account"
              size={70}
              color={colors.mutedText}
            />
          )}
        </View>

        <Text style={styles.fullName}>
          {profile.fullName}
        </Text>

        <Text style={styles.hunterCode}>
          {profile.hunterCode}
        </Text>

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
            <Text style={styles.statLabel}>STREAK</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profile.rankTier}
            </Text>
            <Text style={styles.statLabel}>RANK</Text>
          </View>
        </View>

        <View style={styles.attributes}>
          <AttributeItem
            label="STR"
            value={profile.strength}
            colors={colors}
          />

          <AttributeItem
            label="AGI"
            value={profile.agility}
            colors={colors}
          />

          <AttributeItem
            label="VIT"
            value={profile.vitality}
            colors={colors}
          />
        </View>
      </ScrollView>
    </View>
  );
}
type AttributeItemProps = {
  label: string;
  value: number;
  colors: ThemeColors;
};

function AttributeItem({
  label,
  value,
  colors,
}: AttributeItemProps) {
  return (
    <View
      style={[
        attributeStyles.item,
        {
          borderColor: colors.border,
          backgroundColor: colors.elevated,
        },
      ]}
    >
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

const attributeStyles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 12,
  },

  value: {
    fontSize: 21,
    fontWeight: '800',
  },

  label: {
    marginTop: 4,
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
      paddingBottom: 14,
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

    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 1.4,
    },

    content: {
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 30,
      paddingBottom: 50,
    },

    avatarContainer: {
      width: 126,
      height: 126,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 4,
      borderColor: colors.border,
      borderRadius: 63,
      backgroundColor: colors.elevated,
    },

    avatar: {
      width: '100%',
      height: '100%',
    },

    fullName: {
      marginTop: 20,
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
    },

    hunterCode: {
      marginTop: 6,
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    },

    statsRow: {
      width: '100%',
      marginTop: 30,
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 20,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },

    statItem: {
      alignItems: 'center',
    },

    statValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
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
      marginTop: 28,
      flexDirection: 'row',
      gap: 10,
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