import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { clearUserProfile, getUserProfile } from '../services/storage';
import { RootStackParamList } from '../navigation/types';
import { UserProfile } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getUserProfile();
        setUser(profile);
      } catch (error) {
        Alert.alert('Unable to load profile', 'Please try again later.');
      }
    };

    if (isFocused) {
      loadProfile();
    }
  }, [isFocused]);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearUserProfile();
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          } catch (error) {
            Alert.alert('Unable to log out', 'Please try again.');
          }
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'settings', label: 'Account Settings', color: colors.primary.teal },
    { icon: 'bell', label: 'Notifications', badge: '3', color: colors.primary.teal },
    { icon: 'help-circle', label: 'Help & Support', color: colors.primary.teal },
    { icon: 'shield', label: 'Privacy Settings', color: colors.primary.teal },
    { icon: 'log-out', label: 'Log Out', color: '#EF4444', onPress: handleLogout },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <LinearGradient colors={colors.gradient.primary} style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={{ fontSize: 40 }}>👤</Text>
              </View>
              <TouchableOpacity style={styles.cameraButton}>
                <Feather name="camera" size={12} color={colors.primary.teal} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name ?? 'ActiveSense Member'}</Text>
              <Text style={styles.memberSince}>Active Member since Jan 2026</Text>
            </View>
            <TouchableOpacity style={styles.editButton}>
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
              <Text style={styles.infoValue}>Full</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Preferred Intensity</Text>
              <Text style={styles.infoValue}>{user?.preferredIntensity ?? 'Low'}</Text>
            </View>
            <LinearGradient colors={colors.gradient.primary} style={styles.updateButton}>
              <TouchableOpacity
                style={{ paddingVertical: 12, alignItems: 'center' }}
                onPress={() => Alert.alert('Update Profile', 'This feature is coming soon.')}
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
              {['Stay Active', 'Build Strength', 'Improve Flexibility'].map((goal, idx) => (
                <View key={idx} style={styles.goalChip}>
                  <Text style={styles.goalText}>{goal}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder]}
                onPress={item.onPress}
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
              <TouchableOpacity><Text style={styles.linkText}>Terms</Text></TouchableOpacity>
              <Text style={{ color: colors.text.tertiary }}>•</Text>
              <TouchableOpacity><Text style={styles.linkText}>Privacy</Text></TouchableOpacity>
              <Text style={{ color: colors.text.tertiary }}>•</Text>
              <TouchableOpacity><Text style={styles.linkText}>Contact</Text></TouchableOpacity>
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
