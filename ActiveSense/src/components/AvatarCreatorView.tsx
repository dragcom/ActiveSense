import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { defaultAvatarConfig } from '../data/avatars';
import { AvatarProfileConfig } from '../types';
import { getAvatarCreatorUri, parseCreatorMessage } from '../services/avatarCreatorBridge';

type AvatarCreatorViewProps = {
  avatarConfig: AvatarProfileConfig;
  onAvatarSaved: (avatar: AvatarProfileConfig) => void;
  onScreenshot: (dataUrl: string) => void;
};

export default function AvatarCreatorView({
  avatarConfig,
  onAvatarSaved,
  onScreenshot,
}: AvatarCreatorViewProps) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const uri = useMemo(() => getAvatarCreatorUri('configurator'), []);
  const [hasCreatorFailed, setHasCreatorFailed] = useState(false);
  const [isCreatorReady, setIsCreatorReady] = useState(false);

  const hydratePayload = useMemo(
    () => JSON.stringify({ type: 'HYDRATE_STATE', payload: { avatarConfig, viewOnly: false } }),
    [avatarConfig],
  );

  const hydrateNativeWebView = () => {
    const escapedPayload = JSON.stringify(hydratePayload);
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', { data: JSON.parse(${escapedPayload}) }));
      true;
    `);
  };

  const hydrateWebFrame = () => {
    iframeRef.current?.contentWindow?.postMessage(hydratePayload, '*');
  };

  const handleCreatorMessage = (raw: unknown) => {
    const message = parseCreatorMessage(raw);
    if (!message) {
      return;
    }
    if (message.type === 'WEBVIEW_READY' || message.type === 'WEB_READY') {
      setIsCreatorReady(true);
      setHasCreatorFailed(false);
      if (Platform.OS === 'web') {
        hydrateWebFrame();
      } else {
        hydrateNativeWebView();
      }
      return;
    }
    if (message.type === 'SAVED_AVATAR') {
      onAvatarSaved(message.data);
      return;
    }
    if (message.type === 'CAPTURE_SCREENSHOT') {
      onScreenshot(message.data);
    }
  };

  useEffect(() => {
    if (isCreatorReady) {
      return undefined;
    }
    const timeoutId = setTimeout(() => setHasCreatorFailed(true), 8000);
    return () => clearTimeout(timeoutId);
  }, [isCreatorReady, uri]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }
    const listener = (event: MessageEvent) => handleCreatorMessage(event.data);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  if (hasCreatorFailed) {
    return (
      <View style={styles.fallbackContainer}>
        <View style={styles.fallbackIcon}>
          <Feather name="user-check" size={28} color="#fff" />
        </View>
        <Text style={styles.fallbackTitle}>Avatar creator unavailable</Text>
        <Text style={styles.fallbackCopy}>
          Continue with the default ActiveSense avatar, then update it later when the creator is available.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.fallbackButton}
          onPress={() => onAvatarSaved(defaultAvatarConfig)}
        >
          <Text style={styles.fallbackButtonText}>Use default avatar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {React.createElement('iframe', {
          ref: iframeRef,
          title: 'ActiveSense avatar creator',
          src: uri,
          onLoad: hydrateWebFrame,
          onError: () => setHasCreatorFailed(true),
          style: {
            width: '100%',
            height: '100%',
            border: 0,
            backgroundColor: '#12101B',
          },
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri }}
        onMessage={(event) => handleCreatorMessage(event.nativeEvent.data)}
        onError={() => setHasCreatorFailed(true)}
        onHttpError={() => setHasCreatorFailed(true)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Loading avatar creator...</Text>
          </View>
        )}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12101B' },
  webview: { flex: 1, backgroundColor: '#12101B' },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12101B',
  },
  loadingText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
    backgroundColor: '#12101B',
  },
  fallbackIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14B8A6',
  },
  fallbackTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  fallbackCopy: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  fallbackButton: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#14B8A6',
  },
  fallbackButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
