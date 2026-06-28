import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { getUserProfile, saveUserProfile } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const canLogin = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

  const handleLogin = async () => {
    if (!canLogin) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }

    try {
      const profile = await getUserProfile();
      if (!profile) {
        Alert.alert('No local account found', 'Please sign up first on this device.');
        return;
      }
      await saveUserProfile(profile);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      Alert.alert('Login failed', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={18} color={colors.primary.teal} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <LinearGradient colors={colors.gradient.primary} style={styles.hero}>
            <Feather name="log-in" size={34} color="#fff" />
            <Text style={styles.heroTitle}>Login</Text>
            <Text style={styles.heroCopy}>Continue your ActiveSense progress on this device.</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.text.tertiary}
                style={styles.input}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor={colors.text.tertiary}
                style={styles.input}
              />
            </View>

            <LinearGradient
              colors={canLogin ? colors.gradient.primary : ['#D1D5DB', '#D1D5DB']}
              style={styles.loginButton}
            >
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canLogin}
                onPress={handleLogin}
                style={styles.loginInner}
              >
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.signupLink}
            onPress={() => navigation.navigate('Onboarding', { mode: 'signup' })}
          >
            <Text style={styles.signupText}>Create a new account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.base },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, flexGrow: 1, justifyContent: 'center' },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backText: { color: colors.primary.teal, fontWeight: '700', fontSize: 13 },
  hero: { borderRadius: 24, padding: 24, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 12 },
  heroCopy: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', marginTop: 8 },
  formCard: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, color: colors.text.secondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.background.muted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
  },
  loginButton: { borderRadius: 9999 },
  loginInner: { paddingVertical: 14, alignItems: 'center' },
  loginText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  signupLink: { alignItems: 'center', paddingVertical: 16 },
  signupText: { color: colors.primary.teal, fontSize: 13, fontWeight: '700' },
});
