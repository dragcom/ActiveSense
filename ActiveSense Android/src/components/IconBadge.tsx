import React, { ComponentProps } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

// IconBadge turns stored emoji/category labels into Feather icons for consistent UI.
type FeatherName = ComponentProps<typeof Feather>['name'];

type IconBadgeProps = {
  icon?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

// Workout and reward data still store simple emoji labels, so this maps them to icons.
const iconMap: Record<string, FeatherName> = {
  '🧘': 'wind',
  '🪑': 'grid',
  '🚶': 'navigation',
  '🧠': 'cpu',
  '⚖️': 'sliders',
  '⚡': 'zap',
  '🎯': 'target',
  '🌙': 'moon',
  '🛒': 'shopping-cart',
  '🍔': 'coffee',
  '💊': 'plus-circle',
  '⚽': 'activity',
  '🔥': 'zap',
  '💯': 'award',
  '🏆': 'award',
  'arm-raise': 'arrow-up-circle',
  pushup: 'activity',
  seated: 'grid',
  'side-leg-lift': 'trending-up',
  situp: 'repeat',
  squat: 'chevrons-down',
  standing: 'user',
  stretch: 'wind',
};

// Category names can also request icons when there is no direct emoji match.
const categoryMap: Record<string, FeatherName> = {
  Balance: 'sliders',
  Cardio: 'heart',
  Flexibility: 'wind',
  Food: 'coffee',
  Groceries: 'shopping-cart',
  Health: 'plus-circle',
  Mindfulness: 'moon',
  Sports: 'activity',
  Strength: 'activity',
};

export default function IconBadge({
  icon,
  size = 28,
  color = '#fff',
  style,
}: IconBadgeProps) {
  // Fallback to "activity" so missing catalog data still renders a safe icon.
  const name = (icon && (iconMap[icon] ?? categoryMap[icon])) || 'activity';
  return (
    <View style={[styles.badge, style]}>
      <Feather name={name} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
