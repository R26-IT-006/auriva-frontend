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
import { rs, rf } from '../../../../utils/responsive';

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
  kvWrap: { width: '100%', maxWidth: rs(780) },
  sheet: {
    backgroundColor: '#FFF',
    borderRadius: rs(28),
    maxHeight: '92%',
    paddingBottom: rs(16),
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(10) }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  scroll: { paddingHorizontal: rs(36), paddingTop: rs(48), paddingBottom: rs(52), gap: rs(18) },

  header: { alignItems: 'center', marginBottom: Layout.spacing.sm, position: 'relative' },
  closeBtn: { position: 'absolute', top: 0, right: 0, width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerEmoji: { fontSize: rf(40), marginBottom: rs(4) },
  title: { fontSize: rf(24), fontFamily: 'DMSans_800ExtraBold', color: '#1A1A2E', textAlign: 'center' },
  titleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', color: '#666', textAlign: 'center', marginTop: 2 },

  label: { fontSize: rf(16), fontFamily: 'DMSans_800ExtraBold', color: '#1A1A2E', marginTop: Layout.spacing.md },
  labelSinhala: { fontSize: Layout.fontSize.xs, fontWeight: '500', color: '#888', marginBottom: rs(4) },
  required: { color: '#EF4444' },
  optional: { fontWeight: '400', color: '#888' },

  // All six pets on one line; each tile takes an equal share of the row.
  petGrid: {
    flexDirection: 'row', flexWrap: 'nowrap', gap: rs(8),
    justifyContent: 'center', marginTop: rs(4),
  },
  // Raised 3D choice tiles, like the buttons in the other modules.
  petCard: {
    flex: 1, maxWidth: rs(116), alignItems: 'center', gap: rs(6),
    paddingVertical: rs(26), paddingHorizontal: rs(4),
    borderRadius: rs(20), borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  petEmoji: { fontSize: rf(40) },
  petLabel: { fontSize: rf(15), fontFamily: 'DMSans_700Bold', color: '#475569' },
  checkBadge: {
    position: 'absolute', top: rs(6), right: rs(6),
    width: rs(20), height: rs(20), borderRadius: rs(10),
    borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },

  textInput: {
    borderWidth: 2, borderColor: '#E2E8F0', borderRadius: rs(16),
    paddingHorizontal: Layout.spacing.md, paddingVertical: rs(12),
    fontSize: rf(18), fontFamily: 'DMSans_700Bold', color: '#1A1A2E',
  },

  errorText: { color: '#EF4444', fontSize: Layout.fontSize.sm, fontWeight: '600', marginTop: rs(4) },

  // Raised 3D button, like the ones used in the other modules.
  saveBtn: {
    alignSelf: 'center', minWidth: rs(260),
    borderRadius: rs(16),
    paddingVertical: rs(16), paddingHorizontal: rs(40), alignItems: 'center',
    borderBottomWidth: 5, borderBottomColor: 'rgba(0,0,0,0.22)',
    marginTop: Layout.spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
  },
  // Faded (not greyed) until ready — same as the other screens' buttons.
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: rf(17), fontFamily: 'DMSans_800ExtraBold', color: '#FFF' },
});
