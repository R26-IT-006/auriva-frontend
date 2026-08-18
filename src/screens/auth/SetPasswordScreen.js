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
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 24,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: '#9B9FB0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },

  // ── Requirements ──────────────────────────────────────────────────────────
  requirements: {
    backgroundColor: '#F7F9FC',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  reqTitle: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    color: '#9B9FB0',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reqDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#C8CDD8',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqDotMet: {
    backgroundColor: '#52C07C',
    borderColor: '#52C07C',
  },
  reqText: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: '#9B9FB0',
  },
  reqTextMet: {
    color: '#1A1A2E',
    fontFamily: 'Nunito_600SemiBold',
  },

  // ── Update button ─────────────────────────────────────────────────────────
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

  // ── Footer note ───────────────────────────────────────────────────────────
  footerNote: {
    fontSize: 11,
    color: '#9B9FB0',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
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
