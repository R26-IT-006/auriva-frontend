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

const PETS = [
  { key: 'cat',    emoji: '🐱', label: 'Cat' },
  { key: 'dog',    emoji: '🐶', label: 'Dog' },
  { key: 'cow',    emoji: '🐄', label: 'Cow' },
  { key: 'fish',   emoji: '🐟', label: 'Fish' },
  { key: 'parrot', emoji: '🦜', label: 'Parrot' },
  { key: 'rabbit', emoji: '🐰', label: 'Rabbit' },
];

export default function PetPicker({ visible, student, existing, onSaved, onCancel }) {
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kvWrap}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerEmoji}>🐾</Text>
                <Text style={styles.title}>Do you have a pet?</Text>
                <Text style={styles.titleSinhala}>ඔබට සතෙකු සිටිනවාද?</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={onCancel} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Ionicons name="close" size={22} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Pet type grid */}
              <Text style={styles.label}>Tap your pet! <Text style={styles.required}>*</Text></Text>
              <Text style={styles.labelSinhala}>ඔබේ සතා තෝරන්න!</Text>
              <View style={styles.petGrid}>
                {PETS.map(({ key, emoji, label }) => {
                  const selected = petType === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.petCard, selected && styles.petCardSelected]}
                      onPress={() => setPetType(selected ? null : key)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.petEmoji}>{emoji}</Text>
                      <Text style={[styles.petLabel, selected && styles.petLabelSelected]}>{label}</Text>
                      {selected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional pet name */}
              <Text style={styles.label}>What is your pet's name? <Text style={styles.optional}>(optional)</Text></Text>
              <Text style={styles.labelSinhala}>ඔබේ සතාගේ නම කුමක්ද?</Text>
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
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving || !canSave}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.saveBtnText}>Save & Start! 🚀</Text>
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
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  kvWrap: { width: '100%' },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  scroll: { paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.lg, paddingBottom: Layout.spacing.xl, gap: 8 },

  header: { alignItems: 'center', marginBottom: Layout.spacing.sm, position: 'relative' },
  closeBtn: { position: 'absolute', top: 0, right: 0, padding: 4 },
  headerEmoji: { fontSize: 38, marginBottom: 4 },
  title: { fontSize: Layout.fontSize.xl, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' },
  titleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', color: '#666', textAlign: 'center', marginTop: 2 },

  label: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#1A1A2E', marginTop: Layout.spacing.md },
  labelSinhala: { fontSize: Layout.fontSize.xs, fontWeight: '500', color: '#888', marginBottom: 4 },
  required: { color: '#EF4444' },
  optional: { fontWeight: '400', color: '#888' },

  petGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    justifyContent: 'center', marginTop: 4,
  },
  petCard: {
    width: 90, alignItems: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: Layout.radius.xl, borderWidth: 2.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  petCardSelected: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  petEmoji: { fontSize: 40 },
  petLabel: { fontSize: Layout.fontSize.sm, fontWeight: '700', color: '#475569' },
  petLabelSelected: { color: '#EA580C' },
  checkBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#F97316', borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },

  textInput: {
    borderWidth: 2, borderColor: '#E2E8F0', borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md, paddingVertical: 12,
    fontSize: Layout.fontSize.lg, fontWeight: '700', color: '#1A1A2E',
  },

  errorText: { color: '#EF4444', fontSize: Layout.fontSize.sm, fontWeight: '600', marginTop: 4 },

  saveBtn: {
    backgroundColor: '#F97316', borderRadius: Layout.radius.full,
    paddingVertical: Layout.spacing.md, alignItems: 'center',
    marginTop: Layout.spacing.lg,
    shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  saveBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '800', color: '#FFF' },
});
