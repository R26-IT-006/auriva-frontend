import React, { useState } from 'react';
import { ButtonFeedback } from '../../components/common/ButtonFeedback';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { principalApi } from '../../../api/principal';
import { validateEmail } from '../../../utils/validation';
import { useToast } from '../../../context/ToastContext';

// ── palette ───────────────────────────────────────────────────────────────────
const DARK    = '#0F2F3E';
const GREEN   = '#2E9E63';
const BLUE    = '#4A8FD8';
const BLUE_L  = '#DEEAF8';
const PURPLE  = '#7B68C8';
const PURPLE_L= '#EEEBF8';
const AMBER   = '#C9973A';
const AMBER_L = '#FBF4E6';
const CORAL   = '#D95F50';
const BODY_BG = '#F2F5F8';
const SURFACE = '#FFFFFF';
const TEXT    = '#1A2E3B';
const MUTED   = '#8A93A8';
const BORDER  = '#E8EEF4';

// ── helpers ───────────────────────────────────────────────────────────────────
function FieldRow({ label, required, error, children }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.fieldRequired}> *</Text>}
      </Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function StyledInput({ error, secureTextEntry, ...props }) {
  const [hidden, setHidden] = useState(!!secureTextEntry);
  if (secureTextEntry) {
    return (
      <View style={[styles.styledInput, styles.passwordWrap, error && styles.styledInputError]}>
        <TextInput
          style={styles.passwordInput}
          placeholderTextColor={MUTED}
          secureTextEntry={hidden}
          {...props}
        />
        <ButtonFeedback onPress={() => setHidden((h) => !h)} activeOpacity={0.7} style={styles.eyeBtn}>
          <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={16} color={MUTED} />
        </ButtonFeedback>
      </View>
    );
  }
  return (
    <TextInput
      style={[styles.styledInput, error && styles.styledInputError]}
      placeholderTextColor={MUTED}
      {...props}
    />
  );
}

