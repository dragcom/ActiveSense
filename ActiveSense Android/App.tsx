import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { hasCompletedOnboarding } from './src/services/storage';
import { colors } from './src/theme/colors';
import { RootStackParamList } from './src/navigation/types';
import { NavigationBar } from 'expo-navigation-bar';

// App is the root component that decides whether to show onboarding or the main tabs.
export default function App() {
  const hasWorkoutTestRoute =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('workoutSession') === '1';
  // The first route depends on whether this device has completed onboarding before.
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>(
    hasWorkoutTestRoute ? 'WorkoutSession' : 'AuthLanding',
  );
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Read the local onboarding flag before rendering navigation.
  const loadOnboardingState = async () => {
    setIsReady(false);
    setLoadError(null);
    try {
      if (hasWorkoutTestRoute) {
        setInitialRoute('WorkoutSession');
        return;
      }
      const completed = await hasCompletedOnboarding();
      setInitialRoute(completed ? 'Main' : 'AuthLanding');
    } catch (error) {
      setLoadError('Unable to load app data.');
    } finally {
      setIsReady(true);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setHidden(true);
    }
  }, []);
  
  useEffect(() => {
    // Run once when the app opens so navigation starts in the right place.
    loadOnboardingState();
  }, []);

  if (!isReady) {
    // Keep the app calm while AsyncStorage is being checked.
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.teal} />
      </View>
    );
  }

  if (loadError) {
    // Give the user a simple retry path if local app data cannot be read.
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>We hit a snag</Text>
        <Text style={styles.errorMessage}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadOnboardingState}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {/* The navigator owns all screens after startup chooses the first route. */}
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.base} />
      <AppNavigator initialRouteName={initialRoute} />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
  errorMessage: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginTop: 8 },
  retryButton: {
    marginTop: 16,
    backgroundColor: colors.primary.teal,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
