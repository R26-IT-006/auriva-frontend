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

export default function EditStudentScreen({ route, navigation }) {
  const { student } = route.params;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

  const [form, setForm] = useState({
    full_name: student.full_name ?? '',
    date_of_birth: student.date_of_birth?.slice(0, 10) ?? '',
    disability: student.disability ?? '',
    father_name: student.father_name ?? '',
    mother_name: student.mother_name ?? '',
    address: student.address ?? '',
    marital_status: student.marital_status ?? '',
    mobile_number: student.mobile_number ?? '',
    home_number: student.home_number ?? '',
  });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
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
    if (!form.full_name.trim()) e.full_name = 'Full Name cannot be empty.';
    if (!form.disability.trim()) e.disability = 'Disability cannot be empty.';
    if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth.trim()))
      e.date_of_birth = 'Date of Birth must be a valid date (YYYY-MM-DD).';
    if (form.mobile_number && !validatePhone(form.mobile_number))
      e.mobile_number = 'Mobile Number must be a valid phone number.';
    if (form.home_number && !validatePhone(form.home_number))
      e.home_number = 'Mobile Number must be a valid phone number.';
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
        const uri = photo.uri;
        const name = uri.split('/').pop();
        const ext = name.split('.').pop().toLowerCase();
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
      }
      await principalApi.updateStudent(student.sid, formData);
      Alert.alert('Success', 'Student profile updated successfully.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const photoUri = photo?.uri || student.profile_photo_url;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }}>
            {/* Photo */}
            <View style={styles.photoPicker}>
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={32} color={Colors.icon.default} />
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
                label="Full Name"
                value={form.full_name}
                onChangeText={(v) => set('full_name', v)}
                placeholder="Student's full name"
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
                error={errors.full_name}
              />
              <Input
                label="Date of Birth"
                value={form.date_of_birth}
                onChangeText={(v) => set('date_of_birth', v)}
                placeholder="YYYY-MM-DD"
                leftIcon={<Ionicons name="calendar-outline" size={18} color={Colors.icon.default} />}
                error={errors.date_of_birth}
              />

              {/* Disability dropdown */}
              <View style={{ marginBottom: Layout.spacing.md }}>
                <Text style={styles.selectLabel}>Disability</Text>
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

            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => navigation.goBack()}
                style={{ flex: 1 }}
              />
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
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  scrollLandscape: { paddingHorizontal: Layout.spacing.xxl },
  photoPicker: { alignItems: 'center', marginBottom: Layout.spacing.xl },
  photoPreview: { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.surface, borderWidth: 2,
    borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
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
    height: 52,
    paddingHorizontal: Layout.spacing.md,
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
  buttonRow: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.sm },
});
