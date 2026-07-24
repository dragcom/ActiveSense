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
  '🛒': 'shopping-cart',
  '🍔': 'coffee',
  '💊': 'plus-circle',
  '⚽': 'activity',
  '🔥': 'zap',
  '💯': 'award',
  '🏆': 'award',
  activity: 'activity',
  heart: 'heart',
  pushup: 'activity',
  squat: 'chevrons-down',
  lunge: 'corner-down-right',
  sit_to_stand: 'arrow-up',
  hip_extension: 'corner-up-left',
  side_leg_raise: 'move',
  single_leg_stand: 'shield',
  march: 'repeat',
  quad_stretch: 'corner-down-left',
  triceps_stretch: 'maximize-2',
};

// Category names can also request icons when there is no direct emoji match.
const categoryMap: Record<string, FeatherName> = {
  Food: 'coffee',
  Groceries: 'shopping-cart',
  Health: 'plus-circle',
  'Healthy Ageing': 'heart',
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
