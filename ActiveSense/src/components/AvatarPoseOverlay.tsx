import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import IosGlbAvatarView from './IosGlbAvatarView';
import PoseSkeletonOverlay from './PoseSkeletonOverlay';
import { defaultAvatarConfig } from '../data/avatars';
import { PoseLandmark } from '../types';

// Native avatar rendering uses the iOS GLB renderer where available.
type AvatarPoseOverlayProps = {
  landmarks: PoseLandmark[];
  avatarUrl?: string;
  mirrored?: boolean;
};

export default function AvatarPoseOverlay({
  landmarks,
  avatarUrl,
  mirrored = true,
}: AvatarPoseOverlayProps) {
  if (Platform.OS === 'ios') {
    const avatarConfig = {
      ...defaultAvatarConfig,
      avatarUrl: avatarUrl || defaultAvatarConfig.avatarUrl,
    };

    return (
      <View style={styles.overlay} pointerEvents="none">
        <PoseSkeletonOverlay landmarks={landmarks} mirrored={mirrored} />
        <IosGlbAvatarView
          avatarConfig={avatarConfig}
          autoRotate={false}
          landmarks={landmarks}
          mirrored={mirrored}
          showStatus={false}
          transparent
        />
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>
            {landmarks.length === 33 ? 'Avatar + 33-point pose live' : 'Avatar waiting for full pose'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay} pointerEvents="none">
      <PoseSkeletonOverlay landmarks={landmarks} mirrored={mirrored} />
      <View style={styles.statusPill}>
        <Text style={styles.statusText}>Skeleton tracking</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  statusPill: {
    position: 'absolute',
    left: 12,
    top: 12,
    maxWidth: '78%',
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
