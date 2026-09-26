/**
 * WritingCheckScreen.js
 *
 * The child-facing start and completion screens for a Writing Check.
 *
 * ── What the child sees ────────────────────────────────────────────────────
 * "Writing Check", "Let's write some letters.", a calm 20-step progress row,
 * and "All done! Great work." Nothing else. There is deliberately NO score, NO
 * pass/fail feedback between letters, NO animation, and none of the words
 * model, clustering, pattern, reference range or cluster anywhere in this file.
 *
 * ── ASD-friendly choices ───────────────────────────────────────────────────
 * Fixed layout that never reflows between letters; one instruction line in the
 * same place every time; progress shown as discrete filled dots rather than a
 * moving bar or a percentage; landscape, like every other writing activity;
 * and a resume path that always continues at the next uncaptured letter so
 * stopping mid-check is safe and never loses work.
 *
 * The actual writing reuses the existing LetterWritingScreen in collection
 * mode — this screen only frames it, so the capture conditions (three
 * attempts, attempt-3 guide rendering, feature extraction) are byte-identical
 * to the protocol the frozen model was fitted on.
 */

'use strict';

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useLockLandscape } from '../../../utils/useOrientationLock';
import useGatedBack from '../../../utils/useGatedBack';
import { generateUuidV4 } from '../../../utils/uuid';
import {
  startWritingCheck, fetchWritingCheckProgress, completeWritingCheck,
  WRITING_CHECK_REQUIRED_COUNT,
} from '../../../utils/writingCheck';

/** A calm, discrete progress row — no animation, no percentage. */
function ProgressDots({ captured, total }) {
  return (
    <View style={styles.dotRow} accessibilityLabel={`${captured} of ${total} letters done`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i < captured ? styles.dotFilled : styles.dotEmpty]} />
      ))}
    </View>
  );
}

