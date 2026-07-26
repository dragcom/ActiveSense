import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import AuthLandingScreen from '../screens/AuthLandingScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RewardRedemptionScreen from '../screens/RewardRedemptionScreen';
import WorkoutSessionScreen from '../screens/WorkoutSessionScreen';
import AccountSettingsScreen from '../screens/AccountSettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import { RootStackParamList } from './types';
import { colors } from '../theme/colors';

type Props = {
  initialRouteName: keyof RootStackParamList;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// This stack controls top-level app flow: auth, onboarding, tabs, settings, and workout sessions.
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
        <Stack.Screen name="RewardRedemption" component={RewardRedemptionScreen} />

        {/* MainTabs contains the everyday app sections. */}
        <Stack.Screen name="Main" component={MainTabs} />

        {/* Profile Settings & Sub-Screens */}
        <Stack.Screen 
          name="AccountSettings" 
          component={AccountSettingsScreen} 
          options={{ 
            headerShown: true, 
            title: 'Account Settings',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background.base },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { fontWeight: '700' },
          }} 
        />
        <Stack.Screen 
          name="Notifications" 
          component={NotificationsScreen} 
          options={{ 
            headerShown: true, 
            title: 'Notifications',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background.base },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { fontWeight: '700' },
          }} 
        />
        <Stack.Screen 
          name="HelpSupport" 
          component={HelpSupportScreen} 
          options={{ 
            headerShown: true, 
            title: 'Help & Support',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background.base },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { fontWeight: '700' },
          }} 
        />

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