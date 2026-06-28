import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import AuthLandingScreen from '../screens/AuthLandingScreen';
import LoginScreen from '../screens/LoginScreen';
import InfoPageScreen from '../screens/InfoPageScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import WorkoutSessionScreen from '../screens/WorkoutSessionScreen';
import { RootStackParamList } from './types';

type Props = {
  initialRouteName: keyof RootStackParamList;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// This stack controls top-level app flow: auth, onboarding, tabs, and workout sessions.
export default function AppNavigator({ initialRouteName }: Props) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false }}
      >
        {/* Auth and setup screens are shown before the user reaches the main app. */}
        <Stack.Screen name="AuthLanding" component={AuthLandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="InfoPage" component={InfoPageScreen} />
        {/* MainTabs contains the four everyday app sections. */}
        <Stack.Screen name="Main" component={MainTabs} />
        {/* Workout sessions take over the whole screen for camera-first tracking. */}
        <Stack.Screen
          name="WorkoutSession"
          component={WorkoutSessionScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
