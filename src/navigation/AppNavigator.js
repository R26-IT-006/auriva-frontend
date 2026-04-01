import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import PrincipalNavigator from './PrincipalNavigator';
import TeacherNavigator from './TeacherNavigator';
import SetPasswordScreen from '../screens/auth/SetPasswordScreen';
import { Colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

function SetPasswordStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  const needsPasswordSetup =
    isAuthenticated && user?.role === 'teacher' && user?.is_first_login === true;

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : needsPasswordSetup ? (
        <SetPasswordStack />
      ) : user?.role === 'principal' ? (
        <PrincipalNavigator />
      ) : (
        <TeacherNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
