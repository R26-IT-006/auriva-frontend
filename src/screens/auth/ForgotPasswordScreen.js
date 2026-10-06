import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { authApi } from '../../api/auth';
import { rs, rf } from '../../utils/responsive';

const TEAL       = '#3A9BA8';
const TEAL_GRAD  = ['#4AABB8', '#52C07C'];
const TEAL_LIGHT = '#E3F5F7';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  function validate() {
    const e = {};
    if (!email.trim()) {
      e.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Please enter a valid email address';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSendOtp() {
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      navigation.navigate('OtpVerification', { email: email.trim().toLowerCase() });
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >

      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>

              {/* Icon */}
              <View style={styles.iconCircle}>
                <Ionicons name="lock-open-outline" size={32} color={TEAL} />
              </View>

              {/* Heading */}
              <Text style={styles.cardTitle}>Forgot Password?</Text>
              <Text style={styles.cardSubtitle}>
                Enter the email address linked to your teacher account.{'\n'}We'll send you a one-time password.
              </Text>

              {/* Email field */}
              <Input
                label="Email Address"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: null })); }}
                placeholder="Enter your registered email"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />

              {/* Send OTP button */}
              <TouchableOpacity
                onPress={handleSendOtp}
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
                    : <Text style={styles.btnText}>Send OTP</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Back to login */}
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.75}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back-outline" size={15} color={TEAL} />
                <Text style={styles.backBtnText}>Back to Login</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footer}>AURIVA 2026</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeInner: { flex: 1 },

  // ── Scroll / layout ──────────────────────────────────────────────────────
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
    maxWidth: rs(560),
    backgroundColor: '#FFFFFF',
    borderRadius: rs(28),
    paddingHorizontal: rs(36),
    paddingVertical: rs(40),
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(10),
    marginBottom: rs(24),
  },
  logoBadge: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(12),
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#FFF',
    fontSize: rf(22),
    fontFamily: 'DMSans_800ExtraBold',
  },
  logoText: {
    fontSize: rf(24),
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A2E',
  },

  // ── Icon circle ───────────────────────────────────────────────────────────
  iconCircle: {
    width: rs(68),
    height: rs(68),
    borderRadius: rs(34),
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: rs(20),
  },

  // ── Headings ──────────────────────────────────────────────────────────────
  cardTitle: {
    fontSize: rf(28),
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: rs(8),
  },
  cardSubtitle: {
    fontSize: rf(14),
    fontFamily: 'DMSans_400Regular',
    color: '#9B9FB0',
    textAlign: 'center',
    lineHeight: rf(22),
    marginBottom: rs(28),
  },

  // ── Send OTP button ───────────────────────────────────────────────────────
  btn: {
    borderRadius: rs(14),
    overflow: 'hidden',
    marginTop: rs(8),
  },
  btnGradient: {
    height: rs(54),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: rf(16),
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
  },

  // ── Back to login ─────────────────────────────────────────────────────────
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(6),
    marginTop: rs(20),
  },
  backBtnText: {
    fontSize: rf(13),
    fontFamily: 'DMSans_600SemiBold',
    color: TEAL,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    marginTop: rs(20),
    textAlign: 'center',
    fontSize: rf(10),
    letterSpacing: 1.8,
    color: Colors.text.muted,
    fontFamily: 'DMSans_600SemiBold',
  },
});
