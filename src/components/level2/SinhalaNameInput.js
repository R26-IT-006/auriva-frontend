import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { singlishToUnicode } from 'sinhala-unicode-coverter';
import { Layout } from '../../constants/layout';

/**
 * Shared suggest-then-confirm component for any proper noun that needs a
 * Sinhala-script spelling alongside its English form (TASK-30: the child's
 * own name; TASK-19/20 reuse this unmodified for friend/pet names — keep
 * this component free of any self-introduction-specific assumptions).
 *
 * As englishValue changes, an automatic Singlish-to-Sinhala suggestion is
 * generated and placed in the editable field below — never auto-accepted.
 * `sinhala-unicode-coverter` is known (from live testing) to occasionally
 * get the first consonant wrong on certain names (e.g. rendering a "d"
 * sound as the retroflex ඩ instead of ද) — this is why the field is always
 * editable and the note below always visible, not cosmetic caution.
 *
 * Auto-suggestion only ever fires while there's no confirmed value yet:
 * `confirmedRef` starts true if `sinhalaValue` is already non-empty on
 * mount (an existing/saved spelling — e.g. a teacher re-opening a saved
 * record, the exact scenario TASK-19/20 will hit) and is set the moment the
 * teacher directly edits the field. Once set, this component never
 * overwrites the field again on its own — protecting a confirmed value is
 * the whole point of the human-confirmation step (see the task rationale).
 */
export default function SinhalaNameInput({ label, englishValue, sinhalaValue, onSinhalaChange, theme }) {
  const [text, setText] = useState(sinhalaValue || '');
  const confirmedRef = useRef(!!(sinhalaValue && sinhalaValue.trim()));

  useEffect(() => {
    if (confirmedRef.current) return;
    const trimmed = (englishValue || '').trim();
    const suggestion = trimmed ? singlishToUnicode(trimmed.toLowerCase()) : '';
    setText(suggestion);
    onSinhalaChange(suggestion);
    // Re-suggest only when the English spelling itself changes — deliberately
    // excludes onSinhalaChange/sinhalaValue from deps so the teacher's own
    // edits below don't get clobbered by this effect re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [englishValue]);

  function handleChangeText(value) {
    confirmedRef.current = true;
    setText(value);
    onSinhalaChange(value);
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.headingText }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: theme.headingText, borderColor: theme.cardOutline }]}
        value={text}
        onChangeText={handleChangeText}
        placeholder="Sinhala spelling"
        placeholderTextColor="#AAA"
        maxLength={100}
      />
      <Text style={[styles.note, { color: theme.headingText }]}>
        Please check this spelling looks right — automatic suggestions can occasionally get names wrong.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: Layout.spacing.xs },
  label: { fontSize: Layout.fontSize.sm, fontWeight: '700', opacity: 0.8 },
  input: {
    width: '100%',
    maxWidth: 260,
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1.5,
    borderRadius: Layout.radius.md,
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  note: { fontSize: Layout.fontSize.xs, fontWeight: '500', opacity: 0.6, textAlign: 'center', maxWidth: 280 },
});
