import { useEffect, useMemo, useState, useRef} from 'react';
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
import { WebView } from 'react-native-webview';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy'; 
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { db } from '../services/database';
import { getUserProfile, saveUserProfile } from '../services/storage';
import { MedicalConditionOption } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const TOTAL_STEPS = 5;

export default function OnboardingScreen({ navigation, route }: Props) {
  const isEditMode = route.params?.mode === 'edit';
  
  //1=Basics, 2=Fitness, 3=Medical, 4=Intensity/Summary, 5=3D Avatar
  const [step, setStep] = useState(1);
  
  // Dynamic Option States from DB
  const [fitnessLevels, setFitnessLevels] = useState<string[]>([]);
  const [intensityLevels, setIntensityLevels] = useState<string[]>([]);
  const [medicalOptions, setMedicalOptions] = useState<MedicalConditionOption[]>([]);
  const [loadingChoices, setLoadingChoices] = useState(true);

  // Profile Form States
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState<string[]>(['None']);
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [preferredIntensity, setPreferredIntensity] = useState('');

  const isBasicsReady = useMemo(() => name.trim().length > 0 && age.trim().length > 0, [name, age]);
  const [initialAvatar, setInitialAvatar] = useState<any>(null);
  const webViewRef = useRef<WebView>(null);

  const groupedMedicalOptions = useMemo(() => {
    return medicalOptions.reduce<Record<string, MedicalConditionOption[]>>((groups, option) => {
      groups[option.category] = [...(groups[option.category] ?? []), option];
      return groups;
    }, {});
  }, [medicalOptions]);

  useEffect(() => {
    let mounted = true;
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
          setInitialAvatar(existingProfile?.avatar || null); 
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

  const canContinue = () => {
    if (loadingChoices) return false;
    if (step === 1) return isBasicsReady;
    if (step === 2) return fitnessLevel.length > 0;
    if (step === 3) return selectedMedicalConditions.length > 0;
    if (step === 4) return preferredIntensity.length > 0;
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateBasics()) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'WEBVIEW_READY') {
        if (isEditMode && initialAvatar && webViewRef.current) {
          const stringifiedPayload = JSON.stringify({
            type: 'HYDRATE_STATE',
            payload: { avatarConfig: initialAvatar, viewOnly: false }
          });
          
          const safeJSON = JSON.stringify(stringifiedPayload);
          webViewRef.current.injectJavaScript(`
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.parse(${safeJSON})
            }));
            true;
          `);
        }
      }
      
      if (message.type === 'SAVED_AVATAR') {
        const selectedAvatarConfig = message.data; 
        const existingProfile = await getUserProfile();

        await saveUserProfile({
          name: name.trim(),
          age: Number(age.trim()),
          fitnessLevel,
          preferredIntensity,
          medicalConditions: selectedMedicalConditions.length ? selectedMedicalConditions : ['None'],
          createdAt: isEditMode ? existingProfile?.createdAt : new Date().toISOString(),
          privacyMode: existingProfile?.privacyMode ?? 'Avatar',
          avatar: selectedAvatarConfig,
        });

        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }

      if (message.type === 'CAPTURE_SCREENSHOT') {
        const base64Data = message.data.replace(/^data:image\/png;base64,/, "");
        const filename = `${cacheDirectory}avatar_booth_${Date.now()}.png`;
        await writeAsStringAsync(filename, base64Data, {
          encoding: EncodingType.Base64,
        });

        Alert.alert(
          'Capture Success!',
          'What would you like to do with your Avatar snapshot?',
          [
            {
              text: 'Save to Camera Roll',
              onPress: async () => {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                  await MediaLibrary.saveToLibraryAsync(filename);
                  Alert.alert('Saved!', 'Your avatar image is now in your photos.');
                } else {
                  Alert.alert('Permission Denied', 'Cannot write file to your gallery library.');
                }
              }
            },
            {
              text: 'Share / Send',
              onPress: async () => {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(filename);
                } else {
                  Alert.alert('Error', 'Sharing utilities are unavailable on this device configuration.');
                }
              }
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
        console.error("FileSystem Storage Error Detailed Trace:", error);
        Alert.alert('Integration Error', 'Could not process screenshot channel data upstream.');
    }
  };

  if (step === 5) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.avatarHeader}>
          <TouchableOpacity onPress={() => setStep(4)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Edit Options</Text>
          </TouchableOpacity>
          <Text style={styles.avatarHeaderTitle}>Design Your Avatar</Text>
        </View>
        <WebView
          ref={webViewRef}
          source={{ uri: 'http://localhost:5173?view=configurator' }} 
          onMessage={handleWebViewMessage}
          startInLoadingState={true}
          style={styles.webview}
        />
      </SafeAreaView>
    );
  }

  const renderStep = () => {
    if (loadingChoices) {
      return (
        <View style={styles.choiceLoader}>
          <ActivityIndicator color={colors.primary.teal} />
        </View>
      );
    }

    if (step === 1) {
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

    if (step === 2) {
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

    if (step === 3) {
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
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={colors.gradient.primary} style={styles.heroCard}>
            <TouchableOpacity accessibilityRole="button" style={styles.backToAuth} onPress={() => navigation.goBack()}>
              <Feather name="chevron-left" size={18} color="#fff" />
              <Text style={styles.backToAuthText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.heroTitle}>
              {isEditMode ? 'Update' : 'Active'}<Text style={styles.heroTitleAccent}>{isEditMode ? ' Profile' : 'Sense'}</Text>
            </Text>
            <Text style={styles.heroSubtitle}>Step {step} of {TOTAL_STEPS}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
            </View>
          </LinearGradient>

          {renderStep()}

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
                onPress={handleNext}
              >
                <Text style={styles.primaryButtonText}>
                  {step === 4 ? 'Next: Create Avatar' : 'Next'}
                </Text>
                <Feather name="arrow-right" size={18} color="#fff" />
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
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32, flexGrow: 1 },
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
    minHeight: 320,
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary.teal, borderColor: colors.primary.teal },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
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
  navRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
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
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  helperText: { fontSize: 11, color: colors.text.tertiary, textAlign: 'center', marginTop: 12 },
  
  avatarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#14121c',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  backButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  avatarHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 80
  },
  webview: { flex: 1, backgroundColor: '#14121c' }
});