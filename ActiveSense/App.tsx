import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { hasCompletedOnboarding } from './src/services/storage';
import { colors } from './src/theme/colors';
import { RootStackParamList } from './src/navigation/types';

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Onboarding');
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOnboardingState = async () => {
    setIsReady(false);
    setLoadError(null);
    try {
      const completed = await hasCompletedOnboarding();
      setInitialRoute(completed ? 'Main' : 'Onboarding');
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
