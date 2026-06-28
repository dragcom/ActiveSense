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

export default function AppNavigator({ initialRouteName }: Props) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="AuthLanding" component={AuthLandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="InfoPage" component={InfoPageScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="WorkoutSession"
          component={WorkoutSessionScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
