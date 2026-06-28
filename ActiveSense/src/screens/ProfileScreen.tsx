import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import IconBadge from '../components/IconBadge';
import { db } from '../services/database';
import { clearUserProfile, getUserProfile } from '../services/storage';
import { defaultAvatarConfig, normalizeAvatarConfig } from '../data/avatars';
import { RootStackParamList } from '../navigation/types';
import { ProfileMenuItem, UserProfile } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Convert the saved ISO timestamp into friendly profile copy.
const formatMemberSince = (createdAt?: string) => {
  if (!createdAt) {
    return 'Active member';
  }
  return `Active member since ${new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(createdAt))}`;
};

// Estimate a simple mobility label from selected medical considerations.
const getMobilityLevel = (conditions?: string[]) => {
  const selected = conditions ?? [];
  if (selected.includes('None')) {
    return 'Standard';
  }
  if (
    selected.some((condition) =>
      ['Knee pain', 'Back pain', 'Arthritis', 'Balance concerns', 'Recent injury'].includes(condition),
    )
  ) {
    return 'Supported';
  }
  return 'Monitored';
};

// ProfileScreen shows saved user preferences and settings-style actions.
export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  // Profile, goals, and menu rows are refreshed when the tab is focused.
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileGoals, setProfileGoals] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<ProfileMenuItem[]>([]);
  const avatar = normalizeAvatarConfig(user?.avatar ?? defaultAvatarConfig);

  useEffect(() => {
    // Load local profile details plus data-driven rows for goals and menu actions.
    const loadProfile = async () => {
      try {
        const [profile, goals, menu] = await Promise.all([
          getUserProfile(),
          db.getProfileGoals(),
          db.getProfileMenuItems(),
        ]);
        setUser(profile);
        setProfileGoals(goals);
        setMenuItems(menu);
      } catch (error) {
        Alert.alert('Unable to load profile', 'Please try again later.');
      }
    };

    if (isFocused) {
      loadProfile();
    }
  }, [isFocused]);

  const handleLogout = async () => {
    // Prototype logout clears the onboarding flag and returns to the landing page.
    try {
      await clearUserProfile();
      navigation.reset({ index: 0, routes: [{ name: 'AuthLanding' }] });
    } catch (error) {
      Alert.alert('Unable to log out', 'Please try again.');
    }
  };

  const openInfoPage = async (actionKey: ProfileMenuItem['actionKey'] | 'profile_photo' | 'terms' | 'contact') => {
    // Each menu item either logs out or opens a short explanation page.
    if (!actionKey) {
      return;
    }
    if (actionKey === 'logout') {
      handleLogout();
      return;
    }
    try {
      const page = await db.getInfoPage(actionKey);
      navigation.navigate('InfoPage', page);
    } catch (error) {
      Alert.alert('Unable to load page', 'Please try again later.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header gives the user's identity and quick edit access. */}
        <LinearGradient colors={colors.gradient.primary} style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: avatar.accentColor }]}>
                <Feather name="user" size={34} color="#fff" />
              </View>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => navigation.navigate('Onboarding', { mode: 'edit' })}
              >
                <Feather name="edit-2" size={12} color={colors.primary.teal} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name ?? 'ActiveSense Member'}</Text>
              <Text style={styles.memberSince}>{formatMemberSince(user?.createdAt)}</Text>
              <View style={styles.avatarPill}>
                <View style={[styles.avatarDot, { backgroundColor: avatar.accentColor }]} />
                <Text style={styles.avatarPillText}>{avatar.label}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('Onboarding', { mode: 'edit' })}
            >
              <Feather name="edit-3" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Feather name="user" size={20} color="#fff" style={{ marginBottom: 8 }} />
              <Text style={styles.statValue}>{user?.age ?? '--'}</Text>
              <Text style={styles.statLabel}>Age</Text>
            </View>
            <View style={styles.statBox}>
              <Feather name="activity" size={20} color="#fff" style={{ marginBottom: 8 }} />
              <Text style={styles.statValue}>{user?.fitnessLevel ?? 'Beginner'}</Text>
              <Text style={styles.statLabel}>Fitness Level</Text>
            </View>
            <View style={styles.statBox}>
              <Feather name="shield" size={20} color="#fff" style={{ marginBottom: 8 }} />
              <Text style={styles.statValue}>{user?.privacyMode ?? 'Avatar'}</Text>
              <Text style={styles.statLabel}>Privacy Mode</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ padding: 16 }}>
          {/* Health profile summarizes the onboarding answers used for workout safety. */}
          <View style={styles.healthCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Health Profile</Text>
              <Feather name="shield" size={20} color={colors.primary.teal} />
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Medical Conditions</Text>
              <Text style={styles.infoValue}>
                {user?.medicalConditions?.length ? user.medicalConditions.join(', ') : 'None'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mobility Level</Text>
              <Text style={styles.infoValue}>{getMobilityLevel(user?.medicalConditions)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Preferred Intensity</Text>
              <Text style={styles.infoValue}>{user?.preferredIntensity ?? 'Low'}</Text>
            </View>
            <LinearGradient colors={colors.gradient.primary} style={styles.updateButton}>
              <TouchableOpacity
                style={{ paddingVertical: 12, alignItems: 'center' }}
                onPress={() => navigation.navigate('Onboarding', { mode: 'edit' })}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  Update Health Profile
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Goals are simple chips for the user's broad fitness motivation. */}
          <View style={styles.goalsCard}>
            <Text style={styles.cardTitle}>Your Goals</Text>
            <View style={styles.goalsContainer}>
              {profileGoals.map((goal) => (
                <View key={goal} style={styles.goalChip}>
                  <Text style={styles.goalText}>{goal}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Menu items are data-backed so future settings can be added in one place. */}
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                accessibilityRole="button"
                style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder]}
                onPress={() => openInfoPage(item.actionKey)}
              >
                <View
                  style={[
                    styles.menuIconContainer,
                    item.color === '#EF4444' && { backgroundColor: '#FEE2E2' },
                  ]}
                >
                  <Feather name={item.icon as keyof typeof Feather.glyphMap} size={20} color={item.color} />
                </View>
                <Text
                  style={[
                    styles.menuLabel,
                    item.color === '#EF4444' && { color: '#EF4444' },
                  ]}
                >
                  {item.label}
                </Text>
                {item.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* App information and legal links are grouped at the bottom of the profile. */}
          <View style={styles.appInfo}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <IconBadge icon="activity" size={32} color={colors.primary.teal} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                Active<Text style={{ color: colors.primary.teal }}>Sense</Text>
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.text.secondary, textAlign: 'center' }}>
              NUS Orbital 26 Project • Level Gemini
            </Text>
            <Text style={{ fontSize: 10, color: colors.text.tertiary, textAlign: 'center', marginTop: 4 }}>
              Version 1.0.0
            </Text>
            <View style={styles.divider} />
            <Text style={{ fontSize: 10, color: colors.text.secondary, textAlign: 'center' }}>
              Empowering healthy lifestyles through AI-powered guidance and gamification
            </Text>
            <View style={styles.links}>
              <TouchableOpacity
                onPress={() => openInfoPage('terms')}
              >
                <Text style={styles.linkText}>Terms</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.text.tertiary }}>•</Text>
              <TouchableOpacity
                onPress={() => openInfoPage('privacy')}
              >
                <Text style={styles.linkText}>Privacy</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.text.tertiary }}>•</Text>
              <TouchableOpacity
                onPress={() => openInfoPage('contact')}
              >
                <Text style={styles.linkText}>Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.base },
  header: { padding: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  memberSince: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  avatarPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  avatarDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#fff' },
  avatarPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  editButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 9999 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 4 },
  healthCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  infoLabel: { fontSize: 14, color: colors.text.secondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  updateButton: { borderRadius: 9999, marginTop: 8 },
  goalsCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  goalsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  goalChip: { backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  goalText: { fontSize: 12, fontWeight: '600', color: colors.primary.teal },
  menuCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.background.muted,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.background.muted },
  menuIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text.primary },
  badge: { backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999, marginRight: 8 },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  appInfo: {
    backgroundColor: '#DCFCE7',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  divider: { height: 1, backgroundColor: colors.primary.teal, opacity: 0.2, marginVertical: 12 },
  links: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16 },
  linkText: { fontSize: 10, color: colors.text.secondary },
});
