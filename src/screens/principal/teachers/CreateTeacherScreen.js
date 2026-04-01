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

export default function CreateTeacherScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  function validate() {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!validateEmail(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
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
        const uri = photo.uri;
        const name = uri.split('/').pop();
        const ext = name.split('.').pop().toLowerCase();
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
      }
      await principalApi.createTeacher(formData);
      Alert.alert('Success', 'Teacher account created successfully.');
      navigation.popToTop();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }}>
          {/* Photo picker */}
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

          <View style={styles.form}>
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
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.icon.default} />}
              error={errors.email}
            />
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
              <Ionicons name="information-circle-outline" size={14} color={Colors.text.muted} />
              <Text style={styles.hintText}>
                The teacher will be asked to set a new password on first login.
              </Text>
            </View>

            <Button
              title="Create Teacher"
              onPress={handleCreate}
              loading={loading}
              style={styles.submitBtn}
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
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  scrollLandscape: { paddingHorizontal: Layout.spacing.xxl },
  photoPicker: { alignItems: 'center', marginBottom: Layout.spacing.xl },
  photoPreview: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 4 },
  photoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.md,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Layout.radius.sm,
    padding: Layout.spacing.sm,
    gap: 6,
    marginBottom: Layout.spacing.md,
  },
  hintText: { flex: 1, fontSize: Layout.fontSize.xs, color: Colors.text.muted, lineHeight: 18 },
  submitBtn: { marginTop: Layout.spacing.sm },
});
