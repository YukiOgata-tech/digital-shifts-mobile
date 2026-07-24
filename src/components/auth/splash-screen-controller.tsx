import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  useWindowDimensions,
  View,
} from 'react-native';

import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { appSpacing } from '@/constants/app-theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 180, fade: true });

type Props = {
  appReady: boolean;
  onComplete: () => void;
};

export function AppLaunchScreen({ appReady, onComplete }: Props) {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [visualComplete, setVisualComplete] = useState(false);
  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
  const nativeSplashHidden = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const size = Math.min(512, width * 0.9, height * 0.58);
  const player = useVideoPlayer(
    require('../../../assets/videos/dmise-launch.mp4'),
    (instance) => {
      instance.loop = false;
      instance.muted = true;
      instance.keepScreenOnWhilePlaying = false;
      instance.allowsExternalPlayback = false;
      instance.staysActiveInBackground = false;
    },
  );

  const revealLaunchScreen = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync();
  }, []);

  useEventListener(player, 'playToEnd', () => {
    setVisualComplete(true);
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status !== 'error') return;
    console.warn('Launch animation playback failed:', error?.message ?? 'unknown error');
    revealLaunchScreen();
    setVisualComplete(true);
  });

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {
        if (active) setReduceMotion(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      player.pause();
      revealLaunchScreen();
      const timer = setTimeout(() => setVisualComplete(true), 450);
      return () => clearTimeout(timer);
    }
    player.currentTime = 0;
    player.play();
  }, [player, reduceMotion, revealLaunchScreen]);

  useEffect(() => {
    if (reduceMotion !== false || visualComplete) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        player.play();
      } else {
        player.pause();
      }
    });
    return () => subscription.remove();
  }, [player, reduceMotion, visualComplete]);

  useEffect(() => {
    const timer = setTimeout(() => {
      revealLaunchScreen();
      setVisualComplete(true);
    }, 8_000);
    return () => clearTimeout(timer);
  }, [revealLaunchScreen]);

  useEffect(() => {
    if (!appReady || !visualComplete) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: reduceMotion ? 0 : 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onComplete();
    });
  }, [appReady, onComplete, opacity, reduceMotion, visualComplete]);

  return (
    <Animated.View
      accessibilityViewIsModal
      accessibilityLabel="Dミセを起動しています"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1000,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        opacity,
      }}>
      {reduceMotion ? (
        <Image
          source={require('../../../assets/images/brand/dmise-logo.png')}
          contentFit="contain"
          style={{ width: Math.min(180, width * 0.38), aspectRatio: 1 }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
          }}>
          <Image
            source={require('../../../assets/images/brand/dmise-logo.png')}
            contentFit="contain"
            style={{
              position: 'absolute',
              width: size * 0.32,
              height: size * 0.32,
            }}
          />
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="contain"
            allowsPictureInPicture={false}
            allowsVideoFrameAnalysis={false}
            onFirstFrameRender={() => {
              if (firstFrameRendered) return;
              setFirstFrameRendered(true);
              revealLaunchScreen();
            }}
            style={{ width: size, height: size, backgroundColor: '#FFFFFF' }}
          />
        </View>
      )}

      {visualComplete && !appReady ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: Math.max(36, height * 0.08),
            alignItems: 'center',
            gap: appSpacing.sm,
          }}>
          <LoadingIndicator label="アカウントを確認しています…" compact />
        </View>
      ) : null}
    </Animated.View>
  );
}
