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

            <Text style={styles.footer}>SECURE EDUCATOR ACCESS  •  AURIVA 2025</Text>
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
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 40,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
  },
  logoText: {
    fontSize: 24,
    fontFamily: 'Nunito_700Bold',
    color: '#1A1A2E',
  },

  // ── Icon circle ───────────────────────────────────────────────────────────
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },

  // ── Headings ──────────────────────────────────────────────────────────────
  cardTitle: {
    fontSize: 28,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: '#9B9FB0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },

  // ── Send OTP button ───────────────────────────────────────────────────────
  btn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
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

  // ── Back to login ─────────────────────────────────────────────────────────
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  backBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: TEAL,
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
