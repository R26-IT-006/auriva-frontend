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
import DatePickerField from '../../../components/common/DatePickerField';
import { principalApi } from '../../../api/principal';
import { validatePhone } from '../../../utils/validation';
import { useToast } from '../../../context/ToastContext';
import { rs, rf } from '../../../utils/responsive';

// ── palette ───────────────────────────────────────────────────────────────────
const DARK     = '#0F2F3E';
const DARK2    = '#1A3A4A';
const GREEN    = '#3EBF78';
const GREEN_L  = '#E0F7EC';
const BLUE     = '#4A8FD8';
const BLUE_L   = '#DEEAF8';
const PURPLE   = '#7B68C8';
const PURPLE_L = '#EEEBF8';
const AMBER    = '#F0A940';
const AMBER_L  = '#FDF0D6';
const CORAL    = '#D95F50';
const CORAL_L  = '#FDECEA';
const BODY_BG  = '#F2F5F8';
const SURFACE  = '#FFFFFF';
const TEXT     = '#1A2E3B';
const MUTED    = '#8A93A8';
const BORDER   = '#E8EEF4';

const DISABILITY_OPTIONS = [
  'ASD Level 1', 'ASD Level 2', 'ASD Level 3',
  'Down Syndrome', 'Intellectual Disability', 'Learning Disability', 'Other',
];

// ── field row (label + input + optional error) ────────────────────────────────
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
      style={[styles.styledInput, error && styles.styledInputError, props.multiline && styles.styledInputMulti]}
      placeholderTextColor={MUTED}
      {...props}
    />
  );
}

