import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { useAuthStore } from '../../store/authStore';

// Role selector pill
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
  const [demoMode, setDemoMode] = useState(false);
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
      Alert.alert(
        'Login Failed',
        err.message || 'Invalid ID or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDemoToggle(value) {
    setDemoMode(value);
    if (value) {
      setRole('teacher');
      setIdentifier('demo');
      setPassword('auriva123');
    } else {
      setIdentifier('');
      setPassword('');
    }
  }

  const brandSection = (
    <View style={[styles.brandSection, isLandscape && styles.brandSectionLandscape]}>
      <View style={styles.logoContainer}>
        <View style={styles.logo}>
          <Ionicons name="flash" size={isLandscape ? 24 : 32} color="#FFFFFF" />
        </View>
      </View>
      <Text style={[styles.appName, isLandscape && styles.appNameLandscape]}>Auriva</Text>
      {!isLandscape && (
        <>
          <Text style={styles.headline}>Welcome, Educator</Text>
          <Text style={styles.subheadline}>
            Log in to access personalized learning plans{'\n'}for your students.
          </Text>
        </>
      )}
    </View>
  );

  const formSection = (
    <View style={[styles.formWrapper, isLandscape && styles.formWrapperLandscape]}>
      {/* Role Selector */}
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

      {/* Form Card */}
      <View style={styles.formCard}>
        <Input
          label={role === 'teacher' ? 'Teacher ID' : 'Username'}
          value={identifier}
          onChangeText={(v) => { setIdentifier(v); setErrors((e) => ({ ...e, identifier: null })); }}
          placeholder={role === 'teacher' ? 'Enter your Teacher ID' : 'Enter your username'}
          keyboardType={role === 'teacher' ? 'default' : 'default'}
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

        <Button
          title="Log In"
          onPress={handleLogin}
          loading={loading}
          style={styles.loginBtn}
        />

        {role === 'teacher' && (
          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotPasswordRow}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </Pressable>
        )}
      </View>

      {/* Demo Mode */}
      <View style={styles.demoCard}>
        <View style={styles.demoRow}>
          <View style={styles.demoInfo}>
            <Text style={styles.demoTitle}>Demo Mode</Text>
            <Text style={styles.demoDesc}>Simulate a teacher login experience.</Text>
          </View>
          <Switch
            value={demoMode}
            onValueChange={handleDemoToggle}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={demoMode ? Colors.primary : Colors.surface}
          />
        </View>
        {demoMode && (
          <View style={styles.demoHint}>
            <Text style={styles.demoHintText}>
              Use ID <Text style={{ fontWeight: '700' }}>demo</Text> and password{' '}
              <Text style={{ fontWeight: '700' }}>auriva123</Text> to test the login flow.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
            // Landscape: branding left, form right
            <View style={styles.landscapeLayout}>
              <LinearGradient colors={['#1A1A2E', '#2D2B6B']} style={styles.landscapeBrand}>
                {brandSection}
                <Text style={styles.headlineLandscape}>Welcome,{'\n'}Educator</Text>
                <Text style={styles.subheadlineLandscape}>
                  Log in to access personalized{'\n'}learning plans for your students.
                </Text>
              </LinearGradient>
              <View style={styles.landscapeForm}>
                {formSection}
                <Text style={styles.footer}>SECURE EDUCATOR ACCESS • AURIVA 2025</Text>
              </View>
            </View>
          ) : (
            // Portrait: stacked
            <>
              {brandSection}
              {formSection}
              <Text style={styles.footer}>SECURE EDUCATOR ACCESS • AURIVA 2025</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  scrollLandscape: { padding: 0, paddingHorizontal: 0 },

  // Brand (Portrait)
  brandSection: {
    alignItems: 'center',
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.lg,
  },
  brandSectionLandscape: {
    paddingTop: Layout.spacing.xxl,
    paddingBottom: Layout.spacing.md,
  },
  logoContainer: { marginBottom: Layout.spacing.sm },
  logo: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    ...Layout.shadow.md,
  },
  appName: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Layout.spacing.sm,
  },
  appNameLandscape: { color: '#FFFFFF' },
  headline: {
    fontSize: Layout.fontSize.xxl, fontWeight: Layout.fontWeight.extrabold,
    color: Colors.text.primary, marginBottom: Layout.spacing.xs,
  },
  subheadline: {
    fontSize: Layout.fontSize.sm, color: Colors.text.secondary,
    textAlign: 'center', lineHeight: 20,
  },

  // Form wrapper
  formWrapper: {},
  formWrapperLandscape: { paddingHorizontal: Layout.spacing.lg },

  // Role selector
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
  rolePillActive: { backgroundColor: Colors.primary },
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
  loginBtn: { marginTop: Layout.spacing.sm },
  forgotPasswordRow: {
    alignItems: 'center',
    paddingTop: Layout.spacing.md,
  },
  forgotPasswordText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.primary,
  },

  // Demo
  demoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  demoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  demoInfo: { flex: 1, marginRight: Layout.spacing.sm },
  demoTitle: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  demoDesc: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2 },
  demoHint: { marginTop: Layout.spacing.sm, padding: Layout.spacing.sm, backgroundColor: Colors.surfaceAlt, borderRadius: Layout.radius.sm },
  demoHintText: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, lineHeight: 18, fontStyle: 'italic' },

  footer: {
    textAlign: 'center', fontSize: 10, letterSpacing: 1.5,
    color: Colors.text.muted, fontWeight: Layout.fontWeight.medium,
    paddingBottom: Layout.spacing.sm,
  },

  // Landscape layout
  landscapeLayout: { flexDirection: 'row', flex: 1, minHeight: '100%' },
  landscapeBrand: {
    flex: 1,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headlineLandscape: {
    fontSize: Layout.fontSize.xxl, fontWeight: Layout.fontWeight.extrabold,
    color: '#FFFFFF', textAlign: 'center',
    marginTop: Layout.spacing.md, lineHeight: 32,
  },
  subheadlineLandscape: {
    fontSize: Layout.fontSize.sm, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', lineHeight: 20, marginTop: Layout.spacing.sm,
  },
  landscapeForm: {
    flex: 1.2,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xl,
    justifyContent: 'center',
  },
});
