import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { defaultStats, getStats, getUserProfile } from '../services/storage';
import { AvatarProfileConfig, UserProfile, UserStats } from '../types';

const defaultAvatarConfig: AvatarProfileConfig = {
  optionId: 'default',
  avatarUrl: '',
  label: 'Active Champion',
  accentColor: '#2dd4bf',
};

export default function AvatarShowcaseView() {
  const isFocused = useIsFocused();
  const webViewRef = useRef<WebView>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [isWebReady, setIsWebReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const webViewUrl = 'https://activesense.dpdns.org';

  useEffect(() => {
    let mounted = true;
    const loadInternalData = async () => {
      try {
        const [storedProfile, storedStats] = await Promise.all([
          getUserProfile(),
          getStats(),
        ]);

        if (mounted) {
          setProfile(storedProfile);
          setStats(storedStats);
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setLoading(false);
        }
        Alert.alert('Data Error', 'Could not load profile metrics for 3D showcase.');
      }
    };

    if (isFocused) {
      setLoading(true);
      setFailed(false);
      setIsWebReady(false);
      loadInternalData();
    }

    return () => {
      mounted = false;
    };
  }, [isFocused]);

  const activeConfig: AvatarProfileConfig = 
    profile && 'avatarConfig' in profile 
      ? (profile as any).avatarConfig 
      : defaultAvatarConfig;

  useEffect(() => {
    if (!loading && isWebReady && webViewRef.current && !failed) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'HYDRATE_STATE',
          payload: {
            profile,
            stats,
            avatarConfig: activeConfig,
            viewOnly: true,
          },
        })
      );
    }
  }, [profile, stats, loading, isWebReady, failed, activeConfig]);

  const onWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'WEB_READY') {
        setIsWebReady(true);
      }
    } catch (err) {
      console.error('Avatar Canvas interaction error:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#2dd4bf" />
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.container}>
        <View style={[styles.fallbackAvatar, { backgroundColor: activeConfig.accentColor }]}>
          <Feather name="user-check" size={34} color="#fff" />
        </View>
        <Text style={styles.fallbackTitle}>{activeConfig.label}</Text>
        <Text style={styles.fallbackCopy}>Default avatar active (Server offline)</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        onMessage={onWebViewMessage}
        style={styles.webview}
        originWhitelist={['*']}
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="hardware"
        containerStyle={{ backgroundColor: 'transparent' }}
        
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#2dd4bf" />
          </View>
        )}
        startInLoadingState={true}
      />
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
    backgroundColor: '#12101B',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  loader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#12101B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackAvatar: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  fallbackTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  fallbackCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
  },
});