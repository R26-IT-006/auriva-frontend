import './src/utils/polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  DMSans_900Black,
} from '@expo-google-fonts/dm-sans';
import AppNavigator from './src/navigation/AppNavigator';

// Apply DM Sans globally to every Text in the app
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: 'DMSans_400Regular' };

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
    DMSans_900Black,
  });

  // Configure the audio session once, for the whole app.
  //
  // This used to be set only inside playConceptAudio(), which just two concepts
  // ever reach (apple and banana are the only ones with a t1Audio file). Every
  // other sound — expo-speech prompts, Tier 3 videos, avatar greetings — played
  // against an unconfigured session, so on iOS the hardware silent switch muted
  // all of it and on Android playback could route to the earpiece.
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS:         false,
      playsInSilentModeIOS:       true,   // ignore the hardware mute switch
      shouldDuckAndroid:          false,
      playThroughEarpieceAndroid: false,  // force the loudspeaker
      staysActiveInBackground:    false,
    }).catch(() => {});
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
