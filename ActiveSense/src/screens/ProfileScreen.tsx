import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { db } from '../services/database';
import { clearUserProfile, getUserProfile } from '../services/storage';
import { RootStackParamList } from '../navigation/types';
import { ProfileMenuItem, UserProfile } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const infoPages = {
  settings: {
    title: 'Account Settings',
    icon: 'settings',
    body: 'Supabase Auth will manage email, password, and account security here. Local prototype data is currently stored on this device so the app can run offline during development.',
  },
  notifications: {
    title: 'Notifications',
    icon: 'bell',
    body: 'Workout reminders, streak prompts, and reward updates will be configured here. Notification preferences will become database-backed user settings.',
  },
  support: {
    title: 'Help & Support',
    icon: 'help-circle',
    body: 'For the prototype, support content explains how ActiveSense uses local pose estimation, Healthpoints, and tailored workouts. A future support center can connect FAQs and contact forms.',
  },
  privacy: {
    title: 'Privacy Settings',
    icon: 'shield',
    body: 'ActiveSense processes camera frames locally for pose landmarks. Raw workout video is not uploaded in this prototype; Supabase should store profile, workout, reward, and landmark summary metadata only.',
  },
} as const;

const formatMemberSince = (createdAt?: string) => {
  if (!createdAt) {
    return 'Active member';
  }
  return `Active member since ${new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(createdAt))}`;
};

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

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileGoals, setProfileGoals] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<ProfileMenuItem[]>([]);

  useEffect(() => {
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
    try {
      await clearUserProfile();
      navigation.reset({ index: 0, routes: [{ name: 'AuthLanding' }] });
    } catch (error) {
      Alert.alert('Unable to log out', 'Please try again.');
    }
  };

  const openInfoPage = (actionKey: ProfileMenuItem['actionKey']) => {
    if (!actionKey) {
      return;
    }
    if (actionKey === 'logout') {
      handleLogout();
      return;
    }
    const page = infoPages[actionKey];
    navigation.navigate('InfoPage', page);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <LinearGradient colors={colors.gradient.primary} style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={{ fontSize: 40 }}>👤</Text>
              </View>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() =>
                  navigation.navigate('InfoPage', {
                    title: 'Profile Photo',
                    icon: 'camera',
                    body: 'Profile photo upload will connect to Supabase Storage. The camera used during workouts remains separate and is used for local pose landmarks.',
                  })
                }
              >
                <Feather name="camera" size={12} color={colors.primary.teal} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name ?? 'ActiveSense Member'}</Text>
              <Text style={styles.memberSince}>{formatMemberSince(user?.createdAt)}</Text>
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
              <Text style={styles.statValue}>Avatar</Text>
              <Text style={styles.statLabel}>Privacy Mode</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ padding: 16 }}>
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

          <View style={styles.appInfo}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🏃</Text>
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
                onPress={() =>
                  navigation.navigate('InfoPage', {
                    title: 'Terms',
                    icon: 'file-text',
                    body: 'Prototype terms: ActiveSense is an educational NUS Orbital prototype and should not replace professional medical advice. Stop exercising if you feel pain, dizziness, or discomfort.',
                  })
                }
              >
                <Text style={styles.linkText}>Terms</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.text.tertiary }}>•</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('InfoPage', {
                    title: 'Privacy',
                    icon: 'shield',
                    body: 'Workout camera frames are processed locally for MediaPipe landmarks. Future Supabase storage should hold profile and progress records, not raw camera video.',
                  })
                }
              >
                <Text style={styles.linkText}>Privacy</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.text.tertiary }}>•</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('InfoPage', {
                    title: 'Contact',
                    icon: 'mail',
                    body: 'Contact and feedback forms will be connected when backend messaging is added. For now, this page confirms the link is wired.',
                  })
                }
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
