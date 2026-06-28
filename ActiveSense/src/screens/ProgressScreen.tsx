import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import IconBadge from '../components/IconBadge';
import { db } from '../services/database';
import {
  defaultStats,
  getRedeemedVouchers,
  getStats,
  getWeeklyActivity,
  redeemVoucher,
} from '../services/storage';
import { Achievement, RewardVoucher, WeeklyActivity } from '../types';

type AchievementDisplay = Achievement & { unlocked: boolean };

// ProgressScreen shows Healthpoints, weekly activity, rewards, and achievements.
export default function ProgressScreen() {
  // Progress data comes from Supabase when signed in, with local fallback for prototype runs.
  const [healthpoints, setHealthpoints] = useState(defaultStats.healthpoints);
  const [weeklyData, setWeeklyData] = useState<WeeklyActivity[]>([]);
  const [vouchers, setVouchers] = useState<RewardVoucher[]>([]);
  const [achievements, setAchievements] = useState<AchievementDisplay[]>([]);
  const [redeemedVouchers, setRedeemedVouchers] = useState<number[]>([]);
  const [pendingVoucherIds, setPendingVoucherIds] = useState<number[]>([]);

  useEffect(() => {
    // Load stats and reward catalog together so the shop can render immediately.
    const loadProgress = async () => {
      try {
        const [storedStats, activity, rewardVouchers] = await Promise.all([
          getStats(),
          getWeeklyActivity(),
          db.getRewardVouchers(),
        ]);
        const storedRedeemedVouchers = await getRedeemedVouchers();
        const storedAchievements = await db.getAchievements(storedStats);
        setHealthpoints(storedStats.healthpoints);
        setWeeklyData(activity);
        setVouchers(rewardVouchers);
        setRedeemedVouchers(storedRedeemedVouchers);
        setAchievements(storedAchievements);
      } catch (error) {
        Alert.alert('Unable to load stats', 'Please try again later.');
      }
    };

    loadProgress();
  }, []);

  const handleRedeem = async (voucher: RewardVoucher) => {
    // Do not redeem if the user cannot afford it or already claimed it.
    if (healthpoints < voucher.points || redeemedVouchers.includes(voucher.id) || pendingVoucherIds.includes(voucher.id)) {
      return;
    }
    try {
      // The service handles point deduction through Supabase RPC or local fallback.
      setPendingVoucherIds((current) => [...current, voucher.id]);
      const { stats, redeemedVoucherIds } = await redeemVoucher(voucher);
      setHealthpoints(stats.healthpoints);
      setRedeemedVouchers(redeemedVoucherIds);
      setAchievements(await db.getAchievements(stats));
    } catch (error) {
      Alert.alert('Unable to redeem reward', error instanceof Error ? error.message : 'Please try again later.');
    } finally {
      setPendingVoucherIds((current) => current.filter((id) => id !== voucher.id));
    }
  };

  const maxPoints = Math.max(100, ...weeklyData.map((day) => day.points));
  const totalWeekly = weeklyData.reduce((sum, day) => sum + day.points, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header highlights the currency users earn from workouts. */}
        <LinearGradient colors={colors.gradient.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Your Progress</Text>
          <View style={styles.healthpointsCard}>
            <View>
              <Text style={styles.hpLabel}>Total Healthpoints</Text>
              <Text style={styles.hpValue}>{healthpoints.toLocaleString()}</Text>
            </View>
            <Feather name="award" size={48} color="#FBBF24" />
          </View>
        </LinearGradient>

        <View style={{ padding: 16 }}>
          {/* Weekly chart visualizes recent workout effort. */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Weekly Activity</Text>
              <Feather name="trending-up" size={20} color="#10B981" />
            </View>
            <View style={styles.chart}>
              {(weeklyData.length ? weeklyData : [{ id: 'empty', day: '--', points: 0 }]).map((day) => {
                const heightPercent = (day.points / maxPoints) * 100;
                return (
                  <View key={day.id} style={styles.barContainer}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                      <LinearGradient
                        colors={colors.gradient.success}
                        style={[styles.bar, { height: `${heightPercent}%` }]}
                      />
                    </View>
                    <Text style={styles.dayLabel}>{day.day}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.chartSummary}>
              <Text style={styles.chartSummaryValue}>{totalWeekly}</Text>
              <Text style={styles.chartSummaryLabel}>points earned this week</Text>
            </View>
          </View>

          {/* Rewards Shop spends Healthpoints and updates local progress state. */}
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="gift" size={20} color={colors.primary.teal} />
                <Text style={styles.sectionTitle}>Rewards Shop</Text>
              </View>
              <View style={styles.hpBadge}>
                <Text style={styles.hpBadgeText}>{healthpoints} HP</Text>
              </View>
            </View>
            {vouchers.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="database" size={22} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No rewards found. Seed reward_vouchers in Supabase.</Text>
              </View>
            )}
            {vouchers.map((voucher) => {
              const canAfford = healthpoints >= voucher.points;
              const isRedeemed = redeemedVouchers.includes(voucher.id);
              const isRedeeming = pendingVoucherIds.includes(voucher.id);
              return (
                <View key={voucher.id} style={styles.voucherCard}>
                  <LinearGradient colors={colors.gradient.primary} style={styles.voucherIcon}>
                    <IconBadge icon={voucher.emoji} size={22} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voucherName}>{voucher.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Text style={styles.voucherPoints}>{voucher.points} HP</Text>
                      <View style={styles.voucherCategory}>
                        <Text style={styles.voucherCategoryText}>{voucher.category}</Text>
                      </View>
                    </View>
                  </View>
                    <TouchableOpacity
                      disabled={!canAfford || isRedeemed || isRedeeming}
                    onPress={() => handleRedeem(voucher)}
                  >
                    <LinearGradient
                      colors={
                        isRedeemed || isRedeeming
                          ? ['#DCFCE7', '#DCFCE7']
                          : canAfford
                            ? colors.gradient.primary
                            : ['#D1D5DB', '#D1D5DB']
                      }
                      style={styles.redeemButton}
                    >
                      <Text
                        style={[
                          styles.redeemButtonText,
                          isRedeemed && { color: '#10B981' },
                          isRedeeming && { color: '#10B981' },
                          !canAfford && !isRedeemed && { color: '#9CA3AF' },
                        ]}
                      >
                        {isRedeeming ? 'Redeeming' : isRedeemed ? 'Redeemed' : canAfford ? 'Redeem' : 'Locked'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Achievements compare saved stats against fixed milestone requirements. */}
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="star" size={20} color="#FBBF24" />
                <Text style={styles.sectionTitle}>Achievements</Text>
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary.teal }}>
                  {achievements.length} total
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {achievements.length === 0 && (
                <View style={styles.emptyState}>
                  <Feather name="database" size={22} color={colors.text.tertiary} />
                  <Text style={styles.emptyText}>No achievements found. Seed achievements in Supabase.</Text>
                </View>
              )}
              {achievements.map((ach, idx) => (
                <View key={idx} style={{ width: '48%' }}>
                  <LinearGradient
                    colors={ach.unlocked ? ['#FBBF24', '#F97316'] : ['#F3F4F6', '#F3F4F6']}
                    style={styles.achievementCard}
                  >
                    <IconBadge
                      icon={ach.emoji}
                      size={34}
                      color={ach.unlocked ? '#fff' : '#9CA3AF'}
                      style={styles.achievementIcon}
                    />
                    <Text style={[styles.achievementTitle, !ach.unlocked && { color: '#D1D5DB' }]}>
                      {ach.title}
                    </Text>
                    <Text style={[styles.achievementDesc, !ach.unlocked && { color: '#9CA3AF' }]}>
                      {ach.desc}
                    </Text>
                  </LinearGradient>
                </View>
              ))}
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
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 16 },
  healthpointsCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hpLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  hpValue: { fontSize: 32, fontWeight: '700', color: '#fff' },
  chartCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  chart: { height: 200, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  barContainer: { flex: 1, height: '100%', alignItems: 'center' },
  bar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  dayLabel: { fontSize: 12, fontWeight: '600', color: colors.text.secondary, marginTop: 8 },
  chartSummary: { backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12, alignItems: 'center' },
  chartSummaryValue: { fontSize: 24, fontWeight: '700', color: colors.primary.teal },
  chartSummaryLabel: { fontSize: 12, color: colors.text.secondary },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  hpBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  hpBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary.teal },
  voucherCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.background.muted,
  },
  voucherIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  voucherName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  voucherPoints: { fontSize: 12, color: colors.text.secondary },
  voucherCategory: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  voucherCategoryText: { fontSize: 10, fontWeight: '600', color: colors.primary.teal },
  redeemButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 },
  redeemButtonText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  achievementCard: { borderRadius: 16, padding: 16, alignItems: 'center' },
  achievementIcon: { marginBottom: 8 },
  achievementTitle: { fontSize: 12, fontWeight: '600', color: '#fff', textAlign: 'center' },
  achievementDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background.card,
    padding: 18,
  },
  emptyText: { color: colors.text.secondary, fontSize: 12, textAlign: 'center' },
});
