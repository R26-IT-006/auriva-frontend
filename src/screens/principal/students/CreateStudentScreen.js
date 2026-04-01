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
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { principalApi } from '../../../api/principal';
import { validatePhone } from '../../../utils/validation';

const DISABILITY_OPTIONS = [
  'ASD Level 1',
  'ASD Level 2',
  'ASD Level 3',
  'Down Syndrome',
  'Intellectual Disability',
  'Learning Disability',
  'Other',
];

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <View style={stepStyles.wrapper}>
      {[1, 2].map((s) => (
        <React.Fragment key={s}>
          <View style={[stepStyles.circle, current === s && stepStyles.circleActive, current > s && stepStyles.circleDone]}>
            {current > s
              ? <Ionicons name="checkmark" size={14} color="#FFF" />
              : <Text style={[stepStyles.circleText, current === s && stepStyles.circleTextActive]}>{s}</Text>
            }
          </View>
          {s < 2 && <View style={[stepStyles.line, current > s && stepStyles.lineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Layout.spacing.xl },
  circle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 2,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  circleActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  circleDone: { borderColor: Colors.status.success, backgroundColor: Colors.status.success },
  circleText: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, color: Colors.text.muted },
  circleTextActive: { color: '#FFF' },
  line: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: Layout.spacing.xs },
  lineDone: { backgroundColor: Colors.status.success },
});

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CreateStudentScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    disability: '',
    father_name: '',
    mother_name: '',
    address: '',
    marital_status: '',
    mobile_number: '',
    home_number: '',
  });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDisabilityPicker, setShowDisabilityPicker] = useState(false);

  // Step 2 state
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: null }));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  function validateStep1() {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Full Name is required.';
    if (!form.date_of_birth.trim()) e.date_of_birth = 'Date of Birth must be a valid date (YYYY-MM-DD).';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth.trim()))
      e.date_of_birth = 'Date of Birth must be a valid date (YYYY-MM-DD).';
    if (!form.disability.trim()) e.disability = 'Disability is required.';
    if (form.mobile_number && !validatePhone(form.mobile_number))
      e.mobile_number = 'Mobile Number must be a valid phone number.';
    if (form.home_number && !validatePhone(form.home_number))
      e.home_number = 'Mobile Number must be a valid phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleNext() {
    if (!validateStep1()) return;
    setLoadingTeachers(true);
    try {
      const data = await principalApi.getTeachers();
      const available = data.filter(
        (t) => !t.is_first_login && (t.students?.length ?? 0) < 3
      );
      setAvailableTeachers(available);
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
      Object.entries(form).forEach(([k, v]) => {
        if (v && v.trim()) formData.append(k, v.trim());
      });
      if (photo) {
        const uri = photo.uri;
        const name = uri.split('/').pop();
        const ext = name.split('.').pop().toLowerCase();
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
      }

      const created = await principalApi.createStudent(formData);
      const sid = created?.sid ?? created?.student?.sid;

      if (!skipTeacher && selectedTeacherId && sid) {
        await principalApi.assignStudent(sid, selectedTeacherId);
        Alert.alert('Success', 'Student profile created and allocated successfully.');
      } else {
        Alert.alert('Success', 'Student profile created successfully.');
      }

      navigation.popToTop();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 1: Student Details ────────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.centeredContent, { maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }]}>
              <StepIndicator current={1} />

              {/* Photo */}
              <View style={styles.photoPicker}>
                <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
                  {photo ? (
                    <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera-outline" size={32} color={Colors.icon.default} />
                      <Text style={styles.photoHint}>Add Photo</Text>
                    </View>
                  )}
                  <View style={styles.photoBadge}>
                    <Ionicons name="pencil" size={12} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Required fields */}
              <Text style={styles.groupLabel}>Required Information</Text>
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
                <Input
                  label="Date of Birth *"
                  value={form.date_of_birth}
                  onChangeText={(v) => set('date_of_birth', v)}
                  placeholder="YYYY-MM-DD"
                  leftIcon={<Ionicons name="calendar-outline" size={18} color={Colors.icon.default} />}
                  error={errors.date_of_birth}
                />

                {/* Disability selector */}
                <View style={{ marginBottom: Layout.spacing.md }}>
                  <Text style={styles.selectLabel}>Disability *</Text>
                  <TouchableOpacity
                    style={[styles.selectBtn, errors.disability && { borderColor: Colors.status.error }]}
                    onPress={() => setShowDisabilityPicker((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.selectText, !form.disability && { color: Colors.text.muted }]}>
                      {form.disability || 'Select disability type'}
                    </Text>
                    <Ionicons
                      name={showDisabilityPicker ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.icon.default}
                    />
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
                          <Text style={[styles.dropdownText, form.disability === opt && styles.dropdownTextActive]}>
                            {opt}
                          </Text>
                          {form.disability === opt && (
                            <Ionicons name="checkmark" size={16} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Parent / Guardian */}
              <Text style={styles.groupLabel}>Parent / Guardian Information</Text>
              <View style={styles.formCard}>
                <Input
                  label="Father's Name"
                  value={form.father_name}
                  onChangeText={(v) => set('father_name', v)}
                  placeholder="Optional"
                  autoCapitalize="words"
                  leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
                />
                <Input
                  label="Mother's Name"
                  value={form.mother_name}
                  onChangeText={(v) => set('mother_name', v)}
                  placeholder="Optional"
                  autoCapitalize="words"
                  leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
                />
                <Input
                  label="Mobile Number"
                  value={form.mobile_number}
                  onChangeText={(v) => set('mobile_number', v)}
                  placeholder="+94771234567"
                  keyboardType="phone-pad"
                  leftIcon={<Ionicons name="phone-portrait-outline" size={18} color={Colors.icon.default} />}
                  error={errors.mobile_number}
                />
                <Input
                  label="Home Number"
                  value={form.home_number}
                  onChangeText={(v) => set('home_number', v)}
                  placeholder="+94112345678"
                  keyboardType="phone-pad"
                  leftIcon={<Ionicons name="call-outline" size={18} color={Colors.icon.default} />}
                  error={errors.home_number}
                />
              </View>

              {/* Additional */}
              <Text style={styles.groupLabel}>Additional Details</Text>
              <View style={styles.formCard}>
                <Input
                  label="Address"
                  value={form.address}
                  onChangeText={(v) => set('address', v)}
                  placeholder="Home address"
                  autoCapitalize="sentences"
                  multiline
                  numberOfLines={3}
                  leftIcon={<Ionicons name="home-outline" size={18} color={Colors.icon.default} />}
                />
                <Input
                  label="Marital Status"
                  value={form.marital_status}
                  onChangeText={(v) => set('marital_status', v)}
                  placeholder="e.g. N/A"
                  leftIcon={<Ionicons name="heart-outline" size={18} color={Colors.icon.default} />}
                />
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => navigation.popToTop()}
                  style={{ flex: 1 }}
                />
                <Button
                  title={loadingTeachers ? 'Loading...' : 'Next'}
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

  // ─── Step 2: Teacher Allocation ─────────────────────────────────────────────
  const selectedTeacher = availableTeachers.find((t) => t.tid === selectedTeacherId);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.centeredContent, { maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }]}>
          <StepIndicator current={2} />

          {/* Header card */}
          <View style={styles.allocationHeader}>
            <View style={[styles.allocationIcon, { backgroundColor: Colors.status.infoLight }]}>
              <Ionicons name="people-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.allocationTitle}>Assign to Teacher</Text>
            <Text style={styles.allocationSubtitle}>
              Optionally allocate this student to a Special Education Teacher.
              Only teachers with fewer than 3 students are shown.
            </Text>
          </View>

          {/* Teacher dropdown */}
          <View style={styles.formCard}>
            <Text style={styles.selectLabel}>Select Teacher (Optional)</Text>

            {availableTeachers.length === 0 ? (
              <View style={styles.noTeachersBox}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.text.muted} />
                <Text style={styles.noTeachersText}>
                  No teachers are currently available for allocation.
                </Text>
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
                        <Text style={[styles.selectText, { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2 }]}>
                          {selectedTeacher.teacher_code} · {selectedTeacher.students?.length ?? 0}/3 students
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.selectText, { color: Colors.text.muted }]}>
                        Select a teacher
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={showTeacherPicker ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.icon.default}
                  />
                </TouchableOpacity>

                {showTeacherPicker && (
                  <View style={styles.dropdown}>
                    {availableTeachers.map((t) => (
                      <TouchableOpacity
                        key={t.tid}
                        style={[styles.dropdownItem, selectedTeacherId === t.tid && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedTeacherId(t.tid);
                          setShowTeacherPicker(false);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownText, selectedTeacherId === t.tid && styles.dropdownTextActive]}>
                            {t.full_name}
                          </Text>
                          <Text style={{ fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2 }}>
                            {t.teacher_code} · {t.students?.length ?? 0}/3 students
                          </Text>
                        </View>
                        {selectedTeacherId === t.tid && (
                          <Ionicons name="checkmark" size={16} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Student Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Name</Text>
              <Text style={styles.summaryValue}>{form.full_name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>DOB</Text>
              <Text style={styles.summaryValue}>{form.date_of_birth}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Disability</Text>
              <Text style={styles.summaryValue}>{form.disability}</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <Button
              title="Back"
              variant="outline"
              onPress={() => setStep(1)}
              style={{ flex: 1 }}
              icon={<Ionicons name="arrow-back-outline" size={16} color={Colors.primary} />}
            />
            <Button
              title="Skip"
              variant="outline"
              onPress={() => handleSave(true)}
              loading={loading}
              style={{ flex: 1 }}
            />
            <Button
              title="Save"
              onPress={() => handleSave(false)}
              loading={loading}
              disabled={availableTeachers.length > 0 && !selectedTeacherId}
              style={{ flex: 1 }}
              icon={<Ionicons name="checkmark-outline" size={18} color="#FFF" />}
            />
          </View>

          <Text style={styles.skipHint}>
            Tap "Skip" to create the student without assigning a teacher. You can assign one later from the student profile.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  scrollLandscape: { paddingHorizontal: Layout.spacing.xxl },
  centeredContent: {},

  photoPicker: { alignItems: 'center', marginBottom: Layout.spacing.xl },
  photoPreview: { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.surface, borderWidth: 2,
    borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  photoHint: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 4 },
  photoBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F4845F', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },

  groupLabel: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.secondary,
    marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  selectLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Layout.spacing.xs,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 52,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  selectText: { fontSize: Layout.fontSize.md, color: Colors.text.primary },
  fieldError: { fontSize: Layout.fontSize.xs, color: Colors.status.error, marginTop: 4, marginLeft: 4 },
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
  },
  dropdownItemActive: { backgroundColor: Colors.status.infoLight },
  dropdownText: { flex: 1, fontSize: Layout.fontSize.md, color: Colors.text.primary },
  dropdownTextActive: { color: Colors.primary, fontWeight: Layout.fontWeight.semibold },

  buttonRow: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.md },

  // Step 2
  allocationHeader: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  allocationIcon: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Layout.spacing.md,
  },
  allocationTitle: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Layout.spacing.xs,
  },
  allocationSubtitle: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  noTeachersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
  },
  noTeachersText: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  summaryTitle: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Layout.spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  summaryLabel: { fontSize: Layout.fontSize.sm, color: Colors.text.muted },
  summaryValue: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary, flex: 1, textAlign: 'right' },
  skipHint: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Layout.spacing.sm,
    lineHeight: 18,
  },
});
