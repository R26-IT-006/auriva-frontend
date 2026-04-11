import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { useAuthStore } from '../../store/authStore';

function RolePill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.rolePill, active && styles.rolePillActive]}
    >
      <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [role, setRole] = useState('teacher');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const login = useAuthStore((s) => s.login);

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
      Alert.alert('Login Failed', err.message || 'Invalid ID or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const brandSection = (
    <View style={[styles.brandSection, isLandscape && styles.brandSectionLandscape]}>
      <View style={styles.loginPicWrapper}>
        <Image
          source={require('../../../assets/Portrait LPic.png')}
          style={styles.loginPic}
          resizeMode="cover"
        />
      </View>
    </View>
  );

  const formSection = (
    <View style={[styles.formWrapper, isLandscape && styles.formWrapperLandscape]}>
      <View style={styles.roleSelector}>
        <RolePill
          label="Teacher"
          active={role === 'teacher'}
          onPress={() => { setRole('teacher'); setErrors({}); setIdentifier(''); }}
        />
        <RolePill
          label="Principal"
          active={role === 'principal'}
          onPress={() => { setRole('principal'); setErrors({}); setIdentifier(''); }}
        />
      </View>

      <View style={styles.formCard}>
        <Input
          label={role === 'teacher' ? 'Teacher ID' : 'Username'}
          value={identifier}
          onChangeText={(v) => { setIdentifier(v); setErrors((e) => ({ ...e, identifier: null })); }}
          placeholder={role === 'teacher' ? 'Enter your Teacher ID' : 'Enter your username'}
          keyboardType="default"
          leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
          error={errors.identifier}
        />
        <Input
          label="Password"
          value={password}
          onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: null })); }}
          placeholder="Enter password"
          secureTextEntry
          leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.icon.default} />}
          error={errors.password}
        />

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
          style={styles.loginBtn}
        >
          <LinearGradient
            colors={['#4AABB8', '#52C07C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.loginBtnGradient}
          >
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.loginBtnText}>Log In</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        {role === 'teacher' && (
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPasswordRow}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isLandscape ? (
              <View style={styles.landscapeLayout}>
                <View style={styles.landscapeBrand}>
                  <Image
                    source={require('../../../assets/Landscape LPic.png')}
                    style={styles.loginPicLandscape}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.landscapeForm}>
                  {formSection}
                  <Text style={styles.footer}>SECURE EDUCATOR ACCESS • AURIVA 2025</Text>
                </View>
              </View>
            ) : (
              <>
                {brandSection}
                {formSection}
                <Text style={styles.footer}>SECURE EDUCATOR ACCESS • AURIVA 2025</Text>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeInner: { flex: 1 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  scrollLandscape: { padding: 0, paddingHorizontal: 0 },

  // Portrait brand section
  brandSection: {
    alignItems: 'center',
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.lg,
  },
  brandSectionLandscape: {
    paddingTop: Layout.spacing.xl,
  },
  loginPicWrapper: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: '#FFFFFF',
  },
  loginPic: {
    width: '100%',
    height: 500,
  },
  loginPicLandscape: {
    width: '100%',
    height: '100%',
  },

  formWrapper: {},
  formWrapperLandscape: { paddingHorizontal: Layout.spacing.lg },

  roleSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.full,
    padding: 4,
    marginBottom: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rolePill: {
    flex: 1, paddingVertical: 10,
    borderRadius: Layout.radius.full, alignItems: 'center',
  },
  rolePillActive: { backgroundColor: '#4AABB8' },
  rolePillText: {
    fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary,
  },
  rolePillTextActive: { color: '#FFFFFF' },

  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.md,
  },
  loginBtn: { marginTop: Layout.spacing.sm, borderRadius: 14, overflow: 'hidden' },
  loginBtnGradient: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    letterSpacing: 0.2,
  },
  forgotPasswordRow: {
    alignItems: 'center',
    paddingTop: Layout.spacing.md,
  },
  forgotPasswordText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: '#3A9BA8',
  },

  footer: {
    textAlign: 'center', fontSize: 10, letterSpacing: 1.5,
    color: Colors.text.muted, fontWeight: Layout.fontWeight.medium,
    paddingBottom: Layout.spacing.sm,
  },

  landscapeLayout: { flexDirection: 'row', flex: 1, minHeight: '100%' },
  landscapeBrand: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    margin: Layout.spacing.lg,
    borderRadius: 28,
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  landscapeForm: {
    flex: 1.2,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xl,
    justifyContent: 'center',
  },
});