/**
 * BreakPromptModal.js
 *
 * Proposal FR-13, Phase 7A — the calm, ASD-friendly break prompt (spec
 * item 6). Reads showBreakPrompt from LearningSessionContext directly
 * (true only once the configured session duration is reached AND no
 * stroke is currently in progress) so every learning screen renders the
 * SAME state — no per-screen timer/logic duplication (spec item 10); only
 * this one presentational component is mounted from each of the 4-5
 * learning screens (PreWritingActivity/LetterWriting/UppercaseWriting/
 * WordWriting/WordActivity), each passing its own already-correct
 * `navigation` prop — React Navigation's nested-navigator boundaries mean
 * a shared "useNavigation() from outside the inner stack" approach would
 * resolve to the WRONG (outer) navigator, so each screen's own prop is
 * used instead of a single global mount point.
 *
 * Deliberately NOT: a countdown, an alarm sound, a red/flashing screen,
 * or punitive wording. No "Fatigue detected" language anywhere — see
 * learningSessionTimer.test.js's own terminology guard for the pure-logic
 * side of this same rule.
 *
 * "Continue" is available ONLY behind the existing adult ParentGateModal
 * (the same gate LetterHomeScreen.js already uses for its own sensitive
 * actions) — never a plain child-tappable bypass, per spec item 6.
 */

'use strict';

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParentGateModal } from '../common/ParentGateModal';
import { useLearningSession, speakBreakPrompt, stopBreakPromptSpeech } from '../../context/LearningSessionContext';

const ACCENT = '#4AABB8';

export default function BreakPromptModal({ navigation, student, theme }) {
  const { showBreakPrompt, takeBreak, resumeAfterBreak, finishForNow } = useLearningSession();
  const [gateVisible, setGateVisible] = useState(false);
  const visible = showBreakPrompt;

  // Speak once when the prompt actually appears — never on every render,
  // never repeated while it stays open. Stopped on unmount (spec item 11).
  useEffect(() => {
    if (visible) speakBreakPrompt();
    return () => stopBreakPromptSpeech();
  }, [visible]);

  if (!visible) return null;

  // Both actions navigate to the existing calm hub (LetterHome) rather
  // than trying to hold/freeze the writing canvas in place (spec item 7:
  // "Determine whether navigation to an existing calm/home screen is
  // safer than holding the writing canvas" — it is: nothing about the
  // interrupted attempt cycle was ever persisted yet, since only a
  // completed attempt-3 submission saves anything — see recordLetterCompletion's
  // own "only POSTs at attempt 3" design — so leaving mid-cycle loses
  // nothing that was ever saved).
  const onTakeBreak = () => {
    takeBreak();
    navigation.navigate('LetterHome', { student, theme });
  };
  const onFinishForNow = () => {
    finishForNow();
    navigation.navigate('LetterHome', { student, theme });
  };
  const onContinue = () => {
    resumeAfterBreak();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <Ionicons name="cafe-outline" size={40} color={ACCENT} />
          </View>
          <Text style={styles.title}>Time for a short break</Text>
          <Text style={styles.subtitle}>You've been learning for a while. Session time to relax a little!</Text>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={onTakeBreak}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Take a Break"
          >
            <Ionicons name="pause-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Take a Break</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onFinishForNow}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Finish for Now"
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={ACCENT} />
            <Text style={styles.secondaryButtonText}>Finish for Now</Text>
          </TouchableOpacity>

          {/* Adult-gated override only — never a bare child-tappable button. */}
          <TouchableOpacity
            style={styles.teacherLink}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Teacher: continue this session"
          >
            <Text style={styles.teacherLinkText}>Teacher: continue session</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); onContinue?.(); }}
        onCancel={() => setGateVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 26,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    color: '#2A2A2A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: ACCENT,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },
  secondaryButton: {
    backgroundColor: '#F2F8F9',
    borderWidth: 1.5,
    borderColor: ACCENT + '40',
  },
  secondaryButtonText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },
  teacherLink: {
    marginTop: 6,
    paddingVertical: 6,
  },
  teacherLinkText: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    textDecorationLine: 'underline',
  },
});
