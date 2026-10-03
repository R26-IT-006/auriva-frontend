/**
 * PetPicker  (TASK-20)
 * Modal overlay presented from L2TopicSelectionScreen when the child taps
 * "Describing a Pet" and no pet data has been saved yet (or wants to update).
 *
 * Collects:
 *   - pet_type     (required) — one of the six textbook animals
 *   - pet_name     (optional) — a name the child gives their pet
 *
 * The six animals come from p.15 of the Grade 1–2 English activity book:
 *   cat, dog, cow, fish, parrot, rabbit.
 *
 * On Save → calls patchQuestionnaire(studentId, { pet_type, pet_name })
 * then calls onSaved(fields) so the parent can navigate to L2Loading.
 *
 * Props:
 *   visible   : bool
 *   student   : object  { sid, ... }
 *   existing  : object | null  — questionnaire data already saved
 *   onSaved   : (fields) => void
 *   onCancel  : () => void
 */
import { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { level2Api } from '../../../../api/level2';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

const PETS = [
  { key: 'cat',    emoji: '🐱', label: 'Cat' },
  { key: 'dog',    emoji: '🐶', label: 'Dog' },
  { key: 'cow',    emoji: '🐄', label: 'Cow' },
  { key: 'fish',   emoji: '🐟', label: 'Fish' },
  { key: 'parrot', emoji: '🦜', label: 'Parrot' },
  { key: 'rabbit', emoji: '🐰', label: 'Rabbit' },
];

export default function PetPicker({ visible, student, existing, onSaved, onCancel }) {
  // Selected pet and the Start button use the child's theme colour.
  const theme = getAvatarTheme(student?.avatar_key);
  const [petType, setPetType] = useState(existing?.pet_type ?? null);
  const [petName, setPetName] = useState(existing?.pet_name ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const canSave = petType !== null;

  async function handleSave() {
    if (!canSave) { setError('Please tap on an animal to choose your pet.'); return; }
    setError('');
    setSaving(true);
    const fields = {
      pet_type: petType,
      pet_name: petName.trim() || null,
    };
    try {
      await level2Api.patchQuestionnaire(student.sid, fields);
      onSaved(fields);
    } catch {
      setError('Could not save — please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kvWrap}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Do you have a pet?</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={onCancel} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Ionicons name="close" size={22} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Pet type grid */}
              <Text style={styles.label}>Tap your pet! <Text style={styles.required}>*</Text></Text>
              <View style={styles.petGrid}>
                {PETS.map(({ key, emoji, label }) => {
                  const selected = petType === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.petCard, selected && { borderColor: theme.button }]}
                      onPress={() => setPetType(selected ? null : key)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.petEmoji}>{emoji}</Text>
                      <Text style={[styles.petLabel, selected && { color: theme.button }]}>{label}</Text>
                      {selected && (
                        <View style={[styles.checkBadge, { backgroundColor: theme.button }]}>
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional pet name */}
              <Text style={styles.label}>What is your pet's name? <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.textInput}
                value={petName}
                onChangeText={setPetName}
                placeholder={petType ? `My ${petType}'s name…` : 'Pet name…'}
                placeholderTextColor="#AAA"
                maxLength={40}
                autoCapitalize="words"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.button }, !canSave && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving || !canSave}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={[styles.saveBtnText, { color: theme.buttonText }]}>Start!</Text>
                }
              </TouchableOpacity>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Centred pop-up card, like the Progress pop-ups in the other modules.
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
  },
  kvWrap: { width: '100%', maxWidth: 780 },
  sheet: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    maxHeight: '92%',
    paddingBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  scroll: { paddingHorizontal: 36, paddingTop: 48, paddingBottom: 52, gap: 18 },

  header: { alignItems: 'center', marginBottom: Layout.spacing.sm, position: 'relative' },
  closeBtn: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerEmoji: { fontSize: 40, marginBottom: 4 },
  title: { fontSize: 24, fontFamily: 'DMSans_800ExtraBold', color: '#1A1A2E', textAlign: 'center' },
  titleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', color: '#666', textAlign: 'center', marginTop: 2 },

  label: { fontSize: 16, fontFamily: 'DMSans_800ExtraBold', color: '#1A1A2E', marginTop: Layout.spacing.md },
  labelSinhala: { fontSize: Layout.fontSize.xs, fontWeight: '500', color: '#888', marginBottom: 4 },
  required: { color: '#EF4444' },
  optional: { fontWeight: '400', color: '#888' },

  // All six pets on one line; each tile takes an equal share of the row.
  petGrid: {
    flexDirection: 'row', flexWrap: 'nowrap', gap: 8,
    justifyContent: 'center', marginTop: 4,
  },
  // Raised 3D choice tiles, like the buttons in the other modules.
  petCard: {
    flex: 1, maxWidth: 116, alignItems: 'center', gap: 6,
    paddingVertical: 26, paddingHorizontal: 4,
    borderRadius: 20, borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  petEmoji: { fontSize: 40 },
  petLabel: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#475569' },
  checkBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },

  textInput: {
    borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 16,
    paddingHorizontal: Layout.spacing.md, paddingVertical: 12,
    fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#1A1A2E',
  },

  errorText: { color: '#EF4444', fontSize: Layout.fontSize.sm, fontWeight: '600', marginTop: 4 },

  // Raised 3D button, like the ones used in the other modules.
  saveBtn: {
    alignSelf: 'center', minWidth: 260,
    borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center',
    borderBottomWidth: 5, borderBottomColor: 'rgba(0,0,0,0.22)',
    marginTop: Layout.spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
  },
  // Faded (not greyed) until ready — same as the other screens' buttons.
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 17, fontFamily: 'DMSans_800ExtraBold', color: '#FFF' },
});
