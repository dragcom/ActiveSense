import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { colors } from '../theme/colors';
import AvatarCreatorView from '../components/AvatarCreatorView';
import { RootStackParamList } from '../navigation/types';
import { db } from '../services/database';
import { getUserProfile, saveUserProfile } from '../services/storage';
import { cacheAvatarGlb } from '../services/avatarAssetStorage';
import { hasSupabaseConfig, signUpWithPassword } from '../services/supabase';
import { defaultAvatarConfig, normalizeAvatarConfig } from '../data/avatars';
import { AvatarProfileConfig, MedicalConditionOption } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

// The profile form is split into short steps to reduce friction.
const PROFILE_STEPS = 4;
const AVATAR_PROFILE_STEP = PROFILE_STEPS + 1;

// OnboardingScreen creates or edits the local user profile.
export default function OnboardingScreen({ navigation, route }: Props) {
  const isEditMode = route.params?.mode === 'edit';
  const shouldCollectAccount = !isEditMode;
  const totalSteps = (shouldCollectAccount ? 1 : 0) + PROFILE_STEPS + 1;
  // Form state is local until the final step saves everything together.
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fitnessLevels, setFitnessLevels] = useState<string[]>([]);
  const [intensityLevels, setIntensityLevels] = useState<string[]>([]);
  const [medicalOptions, setMedicalOptions] = useState<MedicalConditionOption[]>([]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState<string[]>(['None']);
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [preferredIntensity, setPreferredIntensity] = useState('');
  const [avatarConfig, setAvatarConfig] = useState(defaultAvatarConfig);
  const [loadingChoices, setLoadingChoices] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isAccountReady = useMemo(
    () => email.trim().length > 0 && password.length >= 8 && confirmPassword.length >= 8,
    [confirmPassword, email, password],
  );
  const isBasicsReady = useMemo(() => name.trim().length > 0 && age.trim().length > 0, [name, age]);
  const profileStep = shouldCollectAccount ? step - 1 : step;
  // Medical options are grouped by category for easier scanning.
  const groupedMedicalOptions = useMemo(() => {
    return medicalOptions.reduce<Record<string, MedicalConditionOption[]>>((groups, option) => {
      groups[option.category] = [...(groups[option.category] ?? []), option];
      return groups;
    }, {});
  }, [medicalOptions]);

  useEffect(() => {
    let mounted = true;
    // Load choice lists and prefill existing profile values when editing.
    const loadChoices = async () => {
      try {
        const [choices, existingProfile] = await Promise.all([
          db.getOnboardingChoices(),
          isEditMode ? getUserProfile() : Promise.resolve(null),
        ]);
        if (mounted) {
          setFitnessLevels(choices.fitnessLevels);
          setIntensityLevels(choices.intensityLevels);
          setMedicalOptions(choices.medicalConditionOptions);
          setName(existingProfile?.name ?? '');
          setAge(existingProfile?.age ? `${existingProfile.age}` : '');
          setSelectedMedicalConditions(existingProfile?.medicalConditions ?? ['None']);
          setFitnessLevel(existingProfile?.fitnessLevel ?? choices.fitnessLevels[0] ?? '');
          setPreferredIntensity(existingProfile?.preferredIntensity ?? choices.intensityLevels[0] ?? '');
          setAvatarConfig(normalizeAvatarConfig(existingProfile?.avatar));
          setLoadingChoices(false);
        }
      } catch (error) {
        if (mounted) {
          setLoadingChoices(false);
        }
        Alert.alert('Unable to load options', 'Please try again.');
      }
    };

    loadChoices();

    return () => {
      mounted = false;
    };
  }, [isEditMode]);

  const toggleMedicalCondition = (label: string) => {
    // "None" is exclusive, while all other conditions can be combined.
    setSelectedMedicalConditions((current) => {
      if (label === 'None') {
        return ['None'];
      }

      const withoutNone = current.filter((condition) => condition !== 'None');
      if (withoutNone.includes(label)) {
        const next = withoutNone.filter((condition) => condition !== label);
        return next.length ? next : ['None'];
      }
      return [...withoutNone, label];
    });
  };

  const validateBasics = () => {
    // Name and age are the only hard validation before saving the profile.
    const parsedAge = Number(age.trim());
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return false;
    }
    if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
      Alert.alert('Invalid age', 'Please enter a valid age.');
      return false;
    }
    return true;
  };

  const validateAccount = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      Alert.alert('Email required', 'Please enter a valid email address.');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Please use at least 8 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm the same password.');
      return false;
    }
    return true;
  };

  const canContinue = () => {
    // Disable the primary button until the current step has enough information.
    if (isSaving) {
      return false;
    }
    if (shouldCollectAccount && step === 1) {
      return isAccountReady;
    }
    if (loadingChoices) {
      return false;
    }
    if (profileStep === 1) {
      return isBasicsReady;
    }
    if (profileStep === 2) {
      return fitnessLevel.length > 0;
    }
    if (profileStep === 3) {
      return selectedMedicalConditions.length > 0;
    }
    if (profileStep === AVATAR_PROFILE_STEP) {
      return Boolean(avatarConfig.optionId);
    }
    return preferredIntensity.length > 0;
  };

  const handleNext = () => {
    // Step one validates before moving ahead because later screens rely on basics.
    if (shouldCollectAccount && step === 1 && !validateAccount()) {
      return;
    }
    if (profileStep === 1 && !validateBasics()) {
      return;
    }
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleComplete = async (nextAvatar: AvatarProfileConfig = avatarConfig) => {
    // Save a complete profile and reset navigation into the main tab app.
    if (!validateBasics()) {
      setStep(shouldCollectAccount ? 2 : 1);
      return;
    }
    if (!fitnessLevel || !preferredIntensity) {
      Alert.alert('Options loading', 'Please wait for your choices to finish loading.');
      return;
    }

    try {
      setIsSaving(true);
      if (shouldCollectAccount && hasSupabaseConfig) {
        await signUpWithPassword(email, password, name);
      }
      const existingProfile = await getUserProfile();
      const normalizedAvatar = await cacheAvatarGlb(normalizeAvatarConfig(nextAvatar));
      await saveUserProfile({
        name: name.trim(),
        age: Number(age.trim()),
        fitnessLevel,
        preferredIntensity,
        medicalConditions: selectedMedicalConditions.length ? selectedMedicalConditions : ['None'],
        createdAt: isEditMode ? existingProfile?.createdAt : new Date().toISOString(),
        privacyMode: existingProfile?.privacyMode ?? 'Avatar',
        avatar: normalizedAvatar,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Unable to save', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarScreenshot = async (dataUrl: string) => {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `activesense-avatar-${Date.now()}.png`;
      link.click();
      return;
    }
    const [{ cacheDirectory, EncodingType, writeAsStringAsync }, MediaLibrary, Sharing] = await Promise.all([
      import('expo-file-system/legacy'),
      import('expo-media-library'),
      import('expo-sharing'),
    ]);
    const filename = `${cacheDirectory ?? ''}avatar_booth_${Date.now()}.png`;
    await writeAsStringAsync(filename, base64Data, { encoding: EncodingType.Base64 });
    Alert.alert('Capture Success!', 'What would you like to do with your avatar snapshot?', [
      {
        text: 'Save to Photos',
        onPress: async () => {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            await MediaLibrary.saveToLibraryAsync(filename);
            Alert.alert('Saved', 'Your avatar image is now in your photos.');
          }
        },
      },
      {
        text: 'Share',
        onPress: async () => {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filename);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderStep = () => {
    // Each step returns only the form controls relevant to that part of setup.
    if (shouldCollectAccount && step === 1) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create your account</Text>
          <Text style={styles.sectionSubtitle}>
            Your email and password will be used to log in on web and iPhone.
          </Text>
          {!hasSupabaseConfig && (
            <View style={styles.noticeCard}>
              <Feather name="alert-circle" size={17} color={colors.primary.teal} />
              <Text style={styles.noticeText}>
                Supabase Auth is not configured in this build, so the password form is kept for the prototype flow and saved profile data stays local.
              </Text>
            </View>
          )}
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
              placeholder="At least 8 characters"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              textContentType="newPassword"
              style={styles.input}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat your password"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              textContentType="newPassword"
              style={styles.input}
            />
          </View>
        </View>
      );
    }

    if (loadingChoices) {
      return (
        <View style={styles.choiceLoader}>
          <ActivityIndicator color={colors.primary.teal} />
        </View>
      );
    }

    if (profileStep === 1) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tell us the basics</Text>
          <Text style={styles.sectionSubtitle}>Your age helps tune safety and workout intensity.</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.text.tertiary}
              style={styles.input}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder="Your age"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        </View>
      );
    }

    if (profileStep === 2) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose your fitness level</Text>
          <Text style={styles.sectionSubtitle}>We use this to recommend the right starting point.</Text>
          <View style={styles.chipRow}>
            {fitnessLevels.map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => setFitnessLevel(level)}
                style={[styles.chip, fitnessLevel === level && styles.chipActive]}
              >
                <Text style={[styles.chipText, fitnessLevel === level && styles.chipTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (profileStep === 3) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Any health considerations?</Text>
          <Text style={styles.sectionSubtitle}>Select all that apply so workouts can stay safe.</Text>
          {Object.entries(groupedMedicalOptions).map(([category, options]) => (
            <View key={category} style={styles.conditionGroup}>
              <Text style={styles.conditionCategory}>{category}</Text>
              <View style={styles.chipRow}>
                {options.map((option) => {
                  const active = selectedMedicalConditions.includes(option.label);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => toggleMedicalCondition(option.label)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (profileStep === 4) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred workout intensity</Text>
          <Text style={styles.sectionSubtitle}>This can be changed later from your profile.</Text>
          <View style={styles.chipRow}>
            {intensityLevels.map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => setPreferredIntensity(level)}
                style={[styles.chip, preferredIntensity === level && styles.chipActive]}
              >
                <Text style={[styles.chipText, preferredIntensity === level && styles.chipTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Profile summary</Text>
            <Text style={styles.summaryText}>Name: {name.trim() || '--'}</Text>
            <Text style={styles.summaryText}>Fitness: {fitnessLevel || '--'}</Text>
            <Text style={styles.summaryText}>
              Medical: {selectedMedicalConditions.join(', ') || 'None'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <ActivityIndicator color={colors.primary.teal} />
      </View>
    );
  };

  if (profileStep === AVATAR_PROFILE_STEP) {
    return (
      <SafeAreaView style={styles.avatarSafeArea}>
        <View style={styles.avatarHeader}>
          <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.avatarBackButton}>
            <Feather name="arrow-left" size={18} color="#fff" />
            <Text style={styles.avatarBackText}>Edit Options</Text>
          </TouchableOpacity>
          <Text style={styles.avatarHeaderTitle}>Design Your Avatar</Text>
        </View>
        <AvatarCreatorView
          avatarConfig={avatarConfig}
          onScreenshot={handleAvatarScreenshot}
          onAvatarSaved={(nextAvatar) => {
            const normalizedAvatar = normalizeAvatarConfig(nextAvatar);
            setAvatarConfig(normalizedAvatar);
            handleComplete(normalizedAvatar);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Hero card shows progress through the profile setup wizard. */}
          <LinearGradient colors={colors.gradient.primary} style={styles.heroCard}>
            <TouchableOpacity accessibilityRole="button" style={styles.backToAuth} onPress={() => navigation.goBack()}>
              <Feather name="chevron-left" size={18} color="#fff" />
              <Text style={styles.backToAuthText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.heroTitle}>
              {isEditMode ? 'Update' : 'Active'}<Text style={styles.heroTitleAccent}>{isEditMode ? ' Profile' : 'Sense'}</Text>
            </Text>
            <Text style={styles.heroSubtitle}>Step {step} of {totalSteps}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
            </View>
          </LinearGradient>

          {renderStep()}

          {/* Navigation buttons move between steps or save on the final step. */}
          <View style={styles.navRow}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.secondaryButton, step === 1 && styles.disabledButton]}
              disabled={step === 1}
              onPress={() => setStep(step - 1)}
            >
              <Feather name="arrow-left" size={18} color={step === 1 ? colors.text.tertiary : colors.primary.teal} />
              <Text style={[styles.secondaryButtonText, step === 1 && { color: colors.text.tertiary }]}>
                Previous
              </Text>
            </TouchableOpacity>

            <LinearGradient
              colors={canContinue() ? colors.gradient.primary : ['#D1D5DB', '#D1D5DB']}
              style={styles.primaryButton}
            >
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.primaryButtonInner}
                disabled={!canContinue()}
                onPress={step === totalSteps ? () => handleComplete() : handleNext}
              >
                <Text style={styles.primaryButtonText}>
                  {isSaving ? 'Saving...' : step === totalSteps ? (isEditMode ? 'Save profile' : 'Create profile') : profileStep === 4 ? 'Next: Create Avatar' : 'Next'}
                </Text>
                <Feather name={step === totalSteps ? 'check' : 'arrow-right'} size={18} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          <Text style={styles.helperText}>You can update your profile anytime in the Profile tab.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.base },
  avatarSafeArea: { flex: 1, backgroundColor: '#12101B' },
  avatarHeader: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#12101B',
  },
  avatarBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatarBackText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  avatarHeaderTitle: { color: '#fff', fontSize: 23, fontWeight: '900', flexShrink: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48, flexGrow: 1 },
  heroCard: { borderRadius: 24, padding: 24, marginBottom: 24 },
  backToAuth: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 18,
  },
  backToAuthText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroTitle: { fontSize: 28, fontWeight: '700', color: '#fff' },
  heroTitleAccent: { color: '#E0F2FE' },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 8 },
  progressTrack: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    overflow: 'hidden',
    marginTop: 18,
  },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 9999 },
  section: {
    backgroundColor: colors.background.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    minHeight: 0,
  },
  choiceLoader: { minHeight: 320, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
  sectionSubtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 6, lineHeight: 18 },
  inputGroup: { marginTop: 18 },
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
  noticeCard: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    backgroundColor: '#ECFEFF',
    padding: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.text.secondary, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary.teal, borderColor: colors.primary.teal },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary, flexShrink: 1 },
  chipTextActive: { color: '#fff' },
  conditionGroup: { marginTop: 18 },
  conditionCategory: { fontSize: 12, fontWeight: '700', color: colors.text.primary },
  summaryCard: {
    backgroundColor: '#ECFEFF',
    borderColor: '#CCFBF1',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 22,
    gap: 6,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  summaryText: { fontSize: 12, color: colors.text.secondary },
  avatarPreview: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    backgroundColor: '#ECFEFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarPreviewBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewLabel: { fontSize: 15, fontWeight: '800', color: colors.text.primary },
  avatarPreviewCopy: { fontSize: 12, color: colors.text.secondary, marginTop: 3 },
  avatarGrid: { gap: 10, marginTop: 16 },
  avatarOption: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background.card,
    padding: 12,
  },
  avatarOptionActive: { borderColor: colors.primary.teal, backgroundColor: '#F0FDFA' },
  avatarSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionTitle: { fontSize: 13, fontWeight: '800', color: colors.text.primary },
  avatarOptionTitleActive: { color: colors.primary.tealDark },
  avatarOptionCopy: { fontSize: 11, color: colors.text.secondary, marginTop: 3 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  secondaryButton: {
    flex: 1,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    backgroundColor: '#ECFEFF',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: { opacity: 0.6, backgroundColor: colors.background.muted, borderColor: colors.border },
  secondaryButtonText: { color: colors.primary.teal, fontWeight: '700', fontSize: 13 },
  primaryButton: { flex: 1.2, borderRadius: 9999 },
  primaryButtonInner: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  helperText: { fontSize: 11, color: colors.text.tertiary, textAlign: 'center', marginTop: 12 },
});
