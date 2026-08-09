import React, { useState } from 'react';
import { ButtonFeedback } from '../../../components/common/ButtonFeedback';
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
const GREEN_L = '#E0F7EC';
const BLUE    = '#4A8FD8';
const BLUE_L  = '#DEEAF8';
const PURPLE  = '#7B68C8';
const PURPLE_L= '#EEEBF8';
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

function StyledInput({ error, ...props }) {
  return (
    <TextInput
      style={[styles.styledInput, error && styles.styledInputError]}
      placeholderTextColor={MUTED}
      {...props}
    />
  );
}

// ── screen ────────────────────────────────────────────────────────────────────
export default function EditTeacherScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { teacher } = route.params;
  const toast = useToast();

  const [fullName, setFullName] = useState(teacher.full_name ?? '');
  const [email,    setEmail]    = useState(teacher.email ?? '');
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
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleUpdate() {
    if (!validate()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('email', email.trim());
      if (photo) {
        const uri  = photo.uri;
        const name = uri.split('/').pop();
        const ext  = name.split('.').pop().toLowerCase();
        const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mime[ext] || 'image/jpeg' });
      }
      await principalApi.updateTeacher(teacher.tid, formData);
      toast.show('Teacher details updated successfully.');
      navigation.goBack();
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const photoUri = photo?.uri || teacher.profile_photo_url;
  const isActive = !teacher.is_first_login;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <ButtonFeedback onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </ButtonFeedback>
        <View style={styles.breadcrumb}>
          <ButtonFeedback onPress={() => navigation.pop(2)} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>Faculty</Text>
          </ButtonFeedback>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
          <ButtonFeedback onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>{teacher.full_name}</Text>
          </ButtonFeedback>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
          <Text style={styles.breadcrumbCurrent}>Edit Profile</Text>
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
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImg} />
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
                <Text style={styles.photoName}>{fullName || teacher.full_name}</Text>
                <View style={styles.photoCodePill}>
                  <Text style={styles.photoCodeText}>{teacher.teacher_code}</Text>
                </View>
                <View style={[
                  styles.photoStatusTag,
                  { backgroundColor: isActive ? GREEN_L : '#FDF0D6', borderColor: isActive ? GREEN + '50' : '#F0A94050' },
                ]}>
                  <View style={[styles.photoStatusDot, { backgroundColor: isActive ? GREEN : '#F0A940' }]} />
                  <Text style={[styles.photoStatusText, { color: isActive ? GREEN : '#F0A940' }]}>
                    {isActive ? 'Active' : 'Pending Setup'}
                  </Text>
                </View>
              </View>
              <ButtonFeedback onPress={pickPhoto} style={styles.changePhotoBtn} activeOpacity={0.8}>
                <Ionicons name="image-outline" size={14} color={BLUE} />
                <Text style={styles.changePhotoBtnText}>Change Photo</Text>
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

            {/* ── Read-only Fields ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: PURPLE_L }]}>
                  <Ionicons name="lock-closed-outline" size={15} color={PURPLE} />
                </View>
                <Text style={styles.cardTitle}>Read-only Fields</Text>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardBody}>

                <FieldRow label="Teacher Code">
                  <View style={[styles.styledInput, styles.readOnlyInput]}>
                    <Text style={styles.readOnlyText}>{teacher.teacher_code}</Text>
                  </View>
                </FieldRow>

                <View style={styles.fieldDivider} />

                <FieldRow label="Account Status">
                  <View style={[styles.styledInput, styles.readOnlyInput]}>
                    <View style={[styles.statusDot, { backgroundColor: isActive ? GREEN : '#F0A940' }]} />
                    <Text style={styles.readOnlyText}>{isActive ? 'Fully Active' : 'Awaiting First Login'}</Text>
                  </View>
                </FieldRow>

              </View>
            </View>

            {/* ── Action buttons ── */}
            <View style={styles.actionRow}>
              <ButtonFeedback style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </ButtonFeedback>
              <ButtonFeedback
                style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-outline" size={15} color={SURFACE} />
                <Text style={styles.saveBtnText}>{loading ? 'Saving…' : 'Save Changes'}</Text>
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
    backgroundColor: BLUE_L, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  photoCodeText: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: BLUE, letterSpacing: 0.3 },
  photoStatusTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1,
  },
  photoStatusDot: { width: 6, height: 6, borderRadius: 3 },
  photoStatusText: { fontSize: 10, fontFamily: 'Nunito_700Bold' },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: BLUE_L, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0,
  },
  changePhotoBtnText: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: BLUE },

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
  readOnlyInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8F9FB',
  },
  readOnlyText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: MUTED },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // ── Action buttons ────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 10 },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 42, borderRadius: 12, backgroundColor: GREEN,
  },
  saveBtnText: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: SURFACE },
  cancelBtn: {
    flex: 1, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SURFACE, borderWidth: 1.5, borderColor: '#C5CDD8',
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: TEXT },
});
