import { StyleSheet, Text, View } from 'react-native';
import PoseSkeletonOverlay from './PoseSkeletonOverlay';
import { PoseLandmark } from '../types';

type AvatarPoseOverlayProps = {
  landmarks: PoseLandmark[];
  avatarUrl?: string;
  mirrored?: boolean;
};

export default function AvatarPoseOverlay({
  landmarks,
  mirrored = true,
}: AvatarPoseOverlayProps) {
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
