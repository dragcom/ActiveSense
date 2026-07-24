import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { getAvatarCreatorUri } from '../services/avatarCreatorBridge';
import { PoseLandmark } from '../types';

export type WorkoutAvatarWebViewHandle = {
  sendPoseFrame: (landmarks: PoseLandmark[]) => void;
};

type Props = {
  onFailed?: () => void;
  onReady?: () => void;
  style?: StyleProp<ViewStyle>;
};

const INJECTED_LOG_BRIDGE = `
  (function() {
    function send(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data }));
      }
    }

    ['log', 'warn', 'error'].forEach(function(level) {
      var original = console[level];
      console[level] = function() {
        original.apply(console, arguments);
        var message = Array.from(arguments).map(function(value) {
          try {
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
          } catch (error) {
            return String(value);
          }
        }).join(' ');
        send('CONSOLE_' + level.toUpperCase(), message);
      };
    });

    setTimeout(function() {
      send('WEBVIEW_DIAGNOSTICS', {
        isSecureContext: window.isSecureContext,
        currentOrigin: window.location.origin,
        userAgent: navigator.userAgent
      });
    }, 1500);
  })();
  true;
`;

const WorkoutAvatarWebView = forwardRef<WorkoutAvatarWebViewHandle, Props>(
  ({ onFailed, onReady, style }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const isReadyRef = useRef(false);
    const source = useMemo(
      () => ({
        uri: process.env.EXPO_PUBLIC_AVATAR_CREATOR_URL_LIVE ?? getAvatarCreatorUri('live'),
      }),
      [],
    );
    const injectedLogBridge = process.env.NODE_ENV === 'production' ? 'true;' : INJECTED_LOG_BRIDGE;

    useImperativeHandle(ref, () => ({
      sendPoseFrame: (landmarks) => {
        if (!isReadyRef.current || !webViewRef.current || landmarks.length === 0) {
          return;
        }
        const payload = JSON.stringify({
          type: 'LIVE_POSE',
          joints: landmarks.slice(0, 33),
        });
        webViewRef.current.injectJavaScript(
          `if (window.receiveRNMessage) { window.receiveRNMessage(${payload}); } true;`,
        );
      },
    }), []);

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message?.type === 'WEBVIEW_READY') {
          isReadyRef.current = true;
          onReady?.();
          return;
        }
        if (message?.type === 'LIVE_POSE_ACK') {
          return;
        }
        if (
          message?.type === 'CONSOLE_LOG' ||
          message?.type === 'CONSOLE_WARN' ||
          message?.type === 'CONSOLE_ERROR'
        ) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Workout avatar ${message.type}]`, message.data);
          }
          return;
        }
        if (message?.type === 'WEBVIEW_DIAGNOSTICS' && process.env.NODE_ENV !== 'production') {
          console.log('[Workout avatar diagnostics]', message.data);
        }
      } catch {
        // Ignore non-JSON messages emitted by the hosted avatar page.
      }
    }, [onReady]);

    const handleFailure = useCallback(() => {
      isReadyRef.current = false;
      onFailed?.();
    }, [onFailed]);

    const handleLoaded = useCallback(() => {
      if (!isReadyRef.current) {
        isReadyRef.current = true;
        onReady?.();
      }
    }, [onReady]);

    return (
      <WebView
        ref={webViewRef}
        source={source}
        onMessage={handleMessage}
        onLoadEnd={handleLoaded}
        onError={handleFailure}
        onHttpError={handleFailure}
        scrollEnabled={false}
        mediaCapturePermissionGrantType="grant"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injectedLogBridge}
        containerStyle={{ backgroundColor: 'transparent' }}
        style={style}
      />
    );
  },
);

WorkoutAvatarWebView.displayName = 'WorkoutAvatarWebView';

export default WorkoutAvatarWebView;
