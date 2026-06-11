import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { defaultStats, getStats, saveStats } from '../services/storage';

const weeklyData = [
  { id: 'mon', day: 'Mon', points: 120 },
  { id: 'tue', day: 'Tue', points: 150 },
  { id: 'wed', day: 'Wed', points: 100 },
  { id: 'thu', day: 'Thu', points: 180 },
  { id: 'fri', day: 'Fri', points: 140 },
  { id: 'sat', day: 'Sat', points: 200 },
  { id: 'sun', day: 'Sun', points: 160 },
];

const vouchers = [
  { id: 1, name: 'FairPrice $5 Voucher', points: 500, emoji: '🛒', category: 'Groceries' },
  { id: 2, name: 'GrabFood $10 Voucher', points: 1000, emoji: '🍔', category: 'Food' },
  { id: 3, name: 'Guardian $5 Voucher', points: 500, emoji: '💊', category: 'Health' },
  { id: 4, name: 'Decathlon $15 Voucher', points: 1500, emoji: '⚽', category: 'Sports' },
];

const achievements = [
  { title: '7-Day Streak', emoji: '🔥', unlocked: true, desc: 'Complete 7 days in a row' },
  { title: 'First Workout', emoji: '🎯', unlocked: true, desc: 'Finish your first session' },
  { title: '1000 Points', emoji: '💯', unlocked: true, desc: 'Earn 1000 Healthpoints' },
  { title: '30-Day Streak', emoji: '🏆', unlocked: false, desc: 'Complete 30 consecutive days' },
];

export default function ProgressScreen() {
  const [healthpoints, setHealthpoints] = useState(defaultStats.healthpoints);
  const [redeemedVouchers, setRedeemedVouchers] = useState<number[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const storedStats = await getStats();
        setHealthpoints(storedStats.healthpoints);
      } catch (error) {
        Alert.alert('Unable to load stats', 'Please try again later.');
      }
    };

    loadStats();
  }, []);

  const handleRedeem = async (voucherId: number, points: number) => {
    if (healthpoints < points || redeemedVouchers.includes(voucherId)) {
      return;
    }
    const updatedPoints = healthpoints - points;
    setHealthpoints(updatedPoints);
    setRedeemedVouchers([...redeemedVouchers, voucherId]);
    try {
      const storedStats = await getStats();
      await saveStats({ ...storedStats, healthpoints: updatedPoints });
    } catch (error) {
      Alert.alert('Unable to save rewards', 'Your redemption will sync next time.');
    }
  };

  const maxPoints = 200;
  const totalWeekly = weeklyData.reduce((sum, day) => sum + day.points, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
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
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Weekly Activity</Text>
              <Feather name="trending-up" size={20} color="#10B981" />
            </View>
            <View style={styles.chart}>
              {weeklyData.map((day) => {
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
            {vouchers.map((voucher) => {
              const canAfford = healthpoints >= voucher.points;
              const isRedeemed = redeemedVouchers.includes(voucher.id);
              return (
                <View key={voucher.id} style={styles.voucherCard}>
                  <LinearGradient colors={colors.gradient.primary} style={styles.voucherIcon}>
                    <Text style={{ fontSize: 24 }}>{voucher.emoji}</Text>
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
                    disabled={!canAfford || isRedeemed}
                    onPress={() => handleRedeem(voucher.id, voucher.points)}
                  >
                    <LinearGradient
                      colors={
                        isRedeemed
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
                          !canAfford && !isRedeemed && { color: '#9CA3AF' },
                        ]}
                      >
                        {isRedeemed ? '✓ Redeemed' : canAfford ? 'Redeem' : 'Locked'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="star" size={20} color="#FBBF24" />
                <Text style={styles.sectionTitle}>Achievements</Text>
              </View>
              <TouchableOpacity>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary.teal }}>
                  View All
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {achievements.map((ach, idx) => (
                <View key={idx} style={{ width: '48%' }}>
                  <LinearGradient
                    colors={ach.unlocked ? ['#FBBF24', '#F97316'] : ['#F3F4F6', '#F3F4F6']}
                    style={styles.achievementCard}
                  >
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>{ach.emoji}</Text>
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
  achievementTitle: { fontSize: 12, fontWeight: '600', color: '#fff', textAlign: 'center' },
  achievementDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
});
