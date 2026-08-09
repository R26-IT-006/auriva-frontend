import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../constants/layout';

// Rule 5 — periodic production probe (TASK-37 backend, TASK-39 frontend).
// Small, dismissible, non-blocking check-in invitation. Purely presentational:
// the caller fetches the probe candidate (dialogueApi.getProbeCandidate) and
// decides whether to render this at all. Dismissal only hides the card for
// this visit — not persisted, by design (it reappears next time a candidate
// comes back, which is expected).
export default function ProbeBanner({ wordLabel, theme, onPress, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardSurface }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name="sparkles-outline" size={18} color={theme.button} />
      <Text style={[styles.text, { color: theme.headingText }]} numberOfLines={2}>
        {`Let's see if ${wordLabel} comes easily today!`}
      </Text>
      <TouchableOpacity
        onPress={handleDismiss}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={18} color={theme.headingText} style={styles.closeIcon} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:                8,
    borderRadius:       Layout.radius.lg,
    paddingVertical:    Layout.spacing.sm,
    paddingHorizontal:  Layout.spacing.md,
    marginHorizontal:   Layout.spacing.lg,
    marginTop:          Layout.spacing.sm,
    ...Layout.shadow.sm,
  },
  text: {
    flex:       1,
    fontSize:   Layout.fontSize.sm,
    fontWeight: '600',
  },
  closeIcon: { opacity: 0.5 },
});
