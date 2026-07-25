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
import {
  defaultStats,
  getDailyActivity,
  getRedeemedVoucherEntries,
  getStats,
  redeemVoucher,
  DailyActivity,
} from '../services/storage';
import { Achievement, RedeemedVoucher, RewardVoucher, UserStats } from '../types';
import { RootStackParamList } from '../navigation/types';

type AchievementDisplay = Achievement & { unlocked: boolean };
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProgressScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [dailyData, setDailyData] = useState<DailyActivity[]>([]);
  const [vouchers, setVouchers] = useState<RewardVoucher[]>([]);
  const [achievements, setAchievements] = useState<AchievementDisplay[]>([]);
  const [redeemedVouchers, setRedeemedVouchers] = useState<number[]>([]);
  const [redeemedVoucherEntries, setRedeemedVoucherEntries] = useState<RedeemedVoucher[]>([]);
  const [pendingVoucherIds, setPendingVoucherIds] = useState<number[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadProgress = async () => {
      try {
        const [storedStats, activity, rewardVouchers] = await Promise.all([
          getStats(),
          getDailyActivity(),
          db.getRewardVouchers(),
        ]);
        const storedRedeemedEntries = await getRedeemedVoucherEntries();
        const storedRedeemedVouchers = storedRedeemedEntries.map((entry) => entry.voucherId);
        const storedAchievements = await db.getAchievements(storedStats);
        if (!mounted) return;

        setStats(storedStats);
        setDailyData(activity);
        setVouchers(rewardVouchers);
        setRedeemedVouchers(storedRedeemedVouchers);
        setRedeemedVoucherEntries(storedRedeemedEntries);
        setAchievements(storedAchievements);
      } catch (error) {
        Alert.alert('Unable to load stats', 'Please try again later.');
      }
    };

    if (isFocused) {
      loadProgress();
    }

    return () => {
      mounted = false;
    };
  }, [isFocused]);

  const openRedemption = (voucher: RewardVoucher, redemptionCode?: string) => {
    const existingEntry = redeemedVoucherEntries.find((entry) => entry.voucherId === voucher.id);
    const existingCode = redemptionCode ?? existingEntry?.redemptionCode;
    if (!existingCode) {
      Alert.alert('Coupon unavailable', 'Please refresh your rewards and try again.');
      return;
    }
    navigation.navigate('RewardRedemption', {
      voucherId: voucher.id,
      voucherName: voucher.name,
      voucherCategory: voucher.category,
      voucherPoints: voucher.points,
      voucherIcon: voucher.emoji,
      redemptionCode: existingCode,
      usedAt: existingEntry?.usedAt,
      usedBy: existingEntry?.usedBy,
    });
  };

  const handleRedeem = async (voucher: RewardVoucher) => {
    if (stats.healthpoints < voucher.points || pendingVoucherIds.includes(voucher.id)) {
      return;
    }
    if (redeemedVouchers.includes(voucher.id)) {
      openRedemption(voucher);
      return;
    }
    try {
      setPendingVoucherIds((current) => [...current, voucher.id]);
      const { stats: nextStats, redeemedVoucherIds, redemptionCode } = await redeemVoucher(voucher);
      const nextRedeemedEntries = await getRedeemedVoucherEntries();
      setStats(nextStats);
      setRedeemedVouchers(redeemedVoucherIds);
      setRedeemedVoucherEntries(nextRedeemedEntries);
      setAchievements(await db.getAchievements(nextStats));
      openRedemption(voucher, redemptionCode);
    } catch (error) {
      Alert.alert('Unable to redeem reward', error instanceof Error ? error.message : 'Please try again later.');
    } finally {
      setPendingVoucherIds((current) => current.filter((id) => id !== voucher.id));
    }
  };

  const getPoints = (day: DailyActivity) => day.points ?? 0;

  const maxPoints = Math.max(1, ...dailyData.map(getPoints));
  const totalDailyPoints = dailyData.reduce((sum, day) => sum + getPoints(day), 0);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <LinearGradient colors={colors.gradient.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Your Progress</Text>
          <View style={styles.healthpointsCard}>
            <View>
              <Text style={styles.hpLabel}>Total Healthpoints</Text>
              <Text style={styles.hpValue}>{stats.healthpoints.toLocaleString()}</Text>
              <Text style={styles.hpSubLabel}>
                {stats.lifetimeHealthpoints.toLocaleString()} lifetime earned
              </Text>
            </View>
            <Feather name="award" size={48} color="#FBBF24" />
          </View>
        </LinearGradient>

        <View style={{ padding: 16 }}>
          {/* Daily Points Bar Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Daily Activity</Text>
                <Text style={styles.chartSubtitle}>Healthpoints earned over time</Text>
              </View>
              <Feather name="activity" size={20} color={colors.primary.teal} />
            </View>

            {/* Horizontal Scroll View */}
            {dailyData.length === 0 ? (
              <View style={styles.emptyChartState}>
                <Text style={styles.emptyText}>No workout points earned yet.</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartScrollContainer}
              >
                {dailyData.map((day) => {
                  const points = getPoints(day);
                  const heightPercent = points > 0 ? Math.max((points / maxPoints) * 100, 18) : 0;

                  return (
                    <View key={day.id} style={styles.barContainer}>
                      {/* Points badge above bar (invisible on 0-point days) */}
                      <Text style={[styles.barValueText, points === 0 && { opacity: 0 }]}>
                        {points}
                      </Text>

                      {/* Empty track pill background stays visible for ALL days */}
                      <View style={styles.barTrack}>
                        {points > 0 && (
                          <LinearGradient
                            colors={colors.gradient.success}
                            style={[styles.bar, { height: `${heightPercent}%` }]}
                          />
                        )}
                      </View>

                      {/* Dynamic date label (e.g. "Jul 21", "Jul 22", "Today") */}
                      <Text
                        style={[
                          styles.dayLabel,
                          day.dayLabel === 'Today' && { color: colors.primary.teal, fontWeight: '700' },
                        ]}
                      >
                        {day.dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.chartSummary}>
              <Text style={styles.chartSummaryValue}>{totalDailyPoints.toLocaleString()} HP</Text>
              <Text style={styles.chartSummaryLabel}>
                total Healthpoints earned from logged workouts
              </Text>
            </View>
          </View>

          {/* Rewards Shop */}
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="gift" size={20} color={colors.primary.teal} />
                <Text style={styles.sectionTitle}>Rewards Shop</Text>
              </View>
              <View style={styles.hpBadge}>
                <Text style={styles.hpBadgeText}>{stats.healthpoints} HP</Text>
              </View>
            </View>
            {vouchers.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="database" size={22} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No rewards found. Seed reward_vouchers in Supabase.</Text>
              </View>
            )}
            {vouchers.map((voucher) => {
              const canAfford = stats.healthpoints >= voucher.points;
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
                    disabled={(!canAfford && !isRedeemed) || isRedeeming}
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
                        {isRedeeming ? 'Redeeming' : isRedeemed ? 'Open' : canAfford ? 'Redeem' : 'Locked'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Achievements */}
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
  hpSubLabel: { marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.86)', fontWeight: '600' },
  chartCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  chartSubtitle: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  chartScrollContainer: { height: 160, alignItems: 'flex-end', paddingRight: 8, marginBottom: 16 },
  emptyChartState: { height: 120, justifyContent: 'center', alignItems: 'center' },
  barContainer: { width: 44, height: '100%', alignItems: 'center', justifyContent: 'flex-end', marginRight: 12 },
  barValueText: { fontSize: 11, fontWeight: '700', color: colors.primary.teal, marginBottom: 4 },
  barTrack: {
    width: 14,
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 9999 },
  dayLabel: { fontSize: 10, fontWeight: '600', color: colors.text.secondary, marginTop: 8, textAlign: 'center' },
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