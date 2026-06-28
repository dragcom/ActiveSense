import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthLanding'>;

export default function AuthLandingScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={colors.gradient.primary} style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🏃</Text>
          </View>
          <Text style={styles.brand}>
            Active<Text style={styles.brandAccent}>Sense</Text>
          </Text>
          <Text style={styles.subtitle}>
            AI-guided workouts, local pose tracking, and Healthpoints rewards for every generation.
          </Text>
          <View style={styles.privacyPill}>
            <Feather name="shield" size={14} color="#fff" />
            <Text style={styles.privacyText}>Camera analysis stays on device</Text>
          </View>
        </LinearGradient>

        <View style={styles.actionPanel}>
          <Text style={styles.panelTitle}>Welcome</Text>
          <Text style={styles.panelCopy}>
            Create your profile so ActiveSense can tailor safe, effective workouts.
          </Text>

          <LinearGradient colors={colors.gradient.primary} style={styles.primaryAction}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.actionButton}
              onPress={() => navigation.navigate('Onboarding', { mode: 'signup' })}
            >
              <Feather name="user-plus" size={18} color="#fff" />
              <Text style={styles.primaryText}>Sign up</Text>
            </TouchableOpacity>
          </LinearGradient>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('Login')}
          >
            <Feather name="log-in" size={18} color={colors.primary.teal} />
            <Text style={styles.secondaryText}>Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featureCard}>
            <Feather name="activity" size={18} color={colors.primary.teal} />
            <Text style={styles.featureText}>Real-time form cues</Text>
          </View>
          <View style={styles.featureCard}>
            <Feather name="gift" size={18} color={colors.primary.teal} />
            <Text style={styles.featureText}>Redeem Healthpoints</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.base },
  content: { padding: 20, paddingBottom: 32, flexGrow: 1, justifyContent: 'center' },
  hero: {
    borderRadius: 24,
    padding: 24,
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 44 },
  brand: { fontSize: 34, fontWeight: '700', color: '#fff' },
  brandAccent: { color: '#E0F2FE' },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  privacyPill: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17,24,39,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  privacyText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  actionPanel: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    gap: 12,
  },
  panelTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
  panelCopy: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
  primaryAction: { borderRadius: 9999, marginTop: 4 },
  actionButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  secondaryAction: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    backgroundColor: '#ECFEFF',
  },
  secondaryText: { fontSize: 14, color: colors.primary.teal, fontWeight: '700' },
  featureRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  featureCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  featureText: { fontSize: 12, color: colors.text.secondary, fontWeight: '600' },
});
