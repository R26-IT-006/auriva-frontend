import { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { authApi } from '../../api/auth';
import { validatePassword } from '../../utils/validation';

function Requirement({ met, label }) {
  return (
    <View style={styles.reqRow}>
      <View style={[styles.reqDot, met && styles.reqDotMet]}>
        {met && <Ionicons name="checkmark" size={10} color="#fff" />}
      </View>
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{label}</Text>
    </View>
  );
}

export default function ResetPasswordScreen({ navigation, route }) {
  const { resetToken } = route.params;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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

  const formContent = (
    <>
      <Text style={styles.title}>Set New Password</Text>
      <Text style={styles.subtitle}>Choose a strong password for your account.</Text>

      <View style={styles.formCard}>
        <Input
          label="New Password"
          value={newPassword}
          onChangeText={(v) => { setNewPassword(v); setErrors((e) => ({ ...e, newPassword: null })); }}
          placeholder="Enter new password"
          secureTextEntry
          leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.icon.default} />}
          error={errors.newPassword}
        />

        <View style={styles.requirements}>
          <Text style={styles.reqTitle}>SECURITY REQUIREMENTS</Text>
          <Requirement met={rules.minLength}   label="8 or more characters" />
          <Requirement met={rules.hasUppercase} label="At least one uppercase letter" />
          <Requirement met={rules.hasLowercase} label="At least one lowercase letter" />
          <Requirement met={rules.hasNumber}    label="At least one number" />
          <Requirement met={rules.hasSpecial}   label="At least one special character" />
        </View>

        <Input
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: null })); }}
          placeholder="Repeat your password"
          secureTextEntry
          leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.icon.default} />}
          error={errors.confirmPassword}
          style={{ marginTop: Layout.spacing.sm }}
        />

        <TouchableOpacity
          onPress={handleReset}
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
              : <Text style={styles.btnText}>Reset Password</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>SECURE EDUCATOR ACCESS • AURIVA 2025</Text>
    </>
  );

  return (
    <LinearGradient colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']} style={styles.safe}>

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
                colors={['#4AABB8', '#52C07C']}
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

  formCard: {
    backgroundColor: Colors.surface, borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg, marginBottom: Layout.spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Layout.shadow.md,
  },

  requirements: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Layout.radius.md,
    padding: Layout.spacing.md, marginBottom: Layout.spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  reqTitle: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: Colors.text.muted, letterSpacing: 1.2, marginBottom: Layout.spacing.sm },
  reqRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  reqDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.border,
    marginRight: Layout.spacing.sm, alignItems: 'center', justifyContent: 'center',
  },
  reqDotMet: { backgroundColor: Colors.status.success, borderColor: Colors.status.success },
  reqText:    { fontSize: Layout.fontSize.sm, color: Colors.text.muted },
  reqTextMet: { color: Colors.text.secondary },

  btn: { marginTop: Layout.spacing.md, borderRadius: 14, overflow: 'hidden' },
  btnGradient: { height: 50, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontSize: Layout.fontSize.md, fontFamily: 'Nunito_700Bold', letterSpacing: 0.2 },

  // ── Success Modal ──────────────────────────────────────────
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
  successBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  successBtnGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  successBtnText: { color: '#FFF', fontSize: Layout.fontSize.md, fontFamily: 'Nunito_700Bold', letterSpacing: 0.2 },

  footer: {
    textAlign: 'center', fontSize: 10, letterSpacing: 1.5,
    color: Colors.text.muted, fontFamily: 'Nunito_600SemiBold', paddingBottom: Layout.spacing.sm,
  },
});