// ── section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon, accent, children }) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBox, { backgroundColor: accent + '1A' }]}>
            <Ionicons name={icon} size={15} color={accent} />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View style={styles.cardFields}>{children}</View>
      </View>
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────
export default function EditStudentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { student } = route.params;
  const toast = useToast();

  const [form, setForm] = useState({
    full_name:      student.full_name ?? '',
    date_of_birth:  student.date_of_birth?.slice(0, 10) ?? '',
    disability:     student.disability ?? '',
    father_name:    student.father_name ?? '',
    mother_name:    student.mother_name ?? '',
    address:        student.address ?? '',
    marital_status: student.marital_status ?? '',
    mobile_number:  student.mobile_number ?? '',
    home_number:    student.home_number ?? '',
  });
  const [photo,                setPhoto]                = useState(null);
  const [loading,              setLoading]              = useState(false);
  const [errors,               setErrors]               = useState({});
  const [disabilityOpen,       setDisabilityOpen]       = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: null }));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  function validate() {
    const e = {};
    if (!form.full_name.trim())  e.full_name  = 'Full name is required.';
    if (!form.disability.trim()) e.disability = 'Please select a disability type.';
    if (form.mobile_number && !validatePhone(form.mobile_number))
      e.mobile_number = 'Enter a valid phone number.';
    if (form.home_number && !validatePhone(form.home_number))
      e.home_number = 'Enter a valid phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleUpdate() {
    if (!validate()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v && v.trim()) formData.append(k, v.trim()); });
      if (photo) {
        const uri  = photo.uri;
        const name = uri.split('/').pop();
        const ext  = name.split('.').pop().toLowerCase();
        const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mime[ext] || 'image/jpeg' });
      }
      await principalApi.updateStudent(student.sid, formData);
      toast.show('Student profile updated successfully.');
      navigation.goBack();
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const photoUri = photo?.uri || student.profile_photo_url;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <ButtonFeedback onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </ButtonFeedback>
        <View style={styles.breadcrumb}>
          <ButtonFeedback onPress={() => navigation.pop(2)} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>Students</Text>
          </ButtonFeedback>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
          <ButtonFeedback onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>{student.full_name}</Text>
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

          {/* ── Left panel: photo identity ── */}
          <View style={styles.layout}>
            <View style={styles.leftPanel}>

              {/* Photo card */}
              <View style={styles.photoCard}>
                <View style={styles.photoCardTop}>
                  <ButtonFeedback onPress={pickPhoto} activeOpacity={0.8} style={styles.photoWrap}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.photoImg} />
                    ) : (
                      <View style={styles.photoEmpty}>
                        <Ionicons name="person-outline" size={34} color="rgba(255,255,255,0.4)" />
                      </View>
                    )}
                    <View style={styles.photoCameraBtn}>
                      <Ionicons name="camera" size={13} color={SURFACE} />
                    </View>
                  </ButtonFeedback>
                </View>
                <View style={styles.photoCardBottom}>
                  <Text style={styles.photoName}>{student.full_name}</Text>
                  <View style={styles.photoCodePill}>
                    <Text style={styles.photoCodeText}>{student.student_code}</Text>
                  </View>
                  <ButtonFeedback onPress={pickPhoto} style={styles.changePhotoBtn} activeOpacity={0.8}>
                    <Ionicons name="image-outline" size={14} color={BLUE} />
                    <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                  </ButtonFeedback>
                </View>
              </View>

              {/* Student code info card */}
              <View style={styles.infoChip}>
                <Ionicons name="information-circle-outline" size={15} color={MUTED} />
                <Text style={styles.infoChipText}>
                  Student code and assignment cannot be changed here.
                </Text>
              </View>

              {/* Action buttons */}
              <ButtonFeedback
                style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-outline" size={15} color={SURFACE} />
                <Text style={styles.saveBtnText}>{loading ? 'Saving…' : 'Save Changes'}</Text>
              </ButtonFeedback>
              <ButtonFeedback style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </ButtonFeedback>

            </View>

            {/* ── Right panel: form ── */}
            <View style={styles.rightPanel}>

              {/* Required */}
              <SectionCard title="Required Information" icon="star-outline" accent={PURPLE}>
                <FieldRow label="Full Name" required error={errors.full_name}>
                  <StyledInput
                    value={form.full_name}
                    onChangeText={(v) => set('full_name', v)}
                    placeholder="Student's full name"
                    autoCapitalize="words"
                    error={errors.full_name}
                  />
                </FieldRow>

                <View style={styles.fieldDivider} />

                <FieldRow label="Date of Birth">
                  <DatePickerField
                    value={form.date_of_birth}
                    onChange={(v) => set('date_of_birth', v)}
                    maximumDate={new Date()}
                    error={errors.date_of_birth}
                  />
                </FieldRow>

                <View style={styles.fieldDivider} />

                <FieldRow label="Disability Type" required error={errors.disability}>
                  <ButtonFeedback
                    style={[styles.styledInput, styles.selectRow, errors.disability && styles.styledInputError]}
                    onPress={() => setDisabilityOpen((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.selectText, !form.disability && { color: MUTED }]}>
                      {form.disability || 'Select type…'}
                    </Text>
                    <Ionicons name={disabilityOpen ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
                  </ButtonFeedback>
                  {disabilityOpen && (
                    <View style={styles.dropdown}>
                      {DISABILITY_OPTIONS.map((opt, i) => {
                        const active = form.disability === opt;
                        return (
                          <ButtonFeedback
                            key={opt}
                            style={[
                              styles.dropdownItem,
                              active && styles.dropdownItemActive,
                              i > 0 && styles.dropdownItemBorder,
                            ]}
                            onPress={() => { set('disability', opt); setDisabilityOpen(false); }}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>{opt}</Text>
                            {active && <Ionicons name="checkmark-circle" size={16} color={PURPLE} />}
                          </ButtonFeedback>
                        );
                      })}
                    </View>
                  )}
                </FieldRow>
              </SectionCard>

              {/* Parent / Guardian */}
              <SectionCard title="Parent / Guardian" icon="people-outline" accent={BLUE}>
                <View style={styles.fieldPair}>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Father's Name">
                      <StyledInput
                        value={form.father_name}
                        onChangeText={(v) => set('father_name', v)}
                        placeholder="Optional"
                        autoCapitalize="words"
                      />
                    </FieldRow>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Mother's Name">
                      <StyledInput
                        value={form.mother_name}
                        onChangeText={(v) => set('mother_name', v)}
                        placeholder="Optional"
                        autoCapitalize="words"
                      />
                    </FieldRow>
                  </View>
                </View>

                <View style={styles.fieldDivider} />

                <View style={styles.fieldPair}>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Mobile Number" error={errors.mobile_number}>
                      <StyledInput
                        value={form.mobile_number}
                        onChangeText={(v) => set('mobile_number', v)}
                        placeholder="+94771234567"
                        keyboardType="phone-pad"
                        error={errors.mobile_number}
                      />
                    </FieldRow>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Home Number" error={errors.home_number}>
                      <StyledInput
                        value={form.home_number}
                        onChangeText={(v) => set('home_number', v)}
                        placeholder="+94112345678"
                        keyboardType="phone-pad"
                        error={errors.home_number}
                      />
                    </FieldRow>
                  </View>
                </View>
              </SectionCard>

              {/* Additional */}
              <SectionCard title="Additional Details" icon="document-text-outline" accent={AMBER}>
                <View style={styles.fieldPair}>
                  <View style={{ flex: 2 }}>
                    <FieldRow label="Address">
                      <StyledInput
                        value={form.address}
                        onChangeText={(v) => set('address', v)}
                        placeholder="Home address"
                        autoCapitalize="sentences"
                        multiline
                        numberOfLines={3}
                      />
                    </FieldRow>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Marital Status">
                      <StyledInput
                        value={form.marital_status}
                        onChangeText={(v) => set('marital_status', v)}
                        placeholder="e.g. N/A"
                        autoCapitalize="words"
                      />
                    </FieldRow>
                  </View>
                </View>
              </SectionCard>

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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    paddingHorizontal: rs(16),
    paddingBottom: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: rs(10),
  },
  backBtn: {
    width: rs(36), height: rs(36), borderRadius: rs(10),
    backgroundColor: BODY_BG,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  breadcrumb: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(4),
  },
  breadcrumbParent: {
    fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', color: MUTED,
  },
  breadcrumbCurrent: {
    fontSize: rf(14), fontFamily: 'DMSans_800ExtraBold', color: TEXT,
  },

  // ── Layout ────────────────────────────────────────────────────────────────
  scroll: { padding: rs(16), paddingBottom: rs(8) },
  layout: { flexDirection: 'row', gap: rs(16), alignItems: 'flex-start' },
  leftPanel: { width: rs(220), gap: rs(12) },
  rightPanel: { flex: 1, gap: rs(14) },

  // ── Photo card ────────────────────────────────────────────────────────────
  photoCard: {
    backgroundColor: SURFACE,
    borderRadius: rs(18),
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  photoCardTop: {
    backgroundColor: DARK,
    paddingTop: rs(28),
    paddingBottom: rs(36),
    alignItems: 'center',
  },
  photoWrap: { position: 'relative' },
  photoImg: {
    width: rs(88), height: rs(88), borderRadius: rs(44),
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
  },
  photoEmpty: {
    width: rs(88), height: rs(88), borderRadius: rs(44),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoCameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: rs(26), height: rs(26), borderRadius: rs(13),
    backgroundColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: DARK,
  },
  photoCardBottom: {
    alignItems: 'center',
    paddingTop: rs(14),
    paddingBottom: rs(18),
    paddingHorizontal: rs(12),
    gap: rs(8),
    marginTop: rs(-24),
    backgroundColor: SURFACE,
    borderTopLeftRadius: rs(20),
    borderTopRightRadius: rs(20),
  },
  photoName: {
    fontSize: rf(15), fontFamily: 'DMSans_800ExtraBold', color: TEXT,
    textAlign: 'center',
  },
  photoCodePill: {
    backgroundColor: PURPLE_L,
    borderRadius: rs(20),
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
  },
  photoCodeText: {
    fontSize: rf(11), fontFamily: 'DMSans_700Bold', color: PURPLE, letterSpacing: 0.4,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5),
    backgroundColor: BLUE_L,
    borderRadius: rs(8),
    paddingHorizontal: rs(12),
    paddingVertical: rs(7),
    marginTop: 2,
  },
  changePhotoBtnText: {
    fontSize: rf(12), fontFamily: 'DMSans_700Bold', color: BLUE,
  },

  // ── Info chip ─────────────────────────────────────────────────────────────
  infoChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(8),
    backgroundColor: SURFACE,
    borderRadius: rs(12),
    padding: rs(12),
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoChipText: {
    flex: 1,
    fontSize: rf(11),
    fontFamily: 'DMSans_400Regular',
    color: MUTED,
    lineHeight: rf(16),
  },

  // ── Section card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: SURFACE,
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardAccentBar: {
    width: rs(4),
    alignSelf: 'stretch',
  },
  cardInner: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    paddingHorizontal: rs(16),
    paddingVertical: rs(13),
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  cardIconBox: {
    width: rs(30), height: rs(30), borderRadius: rs(8),
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: rf(13), fontFamily: 'DMSans_700Bold', color: TEXT,
  },
  cardFields: {
    padding: rs(16),
    gap: rs(12),
  },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldRow: { gap: rs(6) },
  fieldLabel: {
    fontSize: rf(11),
    fontFamily: 'DMSans_700Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldRequired: { color: CORAL },
  fieldError: {
    fontSize: rf(11),
    fontFamily: 'DMSans_400Regular',
    color: CORAL,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: rs(-16),
    marginVertical: 2,
  },
  fieldPair: {
    flexDirection: 'row',
    gap: rs(12),
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  styledInput: {
    backgroundColor: BODY_BG,
    borderRadius: rs(10),
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: rs(12),
    paddingVertical: rs(11),
    fontSize: rf(13),
    fontFamily: 'DMSans_400Regular',
    color: TEXT,
  },
  styledInputMulti: {
    minHeight: rs(78),
    textAlignVertical: 'top',
    paddingTop: rs(10),
  },
  styledInputError: {
    borderColor: CORAL,
  },

  // ── Disability picker ─────────────────────────────────────────────────────
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
    height: rs(44),
  },
  selectText: {
    fontSize: rf(13), fontFamily: 'DMSans_400Regular', color: TEXT,
  },
  dropdown: {
    backgroundColor: SURFACE,
    borderRadius: rs(10),
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: rs(4),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(14),
    paddingVertical: rs(11),
  },
  dropdownItemBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  dropdownItemActive: { backgroundColor: PURPLE_L },
  dropdownText: {
    flex: 1, fontSize: rf(13), fontFamily: 'DMSans_400Regular', color: TEXT,
  },
  dropdownTextActive: {
    fontFamily: 'DMSans_700Bold', color: PURPLE,
  },

  // ── Left panel action buttons ─────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(6),
    height: rs(38),
    borderRadius: rs(10),
    backgroundColor: '#2E9E63',
  },
  saveBtnText: {
    fontSize: rf(13), fontFamily: 'DMSans_700Bold', color: SURFACE,
  },
  cancelBtn: {
    height: rs(36),
    borderRadius: rs(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BODY_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelBtnText: {
    fontSize: rf(13), fontFamily: 'DMSans_700Bold', color: MUTED,
  },
});
