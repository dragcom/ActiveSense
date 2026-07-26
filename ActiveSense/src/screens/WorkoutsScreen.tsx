import { useEffect, useMemo, useState } from 'react';
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import IconBadge from '../components/IconBadge';
import { calculateWorkoutMatch, db } from '../services/database';
import { getUserProfile } from '../services/storage';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { UserProfile, Workout } from '../types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Workouts'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// Limit the 'For You' tab to only show the top 3 best matches
const TOP_RECOMMENDATIONS_LIMIT = 3;
// Strict threshold: Must be an 80%+ match to be recommended
const STRICT_RECOMMENDATION_THRESHOLD = 80;

const fallbackGradient: [string, string] = ['#14B8A6', '#06B6D4'];

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

const buildCategoryChips = (categories: string[], workouts: Workout[]) => {
  const labels = new Set<string>(['For You', 'All']);
  categories.filter(Boolean).forEach((category) => labels.add(category));
  workouts.forEach((workout) => {
    labels.add(workout.category);
    labels.add(workout.difficulty);
  });
  return [...labels];
};

export default function WorkoutsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeCategory, setActiveCategory] = useState('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [workoutCategories, setWorkoutCategories] = useState<string[]>(['For You', 'All']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadWorkoutsAndProfile = async () => {
      try {
        const [storedWorkouts, storedCategories, profile] = await Promise.all([
          db.getWorkouts(),
          db.getWorkoutCategories(),
          getUserProfile(),
        ]);
        if (mounted) {
          const normalizedWorkouts = storedWorkouts.map(normalizeWorkout);
          setWorkouts(normalizedWorkouts);
          setUserProfile(profile);
          setWorkoutCategories(buildCategoryChips(storedCategories, normalizedWorkouts));
          setActiveCategory((current) =>
            buildCategoryChips(storedCategories, normalizedWorkouts).includes(current)
              ? current
              : 'For You'
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

    loadWorkoutsAndProfile();

    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  // Sort workouts from highest score to lowest score using database's central scoring function
  const scoredWorkouts = useMemo(() => {
    return workouts
      .map((workout) => {
        const { score, reason } = calculateWorkoutMatch(workout, userProfile);
        return { workout, score, reason };
      })
      .sort((a, b) => b.score - a.score);
  }, [workouts, userProfile]);

  const filteredWorkouts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    let list = scoredWorkouts;

    // Strict filtering for 'For You' tab
    if (activeCategory === 'For You') {
      list = scoredWorkouts
        .filter((item) => item.score >= STRICT_RECOMMENDATION_THRESHOLD) // Must meet strict threshold
        .slice(0, TOP_RECOMMENDATIONS_LIMIT); // Take only top few
    } else if (activeCategory !== 'All') {
      list = scoredWorkouts.filter(
        (item) =>
          item.workout.category === activeCategory ||
          item.workout.difficulty === activeCategory
      );
    }

    return list.filter(({ workout }) => {
      return (
        !normalizedQuery ||
        workout.title.toLowerCase().includes(normalizedQuery) ||
        workout.description.toLowerCase().includes(normalizedQuery) ||
        workout.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeCategory, searchQuery, scoredWorkouts]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(false);
    setReloadKey((current) => current + 1);
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
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
            {category === 'For You' ? (
              <Ionicons
                name="sparkles"
                size={12}
                color={activeCategory === 'For You' ? '#fff' : colors.primary.teal}
                style={{ marginRight: 4 }}
              />
            ) : null}
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
        {`${filteredWorkouts.length} workout${filteredWorkouts.length !== 1 ? 's' : ''} found`}
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredWorkouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name={loadError ? 'refresh-cw' : 'slash'} size={26} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>
              {loadError
                ? 'Unable to load workouts'
                : activeCategory === 'For You'
                ? 'No strict matches found'
                : 'No workouts found'}
            </Text>
            <Text style={styles.emptyCopy}>
              {loadError
                ? 'Check Supabase setup, then retry.'
                : activeCategory === 'For You'
                ? 'No workouts strictly matched both your fitness level and intensity preferences. Check the "All" tab to browse all workouts.'
                : 'Check your search filters or catalog.'}
            </Text>
            {loadError ? (
              <TouchableOpacity style={styles.retryButton} onPress={retryLoad}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {filteredWorkouts.map(({ workout, score, reason }) => {
          const isBestMatch = score >= STRICT_RECOMMENDATION_THRESHOLD;

          return (
            <View key={workout.id} style={styles.workoutCard}>
              <LinearGradient
                colors={workout.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.workoutHeader}
              >
                <View style={styles.badgeRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{workout.category}</Text>
                  </View>

                  {/* Render 'Best Match' badge ONLY if it meets strict threshold */}
                  {isBestMatch ? (
                    <View style={styles.recommendedBadge}>
                      <Ionicons name="sparkles" size={10} color="#fff" />
                      <Text style={styles.recommendedBadgeText}>Best Match</Text>
                    </View>
                  ) : null}
                </View>
                <IconBadge icon={workout.emoji} size={42} />
              </LinearGradient>

              <View style={styles.workoutBody}>
                <Text style={styles.workoutTitle}>{workout.title}</Text>
                <Text style={styles.workoutDescription}>{workout.description}</Text>

                {Boolean(userProfile && reason) ? (
                  <View style={styles.reasonCard}>
                    <Feather name="check-circle" size={12} color={colors.primary.teal} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ) : null}

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
          );
        })}
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
    flexDirection: 'row',
    alignItems: 'center',
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
  scrollContent: { padding: 20, paddingBottom: 32, gap: 16 },
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
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  recommendedBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  workoutBody: { padding: 16 },
  workoutTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  workoutDescription: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFEFF',
    borderColor: '#CCFBF1',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
  },
  reasonText: { fontSize: 11, fontWeight: '600', color: colors.primary.teal, flexShrink: 1 },
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