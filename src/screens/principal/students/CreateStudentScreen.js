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

// ── palette ───────────────────────────────────────────────────────────────────
const DARK    = '#0F2F3E';
const GREEN   = '#2E9E63';
const GREEN_L = '#E0F7EC';
const BLUE    = '#4A8FD8';
const BLUE_L  = '#DEEAF8';
const PURPLE  = '#7B68C8';
const PURPLE_L= '#EEEBF8';
const TEAL    = '#3AADA3';
const TEAL_L  = '#E0F5F3';
const AMBER   = '#C9973A';
const AMBER_L = '#FBF4E6';
const CORAL   = '#D95F50';
const CORAL_L = '#FDECEA';
const BODY_BG = '#F2F5F8';
const SURFACE = '#FFFFFF';
const TEXT    = '#1A2E3B';
const MUTED   = '#8A93A8';
const BORDER  = '#E8EEF4';

const DISABILITY_OPTIONS = [
  'ASD Level 1', 'ASD Level 2', 'ASD Level 3',
  'Down Syndrome', 'Intellectual Disability', 'Learning Disability', 'Other',
];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = [{ n: 1, label: 'Student Info' }, { n: 2, label: 'Assign Teacher' }];
  return (
    <View style={styles.stepRow}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <View style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              current === s.n && styles.stepCircleActive,
              current > s.n  && styles.stepCircleDone,
            ]}>
              {current > s.n
                ? <Ionicons name="checkmark" size={13} color={SURFACE} />
                : <Text style={[styles.stepNum, current === s.n && styles.stepNumActive]}>{s.n}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, current >= s.n && styles.stepLabelActive]}>{s.label}</Text>
          </View>
          {i < steps.length - 1 && (
            <View style={[styles.stepLine, current > 1 && styles.stepLineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────
function FieldRow({ label, required, error, children }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={styles.fieldRequired}> *</Text>}
      </Text>
      {children}
      {error ? (
        <View style={styles.fieldErrorRow}>
          <Ionicons name="alert-circle-outline" size={12} color={CORAL} />
          <Text style={styles.fieldError}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StyledInput({ error, icon, ...props }) {
  return (
    <View style={[styles.inputWrap, error && styles.inputWrapError]}>
      {icon && (
        <View style={styles.inputIconBox}>
          <Ionicons name={icon} size={16} color={error ? CORAL : MUTED} />
        </View>
      )}
      <TextInput
        style={[styles.inputText, !icon && styles.inputTextNoIcon]}
        placeholderTextColor={MUTED}
        {...props}
      />
    </View>
  );
}

function SectionCard({ accentColor, iconName, title, children }) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBox, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name={iconName} size={15} color={accentColor} />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardBody}>{children}</View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CreateStudentScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', disability: '',
    father_name: '', mother_name: '', address: '',
    marital_status: '', mobile_number: '', home_number: '',
  });
  const [photo,               setPhoto]               = useState(null);
  const [loading,             setLoading]             = useState(false);
  const [loadingTeachers,     setLoadingTeachers]     = useState(false);
  const [errors,              setErrors]              = useState({});
  const [disabilityOpen,      setDisabilityOpen]      = useState(false);
  const [availableTeachers,   setAvailableTeachers]   = useState([]);
  const [selectedTeacherId,   setSelectedTeacherId]   = useState(null);
  const [teacherPickerOpen,   setTeacherPickerOpen]   = useState(false);

  function setField(key, value) {
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

  function validateStep1() {
    const e = {};
    if (!form.full_name.trim())  e.full_name    = 'Full name is required.';
    if (!form.date_of_birth)     e.date_of_birth= 'Date of birth is required.';
    if (!form.disability.trim()) e.disability   = 'Disability type is required.';
    if (form.mobile_number && !validatePhone(form.mobile_number)) e.mobile_number = 'Enter a valid phone number.';
    if (form.home_number   && !validatePhone(form.home_number))   e.home_number   = 'Enter a valid phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleNext() {
    if (!validateStep1()) return;
    setLoadingTeachers(true);
    try {
      const data = await principalApi.getTeachers();
      setAvailableTeachers(data.filter((t) => (t.students?.length ?? 0) < 5));
    } catch {
      setAvailableTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
    setStep(2);
  }

  async function handleSave(skipTeacher = false) {
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
      const created = await principalApi.createStudent(formData);
      const sid = created?.sid ?? created?.student?.sid;
      if (!skipTeacher && selectedTeacherId && sid) {
        await principalApi.assignStudent(sid, selectedTeacherId);
        toast.show('Student created and assigned successfully.');
      } else {
        toast.show('Student profile created successfully.');
      }
      navigation.navigate('StudentList');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const displayName      = form.full_name.trim() || 'New Student';
  const selectedTeacher  = availableTeachers.find((t) => t.tid === selectedTeacherId);

  // ── Top bar (shared) ──────────────────────────────────────────────────────
  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
      <ButtonFeedback
        onPress={() => step === 1 ? navigation.goBack() : setStep(1)}
        style={styles.backBtn} activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={20} color={TEXT} />
      </ButtonFeedback>
      <View style={styles.breadcrumb}>
        <ButtonFeedback onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.breadcrumbParent}>Students</Text>
        </ButtonFeedback>
        <Ionicons name="chevron-forward" size={14} color={MUTED} />
        <Text style={styles.breadcrumbCurrent}>Add Student</Text>
      </View>
    </View>
  );

  // ── Step 1 ────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {topBar}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.layout}>

              <StepIndicator current={1} />

              {/* Profile card */}
              <View style={styles.photoStrip}>
                <ButtonFeedback onPress={pickPhoto} activeOpacity={0.8} style={styles.avatarWrap}>
                  {photo ? (
                    <Image source={{ uri: photo.uri }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarEmpty}>
                      <Ionicons name="person-outline" size={28} color="rgba(255,255,255,0.4)" />
                    </View>
                  )}
                  <View style={styles.avatarCamera}>
                    <Ionicons name="camera" size={12} color={SURFACE} />
                  </View>
                </ButtonFeedback>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{displayName}</Text>
                  <View style={styles.profileTagRow}>
                    {form.disability ? (
                      <View style={styles.disabilityTag}>
                        <Text style={styles.disabilityTagText}>{form.disability}</Text>
                      </View>
                    ) : (
                      <View style={styles.codePill}>
                        <Ionicons name="pricetag-outline" size={10} color={MUTED} />
                        <Text style={styles.codePillText}>Code auto-generated</Text>
                      </View>
                    )}
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>New</Text>
                    </View>
                  </View>
                </View>
                <ButtonFeedback onPress={pickPhoto} style={styles.photoBtn} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={14} color={BLUE} />
                  <Text style={styles.photoBtnText}>{photo ? 'Change' : 'Add Photo'}</Text>
                </ButtonFeedback>
              </View>

              {/* Required Information */}
              <SectionCard accentColor={PURPLE} iconName="star-outline" title="Required Information">

                <FieldRow label="Full Name" required error={errors.full_name}>
                  <StyledInput
                    value={form.full_name}
                    onChangeText={(v) => setField('full_name', v)}
                    placeholder="Student's full name"
                    autoCapitalize="words"
                    error={errors.full_name}
                    icon="person-outline"
                  />
                </FieldRow>

                <View style={styles.fieldDivider} />

                <FieldRow label="Date of Birth" required error={errors.date_of_birth}>
                  <DatePickerField
                    value={form.date_of_birth}
                    onChange={(v) => setField('date_of_birth', v)}
                    maximumDate={new Date()}
                    error={errors.date_of_birth}
                  />
                </FieldRow>

                <View style={styles.fieldDivider} />

                {/* Disability picker */}
                <FieldRow label="Disability Type" required error={errors.disability}>
                  <ButtonFeedback
                    style={[styles.selectWrap, errors.disability && styles.inputWrapError]}
                    onPress={() => setDisabilityOpen((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.inputIconBox}>
                      <Ionicons name="medical-outline" size={16} color={MUTED} />
                    </View>
                    <Text style={[styles.inputText, styles.inputTextNoIcon, !form.disability && { color: MUTED }]}>
                      {form.disability || 'Select disability type'}
                    </Text>
                    <View style={styles.selectChevron}>
                      <Ionicons name={disabilityOpen ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
                    </View>
                  </ButtonFeedback>
                  {disabilityOpen && (
                    <View style={styles.dropdown}>
                      {DISABILITY_OPTIONS.map((opt) => (
                        <ButtonFeedback
                          key={opt}
                          style={[styles.dropdownItem, form.disability === opt && styles.dropdownItemActive]}
                          onPress={() => { setField('disability', opt); setDisabilityOpen(false); }}
                        >
                          <Text style={[styles.dropdownText, form.disability === opt && styles.dropdownTextActive]}>{opt}</Text>
                          {form.disability === opt && <Ionicons name="checkmark-circle" size={16} color={PURPLE} />}
                        </ButtonFeedback>
                      ))}
                    </View>
                  )}
                </FieldRow>

              </SectionCard>

              {/* Parent / Guardian */}
              <SectionCard accentColor={TEAL} iconName="people-outline" title="Parent / Guardian">

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Father's Name">
                      <StyledInput
                        value={form.father_name}
                        onChangeText={(v) => setField('father_name', v)}
                        placeholder="Optional"
                        autoCapitalize="words"
                        icon="person-outline"
                      />
                    </FieldRow>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Mother's Name">
                      <StyledInput
                        value={form.mother_name}
                        onChangeText={(v) => setField('mother_name', v)}
                        placeholder="Optional"
                        autoCapitalize="words"
                        icon="person-outline"
                      />
                    </FieldRow>
                  </View>
                </View>

                <View style={styles.fieldDivider} />

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Mobile Number" error={errors.mobile_number}>
                      <StyledInput
                        value={form.mobile_number}
                        onChangeText={(v) => setField('mobile_number', v)}
                        placeholder="+94771234567"
                        keyboardType="phone-pad"
                        error={errors.mobile_number}
                        icon="phone-portrait-outline"
                      />
                    </FieldRow>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldRow label="Home Number" error={errors.home_number}>
                      <StyledInput
                        value={form.home_number}
                        onChangeText={(v) => setField('home_number', v)}
                        placeholder="+94112345678"
                        keyboardType="phone-pad"
                        error={errors.home_number}
                        icon="call-outline"
                      />
                    </FieldRow>
                  </View>
                </View>

              </SectionCard>

              {/* Additional Details */}
              <SectionCard accentColor={AMBER} iconName="document-text-outline" title="Additional Details">

                <FieldRow label="Home Address">
                  <StyledInput
                    value={form.address}
                    onChangeText={(v) => setField('address', v)}
                    placeholder="Street, city"
                    autoCapitalize="sentences"
                    icon="home-outline"
                  />
                </FieldRow>

                <View style={styles.fieldDivider} />

                <FieldRow label="Marital Status of Parents">
                  <StyledInput
                    value={form.marital_status}
                    onChangeText={(v) => setField('marital_status', v)}
                    placeholder="e.g. Married, Divorced, N/A"
                    icon="heart-outline"
                  />
                </FieldRow>

              </SectionCard>

              {/* Buttons */}
              <View style={styles.actionRow}>
                <ButtonFeedback style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </ButtonFeedback>
                <ButtonFeedback
                  style={[styles.primaryBtn, loadingTeachers && { opacity: 0.7 }]}
                  onPress={handleNext}
                  disabled={loadingTeachers}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>{loadingTeachers ? 'Loading…' : 'Next'}</Text>
                  <Ionicons name="arrow-forward-outline" size={16} color={SURFACE} />
                </ButtonFeedback>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {topBar}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.layout}>

          <StepIndicator current={2} />

          {/* Header info card */}
          <View style={styles.assignHeaderCard}>
            <View style={styles.assignIconBox}>
              <Ionicons name="person-add-outline" size={22} color={PURPLE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assignTitle}>Assign to a Teacher</Text>
              <Text style={styles.assignSub}>
                Only teachers with fewer than 5 students are shown. You can skip this and assign later.
              </Text>
            </View>
          </View>

          {/* Teacher picker */}
          <SectionCard accentColor={PURPLE} iconName="people-outline" title="Select Teacher (Optional)">
            {availableTeachers.length === 0 ? (
              <View style={styles.noTeachersBox}>
                <Ionicons name="information-circle-outline" size={16} color={AMBER} />
                <Text style={styles.noTeachersText}>No teachers are currently available for allocation.</Text>
              </View>
            ) : (
              <View style={styles.teacherList}>
                {availableTeachers.map((t) => {
                  const count    = t.students?.length ?? 0;
                  const selected = selectedTeacherId === t.tid;
                  const initials = t.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                  const slotColor = count <= 1 ? GREEN : count <= 3 ? BLUE : AMBER;
                  return (
                    <ButtonFeedback
                      key={t.tid}
                      style={[styles.teacherCard, selected && styles.teacherCardSelected]}
                      onPress={() => setSelectedTeacherId(selected ? null : t.tid)}
                      activeOpacity={0.8}
                    >
                      {/* Avatar */}
                      {t.profile_photo_url ? (
                        <Image source={{ uri: t.profile_photo_url }} style={styles.teacherAvatar} />
                      ) : (
                        <View style={[styles.teacherAvatarFallback, { backgroundColor: selected ? PURPLE : BODY_BG }]}>
                          <Text style={[styles.teacherInitials, { color: selected ? SURFACE : MUTED }]}>{initials}</Text>
                        </View>
                      )}

                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.teacherCardName, selected && { color: PURPLE }]}>{t.full_name}</Text>
                        <View style={styles.teacherCardMeta}>
                          <View style={styles.teacherCodePill}>
                            <Text style={styles.teacherCodeText}>{t.teacher_code}</Text>
                          </View>
                          <Text style={styles.teacherSlotText}>{count}/5 students</Text>
                        </View>
                        {/* Capacity dots */}
                        <View style={styles.capacityDots}>
                          {[0, 1, 2, 3, 4].map((i) => (
                            <View
                              key={i}
                              style={[
                                styles.capacityDot,
                                { backgroundColor: i < count ? slotColor : BORDER },
                              ]}
                            />
                          ))}
                          <Text style={[styles.capacityLabel, { color: slotColor }]}>
                            {5 - count} slot{5 - count !== 1 ? 's' : ''} available
                          </Text>
                        </View>
                      </View>

                      {/* Selected indicator */}
                      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                        {selected && <View style={styles.radioInner} />}
                      </View>
                    </ButtonFeedback>
                  );
                })}
              </View>
            )}
          </SectionCard>

          {/* Student summary */}
          <SectionCard accentColor={BLUE} iconName="document-outline" title="Student Summary">
            {[
              { label: 'Full Name',   value: form.full_name,    icon: 'person-outline' },
              { label: 'Date of Birth', value: form.date_of_birth, icon: 'calendar-outline' },
              { label: 'Disability',  value: form.disability,   icon: 'medical-outline' },
            ].map(({ label, value, icon }) => (
              <View key={label} style={styles.summaryRow}>
                <View style={styles.summaryLabelRow}>
                  <Ionicons name={icon} size={13} color={MUTED} />
                  <Text style={styles.summaryLabel}>{label}</Text>
                </View>
                <Text style={styles.summaryValue}>{value}</Text>
              </View>
            ))}
          </SectionCard>

          {/* Buttons */}
          <View style={styles.actionRow}>
            <ButtonFeedback style={styles.cancelBtn} onPress={() => setStep(1)} activeOpacity={0.8}>
              <Ionicons name="arrow-back-outline" size={15} color={TEXT} />
              <Text style={styles.cancelBtnText}>Back</Text>
            </ButtonFeedback>
            <ButtonFeedback
              style={[styles.skipBtn, loading && { opacity: 0.7 }]}
              onPress={() => handleSave(true)}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.skipBtnText}>{loading ? '…' : 'Skip & Save'}</Text>
            </ButtonFeedback>
            <ButtonFeedback
              style={[styles.primaryBtn, { flex: 2 }, (loading || (availableTeachers.length > 0 && !selectedTeacherId)) && { opacity: 0.5 }]}
              onPress={() => handleSave(false)}
              disabled={loading || (availableTeachers.length > 0 && !selectedTeacherId)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-outline" size={16} color={SURFACE} />
              <Text style={styles.primaryBtnText}>{loading ? 'Saving…' : 'Save & Assign'}</Text>
            </ButtonFeedback>
          </View>

        </View>
      </ScrollView>
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
  breadcrumbParent:  { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: MUTED },
  breadcrumbCurrent: { fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: TEXT },

  // ── Layout ────────────────────────────────────────────────────────────────
  scroll: { padding: 20, paddingBottom: 32, alignItems: 'center' },
  layout: { gap: 14, width: '100%', maxWidth: 680 },

  // ── Step indicator ────────────────────────────────────────────────────────
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { alignItems: 'center', gap: 5 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: SURFACE, borderWidth: 2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { borderColor: PURPLE, backgroundColor: PURPLE },
  stepCircleDone:   { borderColor: GREEN,  backgroundColor: GREEN  },
  stepNum:          { fontSize: 13, fontFamily: 'Nunito_700Bold', color: MUTED },
  stepNumActive:    { color: SURFACE },
  stepLabel:        { fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: MUTED },
  stepLabelActive:  { color: TEXT, fontFamily: 'Nunito_700Bold' },
  stepLine:         { flex: 1, height: 2, backgroundColor: BORDER, marginHorizontal: 10, marginBottom: 16 },
  stepLineDone:     { backgroundColor: GREEN },

  // ── Photo strip ───────────────────────────────────────────────────────────
  photoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: SURFACE, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatarImg: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: BORDER,
  },
  avatarEmpty: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: DARK,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCamera: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: SURFACE,
  },
  profileInfo: { flex: 1, gap: 5 },
  profileName: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: TEXT },
  profileTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: BODY_BG, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: BORDER,
  },
  codePillText: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: MUTED },
  disabilityTag: {
    backgroundColor: AMBER_L, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  disabilityTagText: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: AMBER },
  newBadge: {
    backgroundColor: GREEN + '20', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeText: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: GREEN },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: BLUE_L, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0,
  },
  photoBtnText: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: BLUE },

  // ── Section cards ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: SURFACE, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardAccent: { width: 4 },
  cardInner:  { flex: 1 },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardIconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle:   { fontSize: 14, fontFamily: 'Nunito_700Bold', color: TEXT },
  cardDivider: { height: 1, backgroundColor: BORDER },
  cardBody:    { padding: 16, gap: 14 },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldRow:      { gap: 7 },
  fieldLabel:    { fontSize: 11, fontFamily: 'Nunito_700Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldRequired: { color: CORAL },
  fieldErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldError:    { fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: CORAL },
  fieldDivider:  { height: 1, backgroundColor: BORDER },
  twoCol:        { flexDirection: 'row', gap: 12 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BODY_BG, borderRadius: 11,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  inputWrapError: { borderColor: CORAL, backgroundColor: '#FEF6F5' },
  inputIconBox: {
    width: 42, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: BORDER, paddingVertical: 12,
  },
  inputText: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 13, fontFamily: 'Nunito_400Regular', color: TEXT,
  },
  inputTextNoIcon: { paddingHorizontal: 14 },

  // ── Picker ────────────────────────────────────────────────────────────────
  selectWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BODY_BG, borderRadius: 11,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  selectChevron: { paddingHorizontal: 12 },
  dropdown: {
    marginTop: 6, backgroundColor: SURFACE, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  dropdownItemActive: { backgroundColor: PURPLE_L },
  dropdownText:       { flex: 1, fontSize: 13, fontFamily: 'Nunito_400Regular', color: TEXT },
  dropdownTextActive: { color: PURPLE, fontFamily: 'Nunito_700Bold' },
  teacherMeta:        { fontSize: 11, fontFamily: 'Nunito_400Regular', color: MUTED, marginTop: 2 },

  // ── Step 2 ────────────────────────────────────────────────────────────────
  assignHeaderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: PURPLE_L, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: PURPLE + '30',
  },
  assignIconBox: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: PURPLE + '20',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  assignTitle: { fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: TEXT, marginBottom: 3 },
  assignSub:   { fontSize: 12, fontFamily: 'Nunito_400Regular', color: MUTED, lineHeight: 17 },

  noTeachersBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: AMBER_L, borderRadius: 10, padding: 12,
  },
  noTeachersText: { flex: 1, fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: AMBER },

  // ── Teacher cards ─────────────────────────────────────────────────────────
  teacherList: { gap: 10 },
  teacherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: BODY_BG, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER,
    padding: 14,
  },
  teacherCardSelected: {
    backgroundColor: PURPLE_L, borderColor: PURPLE,
  },
  teacherAvatar: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
  teacherAvatarFallback: {
    width: 48, height: 48, borderRadius: 24, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  teacherInitials: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  teacherCardName: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: TEXT, marginBottom: 4 },
  teacherCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  teacherCodePill: {
    backgroundColor: SURFACE, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: BORDER,
  },
  teacherCodeText: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: MUTED },
  teacherSlotText: { fontSize: 11, fontFamily: 'Nunito_400Regular', color: MUTED },
  capacityDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  capacityDot: { width: 8, height: 8, borderRadius: 4 },
  capacityLabel: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', marginLeft: 2 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioOuterSelected: { borderColor: PURPLE },
  radioInner: {
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: PURPLE,
  },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryLabel:    { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: MUTED },
  summaryValue:    { fontSize: 13, fontFamily: 'Nunito_700Bold', color: TEXT, flex: 1, textAlign: 'right' },

  // ── Action buttons ────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, height: 46, borderRadius: 13, backgroundColor: GREEN,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnText: { fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: SURFACE },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: SURFACE, borderWidth: 1.5, borderColor: '#C5CDD8',
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: TEXT },
  skipBtn: {
    flex: 1, height: 46, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BODY_BG, borderWidth: 1.5, borderColor: '#C5CDD8',
  },
  skipBtnText: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: MUTED },
});
