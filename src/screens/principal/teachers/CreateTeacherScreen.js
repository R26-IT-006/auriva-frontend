import React, { useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
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
  amber:      '#C9973A',
  amberLight: '#FBF4E6',
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

export default function CreateTeacherScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

  const toast = useToast();
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [photo, setPhoto]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState({});

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  function validate() {
    const e = {};
    if (!fullName.trim())       e.fullName = 'Full name is required';
    if (!email.trim())          e.email    = 'Email is required';
    else if (!validateEmail(email)) e.email = 'Enter a valid email';
    if (!password)              e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
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
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
      }
      await principalApi.createTeacher(formData);
      toast.show('Teacher account created successfully.');
      navigation.popToTop();
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Breadcrumb
        crumbs={[
          { label: 'Teachers', onPress: () => navigation.goBack() },
          { label: 'Add Teacher' },
        ]}
        title="Add Teacher"
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
                </ButtonFeedback>
                <Text style={styles.photoHint}>Tap to add photo</Text>
              </View>
            </View>

            {/* ── Account Info ─────────────────────────────────── */}
            <SectionHeader icon="person-outline" label="Account Information" color={K.purple} bg={K.purpleLight} />
            <View style={styles.formCard}>
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: null })); }}
                placeholder="Enter teacher's full name"
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.icon.default} />}
                error={errors.fullName}
              />
              <Input
                label="Email Address"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: null })); }}
                placeholder="teacher@school.lk"
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.icon.default} />}
                error={errors.email}
              />
            </View>

            {/* ── Security ─────────────────────────────────────── */}
            <SectionHeader icon="lock-closed-outline" label="Security" color={K.teal} bg={K.tealLight} />
            <View style={styles.formCard}>
              <Input
                label="Temporary Password"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: null })); }}
                placeholder="Minimum 8 characters"
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.icon.default} />}
                error={errors.password}
              />
              <View style={styles.hint}>
                <Ionicons name="information-circle-outline" size={14} color={K.amber} />
                <Text style={styles.hintText}>
                  The teacher will be asked to set a new password on first login.
                </Text>
              </View>
            </View>

            {/* ── Actions ──────────────────────────────────────── */}
            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => navigation.popToTop()}
                style={{ flex: 1 }}
              />
              <Button
                title="Create Teacher"
                onPress={handleCreate}
                loading={loading}
                style={{ flex: 1 }}
                icon={<Ionicons name="person-add-outline" size={18} color="#FFF" />}
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

  // Photo hero card
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
  photoBody: { alignItems: 'center', paddingBottom: Layout.spacing.md },
  photoTouch: { marginTop: -36 },
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
  photoHint: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    marginTop: Layout.spacing.xs,
  },

  // Section header
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
    fontWeight: Layout.fontWeight.bold,
    letterSpacing: 0.2,
  },

  // Form card
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
    gap: Layout.spacing.xs,
  },

  // Hint
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: K.amberLight,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.sm,
    gap: 6,
    marginTop: Layout.spacing.xs,
  },
  hintText: {
    flex: 1,
    fontSize: Layout.fontSize.xs,
    color: K.amber,
    lineHeight: 18,
    fontWeight: Layout.fontWeight.medium,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    marginTop: Layout.spacing.xl,
  },
});
