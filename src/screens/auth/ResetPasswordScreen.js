import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { authApi } from '../../api/auth';
import { validatePassword } from '../../utils/validation';

function Requirement({ met, label }) {
  return (
    <View style={styles.reqRow}>
      <View style={[styles.reqDot, met && styles.reqDotMet]}>
        {met && <Ionicons name="checkmark" size={10} color="#fff" />}
      </View>
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{label}</Text>
    </View>
  );
}

export default function ResetPasswordScreen({ navigation, route }) {
  const { resetToken } = route.params;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { rules } = validatePassword(newPassword);

  function validate() {
    const e = {};
    if (!newPassword) {
      e.newPassword = 'Password is required';
    } else if (!validatePassword(newPassword).isValid) {
      e.newPassword = 'Password does not meet all requirements';
    }
    if (!confirmPassword) {
      e.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleReset() {
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, newPassword);
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. Please log in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark-outline" size={40} color={Colors.primary} />
            </View>
          </View>

          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>
            Choose a strong password for your account.
          </Text>

          <View style={styles.formCard}>
            <Input
              label="New Password"
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setErrors((e) => ({ ...e, newPassword: null })); }}
              placeholder="Enter new password"
              secureTextEntry
              error={errors.newPassword}
            />

            <View style={styles.requirements}>
              <Text style={styles.reqTitle}>SECURITY REQUIREMENTS</Text>
              <Requirement met={rules.minLength} label="8 or more characters" />
              <Requirement met={rules.hasUppercase} label="At least one uppercase letter" />
              <Requirement met={rules.hasLowercase} label="At least one lowercase letter" />
              <Requirement met={rules.hasNumber} label="At least one number" />
              <Requirement met={rules.hasSpecial} label="At least one special character" />
            </View>

            <Input
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: null })); }}
              placeholder="Repeat your password"
              secureTextEntry
              error={errors.confirmPassword}
              style={{ marginTop: Layout.spacing.sm }}
            />

            <Button
              title="Reset Password"
              onPress={handleReset}
              loading={loading}
              style={styles.btn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  iconSection: {
    alignItems: 'center',
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  title: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: Layout.fontWeight.extrabold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Layout.spacing.lg,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.md,
  },
  requirements: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reqTitle: {
    fontSize: 10,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.muted,
    letterSpacing: 1.2,
    marginBottom: Layout.spacing.sm,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reqDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Layout.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqDotMet: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  reqText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
  },
  reqTextMet: {
    color: Colors.text.secondary,
  },
  btn: { marginTop: Layout.spacing.md },
});
