import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useLockLandscape } from '../../../../utils/useOrientationLock';

export default function WordVideoScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  const { student, theme, letter, videoSource } = route.params;
  const { width: screenW } = useWindowDimensions();

  const player = useVideoPlayer(videoSource, p => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      navigation.replace('WordWriting', { student, theme, letter });
    });
    return () => sub.remove();
  }, [player, navigation, student, theme, letter]);

  return (
    <>
      <StatusBar hidden />
      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <VideoView
          player={player}
          style={{ width: screenW, flex: 1 }}
          contentFit="contain"
          nativeControls={false}
        />
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
