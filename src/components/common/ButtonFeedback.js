import React, { useRef } from "react";
import { Animated, TouchableOpacity } from "react-native";
import { Audio } from "expo-av";

const CLICK_SOUND_ASSET = require("../../../assets/click.wav");
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

let sharedClickSound = null;
let sharedClickSoundPromise = null;

async function ensureAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  });
}

async function getClickSound() {
  if (sharedClickSound) {
    return sharedClickSound;
  }

  if (!sharedClickSoundPromise) {
    sharedClickSoundPromise = Audio.Sound.createAsync(CLICK_SOUND_ASSET, {
      shouldPlay: false,
      volume: 0.45,
    }).then(({ sound }) => {
      sharedClickSound = sound;
      sharedClickSoundPromise = null;
      return sound;
    });
  }

  return sharedClickSoundPromise;
}

export async function playClickSound() {
  try {
    await ensureAudioMode();
    const sound = await getClickSound();

    await sound.stopAsync().catch(() => {});
    await sound.setPositionAsync(0).catch(() => {});
    await sound.playAsync();

    return sound;
  } catch (error) {
    console.log("Click sound playback error:", error);
    return null;
  }
}

export function ButtonFeedback({
  children,
  onPress,
  style,
  activeOpacity = 1,
  disabled = false,
  soundEnabled = true,
  hitSlop,
  ...touchableProps
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 5,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  function handlePress(event) {
    if (disabled || !onPress) {
      return;
    }

    if (soundEnabled) {
      playClickSound();
    }
    onPress?.(event);
  }

  return (
    <AnimatedTouchableOpacity
      style={[style, { transform: [{ scale }] }]}
      activeOpacity={activeOpacity}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      {...touchableProps}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}
