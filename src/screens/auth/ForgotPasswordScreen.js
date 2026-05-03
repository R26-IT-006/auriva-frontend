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

export default function ForgotPasswordScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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

  const formContent = (
    <>
      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>
        Enter the email address linked to your teacher account.{'\n'}We'll send you a one-time password.
      </Text>

      <View style={styles.formCard}>
        <Input
          label="Email Address"
          value={email}
          onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: null })); }}
          placeholder="Enter your registered email"
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.icon.default} />}
          error={errors.email}
        />

        <TouchableOpacity
          onPress={handleSendOtp}
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
              : <Text style={styles.btnText}>Send OTP</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back-outline" size={15} color="#3A9BA8" />
          <Text style={styles.backBtnText}>Back to Login</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>SECURE EDUCATOR ACCESS • AURIVA 2025</Text>
    </>
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
                {/* Left: image */}
                <View style={styles.landscapeBrand}>
                  <Image
                    source={require('../../../assets/Landscape LPic.png')}
                    style={styles.landscapeImage}
                    resizeMode="cover"
                  />
                </View>
                {/* Right: form */}
                <View style={styles.landscapeForm}>
                  {formContent}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.imageSection}>
                  <View style={styles.imageWrapper}>
                    <Image
                      source={require('../../../assets/Portrait LPic.png')}
                      style={styles.portraitImage}
                      resizeMode="cover"
                    />
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

  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  scrollLandscape: { padding: 0, paddingHorizontal: 0 },

  // Landscape layout
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
  landscapeImage: { width: '100%', height: '100%' },
  landscapeForm: {
    flex: 1.2,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xl,
    justifyContent: 'center',
  },

  // Portrait image
  imageSection: {
    alignItems: 'center',
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
  },
  imageWrapper: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: '#FFFFFF',
  },
  portraitImage: {
    width: '100%',
    height: 500,
  },

  title: {
    fontSize: Layout.fontSize.xxl,
    fontFamily: 'Nunito_900Black',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Layout.spacing.lg,
  },

  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.md,
  },

  btn: { marginTop: Layout.spacing.sm, borderRadius: 14, overflow: 'hidden' },
  btnGradient: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.2,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: Layout.spacing.md,
  },
  backBtnText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_600SemiBold',
    color: '#3A9BA8',
  },

  footer: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.text.muted,
    fontFamily: 'Nunito_600SemiBold',
    paddingBottom: Layout.spacing.sm,
  },
});