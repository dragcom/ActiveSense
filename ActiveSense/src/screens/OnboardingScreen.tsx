import React, { useMemo, useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { saveUserProfile } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const fitnessLevels = ['Beginner', 'Intermediate', 'Advanced', 'Low Impact'];
const intensityLevels = ['Low', 'Medium', 'High'];

export default function OnboardingScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState(fitnessLevels[0]);
  const [preferredIntensity, setPreferredIntensity] = useState(intensityLevels[0]);
  const isFormReady = useMemo(() => name.trim().length > 0 && age.trim().length > 0, [name, age]);

  const handleComplete = async () => {
    const trimmedName = name.trim();
    const parsedAge = Number(age.trim());
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }
    if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
      Alert.alert('Invalid age', 'Please enter a valid age.');
      return;
    }

    const conditions = medicalConditions
      .split(',')
      .map((condition) => condition.trim())
      .filter(Boolean);

    try {
      await saveUserProfile({
        name: trimmedName,
        age: parsedAge,
        fitnessLevel,
        preferredIntensity,
        medicalConditions: conditions.length ? conditions : ['None'],
      });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      Alert.alert('Unable to save', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={colors.gradient.primary} style={styles.heroCard}>
            <Text style={styles.heroTitle}>
              Active<Text style={styles.heroTitleAccent}>Sense</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              AI-powered guidance and rewards to keep every generation moving.
            </Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>NUS Orbital 26 • Project Gemini</Text>
            </View>
          </LinearGradient>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personalize your experience</Text>
            <Text style={styles.sectionSubtitle}>
              Tell us a bit about you so we can tailor safe, effective workouts.
            </Text>

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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Medical conditions (optional)</Text>
              <TextInput
                value={medicalConditions}
                onChangeText={setMedicalConditions}
                placeholder="e.g. hypertension, knee pain"
                placeholderTextColor={colors.text.tertiary}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fitness level</Text>
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferred intensity</Text>
            <View style={styles.chipRow}>
              {intensityLevels.map((level) => (
                <TouchableOpacity
                  key={level}
                  onPress={() => setPreferredIntensity(level)}
                  style={[styles.chip, preferredIntensity === level && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, preferredIntensity === level && styles.chipTextActive]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LinearGradient colors={colors.gradient.primary} style={styles.cta}>
            <TouchableOpacity
              style={styles.ctaButton}
              disabled={!isFormReady}
              onPress={handleComplete}
            >
              <Text style={styles.ctaText}>Start your journey</Text>
            </TouchableOpacity>
          </LinearGradient>

          <Text style={styles.helperText}>
            You can update your profile anytime in the Profile tab.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.base },
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  heroTitle: { fontSize: 28, fontWeight: '700', color: '#fff' },
  heroTitleAccent: { color: '#E0F2FE' },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 8 },
  heroBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  heroBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  sectionSubtitle: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  inputGroup: { marginTop: 16 },
  inputLabel: { fontSize: 12, color: colors.text.secondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.background.card,
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
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary.teal, borderColor: colors.primary.teal },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  chipTextActive: { color: '#fff' },
  cta: { borderRadius: 9999, marginTop: 8 },
  ctaButton: { paddingVertical: 14, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  helperText: { fontSize: 11, color: colors.text.tertiary, textAlign: 'center', marginTop: 12 },
});
