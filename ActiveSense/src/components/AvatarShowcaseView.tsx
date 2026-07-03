import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import IosGlbAvatarView from './IosGlbAvatarView';
import { AvatarProfileConfig, UserProfile, UserStats } from '../types';

type AvatarShowcaseViewProps = {
  profile: UserProfile | null;
  stats: UserStats;
  avatarConfig: AvatarProfileConfig;
};

export default function AvatarShowcaseView({ avatarConfig }: AvatarShowcaseViewProps) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        <IosGlbAvatarView avatarConfig={avatarConfig} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.fallbackAvatar, { backgroundColor: avatarConfig.accentColor }]}>
        <Feather name="user-check" size={34} color="#fff" />
      </View>
      <Text style={styles.title}>{avatarConfig.label}</Text>
      <Text style={styles.copy}>Saved avatar ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 360,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: '#12101B',
  },
  fallbackAvatar: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  copy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
