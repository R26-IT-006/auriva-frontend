import { useState, useRef } from 'react';
import { ButtonFeedback } from '../../components/common/ButtonFeedback';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Animated,
  Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { useAuthStore } from '../../store/authStore';
import { rs, rf } from '../../utils/responsive';

// Aliases onto the shared brand token. The sign-in button is where this colour
// is defined for the product, so other screens borrow it from `Colors` — keeping
// a second literal here is how the two would drift apart.
const GREEN       = Colors.brand;
const GREEN_GRAD  = Colors.brandGradient;
const GREEN_LIGHT = '#E3F5F7';

// The Auriva logo (book, wordmark and tagline): a transparent PNG trimmed to
// the artwork, made from Auriva_Logo.jpeg, so no cream box shows on the card.
const AURIVA_LOGO = require('../../../assets/logos/Auriva_Logo.png');
const LOGO_RATIO = 821 / 931;   // the image's height / width

export default function LoginScreen({ navigation }) {
  // The logo's width is the smaller of its design size and what keeps it to
  // 22% of the screen's height, so the whole sign-in card fits a short tablet
  // without scrolling and the logo still reads at its designed size elsewhere.
  const { height: winH } = useWindowDimensions();
  const logoW = Math.min(rs(220), (winH * 0.22) / LOGO_RATIO);
  const slideAnim    = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;
  const [selectorW, setSelectorW] = useState(0);
  const [role, setRole]           = useState('teacher');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState({});
  const [errorModal, setErrorModal] = useState({ visible: false, message: '' });

  const login = useAuthStore((s) => s.login);

  function switchRole(newRole) {
    Animated.spring(slideAnim, {
      toValue: newRole === 'principal' ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
    setRole(newRole);
    setErrors({});
    setIdentifier('');
  }

  function validate() {
    const e = {};
    if (!identifier.trim())
      e.identifier = role === 'teacher' ? 'Please enter valid ID credentials.' : 'Username is required';
    if (!password) e.password = 'Password cannot be empty.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function btnPressIn() {
    Animated.spring(btnScale, { toValue: 0.97, speed: 40, bounciness: 4, useNativeDriver: true }).start();
  }
  function btnPressOut() {
    Animated.spring(btnScale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }).start();
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(role, identifier.trim(), password);
    } catch (err) {
      setErrorModal({ visible: true, message: err.message || 'Invalid ID or password. Please try again.' });
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

      {/* ── Error modal ── */}
      <Modal visible={errorModal.visible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="alert-circle" size={52} color="#E05C48" />
            </View>
            <Text style={styles.errorTitle}>Login Failed</Text>
            <Text style={styles.errorMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={styles.errorBtn}
              onPress={() => setErrorModal({ visible: false, message: '' })}
              activeOpacity={0.85}
            >
              <Text style={styles.errorBtnText}>Try Again</Text>
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
            {/* ── Card ── */}
            <View style={styles.card}>

              {/* Logo */}
              <View style={styles.logoRow}>
                <Image
                  source={AURIVA_LOGO}
                  style={{ width: logoW, height: logoW * LOGO_RATIO }}
                  resizeMode="contain"
                  accessibilityRole="image"
                  accessibilityLabel="Auriva — Learning English, one happy step at a time"
                />
              </View>

              {/* Heading */}
              <Text style={styles.cardTitle}>Welcome back</Text>
              <Text style={styles.cardSubtitle}>Sign in to your account</Text>

              {/* Role toggle */}
              <View
                style={styles.roleSelector}
                onLayout={e => setSelectorW(e.nativeEvent.layout.width)}
              >
                {selectorW > 0 && (
                  <Animated.View style={[
                    styles.rolePillIndicator,
                    {
                      width: (selectorW - 8) / 2,
                      transform: [{
                        translateX: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, (selectorW - 8) / 2],
                        }),
                      }],
                    },
                  ]} />
                )}
                <TouchableOpacity style={styles.rolePill} activeOpacity={0.8} onPress={() => switchRole('teacher')}>
                  <Text style={[styles.rolePillText, role === 'teacher' && styles.rolePillTextActive]}>Teacher</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rolePill} activeOpacity={0.8} onPress={() => switchRole('principal')}>
                  <Text style={[styles.rolePillText, role === 'principal' && styles.rolePillTextActive]}>Principal</Text>
                </TouchableOpacity>
              </View>

              {/* Fields */}
              <Input
                label={role === 'teacher' ? 'Teacher ID' : 'Username'}
                value={identifier}
                onChangeText={(v) => { setIdentifier(v); setErrors((e) => ({ ...e, identifier: null })); }}
                placeholder="Enter your username"
                error={errors.identifier}
              />
              <Input
                label="Password"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: null })); }}
                placeholder="Enter your password"
                secureTextEntry
                error={errors.password}
              />

              {/* Forgot password */}
              {role === 'teacher' && (
                <ButtonFeedback onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotRow}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </ButtonFeedback>
              )}

              {/* Sign in button — the one primary action on the screen, so it
                  carries a lift and a press response the other controls don't. */}
              <Animated.View
                style={[
                  styles.loginBtnWrap,
                  { transform: [{ scale: btnScale }] },
                  loading && styles.loginBtnWrapBusy,
                ]}
              >
                <Pressable
                  onPress={handleLogin}
                  onPressIn={btnPressIn}
                  onPressOut={btnPressOut}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                  accessibilityState={{ disabled: loading, busy: loading }}
                  style={styles.loginBtn}
                >
                  <LinearGradient
                    colors={GREEN_GRAD}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.loginBtnGradient}
                  >
                    {loading ? (
                      <View style={styles.loginBtnRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.loginBtnText}>Signing in…</Text>
                      </View>
                    ) : (
                      <View style={styles.loginBtnRow}>
                        <Text style={styles.loginBtnText}>Sign In</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>
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
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoRow: {
    alignItems: 'center',
    marginBottom: rs(14),
  },

  // ── Headings ──────────────────────────────────────────────────────────────
  cardTitle: {
    fontSize: rf(28),
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: rs(6),
  },
  cardSubtitle: {
    fontSize: rf(14),
    fontFamily: 'DMSans_400Regular',
    color: '#9B9FB0',
    textAlign: 'center',
    marginBottom: rs(28),
  },

  // ── Role selector ─────────────────────────────────────────────────────────
  roleSelector: {
    flexDirection: 'row',
    backgroundColor: GREEN_LIGHT,
    borderRadius: Layout.radius.lg,
    padding: rs(4),
    marginBottom: rs(24),
  },
  rolePillIndicator: {
    position: 'absolute',
    top: rs(4),
    left: rs(4),
    bottom: rs(4),
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  rolePill: {
    flex: 1,
    paddingVertical: rs(11),
    alignItems: 'center',
    zIndex: 1,
  },
  rolePillText: {
    fontSize: rf(14),
    fontFamily: 'DMSans_600SemiBold',
    color: '#9B9FB0',
  },
  rolePillTextActive: {
    color: '#1A1A2E',
  },

  // ── Forgot password ───────────────────────────────────────────────────────
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: rs(4),
    marginBottom: rs(20),
  },
  forgotText: {
    fontSize: rf(13),
    fontFamily: 'DMSans_600SemiBold',
    color: '#4AABB8',
  },

  // ── Login button ──────────────────────────────────────────────────────────
  // The lift sits on the wrapper: the button itself clips its gradient, and a
  // shadow on a clipping view is cut off with the corners.
  loginBtnWrap: {
    marginTop: rs(4),
    borderRadius: rs(16),
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 6,
  },
  loginBtnWrapBusy: {
    opacity: 0.75,
    shadowOpacity: 0.12,
    elevation: 2,
  },
  loginBtn: {
    borderRadius: rs(16),
    overflow: 'hidden',
  },
  loginBtnGradient: {
    height: rs(56),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: rf(16),
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
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

  // ── Error modal ───────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: rs(40),
  },
  errorCard: {
    width: '100%',
    maxWidth: rs(400),
    backgroundColor: '#FFF',
    borderRadius: rs(28),
    paddingVertical: rs(40),
    paddingHorizontal: rs(32),
    alignItems: 'center',
    gap: rs(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(12) },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  errorIconCircle: {
    width: rs(90),
    height: rs(90),
    borderRadius: rs(45),
    backgroundColor: '#FDF0EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(4),
  },
  errorTitle: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: Layout.fontSize.sm,
    color: '#666',
    textAlign: 'center',
    lineHeight: rf(22),
    marginBottom: rs(4),
  },
  errorBtn: {
    width: '100%',
    borderRadius: rs(14),
    marginTop: rs(8),
    backgroundColor: GREEN,
    height: rs(54),
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBtnText: {
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.2,
  },
});
