import './src/utils/polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { BackgroundAudio } from './src/components/common/BackgroundAudio';

export default function App() {
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
