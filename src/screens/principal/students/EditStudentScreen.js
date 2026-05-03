import React, { useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
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
  bg:         '#F2F1F8',
  banner:     '#3D5A9E',
};

const DISABILITY_OPTIONS = [
  'ASD Level 1', 'ASD Level 2', 'ASD Level 3',
  'Down Syndrome', 'Intellectual Disability', 'Learning Disability', 'Other',
];

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

export default function EditStudentScreen({ route, navigation }) {
  const { student } = route.params;
  const { width, height } = useWindowDimensions();
  const isLandscape  = width > height;
  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

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
  const [photo, setPhoto]                       = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [errors, setErrors]                     = useState({});
  const [showDisabilityPicker, setShowDisabilityPicker] = useState(false);

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
    if (!form.full_name.trim())  e.full_name  = 'Full Name cannot be empty.';
    if (!form.disability.trim()) e.disability = 'Disability cannot be empty.';
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
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
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
      <Breadcrumb
        crumbs={[
          { label: 'Students', onPress: () => navigation.pop(2) },
          { label: student.full_name, onPress: () => navigation.goBack() },
          { label: 'Edit Student' },
        ]}
        title="Edit Student"
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }}>

            {/* ── Photo hero ───────────────────────────────────── */}
            <View style={styles.photoCard}>
              <View style={styles.photoBanner} />
              <View style={styles.photoBody}>
                <ButtonFeedback onPress={pickPhoto} activeOpacity={0.8} style={styles.photoTouch}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera-outline" size={28} color={Colors.icon.default} />
                    </View>
                  )}
                  <View style={styles.photoBadge}>
                    <Ionicons name="camera" size={11} color="#FFF" />
                  </View>
                </ButtonFeedback>
                <Text style={styles.photoName}>{student.full_name}</Text>
                <Text style={styles.photoHint}>Tap photo to change</Text>
              </View>
            </View>

            {/* ── Required Info ────────────────────────────────── */}
            <SectionHeader icon="star-outline" label="Required Information" color={K.purple} bg={K.purpleLight} />
            <View style={styles.formCard}>
              <Input
                label="Full Name"
                value={form.full_name}
                onChangeText={(v) => set('full_name', v)}
                placeholder="Student's full name"
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
                error={errors.full_name}
              />
              <DatePickerField
                label="Date of Birth"
                value={form.date_of_birth}
                onChange={(v) => set('date_of_birth', v)}
                maximumDate={new Date()}
                error={errors.date_of_birth}
              />

              {/* Disability picker */}
              <View>
                <Text style={styles.selectLabel}>Disability</Text>
                <ButtonFeedback
                  style={[styles.selectBtn, errors.disability && { borderColor: Colors.status.error }]}
                  onPress={() => setShowDisabilityPicker((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.selectText, !form.disability && { color: Colors.text.muted }]}>
                    {form.disability || 'Select disability type'}
                  </Text>
                  <Ionicons name={showDisabilityPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.icon.default} />
                </ButtonFeedback>
                {errors.disability && <Text style={styles.fieldError}>{errors.disability}</Text>}
                {showDisabilityPicker && (
                  <View style={styles.dropdown}>
                    {DISABILITY_OPTIONS.map((opt) => (
                      <ButtonFeedback
                        key={opt}
                        style={[styles.dropdownItem, form.disability === opt && styles.dropdownItemActive]}
                        onPress={() => { set('disability', opt); setShowDisabilityPicker(false); }}
                      >
                        <Text style={[styles.dropdownText, form.disability === opt && styles.dropdownTextActive]}>{opt}</Text>
                        {form.disability === opt && <Ionicons name="checkmark" size={16} color={K.purple} />}
                      </ButtonFeedback>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* ── Parent / Guardian ────────────────────────────── */}
            <SectionHeader icon="people-outline" label="Parent / Guardian" color={K.teal} bg={K.tealLight} />
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

            {/* ── Additional ───────────────────────────────────── */}
            <SectionHeader icon="document-text-outline" label="Additional Details" color={K.coral} bg={K.coralLight} />
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

            {/* ── Actions ──────────────────────────────────────── */}
            <View style={styles.buttonRow}>
              <Button title="Cancel" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
              <Button
                title="Save Changes"
                onPress={handleUpdate}
                loading={loading}
                style={{ flex: 1 }}
                icon={<Ionicons name="checkmark-outline" size={18} color="#FFF" />}
              />
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: K.bg },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl, gap: Layout.spacing.md },

  photoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
    marginBottom: Layout.spacing.xs,
  },
  photoBanner: { height: 56, backgroundColor: K.banner },
  photoBody:   { alignItems: 'center', paddingBottom: Layout.spacing.md, gap: 4 },
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
  photoName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
    marginTop: Layout.spacing.xs,
  },
  photoHint: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Layout.spacing.xs,
    marginBottom: Layout.spacing.xs,
    marginTop: Layout.spacing.xs,
  },
  sectionIconBox: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
    letterSpacing: 0.2,
  },

  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
    gap: Layout.spacing.xs,
  },

  selectLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Layout.spacing.xs,
  },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
    height: 52, paddingHorizontal: Layout.spacing.md,
  },
  selectText: { fontSize: Layout.fontSize.md, color: Colors.text.primary },
  fieldError: { fontSize: Layout.fontSize.xs, color: Colors.status.error, marginTop: 4, marginLeft: 4 },
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.md,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Layout.spacing.md, paddingVertical: 12,
  },
  dropdownItemActive: { backgroundColor: K.purpleLight },
  dropdownText: { flex: 1, fontSize: Layout.fontSize.md, color: Colors.text.primary },
  dropdownTextActive: { color: K.purple, fontWeight: Layout.fontWeight.semibold },

  buttonRow: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.xl },
});