export default function WritingCheckScreen({ route, navigation }) {
  // Every child writing activity is landscape. Locked on focus, released on
  // blur — see utils/useOrientationLock.js.
  useLockLandscape();

  const { student, theme } = route.params ?? {};
  const { requestBack, gateModal } = useGatedBack(() => navigation.goBack());

  // ── The screen's whole state, as one explicit machine ────────────────────
  //   loading -> ready | done | unavailable | error
  // There is deliberately no path that leaves `loading` set. A spinner with
  // no exit is worse than an error message: the teacher cannot tell whether
  // to wait, retry, or fetch help.
  const [state, setState] = useState({ phase: 'loading', check: null, captured: 0, remaining: [] });

  const load = useCallback(async () => {
    setState((s) => (s.phase === 'loading' ? s : { ...s, phase: 'loading' }));
    try {
      const started = await startWritingCheck({
        studentId: student?.sid,
        collectionSessionId: generateUuidV4(),
      });
      // A missing check object is as unusable as an outright failure - never
      // read `.id` off it and hope.
      if (started.status === 'unavailable' || !started.check?.id) {
        setState({ phase: 'unavailable', check: null, captured: 0, remaining: [] });
        return;
      }

      const progress = await fetchWritingCheckProgress(started.check.id);
      const captured = progress.status === 'found' ? progress.capturedCount : 0;
      const remaining = progress.status === 'found' ? progress.remaining : started.remaining;

      if (remaining.length === 0) {
        // Everything is already captured - finish it rather than
        // re-presenting letters the child has already done.
        await completeWritingCheck(started.check.id);
        setState({ phase: 'done', check: started.check, captured: WRITING_CHECK_REQUIRED_COUNT, remaining: [] });
        return;
      }
      setState({ phase: 'ready', check: started.check, captured, remaining });
    } catch (err) {
      // The API client never throws, so reaching here means a programming
      // fault in this screen - exactly the class of bug that used to sit
      // invisible behind the spinner. It becomes a visible, retryable error.
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[WritingCheck] load failed:', err?.message ?? err, err?.stack);
      }
      setState({ phase: 'error', check: null, captured: 0, remaining: [] });
    }
  }, [student]);

  // `load` is memoised on `student` (a stable route param), so this runs once
  // per focus and cannot re-trigger itself: nothing it sets is in its own
  // dependency list.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /**
   * Hands the remaining letters to the existing writing screen in COLLECTION
   * mode. That is what reproduces the model's training capture conditions —
   * this screen never re-implements any part of the capture.
   */
  /**
   * Hands the next batch of remaining letters to the existing writing screen
   * in COLLECTION mode. That is what reproduces the model's training capture
   * conditions - this screen never re-implements any part of the capture.
   *
   * ONE CASE AT A TIME, and always the earlier case first. The two writing
   * screens each render a single case: LetterWritingScreen filters the
   * sequence it is given down to its own `caseType`, so handing it all 20
   * mixed pairs would silently drop the 10 uppercase ones (and, on an
   * uppercase-only resume, would leave it with an empty sequence and fall
   * back to the whole alphabet). The child returns here between the two
   * batches, where fresh progress decides what is left.
   *
   * The protocol itself is untouched: `remaining` comes from the backend, in
   * LETTER_MOTOR_REFERENCE_LETTERS order, and is only partitioned by case.
   */
  function nextBatch() {
    const remaining = state.remaining ?? [];
    const lower = remaining.filter(p => p.caseType === 'lowercase');
    const upper = remaining.filter(p => p.caseType === 'uppercase');
    if (lower.length > 0) return { route: 'LetterWriting', caseType: 'lowercase', pairs: lower };
    if (upper.length > 0) return { route: 'UppercaseWriting', caseType: 'uppercase', pairs: upper };
    return null;
  }

  function beginWriting() {
    const batch = nextBatch();
    if (!batch || !state.check) return;

    navigation.navigate(batch.route, {
      student, theme,
      caseType: batch.caseType,
      collectionMode: true,
      collectionSessionId: state.check.collection_session_id,
      letterSequence: batch.pairs.map(p => ({ letter: p.letter, caseType: p.caseType })),
      // Tells the writing screen this run belongs to a Writing Check, so it
      // returns here when the batch is done instead of continuing into the
      // research data-collection protocol.
      writingCheckId: state.check.id,
    });
  }

  const bg = [theme?.gradientStart ?? '#EEF2FF', theme?.gradientEnd ?? '#E0E7FF'];

  return (
    <LinearGradient colors={bg} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={requestBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={theme?.headingText ?? '#1E293B'} />
          </TouchableOpacity>
        </View>

        <View style={styles.center}>
          {state.phase === 'loading' && (
            <>
              <ActivityIndicator size="large" color={theme?.button ?? '#6366F1'} />
              <Text style={styles.subtitle}>Getting ready…</Text>
            </>
          )}

          {(state.phase === 'unavailable' || state.phase === 'error') && (
            <>
              <Text style={styles.title}>Writing Check</Text>
              <Text style={styles.subtitle}>
                {state.phase === 'error'
                  ? 'Writing Check could not be loaded.'
                  : 'We can\u2019t start right now. Please try again later.'}
              </Text>
              <View style={styles.errorRow}>
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: theme?.button ?? '#6366F1' }]}
                  onPress={load}
                  activeOpacity={0.85}
                  accessibilityLabel="Try again"
                >
                  <Text style={[styles.startBtnText, { color: theme?.buttonText ?? '#FFFFFF' }]}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={requestBack}
                  activeOpacity={0.85}
                  accessibilityLabel="Back \u2014 needs a code"
                >
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {state.phase === 'ready' && (
            <>
              <Text style={styles.title}>Writing Check</Text>
              <Text style={styles.subtitle}>Let&apos;s write some letters.</Text>

              <ProgressDots captured={state.captured} total={WRITING_CHECK_REQUIRED_COUNT} />
              <Text style={styles.countText}>
                {state.captured} of {WRITING_CHECK_REQUIRED_COUNT}
              </Text>

              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme?.button ?? '#6366F1' }]}
                onPress={beginWriting}
                activeOpacity={0.85}
                accessibilityLabel={state.captured > 0 ? 'Keep going' : 'Start'}
              >
                <Text style={[styles.startBtnText, { color: theme?.buttonText ?? '#FFFFFF' }]}>
                  {state.captured > 0 ? 'Keep going' : 'Start'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {state.phase === 'done' && (
            <>
              <Ionicons name="checkmark-circle" size={64} color={theme?.button ?? '#6366F1'} />
              <Text style={styles.title}>All done!</Text>
              <Text style={styles.subtitle}>Great work.</Text>
              {/* Leaving the activity is an adult decision here too — the same
                  principle every other handwriting screen follows — so Finish
                  goes through the same gate as the back button rather than
                  navigating straight out. */}
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme?.button ?? '#6366F1' }]}
                onPress={requestBack}
                activeOpacity={0.85}
                accessibilityLabel="Finish — needs a code"
              >
                <Text style={[styles.startBtnText, { color: theme?.buttonText ?? '#FFFFFF' }]}>Finish</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {gateModal}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill:      { flex: 1 },
  topBar:    { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
               backgroundColor: 'rgba(255,255,255,0.4)' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  title:     { fontSize: 30, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#1E293B', textAlign: 'center' },
  subtitle:  { fontSize: 17, color: '#475569', textAlign: 'center' },
  countText: { fontSize: 15, color: '#475569', fontVariant: ['tabular-nums'] },
  dotRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 420 },
  dot:       { width: 13, height: 13, borderRadius: 7 },
  dotFilled: { backgroundColor: '#6366F1' },
  dotEmpty:  { backgroundColor: 'rgba(100,116,139,0.22)' },
  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondaryBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 28, marginTop: 6,
                  backgroundColor: 'rgba(255,255,255,0.55)' },
  secondaryBtnText: { fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#475569' },
  startBtn:  { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 28, marginTop: 6 },
  startBtnText: { fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
});
