import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar'; 
import AppNavigator from './src/navigation/AppNavigator';
import { hasCompletedOnboarding } from './src/services/storage';
import { colors } from './src/theme/colors';
import { RootStackParamList } from './src/navigation/types';

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('AuthLanding');
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const configureNavigationBar = async () => {
        try {
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
        } catch (error) {
          console.warn('Failed to configure navigation bar:', error);
        }
      };
      configureNavigationBar();
    }
  }, []);

  const loadOnboardingState = async () => {
    setIsReady(false);
    setLoadError(null);
    try {
      const completed = await hasCompletedOnboarding();
      setInitialRoute(completed ? 'Main' : 'AuthLanding');
    } catch (error) {
      setLoadError('Unable to load app data.');
    } finally {
      setIsReady(true);
    }
  };

  useEffect(() => {
    loadOnboardingState();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.teal} />
      </View>
    );
  }

  if (loadError) {
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