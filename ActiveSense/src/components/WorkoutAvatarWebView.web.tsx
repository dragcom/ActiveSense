import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { getAvatarCreatorUri } from '../services/avatarCreatorBridge';
import { PoseLandmark } from '../types';
import type { WorkoutAvatarWebViewHandle } from './WorkoutAvatarWebView';

type Props = {
  onFailed?: () => void;
  onReady?: () => void;
  style?: StyleProp<ViewStyle>;
};

const WorkoutAvatarWebView = forwardRef<WorkoutAvatarWebViewHandle, Props>(
  ({ onFailed, onReady, style }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const source = useMemo(
      () => process.env.EXPO_PUBLIC_AVATAR_CREATOR_URL_LIVE ?? getAvatarCreatorUri('live'),
      [],
    );
    const sourceOrigin = useMemo(() => new URL(source).origin, [source]);

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow || event.origin !== sourceOrigin) {
          return;
        }
        const message = typeof event.data === 'string'
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch {
                return null;
              }
            })()
          : event.data;
        if (message?.type === 'WEBVIEW_READY') {
          onReady?.();
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [onReady, sourceOrigin]);

    useImperativeHandle(ref, () => ({
      sendPoseFrame: (landmarks: PoseLandmark[]) => {
        const targetWindow = iframeRef.current?.contentWindow;
        if (!targetWindow || landmarks.length === 0) {
          return;
        }
        const payload = {
          type: 'LIVE_POSE',
          joints: landmarks.slice(0, 33),
        };
        try {
          const receiveRNMessage = (targetWindow as Window & {
            receiveRNMessage?: (message: typeof payload) => void;
          }).receiveRNMessage;
          if (typeof receiveRNMessage === 'function') {
            receiveRNMessage(payload);
            return;
          }
        } catch {
          // Cross-origin frames cannot call receiveRNMessage directly.
        }
        targetWindow.postMessage(payload, sourceOrigin);
      },
    }), [sourceOrigin]);

    return (
      <View style={[styles.container, style]}>
        {/*
          The hosted renderer is cross-origin in production, so web uses postMessage.
          Native WebViews continue to use the partner's receiveRNMessage bridge.
        */}
        {React.createElement('iframe', {
          ref: iframeRef,
          src: source,
          title: 'ActiveSense workout avatar',
          allow: 'camera',
          onLoad: onReady,
          onError: onFailed,
          style: {
            border: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
          },
        })}
      </View>
    );
  },
);

WorkoutAvatarWebView.displayName = 'WorkoutAvatarWebView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default WorkoutAvatarWebView;
