import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { ButtonFeedback } from "../../components/common/ButtonFeedback";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { authApi } from '../../api/auth';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export default function OtpVerificationScreen({ navigation, route }) {
  const { email } = route.params;
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleOtpChange(value, index) {
    // Only accept digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(e, index) {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e, index) {
    const text = e.nativeEvent.text;
    if (/^\d{6}$/.test(text)) {
      setOtp(text.split(''));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      Alert.alert('Incomplete OTP', 'Please enter all 6 digits.');
      return;
    }
    setLoading(true);
    try {
      const { reset_token } = await authApi.verifyOtp(email, code);
      navigation.navigate('ResetPassword', { resetToken: reset_token });
    } catch (err) {
      Alert.alert('Invalid OTP', err.message || 'The OTP is incorrect or has expired.');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await authApi.forgotPassword(email);
      setCountdown(RESEND_COUNTDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      Alert.alert('OTP Sent', 'A new OTP has been sent to your email.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  }

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

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
              <Ionicons name="key-outline" size={40} color={Colors.primary} />
            </View>
          </View>

          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            A 6-digit code was sent to{'\n'}
            <Text style={styles.emailText}>{maskedEmail}</Text>
          </Text>

          <View style={styles.formCard}>
            {/* OTP Input boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(v, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  onChange={(e) => handlePaste(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  textAlign="center"
                />
              ))}
            </View>

            <Button
              title="Verify OTP"
              onPress={handleVerify}
              loading={loading}
              style={styles.btn}
            />

            <View style={styles.resendRow}>
              {countdown > 0 ? (
                <Text style={styles.resendTimer}>
                  Resend OTP in <Text style={styles.resendTimerBold}>{countdown}s</Text>
                </Text>
              ) : (
                <ButtonFeedback onPress={handleResend} disabled={resending}>
                  <Text style={[styles.resendLink, resending && styles.resendLinkDisabled]}>
                    {resending ? 'Sending...' : 'Resend OTP'}
                  </Text>
                </ButtonFeedback>
              )}
            </View>

            <Button
              title="Back"
              onPress={() => navigation.goBack()}
              variant="outline"
              style={styles.backBtn}
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
  emailText: {
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.md,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.lg,
  },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: Layout.radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.status.infoLight,
  },
  btn: { marginBottom: Layout.spacing.md },
  resendRow: {
    alignItems: 'center',
    marginBottom: Layout.spacing.sm,
  },
  resendTimer: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
  },
  resendTimerBold: {
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary,
  },
  resendLink: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.primary,
  },
  resendLinkDisabled: {
    color: Colors.text.muted,
  },
  backBtn: { marginTop: Layout.spacing.xs },
});
