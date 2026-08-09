import './src/utils/polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import AppNavigator from './src/navigation/AppNavigator';
import { BackgroundAudio } from './src/components/common/BackgroundAudio';

// Apply Nunito globally to every Text in the app
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: 'Nunito_400Regular' };

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <BackgroundAudio />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
