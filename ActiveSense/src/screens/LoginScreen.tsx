import React, { useState } from 'react';
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
import { hasSupabaseConfig, signInWithPassword } from '../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// LoginScreen authenticates the Supabase email/password account created during signup.
export default function LoginScreen({ navigation }: Props) {
  const [isContinuing, setIsContinuing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleContinue = async () => {
    if (isContinuing) {
      return;
    }

    try {
      setIsContinuing(true);
      if (hasSupabaseConfig) {
        if (!email.trim() || !password) {
          Alert.alert('Missing login details', 'Please enter your email and password.');
          return;
        }
        await signInWithPassword(email, password);
      }

      const profile = await getUserProfile();
      if (!profile) {
        Alert.alert('Profile not found', 'Please complete signup before logging in.');
        return;
      }
      await saveUserProfile(profile);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Unable to log in', message);
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back returns to the landing screen without changing saved profile data. */}
        <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={18} color={colors.primary.teal} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <LinearGradient colors={colors.gradient.primary} style={styles.hero}>
          <Feather name="log-in" size={34} color="#fff" />
          <Text style={styles.heroTitle}>Log in</Text>
          <Text style={styles.heroCopy}>Use the email and password from your ActiveSense signup.</Text>
        </LinearGradient>

        {/* Login uses Supabase Auth when configured and local profile fallback in offline prototype builds. */}
        <View style={styles.formCard}>
          {!hasSupabaseConfig && (
            <View style={styles.infoRow}>
              <Feather name="smartphone" size={22} color={colors.primary.teal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Local prototype mode</Text>
                <Text style={styles.infoCopy}>
                  Supabase Auth is not configured, so this build can only resume the profile saved on this device.
                </Text>
              </View>
            </View>
          )}

          {hasSupabaseConfig && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  textContentType="password"
                  style={styles.input}
                />
              </View>
            </>
          )}

          <LinearGradient
            colors={isContinuing ? ['#D1D5DB', '#D1D5DB'] : colors.gradient.primary}
            style={styles.loginButton}
          >
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isContinuing}
              onPress={handleContinue}
              style={styles.loginInner}
            >
              <Text style={styles.loginText}>
                {isContinuing ? 'Opening...' : hasSupabaseConfig ? 'Log in' : 'Continue with saved profile'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.signupLink}
          onPress={() => navigation.navigate('Onboarding', { mode: 'signup' })}
        >
          <Text style={styles.signupText}>Create a new profile</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.base },
  keyboardContainer: { flex: 1 },
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
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  infoCopy: { fontSize: 12, color: colors.text.secondary, lineHeight: 17, marginTop: 4 },
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
  loginButton: { borderRadius: 9999, marginTop: 2 },
  loginInner: { paddingVertical: 14, alignItems: 'center' },
  loginText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  signupLink: { alignItems: 'center', paddingVertical: 16 },
  signupText: { color: colors.primary.teal, fontSize: 13, fontWeight: '700' },
});
