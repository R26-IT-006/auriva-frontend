import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SetPasswordScreen from '../screens/auth/SetPasswordScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTitleStyle: {
          fontWeight: Layout.fontWeight.bold,
          color: Colors.text.primary,
          fontSize: Layout.fontSize.lg,
        },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SetPassword"
        component={SetPasswordScreen}
        options={{ title: 'Update Password', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Forgot Password', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="OtpVerification"
        component={OtpVerificationScreen}
        options={{ title: 'Verify OTP', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Reset Password', headerBackTitle: '', headerBackVisible: false }}
      />
    </Stack.Navigator>
  );
}
