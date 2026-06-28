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
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { db } from '../services/database';
import { RootStackParamList } from '../navigation/types';
import { Workout } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutCategories, setWorkoutCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadWorkouts = async () => {
      try {
        const [storedWorkouts, storedCategories] = await Promise.all([
          db.getWorkouts(),
          db.getWorkoutCategories(),
        ]);
        if (mounted) {
          setWorkouts(storedWorkouts);
          setWorkoutCategories(storedCategories);
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setLoading(false);
        }
        Alert.alert('Unable to load workouts', 'Please try again later.');
      }
    };

    loadWorkouts();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      const matchesCategory =
        activeCategory === 'All' ||
        workout.category === activeCategory ||
        workout.difficulty === activeCategory;
      const matchesSearch = workout.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  if (loading) {
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={styles.workoutEmoji}>{workout.emoji}</Text>
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
                  onPress={() =>
                    navigation.navigate('WorkoutSession', { workoutId: workout.id })
                  }
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
  workoutEmoji: { fontSize: 48 },
  workoutBody: { padding: 16 },
  workoutTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  workoutDescription: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  workoutMeta: { flexDirection: 'row', gap: 16, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.text.secondary },
  workoutButton: { borderRadius: 9999, marginTop: 16 },
  workoutButtonInner: { paddingVertical: 12, alignItems: 'center' },
  workoutButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
