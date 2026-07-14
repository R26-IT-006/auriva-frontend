import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { authApi } from '../../api/auth';

const TEAL           = '#3A9BA8';
const TEAL_GRAD      = ['#4AABB8', '#52C07C'];
const TEAL_LIGHT     = '#E3F5F7';
const OTP_LENGTH     = 6;
const RESEND_COUNTDOWN = 60;

export default function OtpVerificationScreen({ navigation, route }) {
  const { email } = route.params;

  const [otp, setOtp]               = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]       = useState(false);
  const [resending, setResending]   = useState(false);
  const [countdown, setCountdown]   = useState(RESEND_COUNTDOWN);
  const [toast, setToast]           = useState({ visible: false, type: 'success', title: '', message: '' });
  const inputRefs = useRef([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function showToast(type, title, message) {
    setToast({ visible: true, type, title, message });
  }

  function hideToast() {
    setToast((t) => ({ ...t, visible: false }));
  }

  function handleOtpChange(value, index) {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyPress(e, index) {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e, _index) {
    const text = e.nativeEvent.text;
    if (/^\d{6}$/.test(text)) {
      setOtp(text.split(''));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      showToast('error', 'Incomplete OTP', 'Please enter all 6 digits.');
      return;
    }
    setLoading(true);
    try {
      const { reset_token } = await authApi.verifyOtp(email, code);
      navigation.navigate('ResetPassword', { resetToken: reset_token });
    } catch (err) {
      showToast('error', 'Invalid OTP', err.message || 'The OTP is incorrect or has expired.');
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
      showToast('success', 'OTP Sent', 'A new OTP has been sent to your email.');
    } catch (err) {
      showToast('error', 'Failed to Resend', err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  }

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

  const isSuccess = toast.type === 'success';

  return (
    <LinearGradient
      colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* ── Toast Modal ── */}
      <Modal visible={toast.visible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.toastCard}>
            <View style={[styles.toastIconCircle, isSuccess ? styles.toastIconSuccess : styles.toastIconError]}>
              <Ionicons
                name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
                size={44}
                color={isSuccess ? '#52C07C' : '#E05C48'}
              />
            </View>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            <Text style={styles.toastMessage}>{toast.message}</Text>
            <TouchableOpacity
              onPress={hideToast}
              activeOpacity={0.85}
              style={styles.toastBtn}
            >
              <LinearGradient
                colors={isSuccess ? TEAL_GRAD : ['#E07060', '#C04030']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.toastBtnGradient}
              >
                <Text style={styles.toastBtnText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>

              {/* Back */}
              <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={16} color={TEAL} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>

              {/* Heading */}
              <Text style={styles.cardTitle}>Enter verification code</Text>
              <Text style={styles.cardSubtitle}>
                We sent a 6-digit code to{' '}
                <Text style={styles.emailHighlight}>{maskedEmail}</Text>
              </Text>

              {/* OTP boxes */}
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

              {/* Verify button */}
              <TouchableOpacity
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.85}
                style={[styles.btn, loading && { opacity: 0.75 }]}
              >
                <LinearGradient
                  colors={TEAL_GRAD}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnGradient}
                >
                  {loading
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.btnText}>Verify OTP</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend */}
              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Didn't receive it?</Text>
                {countdown > 0 ? (
                  <Text style={styles.resendTimer}>{'  '}Resend in {countdown}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={resending}>
                    <Text style={[styles.resendLink, resending && styles.resendLinkDisabled]}>
                      {'  '}{resending ? 'Sending...' : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

            </View>

            <Text style={styles.footer}>SECURE EDUCATOR ACCESS  •  AURIVA 2025</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  safeInner: { flex: 1 },

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.xxl,
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 36,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },

  // ── Back ──────────────────────────────────────────────────────────────────
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: TEAL,
  },

  // ── Headings ──────────────────────────────────────────────────────────────
  cardTitle: {
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: '#9B9FB0',
    lineHeight: 22,
    marginBottom: 28,
  },
  emailHighlight: {
    fontFamily: 'Nunito_600SemiBold',
    color: TEAL,
  },

  // ── OTP boxes ─────────────────────────────────────────────────────────────
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E4EE',
    backgroundColor: '#F5F7FA',
    fontSize: 22,
    fontFamily: 'Nunito_700Bold',
    color: '#1A1A2E',
  },
  otpBoxFilled: {
    borderColor: TEAL,
    backgroundColor: TEAL_LIGHT,
  },

  // ── Verify button ─────────────────────────────────────────────────────────
  btn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  btnGradient: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.4,
  },

  // ── Resend ────────────────────────────────────────────────────────────────
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: '#9B9FB0',
  },
  resendTimer: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: '#9B9FB0',
  },
  resendLink: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: TEAL,
  },
  resendLinkDisabled: {
    color: '#9B9FB0',
  },

  // ── Toast Modal ───────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  toastCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  toastIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toastIconSuccess: { backgroundColor: '#E8F8EF' },
  toastIconError:   { backgroundColor: '#FDF0EE' },
  toastTitle: {
    fontSize: 20,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  toastMessage: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  toastBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  toastBtnGradient: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.3,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.text.muted,
    fontFamily: 'Nunito_600SemiBold',
  },
});
