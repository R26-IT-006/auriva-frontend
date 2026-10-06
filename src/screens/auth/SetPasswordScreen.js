import { useState } from 'react';
import {
  View,
  Text,
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
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { useAuthStore } from '../../store/authStore';
import { validatePassword } from '../../utils/validation';
import { rs, rf } from '../../utils/responsive';

const TEAL       = '#3A9BA8';
const TEAL_GRAD  = ['#4AABB8', '#52C07C'];
const TEAL_LIGHT = '#E3F5F7';

function Requirement({ met, label }) {
  return (
    <View style={styles.reqRow}>
      <View style={[styles.reqDot, met && styles.reqDotMet]}>
        {met && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{label}</Text>
    </View>
  );
}

export default function SetPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const setPassword = useAuthStore((s) => s.setPassword);
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

  async function handleUpdate() {
    if (!validate()) return;
    setLoading(true);
    try {
      await setPassword(newPassword);
      // Navigates automatically via AppNavigator
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update password.');
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
                <Ionicons name="shield-checkmark-outline" size={32} color={TEAL} />
              </View>

              {/* Heading */}
              <Text style={styles.cardTitle}>Set new password</Text>

              {/* New password */}
              <Input
                label="New Password"
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setErrors((e) => ({ ...e, newPassword: null })); }}
                placeholder="Enter secure password"
                secureTextEntry
                error={errors.newPassword}
              />

              {/* Confirm password */}
              <Input
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: null })); }}
                placeholder="Repeat your password"
                secureTextEntry
                error={errors.confirmPassword}
              />

              {/* Requirements */}
              <View style={styles.requirements}>
                <Text style={styles.reqTitle}>PASSWORD MUST INCLUDE</Text>
                <Requirement met={rules.minLength}    label="At least 8 characters" />
                <Requirement met={rules.hasUppercase} label="One uppercase letter" />
                <Requirement met={rules.hasLowercase} label="One lowercase letter" />
                <Requirement met={rules.hasNumber}    label="One number" />
                <Requirement met={rules.hasSpecial}   label="One special character" />
              </View>

              {/* Update button */}
              <TouchableOpacity
                onPress={handleUpdate}
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
                    : <Text style={styles.btnText}>Update Password</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.footerNote}>
                By updating your password, you agree to our security{'\n'}guidelines for educator accounts.
              </Text>
            </View>

            <Text style={styles.footer}>AURIVA 2026</Text>
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
    maxWidth: rs(560),
    backgroundColor: '#FFFFFF',
    borderRadius: rs(28),
    paddingHorizontal: rs(32),
    paddingVertical: rs(36),
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
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
    fontSize: rf(26),
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: rs(24),
  },
  cardSubtitle: {
    fontSize: rf(14),
    fontFamily: 'DMSans_400Regular',
    color: '#9B9FB0',
    textAlign: 'center',
    lineHeight: rf(22),
    marginBottom: rs(24),
  },

  // ── Requirements ──────────────────────────────────────────────────────────
  requirements: {
    backgroundColor: '#F7F9FC',
    borderRadius: rs(12),
    padding: rs(14),
    marginTop: rs(4),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  reqTitle: {
    fontSize: rf(10),
    fontFamily: 'DMSans_700Bold',
    color: '#9B9FB0',
    letterSpacing: 1.2,
    marginBottom: rs(10),
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: rs(6),
  },
  reqDot: {
    width: rs(22),
    height: rs(22),
    borderRadius: rs(11),
    borderWidth: 1.5,
    borderColor: '#C8CDD8',
    marginRight: rs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqDotMet: {
    backgroundColor: '#52C07C',
    borderColor: '#52C07C',
  },
  reqText: {
    fontSize: rf(13),
    fontFamily: 'DMSans_400Regular',
    color: '#9B9FB0',
  },
  reqTextMet: {
    color: '#1A1A2E',
    fontFamily: 'DMSans_600SemiBold',
  },

  // ── Update button ─────────────────────────────────────────────────────────
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

  // ── Footer note ───────────────────────────────────────────────────────────
  footerNote: {
    fontSize: rf(11),
    color: '#9B9FB0',
    textAlign: 'center',
    lineHeight: rf(18),
    marginTop: rs(16),
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
