import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { authApi } from '../../api/auth';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export default function OtpVerificationScreen({ navigation, route }) {
  const { email } = route.params;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [otp, setOtp]           = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

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
    if (code.length !== OTP_LENGTH) { Alert.alert('Incomplete OTP', 'Please enter all 6 digits.'); return; }
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

  const formContent = (
    <>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        A 6-digit code was sent to{'\n'}
        <Text style={styles.emailText}>{maskedEmail}</Text>
      </Text>

      <View style={styles.formCard}>
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

        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
          style={styles.btn}
        >
          <LinearGradient
            colors={['#4AABB8', '#52C07C']}
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

        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>
              Resend OTP in <Text style={styles.resendTimerBold}>{countdown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={[styles.resendLink, resending && styles.resendLinkDisabled]}>
                {resending ? 'Sending...' : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={15} color="#3A9BA8" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>SECURE EDUCATOR ACCESS • AURIVA 2025</Text>
    </>
  );

  return (
    <LinearGradient colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isLandscape ? (
              <View style={styles.landscapeLayout}>
                <View style={styles.landscapeBrand}>
                  <Image source={require('../../../assets/Landscape LPic.png')} style={styles.landscapeImage} resizeMode="cover" />
                </View>
                <View style={styles.landscapeForm}>{formContent}</View>
              </View>
            ) : (
              <>
                <View style={styles.imageSection}>
                  <View style={styles.imageWrapper}>
                    <Image source={require('../../../assets/Portrait LPic.png')} style={styles.portraitImage} resizeMode="cover" />
                  </View>
                </View>
                {formContent}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1 },
  scroll:          { flexGrow: 1, paddingHorizontal: Layout.spacing.lg, paddingBottom: Layout.spacing.xl },
  scrollLandscape: { padding: 0, paddingHorizontal: 0 },

  landscapeLayout: { flexDirection: 'row', flex: 1, minHeight: '100%' },
  landscapeBrand: {
    flex: 1, overflow: 'hidden',
    margin: Layout.spacing.lg, borderRadius: 28,
    borderWidth: 8, borderColor: 'rgba(255,255,255,0.7)',
  },
  landscapeImage: { width: '100%', height: '100%' },
  landscapeForm: {
    flex: 1.2,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.xl,
    justifyContent: 'center',
  },

  imageSection: { alignItems: 'center', paddingTop: Layout.spacing.lg, paddingBottom: Layout.spacing.md },
  imageWrapper: { width: '100%', borderRadius: 28, overflow: 'hidden', borderWidth: 8, borderColor: '#FFFFFF' },
  portraitImage: { width: '100%', height: 500 },

  title: {
    fontSize: Layout.fontSize.xxl, fontFamily: 'Nunito_900Black',
    color: Colors.text.primary, textAlign: 'center', marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Layout.fontSize.sm, color: Colors.text.secondary,
    textAlign: 'center', lineHeight: 20, marginBottom: Layout.spacing.lg,
  },
  emailText: { fontFamily: 'Nunito_600SemiBold', color: Colors.text.primary },

  formCard: {
    backgroundColor: Colors.surface, borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg, marginBottom: Layout.spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Layout.shadow.md,
  },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Layout.spacing.lg },
  otpBox: {
    width: 46, height: 56, borderRadius: Layout.radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    fontSize: Layout.fontSize.xl, fontFamily: 'Nunito_700Bold', color: Colors.text.primary,
  },
  otpBoxFilled: { borderColor: '#4AABB8', backgroundColor: '#EAF6F9' },

  btn: { borderRadius: 14, overflow: 'hidden', marginBottom: Layout.spacing.md },
  btnGradient: { height: 50, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontSize: Layout.fontSize.md, fontFamily: 'Nunito_700Bold', letterSpacing: 0.2 },

  resendRow: { alignItems: 'center', marginBottom: Layout.spacing.sm },
  resendTimer: { fontSize: Layout.fontSize.sm, color: Colors.text.muted },
  resendTimerBold: { fontFamily: 'Nunito_600SemiBold', color: Colors.text.secondary },
  resendLink: { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_600SemiBold', color: '#3A9BA8' },
  resendLinkDisabled: { color: Colors.text.muted },

  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: Layout.spacing.sm },
  backBtnText: { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_600SemiBold', color: '#3A9BA8' },

  footer: {
    textAlign: 'center', fontSize: 10, letterSpacing: 1.5,
    color: Colors.text.muted, fontFamily: 'Nunito_600SemiBold', paddingBottom: Layout.spacing.sm,
  },
});