// ── screen ────────────────────────────────────────────────────────────────────
export default function CreateTeacherScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [photo,    setPhoto]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  function validate() {
    const e = {};
    if (!fullName.trim())           e.fullName = 'Full name is required.';
    if (!email.trim())              e.email    = 'Email address is required.';
    else if (!validateEmail(email)) e.email    = 'Enter a valid email address.';
    if (!password)                  e.password = 'Password is required.';
    else if (password.length < 8)   e.password = 'Minimum 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('email', email.trim());
      formData.append('password', password);
      if (photo) {
        const uri  = photo.uri;
        const name = uri.split('/').pop();
        const ext  = name.split('.').pop().toLowerCase();
        const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mime[ext] || 'image/jpeg' });
      }
      await principalApi.createTeacher(formData);
      toast.show('Teacher account created successfully.');
      navigation.goBack();
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const displayName = fullName.trim() || 'New Teacher';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <ButtonFeedback onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </ButtonFeedback>
        <View style={styles.breadcrumb}>
          <ButtonFeedback onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>Faculty</Text>
          </ButtonFeedback>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
          <Text style={styles.breadcrumbCurrent}>Add Teacher</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.layout}>

            {/* ── Photo strip ── */}
            <View style={styles.photoStrip}>
              <ButtonFeedback onPress={pickPhoto} activeOpacity={0.8} style={styles.photoWrap}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Ionicons name="person-outline" size={28} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
                <View style={styles.photoCameraBtn}>
                  <Ionicons name="camera" size={12} color={SURFACE} />
                </View>
              </ButtonFeedback>
              <View style={styles.photoMeta}>
                <Text style={styles.photoName}>{displayName}</Text>
                <View style={styles.photoCodePill}>
                  <Text style={styles.photoCodeText}>Code: Auto-generated</Text>
                </View>
              </View>
              <ButtonFeedback onPress={pickPhoto} style={styles.changePhotoBtn} activeOpacity={0.8}>
                <Ionicons name="image-outline" size={14} color={BLUE} />
                <Text style={styles.changePhotoBtnText}>{photo ? 'Change Photo' : 'Add Photo'}</Text>
              </ButtonFeedback>
            </View>

            {/* ── Account Information ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: BLUE + '1A' }]}>
                  <Ionicons name="person-circle-outline" size={15} color={BLUE} />
                </View>
                <Text style={styles.cardTitle}>Account Information</Text>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardBody}>

                <FieldRow label="Full Name" required error={errors.fullName}>
                  <StyledInput
                    value={fullName}
                    onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: null })); }}
                    placeholder="Teacher's full name"
                    autoCapitalize="words"
                    error={errors.fullName}
                  />
                </FieldRow>

                <View style={styles.fieldDivider} />

                <FieldRow label="Email Address" required error={errors.email}>
                  <StyledInput
                    value={email}
                    onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: null })); }}
                    placeholder="teacher@school.edu"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email}
                  />
                </FieldRow>

              </View>
            </View>

            {/* ── Security ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: PURPLE + '1A' }]}>
                  <Ionicons name="lock-closed-outline" size={15} color={PURPLE} />
                </View>
                <Text style={styles.cardTitle}>Security</Text>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardBody}>

                <FieldRow label="Temporary Password" required error={errors.password}>
                  <StyledInput
                    value={password}
                    onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: null })); }}
                    placeholder="Minimum 8 characters"
                    secureTextEntry
                    error={errors.password}
                  />
                </FieldRow>

                <View style={styles.hintBox}>
                  <Ionicons name="information-circle-outline" size={14} color={AMBER} />
                  <Text style={styles.hintText}>
                    The teacher will be asked to set a new password on first login.
                  </Text>
                </View>

              </View>
            </View>

            {/* ── Action buttons ── */}
            <View style={styles.actionRow}>
              <ButtonFeedback style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </ButtonFeedback>
              <ButtonFeedback
                style={[styles.createBtn, loading && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={15} color={SURFACE} />
                <Text style={styles.createBtnText}>{loading ? 'Creating…' : 'Create Teacher'}</Text>
              </ButtonFeedback>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BODY_BG },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: BODY_BG,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  breadcrumb: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  breadcrumbParent: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: MUTED },
  breadcrumbCurrent: { fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: TEXT },

  // ── Layout ────────────────────────────────────────────────────────────────
  scroll: { padding: 20, paddingBottom: 32, alignItems: 'center' },
  layout: { gap: 14, width: '100%', maxWidth: 680 },

  // ── Photo strip ───────────────────────────────────────────────────────────
  photoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: SURFACE, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  photoWrap: { position: 'relative', flexShrink: 0 },
  photoImg: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: BORDER,
  },
  photoEmpty: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: DARK,
    alignItems: 'center', justifyContent: 'center',
  },
  photoCameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: SURFACE,
  },
  photoMeta: { flex: 1, gap: 5 },
  photoName: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: TEXT },
  photoCodePill: {
    alignSelf: 'flex-start',
    backgroundColor: BODY_BG, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: BORDER,
  },
  photoCodeText: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: MUTED, letterSpacing: 0.3 },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: BLUE_L, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0,
  },
  changePhotoBtnText: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: BLUE },

  // ── Action buttons ────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 10 },
  createBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 42, borderRadius: 12, backgroundColor: GREEN,
  },
  createBtnText: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: SURFACE },
  cancelBtn: {
    flex: 1, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SURFACE, borderWidth: 1.5, borderColor: '#C5CDD8',
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: TEXT },

  // ── Section cards ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: SURFACE, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  cardIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: TEXT },
  cardDivider: { height: 1, backgroundColor: BORDER },
  cardBody: { padding: 16, gap: 12 },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldRow: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldRequired: { color: CORAL },
  fieldError: { fontSize: 11, fontFamily: 'Nunito_400Regular', color: CORAL },
  fieldDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: -16, marginVertical: 2 },

  styledInput: {
    backgroundColor: BODY_BG, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 13, fontFamily: 'Nunito_400Regular', color: TEXT,
  },
  styledInputError: { borderColor: CORAL },

  // password
  passwordWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingHorizontal: 0 },
  passwordInput: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 13, fontFamily: 'Nunito_400Regular', color: TEXT,
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 11 },

  // hint
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: AMBER_L, borderRadius: 10, padding: 12, marginTop: 2,
  },
  hintText: { flex: 1, fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: AMBER, lineHeight: 16 },
});
