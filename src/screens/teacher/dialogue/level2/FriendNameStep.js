/**
 * FriendNameStep  (TASK-20)
 * Modal overlay presented from L2TopicSelectionScreen when the child taps
 * "Describing a Friend" and no friend data has been saved yet (or wants to
 * update it).  Collects:
 *   - friend_name       (required, text)
 *   - friend_gender     (required, 'boy' | 'girl')
 *   - friend_age        (optional, integer 5–12)
 *   - friend_grade      (optional, integer 1–6)
 *   - friend_personality (optional, one of the chips)
 *
 * On Save → calls patchQuestionnaire(studentId, { friend_* fields }) then
 * calls onSaved(patchedFields) so the parent can navigate to L2Loading.
 *
 * Props:
 *   visible     : bool
 *   student     : object  { sid, ... }
 *   existing    : object | null  — questionnaire data already saved
 *   onSaved     : (fields) => void
 *   onCancel    : () => void
 * Imported: level2Api
 */
import { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { level2Api } from '../../../../api/level2';

const PERSONALITY_OPTIONS = ['kind', 'funny', 'smart', 'brave', 'caring', 'creative'];
const AGE_OPTIONS    = [5, 6, 7, 8, 9, 10, 11, 12];
const GRADE_OPTIONS  = [1, 2, 3, 4, 5, 6];

export default function FriendNameStep({ visible, student, existing, onSaved, onCancel }) {
  const [name,        setName]        = useState(existing?.friend_name         ?? '');
  const [gender,      setGender]      = useState(existing?.friend_gender       ?? null);
  const [age,         setAge]         = useState(existing?.friend_age          ?? null);
  const [grade,       setGrade]       = useState(existing?.friend_grade        ?? null);
  const [personality, setPersonality] = useState(existing?.friend_personality  ?? null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const canSave = name.trim().length > 0 && gender !== null;

  async function handleSave() {
    if (!canSave) { setError('Please enter your friend\'s name and choose girl or boy.'); return; }
    setError('');
    setSaving(true);
    const fields = {
      friend_name:        name.trim(),
      friend_gender:      gender,
      friend_age:         age,
      friend_grade:       grade,
      friend_personality: personality,
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
                <Text style={styles.headerEmoji}>👫</Text>
                <Text style={styles.title}>Tell me about your friend!</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={onCancel} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Ionicons name="close" size={22} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Friend's Name */}
              <Text style={styles.label}>What is your friend's name? <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Friend's name"
                placeholderTextColor="#AAA"
                maxLength={40}
                autoCapitalize="words"
              />

              {/* Gender */}
              <Text style={styles.label}>Is your friend a girl or a boy? <Text style={styles.required}>*</Text></Text>
              <View style={styles.chipRow}>
                {[{ v: 'girl', label: 'Girl 👧' }, { v: 'boy', label: 'Boy 👦' }].map(({ v, label }) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, gender === v && styles.chipSelected]}
                    onPress={() => setGender(v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, gender === v && styles.chipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Age (optional) */}
              <Text style={styles.label}>How old is your friend? <Text style={styles.optional}>(optional)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {AGE_OPTIONS.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.chip, styles.chipSm, age === a && styles.chipSelected]}
                    onPress={() => setAge(age === a ? null : a)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, age === a && styles.chipTextSelected]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Grade (optional) */}
              <Text style={styles.label}>What grade is your friend in? <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.chipRow}>
                {GRADE_OPTIONS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, styles.chipSm, grade === g && styles.chipSelected]}
                    onPress={() => setGrade(grade === g ? null : g)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, grade === g && styles.chipTextSelected]}>Grade {g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Personality (optional) */}
              <Text style={styles.label}>Why do you like your friend? <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.chipRow}>
                {PERSONALITY_OPTIONS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, personality === p && styles.chipSelected]}
                    onPress={() => setPersonality(personality === p ? null : p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, personality === p && styles.chipTextSelected]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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

  textInput: {
    borderWidth: 2, borderColor: '#E2E8F0', borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md, paddingVertical: 12,
    fontSize: Layout.fontSize.lg, fontWeight: '700', color: '#1A1A2E',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: Layout.radius.full,
    borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  chipSm: { paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  chipText: { fontSize: Layout.fontSize.sm, fontWeight: '700', color: '#475569' },
  chipTextSelected: { color: '#6366F1' },

  errorText: { color: '#EF4444', fontSize: Layout.fontSize.sm, fontWeight: '600', marginTop: 4 },

  saveBtn: {
    backgroundColor: '#6366F1', borderRadius: Layout.radius.full,
    paddingVertical: Layout.spacing.md, alignItems: 'center',
    marginTop: Layout.spacing.lg,
    shadowColor: '#4338CA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  saveBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '800', color: '#FFF' },
});
