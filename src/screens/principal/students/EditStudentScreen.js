import React, { useState } from 'react';
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={() => navigation.pop(2)} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>Students</Text>
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>{student.full_name}</Text>
          </TouchableOpacity>
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
                  <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={styles.photoWrap}>
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
                  </TouchableOpacity>
                </View>
                <View style={styles.photoCardBottom}>
                  <Text style={styles.photoName}>{student.full_name}</Text>
                  <View style={styles.photoCodePill}>
                    <Text style={styles.photoCodeText}>{student.student_code}</Text>
                  </View>
                  <TouchableOpacity onPress={pickPhoto} style={styles.changePhotoBtn} activeOpacity={0.8}>
                    <Ionicons name="image-outline" size={14} color={BLUE} />
                    <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                  </TouchableOpacity>
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
              <TouchableOpacity
                style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-outline" size={15} color={SURFACE} />
                <Text style={styles.saveBtnText}>{loading ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

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
                  <TouchableOpacity
                    style={[styles.styledInput, styles.selectRow, errors.disability && styles.styledInputError]}
                    onPress={() => setDisabilityOpen((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.selectText, !form.disability && { color: MUTED }]}>
                      {form.disability || 'Select type…'}
                    </Text>
                    <Ionicons name={disabilityOpen ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
                  </TouchableOpacity>
                  {disabilityOpen && (
                    <View style={styles.dropdown}>
                      {DISABILITY_OPTIONS.map((opt, i) => {
                        const active = form.disability === opt;
                        return (
                          <TouchableOpacity
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
                          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: BODY_BG,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  breadcrumb: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  breadcrumbParent: {
    fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: MUTED,
  },
  breadcrumbCurrent: {
    fontSize: 14, fontFamily: 'DMSans_800ExtraBold', color: TEXT,
  },

  // ── Layout ────────────────────────────────────────────────────────────────
  scroll: { padding: 16, paddingBottom: 8 },
  layout: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  leftPanel: { width: 220, gap: 12 },
  rightPanel: { flex: 1, gap: 14 },

  // ── Photo card ────────────────────────────────────────────────────────────
  photoCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
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
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
  },
  photoWrap: { position: 'relative' },
  photoImg: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
  },
  photoEmpty: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoCameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: DARK,
  },
  photoCardBottom: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: -24,
    backgroundColor: SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  photoName: {
    fontSize: 15, fontFamily: 'DMSans_800ExtraBold', color: TEXT,
    textAlign: 'center',
  },
  photoCodePill: {
    backgroundColor: PURPLE_L,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  photoCodeText: {
    fontSize: 11, fontFamily: 'DMSans_700Bold', color: PURPLE, letterSpacing: 0.4,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BLUE_L,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
  },
  changePhotoBtnText: {
    fontSize: 12, fontFamily: 'DMSans_700Bold', color: BLUE,
  },

  // ── Info chip ─────────────────────────────────────────────────────────────
  infoChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoChipText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: MUTED,
    lineHeight: 16,
  },

  // ── Section card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
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
    width: 4,
    alignSelf: 'stretch',
  },
  cardInner: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  cardIconBox: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13, fontFamily: 'DMSans_700Bold', color: TEXT,
  },
  cardFields: {
    padding: 16,
    gap: 12,
  },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldRow: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldRequired: { color: CORAL },
  fieldError: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: CORAL,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: -16,
    marginVertical: 2,
  },
  fieldPair: {
    flexDirection: 'row',
    gap: 12,
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  styledInput: {
    backgroundColor: BODY_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: TEXT,
  },
  styledInputMulti: {
    minHeight: 78,
    textAlignVertical: 'top',
    paddingTop: 10,
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
    height: 44,
  },
  selectText: {
    fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT,
  },
  dropdown: {
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownItemBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  dropdownItemActive: { backgroundColor: PURPLE_L },
  dropdownText: {
    flex: 1, fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT,
  },
  dropdownTextActive: {
    fontFamily: 'DMSans_700Bold', color: PURPLE,
  },

  // ── Left panel action buttons ─────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2E9E63',
  },
  saveBtnText: {
    fontSize: 13, fontFamily: 'DMSans_700Bold', color: SURFACE,
  },
  cancelBtn: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BODY_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelBtnText: {
    fontSize: 13, fontFamily: 'DMSans_700Bold', color: MUTED,
  },
});
