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

export default function EditTeacherScreen({ route, navigation }) {
  const { teacher } = route.params;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const formMaxWidth = isLandscape ? Math.min(width * 0.65, 680) : undefined;

  const [fullName, setFullName] = useState(teacher.full_name);
  const [email, setEmail] = useState(teacher.email);
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
    if (!fullName.trim()) e.fullName = 'Full Name cannot be empty.';
    if (!email.trim()) e.email = 'A valid email address is required.';
    else if (!validateEmail(email)) e.email = 'A valid email address is required.';
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
        const uri = photo.uri;
        const name = uri.split('/').pop();
        const ext = name.split('.').pop().toLowerCase();
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        formData.append('photo', { uri, name, type: mimeMap[ext] || 'image/jpeg' });
      }
      await principalApi.updateTeacher(teacher.tid, formData);
      Alert.alert('Success', 'Teacher details updated successfully.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const photoUri = photo?.uri || teacher.profile_photo_url;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }}>
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
              <Text style={styles.photoLabel}>Tap to change photo</Text>
            </View>

            <View style={styles.form}>
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
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.icon.default} />}
                error={errors.email}
              />
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
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.surface, borderWidth: 2,
    borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 8 },
  photoBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  form: {
    backgroundColor: Colors.surface, borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg, borderWidth: 1,
    borderColor: Colors.borderLight, ...Layout.shadow.md,
  },
  buttonRow: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.sm },
});
