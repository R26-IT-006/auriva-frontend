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
import { validateEmail } from '../../../utils/validation';
import { useToast } from '../../../context/ToastContext';
import { Breadcrumb } from '../../../components/common/Breadcrumb';

const K = {
  purple:     '#8A80BC',
  purpleLight:'#EFEDF8',
  teal:       '#4AADA3',
  tealLight:  '#E8F6F5',
  bg:         '#F2F1F8',
  banner:     '#3D5A9E',
};

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

export default function EditTeacherScreen({ route, navigation }) {
  const { teacher } = route.params;
  const { width, height } = useWindowDimensions();
  const isLandscape  = width > height;
  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

  const toast = useToast();
  const [fullName, setFullName] = useState(teacher.full_name);
  const [email, setEmail]       = useState(teacher.email);
  const [photo, setPhoto]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  function validate() {
    const e = {};
    if (!fullName.trim())           e.fullName = 'Full Name cannot be empty.';
    if (!email.trim())              e.email    = 'A valid email address is required.';
    else if (!validateEmail(email)) e.email    = 'A valid email address is required.';
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
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Breadcrumb
        crumbs={[
          { label: 'Teachers', onPress: () => navigation.pop(2) },
          { label: teacher.full_name, onPress: () => navigation.goBack() },
          { label: 'Edit Teacher' },
        ]}
        title="Edit Teacher"
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
                <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={styles.photoTouch}>
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
                </TouchableOpacity>
                <Text style={styles.photoName}>{teacher.full_name}</Text>
                <Text style={styles.photoHint}>Tap photo to change</Text>
              </View>
            </View>

            {/* ── Account Info ─────────────────────────────────── */}
            <SectionHeader icon="person-outline" label="Account Information" color={K.purple} bg={K.purpleLight} />
            <View style={styles.formCard}>
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: null })); }}
                placeholder="Teacher's full name"
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
                error={errors.fullName}
              />
              <Input
                label="Email Address"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: null })); }}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.icon.default} />}
                error={errors.email}
              />
            </View>

            {/* ── Actions ──────────────────────────────────────── */}
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
    backgroundColor: K.purple,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  photoName: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
    marginTop: Layout.spacing.xs,
  },
  photoHint: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: 'Nunito_700Bold',
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

  buttonRow: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    marginTop: Layout.spacing.xl,
  },
});
