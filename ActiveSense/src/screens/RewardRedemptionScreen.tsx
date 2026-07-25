import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import IconBadge from '../components/IconBadge';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardRedemption'>;

const code128Patterns = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const encodeCode128B = (value: string) => {
  const safeValue = value.replace(/[^\x20-\x7E]/g, '').slice(0, 48) || 'ACTIVE-SENSE';
  const values = [104, ...safeValue.split('').map((char) => char.charCodeAt(0) - 32)];
  const checksum = values.reduce((sum, code, index) => sum + code * (index === 0 ? 1 : index), 0) % 103;
  return [...values, checksum, 106].map((code) => code128Patterns[code]).join('');
};

function Barcode({ value }: { value: string }) {
  const bars = useMemo(() => encodeCode128B(value), [value]);
  return (
    <View style={styles.barcode} accessibilityLabel={`Barcode for ${value}`}>
      {bars.split('').map((width, index) => {
        const isBar = index % 2 === 0;
        return (
          <View
            key={`${width}-${index}`}
            style={[
              styles.barcodeModule,
              {
                flexGrow: Number(width),
                backgroundColor: isBar ? colors.text.primary : '#fff',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function RewardRedemptionScreen({ navigation, route }: Props) {
  const { voucherName, voucherCategory, voucherPoints, voucherIcon, redemptionCode, usedAt, usedBy } = route.params;
  const usedDate = usedAt
    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(usedAt))
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Feather name="x" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reward Coupon</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>

        <LinearGradient colors={colors.gradient.primary} style={styles.couponHero}>
          <View style={styles.couponIcon}>
            <IconBadge icon={voucherIcon} size={36} />
          </View>
          <Text style={styles.couponName}>{voucherName}</Text>
          <Text style={styles.couponMeta}>{voucherCategory} • {voucherPoints} HP redeemed</Text>
        </LinearGradient>

        <View style={styles.scanCard}>
          <View style={[styles.statusPill, usedAt && styles.usedPill]}>
            <Feather name={usedAt ? 'check-circle' : 'clock'} size={14} color={usedAt ? '#047857' : colors.primary.teal} />
            <Text style={[styles.statusText, usedAt && styles.usedText]}>
              {usedAt ? 'Used' : 'Ready to redeem'}
            </Text>
          </View>
          <Text style={styles.scanTitle}>Scan to Redeem</Text>
          <Text style={styles.scanCopy}>
            Show this coupon code to the cashier or partner merchant. The code uniquely identifies this redeemed reward.
          </Text>
          <Barcode value={redemptionCode} />
          <Text style={styles.redemptionCode}>{redemptionCode}</Text>
          {usedDate && (
            <Text style={styles.usedCopy}>
              Used {usedBy ? `by ${usedBy} ` : ''}on {usedDate}
            </Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Feather name="check-circle" size={18} color={colors.primary.teal} />
            <Text style={styles.infoText}>This coupon has already been claimed from your Healthpoints balance.</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="shield" size={18} color={colors.primary.teal} />
            <Text style={styles.infoText}>Use once at a participating merchant during the prototype demo. Once scanned, Supabase records the used time.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.base },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButtonPlaceholder: { width: 40, height: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  couponHero: { borderRadius: 18, padding: 22, alignItems: 'center' },
  couponIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  couponName: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  couponMeta: { marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  scanCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 18,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  scanTitle: { fontSize: 18, fontWeight: '800', color: colors.text.primary },
  scanCopy: { marginTop: 8, fontSize: 13, color: colors.text.secondary, textAlign: 'center', lineHeight: 19 },
  barcode: {
    marginTop: 18,
    width: '100%',
    maxWidth: 320,
    height: 116,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  barcodeModule: { height: '100%' },
  redemptionCode: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    color: colors.text.primary,
  },
  usedCopy: { marginTop: 8, fontSize: 12, color: colors.text.secondary, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  usedPill: { backgroundColor: '#D1FAE5' },
  statusText: { color: colors.primary.teal, fontSize: 12, fontWeight: '800' },
  usedText: { color: '#047857' },
  infoCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#ECFDF5',
    gap: 12,
  },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, color: colors.text.secondary, fontSize: 13, lineHeight: 18 },
});
