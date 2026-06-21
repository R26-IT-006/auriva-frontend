import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Alert,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { authApi } from '../../api/auth';
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

export default function ResetPasswordScreen({ navigation, route }) {
  const { resetToken } = route.params;

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [errors,          setErrors]          = useState({});
  const [successVisible,  setSuccessVisible]  = useState(false);

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
      setSuccessVisible(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to reset password. Please try again.');
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
      {/* ── Success Modal ── */}
      <Modal visible={successVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={52} color="#52C07C" />
            </View>
            <Text style={styles.successTitle}>Password Reset!</Text>
            <Text style={styles.successMessage}>
              Your password has been reset successfully.{'\n'}Please log in with your new password.
            </Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => { setSuccessVisible(false); navigation.navigate('Login'); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={TEAL_GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.successBtnGradient}
              >
                <Text style={styles.successBtnText}>Back to Login</Text>
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
              <Text style={styles.cardTitle}>Set new password</Text>
              <Text style={styles.cardSubtitle}>Choose a strong password for your account.</Text>

              {/* New password */}
              <Input
                label="New Password"
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setErrors((e) => ({ ...e, newPassword: null })); }}
                placeholder="Enter new password"
                secureTextEntry
                error={errors.newPassword}
              />

              {/* Confirm password */}
              <Input
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: null })); }}
                placeholder="Re-enter your password"
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

              {/* Reset button */}
              <TouchableOpacity
                onPress={handleReset}
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
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: '#9B9FB0',
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

  // ── Reset button ──────────────────────────────────────────────────────────
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

  // ── Success Modal ─────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successCard: {
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
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E8F8EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_900Black',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  successMessage: {
    fontSize: Layout.fontSize.sm,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  successBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  successBtnGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBtnText: {
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.2,
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
