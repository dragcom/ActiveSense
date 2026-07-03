import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import IconBadge from '../components/IconBadge';
import { db } from '../services/database';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { Workout } from '../types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Workouts'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const fallbackGradient: [string, string] = ['#14B8A6', '#06B6D4'];

// Workouts can come from Supabase, so normalize every field before rendering UI.
const normalizeWorkout = (workout: Workout): Workout => ({
  ...workout,
  title: workout.title?.trim() || 'Untitled workout',
  duration: workout.duration?.trim() || '-- min',
  difficulty: workout.difficulty?.trim() || 'General',
  calories: workout.calories?.trim() || '-- cal',
  category: workout.category?.trim() || 'General',
  emoji: workout.emoji || 'activity',
  gradient:
    Array.isArray(workout.gradient) &&
    workout.gradient.length >= 2 &&
    workout.gradient.every((color) => /^#[0-9A-Fa-f]{6}$/.test(color))
      ? workout.gradient
      : fallbackGradient,
  description: workout.description?.trim() || 'Workout details will appear here once configured.',
  intensity: workout.intensity?.trim() || 'Low',
});

// Include categories and difficulty labels that actually exist in the loaded catalog.
const buildCategoryChips = (categories: string[], workouts: Workout[]) => {
  const labels = new Set<string>(['All']);
  categories.filter(Boolean).forEach((category) => labels.add(category));
  workouts.forEach((workout) => {
    labels.add(workout.category);
    labels.add(workout.difficulty);
  });
  return [...labels];
};

// WorkoutsScreen lets users search, filter, and start catalog workouts.
export default function WorkoutsScreen() {
  const navigation = useNavigation<NavigationProp>();
  // Filters are local UI state; the catalog itself is loaded from the db facade.
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutCategories, setWorkoutCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    // Load workout cards and category chips once when the screen mounts.
    const loadWorkouts = async () => {
      try {
        const [storedWorkouts, storedCategories] = await Promise.all([
          db.getWorkouts(),
          db.getWorkoutCategories(),
        ]);
        if (mounted) {
          const normalizedWorkouts = storedWorkouts.map(normalizeWorkout);
          setWorkouts(normalizedWorkouts);
          setWorkoutCategories(buildCategoryChips(storedCategories, normalizedWorkouts));
          setActiveCategory((current) =>
            buildCategoryChips(storedCategories, normalizedWorkouts).includes(current) ? current : 'All',
          );
          setLoadError(false);
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setLoadError(true);
          setLoading(false);
        }
        Alert.alert('Unable to load workouts', 'Please try again later.');
      }
    };

    loadWorkouts();

    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const filteredWorkouts = useMemo(() => {
    // Filtering stays memoized so typing in search does not recompute unrelated work.
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return workouts.filter((workout) => {
      const matchesCategory =
        activeCategory === 'All' ||
        workout.category === activeCategory ||
        workout.difficulty === activeCategory;
      const matchesSearch =
        !normalizedQuery ||
        workout.title.toLowerCase().includes(normalizedQuery) ||
        workout.description.toLowerCase().includes(normalizedQuery) ||
        workout.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, workouts]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(false);
    setReloadKey((current) => current + 1);
  };

  if (loading) {
    // Show a centered spinner while the catalog is being prepared.
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* Search narrows the visible workout cards by title. */}
        <Text style={styles.headerTitle}>Workouts</Text>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search workouts..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          ) : (
            <Feather name="sliders" size={18} color={colors.text.secondary} />
          )}
        </View>
      </View>

      {/* Category chips let users browse by workout category or difficulty. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {workoutCategories.map((category) => (
          <TouchableOpacity
            key={category}
            onPress={() => setActiveCategory(category)}
            style={[
              styles.categoryChip,
              activeCategory === category && styles.categoryChipActive,
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                activeCategory === category && styles.categoryTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.resultsCount}>
        {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''} found
      </Text>

      {/* Each workout card can launch a camera-tracked session. */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name={loadError ? 'refresh-cw' : 'database'} size={26} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>{loadError ? 'Unable to load workouts' : 'No workouts found'}</Text>
            <Text style={styles.emptyCopy}>
              {loadError
                ? 'Check Supabase setup, then retry. The local fallback catalog should keep this screen usable.'
                : 'Check your Supabase seed data or adjust the search filters.'}
            </Text>
            {loadError && (
              <TouchableOpacity style={styles.retryButton} onPress={retryLoad}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {filteredWorkouts.map((workout) => (
          <View key={workout.id} style={styles.workoutCard}>
            <LinearGradient
              colors={workout.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.workoutHeader}
            >
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{workout.category}</Text>
              </View>
              <IconBadge icon={workout.emoji} size={42} />
            </LinearGradient>
            <View style={styles.workoutBody}>
              <Text style={styles.workoutTitle}>{workout.title}</Text>
              <Text style={styles.workoutDescription}>{workout.description}</Text>
              <View style={styles.workoutMeta}>
                <View style={styles.metaItem}>
                  <Feather name="clock" size={14} color={colors.primary.teal} />
                  <Text style={styles.metaText}>{workout.duration}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="zap" size={14} color={colors.primary.teal} />
                  <Text style={styles.metaText}>{workout.calories}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="activity" size={14} color={colors.primary.teal} />
                  <Text style={styles.metaText}>{workout.difficulty}</Text>
                </View>
              </View>
              <LinearGradient colors={colors.gradient.primary} style={styles.workoutButton}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('WorkoutSession', { workoutId: workout.id })}
                  style={styles.workoutButtonInner}
                >
                  <Text style={styles.workoutButtonText}>Start Workout</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.base },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background.muted,
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text.primary },
  categoriesContainer: { flexGrow: 0 },
  categoriesContent: { paddingHorizontal: 20, gap: 8, paddingBottom: 6 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: { backgroundColor: colors.primary.teal, borderColor: colors.primary.teal },
  categoryText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  categoryTextActive: { color: '#fff' },
  resultsCount: {
    fontSize: 12,
    color: colors.text.secondary,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100, gap: 16 },
  workoutCard: {
    backgroundColor: colors.background.card,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  workoutHeader: {
    height: 120,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  workoutBody: { padding: 16 },
  workoutTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  workoutDescription: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  workoutMeta: { flexDirection: 'row', gap: 16, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.text.secondary },
  workoutButton: { borderRadius: 9999, marginTop: 16 },
  workoutButtonInner: { paddingVertical: 12, alignItems: 'center' },
  workoutButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  emptyCopy: { fontSize: 12, color: colors.text.secondary, textAlign: 'center' },
  retryButton: {
    marginTop: 10,
    borderRadius: 9999,
    backgroundColor: colors.primary.teal,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
