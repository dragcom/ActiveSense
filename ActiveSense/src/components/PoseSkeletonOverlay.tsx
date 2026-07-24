import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { PoseLandmark } from '../types';
import { clampUnit, getVisibility, POSE_CONNECTIONS } from '../utils/poseRig';

// PoseSkeletonOverlay draws the original MediaPipe stick figure over the camera preview.
type PoseSkeletonOverlayProps = {
  landmarks: PoseLandmark[];
  mirrored?: boolean;
};

type Size = {
  width: number;
  height: number;
};

const MIN_VISIBILITY = 0.35;

export default function PoseSkeletonOverlay({
  landmarks,
  mirrored = false,
}: PoseSkeletonOverlayProps) {
  // The overlay needs its rendered size to convert normalized pose points into pixels.
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  // Convert the 33 normalized landmarks into screen-space points for native Views.
  const points = useMemo(() => {
    if (landmarks.length !== 33 || !size.width || !size.height) {
      return [];
    }
    return landmarks.map((landmark) => ({
      x: (mirrored ? 1 - clampUnit(landmark.x) : clampUnit(landmark.x)) * size.width,
      y: clampUnit(landmark.y) * size.height,
      visibility: getVisibility(landmark),
    }));
  }, [landmarks, mirrored, size.height, size.width]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={handleLayout}>
      {/* Bones are thin rotated Views drawn between connected landmarks. */}
      {POSE_CONNECTIONS.map(([from, to]) => {
        const start = points[from];
        const end = points[to];
        if (!start || !end || start.visibility < MIN_VISIBILITY || end.visibility < MIN_VISIBILITY) {
          return null;
        }
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = `${Math.atan2(dy, dx)}rad`;
        return (
          <View
            key={`${from}-${to}`}
            style={[
              styles.bone,
              {
                width: length,
                left: start.x,
                top: start.y,
                transform: [{ rotate: angle }],
              },
            ]}
          />
        );
      })}
      {/* Joints sit on top of bones so the detected points stay visible. */}
      {points.map((point, index) => {
        if (point.visibility < 0.25) {
          return null;
        }
        const radius = index <= 10 ? 3.5 : 4.5;
        return (
          <View
            key={index}
            style={[
              styles.joint,
              {
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
                left: point.x - radius,
                top: point.y - radius,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(45, 212, 191, 0.92)',
    transformOrigin: '0px 2px',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  joint: {
    position: 'absolute',
    backgroundColor: '#14B8A6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
