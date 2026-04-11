import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import DatePickerField from '../../../components/common/DatePickerField';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { principalApi } from '../../../api/principal';
import { validatePhone } from '../../../utils/validation';
import { useToast } from '../../../context/ToastContext';
import { Breadcrumb } from '../../../components/common/Breadcrumb';

const K = {
  purple:     '#8A80BC',
  purpleLight:'#EFEDF8',
  teal:       '#4AADA3',
  tealLight:  '#E8F6F5',
  coral:      '#D97B6C',
  coralLight: '#FAF0EE',
  amber:      '#C9973A',
  amberLight: '#FBF4E6',
  green:      '#5BAF85',
  greenLight: '#EAF6F1',
  bg:         '#F2F1F8',
  banner:     '#0F3D2E',
};

const DISABILITY_OPTIONS = [
  'ASD Level 1', 'ASD Level 2', 'ASD Level 3',
  'Down Syndrome', 'Intellectual Disability', 'Learning Disability', 'Other',
];

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = [
    { n: 1, label: 'Student Info' },
    { n: 2, label: 'Assign Teacher' },
  ];
  return (
    <View style={stepStyles.wrapper}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <View style={stepStyles.step}>
            <View style={[
              stepStyles.circle,
              current === s.n && stepStyles.circleActive,
              current > s.n  && stepStyles.circleDone,
            ]}>
              {current > s.n
                ? <Ionicons name="checkmark" size={13} color="#FFF" />
                : <Text style={[stepStyles.circleText, current === s.n && stepStyles.circleTextActive]}>{s.n}</Text>
              }
            </View>
            <Text style={[stepStyles.stepLabel, current >= s.n && stepStyles.stepLabelActive]}>{s.label}</Text>
          </View>
          {i < steps.length - 1 && (
            <View style={[stepStyles.line, current > s.n && stepStyles.lineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrapper:   { flexDirection: 'row', alignItems: 'center', marginBottom: Layout.spacing.lg },
  step:      { alignItems: 'center', gap: 4 },
  circle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.surface,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  circleActive: { borderColor: K.purple, backgroundColor: K.purple },
  circleDone:   { borderColor: K.green,  backgroundColor: K.green  },
  circleText:   { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, color: Colors.text.muted },
  circleTextActive: { color: '#FFF' },
  stepLabel:    { fontSize: 10, color: Colors.text.muted, fontWeight: Layout.fontWeight.medium },
  stepLabelActive: { color: K.purple, fontWeight: Layout.fontWeight.bold },
  line: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: Layout.spacing.sm, marginBottom: 14 },
  lineDone: { backgroundColor: K.green },
});

function SectionHeader({ icon, label, color, bg }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CreateStudentScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape  = width > height;
  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', disability: '',
    father_name: '', mother_name: '', address: '',
    marital_status: '', mobile_number: '', home_number: '',
  });
  const [photo, setPhoto]                       = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [loadingTeachers, setLoadingTeachers]   = useState(false);
  const [errors, setErrors]                     = useState({});
  const [showDisabilityPicker, setShowDisabilityPicker] = useState(false);
  const [availableTeachers, setAvailableTeachers]       = useState([]);
  const [selectedTeacherId, setSelectedTeacherId]       = useState(null);
  const [showTeacherPicker, setShowTeacherPicker]       = useState(false);

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

  function validateStep1() {
    const e = {};
    if (!form.full_name.trim())  e.full_name = 'Full Name is required.';
    if (!form.date_of_birth) e.date_of_birth = 'Date of Birth is required.';
    if (!form.disability.trim()) e.disability = 'Disability is required.';
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
      setAvailableTeachers(data.filter((t) => !t.is_first_login && (t.students?.length ?? 0) < 3));
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
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
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

  // ── Step 1 ────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Breadcrumb
          crumbs={[
            { label: 'Students', onPress: () => navigation.goBack() },
            { label: 'Add Student' },
          ]}
          title="Add Student"
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }}>
              <StepIndicator current={1} />

              {/* Photo hero */}
              <View style={styles.photoCard}>
                <View style={styles.photoBanner} />
                <View style={styles.photoBody}>
                  <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={styles.photoTouch}>
                    {photo ? (
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Ionicons name="camera-outline" size={28} color={Colors.icon.default} />
                      </View>
                    )}
                    <View style={styles.photoBadge}>
                      <Ionicons name="camera" size={11} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.photoHint}>Tap to add photo</Text>
                </View>
              </View>

              {/* Required */}
              <SectionHeader icon="star-outline" label="Required Information" color={K.purple} bg={K.purpleLight} />
              <View style={styles.formCard}>
                <Input
                  label="Full Name *"
                  value={form.full_name}
                  onChangeText={(v) => set('full_name', v)}
                  placeholder="Student's full name"
                  autoCapitalize="words"
                  leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
                  error={errors.full_name}
                />
                <DatePickerField
                  label="Date of Birth *"
                  value={form.date_of_birth}
                  onChange={(v) => set('date_of_birth', v)}
                  maximumDate={new Date()}
                  error={errors.date_of_birth}
                />
                <View>
                  <Text style={styles.selectLabel}>Disability *</Text>
                  <TouchableOpacity
                    style={[styles.selectBtn, errors.disability && { borderColor: Colors.status.error }]}
                    onPress={() => setShowDisabilityPicker((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.selectText, !form.disability && { color: Colors.text.muted }]}>
                      {form.disability || 'Select disability type'}
                    </Text>
                    <Ionicons name={showDisabilityPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.icon.default} />
                  </TouchableOpacity>
                  {errors.disability && <Text style={styles.fieldError}>{errors.disability}</Text>}
                  {showDisabilityPicker && (
                    <View style={styles.dropdown}>
                      {DISABILITY_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.dropdownItem, form.disability === opt && styles.dropdownItemActive]}
                          onPress={() => { set('disability', opt); setShowDisabilityPicker(false); }}
                        >
                          <Text style={[styles.dropdownText, form.disability === opt && styles.dropdownTextActive]}>{opt}</Text>
                          {form.disability === opt && <Ionicons name="checkmark" size={16} color={K.purple} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Parent / Guardian */}
              <SectionHeader icon="people-outline" label="Parent / Guardian" color={K.teal} bg={K.tealLight} />
              <View style={styles.formCard}>
                <Input label="Father's Name" value={form.father_name} onChangeText={(v) => set('father_name', v)} placeholder="Optional" autoCapitalize="words" leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />} />
                <Input label="Mother's Name" value={form.mother_name} onChangeText={(v) => set('mother_name', v)} placeholder="Optional" autoCapitalize="words" leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />} />
                <Input label="Mobile Number" value={form.mobile_number} onChangeText={(v) => set('mobile_number', v)} placeholder="+94771234567" keyboardType="phone-pad" leftIcon={<Ionicons name="phone-portrait-outline" size={18} color={Colors.icon.default} />} error={errors.mobile_number} />
                <Input label="Home Number" value={form.home_number} onChangeText={(v) => set('home_number', v)} placeholder="+94112345678" keyboardType="phone-pad" leftIcon={<Ionicons name="call-outline" size={18} color={Colors.icon.default} />} error={errors.home_number} />
              </View>

              {/* Additional */}
              <SectionHeader icon="document-text-outline" label="Additional Details" color={K.coral} bg={K.coralLight} />
              <View style={styles.formCard}>
                <Input label="Address" value={form.address} onChangeText={(v) => set('address', v)} placeholder="Home address" autoCapitalize="sentences" multiline numberOfLines={3} leftIcon={<Ionicons name="home-outline" size={18} color={Colors.icon.default} />} />
                <Input label="Marital Status" value={form.marital_status} onChangeText={(v) => set('marital_status', v)} placeholder="e.g. N/A" leftIcon={<Ionicons name="heart-outline" size={18} color={Colors.icon.default} />} />
              </View>

              <View style={styles.buttonRow}>
                <Button title="Cancel" variant="outline" onPress={() => navigation.navigate('StudentList')} style={{ flex: 1 }} />
                <Button
                  title={loadingTeachers ? 'Loading…' : 'Next'}
                  onPress={handleNext}
                  loading={loadingTeachers}
                  style={{ flex: 1 }}
                  icon={<Ionicons name="arrow-forward-outline" size={18} color="#FFF" />}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const selectedTeacher = availableTeachers.find((t) => t.tid === selectedTeacherId);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Breadcrumb
        crumbs={[
          { label: 'Students', onPress: () => navigation.goBack() },
          { label: 'Add Student' },
        ]}
        title="Add Student"
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }}>
          <StepIndicator current={2} />

          {/* Allocation header card */}
          <View style={styles.allocationCard}>
            <View style={[styles.allocationIconWrap, { backgroundColor: K.purpleLight }]}>
              <Ionicons name="people-outline" size={28} color={K.purple} />
            </View>
            <Text style={styles.allocationTitle}>Assign to Teacher</Text>
            <Text style={styles.allocationSubtitle}>
              Optionally assign this student to a Special Education Teacher.{'\n'}
              Only teachers with fewer than 3 students are shown.
            </Text>
          </View>

          {/* Teacher picker */}
          <SectionHeader icon="person-outline" label="Select Teacher (Optional)" color={K.purple} bg={K.purpleLight} />
          <View style={styles.formCard}>
            {availableTeachers.length === 0 ? (
              <View style={styles.noTeachersBox}>
                <Ionicons name="information-circle-outline" size={18} color={K.amber} />
                <Text style={styles.noTeachersText}>No teachers are currently available for allocation.</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => setShowTeacherPicker((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    {selectedTeacher ? (
                      <>
                        <Text style={styles.selectText}>{selectedTeacher.full_name}</Text>
                        <Text style={{ fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2 }}>
                          {selectedTeacher.teacher_code} · {selectedTeacher.students?.length ?? 0}/3 students
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.selectText, { color: Colors.text.muted }]}>Select a teacher</Text>
                    )}
                  </View>
                  <Ionicons name={showTeacherPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.icon.default} />
                </TouchableOpacity>
                {showTeacherPicker && (
                  <View style={styles.dropdown}>
                    {availableTeachers.map((t) => (
                      <TouchableOpacity
                        key={t.tid}
                        style={[styles.dropdownItem, selectedTeacherId === t.tid && styles.dropdownItemActive]}
                        onPress={() => { setSelectedTeacherId(t.tid); setShowTeacherPicker(false); }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownText, selectedTeacherId === t.tid && styles.dropdownTextActive]}>{t.full_name}</Text>
                          <Text style={{ fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2 }}>
                            {t.teacher_code} · {t.students?.length ?? 0}/3 students
                          </Text>
                        </View>
                        {selectedTeacherId === t.tid && <Ionicons name="checkmark" size={16} color={K.purple} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Summary card */}
          <SectionHeader icon="document-outline" label="Student Summary" color={K.teal} bg={K.tealLight} />
          <View style={styles.formCard}>
            {[
              { label: 'Name',       value: form.full_name },
              { label: 'DOB',        value: form.date_of_birth },
              { label: 'Disability', value: form.disability },
            ].map(({ label, value }) => (
              <View key={label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{label}</Text>
                <Text style={styles.summaryValue}>{value}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.skipHint}>
            Tap "Skip" to create the student without a teacher. You can assign one later from the student profile.
          </Text>

          <View style={styles.buttonRow}>
            <Button title="Back" variant="outline" onPress={() => setStep(1)} style={{ flex: 1 }} icon={<Ionicons name="arrow-back-outline" size={16} color={Colors.primary} />} />
            <Button title="Skip" variant="outline" onPress={() => handleSave(true)} loading={loading} style={{ flex: 1 }} />
            <Button
              title="Save"
              onPress={() => handleSave(false)}
              loading={loading}
              disabled={availableTeachers.length > 0 && !selectedTeacherId}
              style={{ flex: 1 }}
              icon={<Ionicons name="checkmark-outline" size={18} color="#FFF" />}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: K.bg },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl, gap: Layout.spacing.md },

  // Photo hero
  photoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Layout.shadow.sm, marginBottom: Layout.spacing.xs,
  },
  photoBanner: { height: 56, backgroundColor: K.banner },
  photoBody:   { alignItems: 'center', paddingBottom: Layout.spacing.md },
  photoTouch:  { marginTop: -36 },
  photoPreview: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: Colors.surface,
  },
  photoPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 3, borderColor: Colors.surface,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: K.coral,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  photoHint: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: Layout.spacing.xs },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Layout.spacing.xs,
    marginBottom: Layout.spacing.xs, marginTop: Layout.spacing.xs,
  },
  sectionIconBox: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, letterSpacing: 0.2 },

  // Form card
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20, padding: Layout.spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Layout.shadow.sm, gap: Layout.spacing.xs,
  },

  // Disability / teacher picker
  selectLabel: {
    fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary, marginBottom: Layout.spacing.xs,
  },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.background, borderRadius: Layout.radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
    minHeight: 52, paddingHorizontal: Layout.spacing.md, paddingVertical: Layout.spacing.sm,
  },
  selectText: { fontSize: Layout.fontSize.md, color: Colors.text.primary },
  fieldError: { fontSize: Layout.fontSize.xs, color: Colors.status.error, marginTop: 4, marginLeft: 4 },
  dropdown: {
    backgroundColor: Colors.surface, borderRadius: Layout.radius.md,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Layout.spacing.md, paddingVertical: 12,
  },
  dropdownItemActive: { backgroundColor: K.purpleLight },
  dropdownText:       { flex: 1, fontSize: Layout.fontSize.md, color: Colors.text.primary },
  dropdownTextActive: { color: K.purple, fontWeight: Layout.fontWeight.semibold },

  // Allocation card (step 2)
  allocationCard: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: Layout.spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Layout.shadow.sm, gap: Layout.spacing.sm,
  },
  allocationIconWrap: {
    width: 58, height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  allocationTitle: {
    fontSize: Layout.fontSize.lg, fontWeight: Layout.fontWeight.extrabold,
    color: Colors.text.primary,
  },
  allocationSubtitle: {
    fontSize: Layout.fontSize.sm, color: Colors.text.muted,
    textAlign: 'center', lineHeight: 20,
  },
  noTeachersBox: {
    flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm,
    backgroundColor: K.amberLight, borderRadius: Layout.radius.md, padding: Layout.spacing.md,
  },
  noTeachersText: {
    flex: 1, fontSize: Layout.fontSize.sm, color: K.amber, fontStyle: 'italic',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  summaryLabel: { fontSize: Layout.fontSize.sm, color: Colors.text.muted },
  summaryValue: {
    fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary, flex: 1, textAlign: 'right',
  },
  skipHint: {
    fontSize: Layout.fontSize.xs, color: Colors.text.muted,
    textAlign: 'center', lineHeight: 18,
  },

  buttonRow: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.lg },
});
