import { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { useAuthStore } from '../../store/authStore';

const GREEN       = '#3A9BA8';
const GREEN_GRAD  = ['#4AABB8', '#52C07C'];
const GREEN_LIGHT = '#E3F5F7';

export default function LoginScreen({ navigation }) {
  const slideAnim    = useRef(new Animated.Value(0)).current;
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
                <View style={styles.logoBadge}>
                  <Text style={styles.logoLetter}>A</Text>
                </View>
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
                placeholder={role === 'teacher' ? 'e.g. T-1024' : 'Enter your username'}
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
                <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotRow}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              )}

              {/* Login button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
                style={[styles.loginBtn, loading && { opacity: 0.75 }]}
              >
                <LinearGradient
                  colors={GREEN_GRAD}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginBtnGradient}
                >
                  {loading
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.loginBtnText}>Login</Text>
                  }
                </LinearGradient>
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
    shadowColor: GREEN,
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
    marginBottom: 20,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: GREEN,
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

  // ── Headings ──────────────────────────────────────────────────────────────
  cardTitle: {
    fontSize: 28,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: '#9B9FB0',
    textAlign: 'center',
    marginBottom: 28,
  },

  // ── Role selector ─────────────────────────────────────────────────────────
  roleSelector: {
    flexDirection: 'row',
    backgroundColor: GREEN_LIGHT,
    borderRadius: Layout.radius.lg,
    padding: 4,
    marginBottom: 24,
  },
  rolePillIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
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
    paddingVertical: 11,
    alignItems: 'center',
    zIndex: 1,
  },
  rolePillText: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: '#9B9FB0',
  },
  rolePillTextActive: {
    color: '#1A1A2E',
  },

  // ── Forgot password ───────────────────────────────────────────────────────
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 4,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: '#4AABB8',
  },

  // ── Login button ──────────────────────────────────────────────────────────
  loginBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  loginBtnGradient: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.4,
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

  // ── Error modal ───────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  errorIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FDF0EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_900Black',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: Layout.fontSize.sm,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  errorBtn: {
    width: '100%',
    borderRadius: 14,
    marginTop: 8,
    backgroundColor: GREEN,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBtnText: {
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.2,
  },
});
