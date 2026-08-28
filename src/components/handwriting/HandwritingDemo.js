/**
 * HandwritingDemo.js
 *
 * The watch-only overlay — and nothing else.
 *
 * ── What changed, and why it matters ────────────────────────────────────
 * This component used to draw its own canvas: a tidy white box with a light
 * reference path and a small pointer. It looked fine and it was wrong. A
 * child who watched that demonstration then met a completely different
 * screen — different canvas size, no 4-line ruling, no letter card, no title
 * card, a different tracer dot — and had to work out for themselves that the
 * two were about the same thing.
 *
 * Now the demonstration renders the REAL activity's own components
 * (LetterWritingStage, WordWritingStage, ShapeAssessmentStage,
 * ExerciseD_SpellWord) in demo mode, and this file contributes only the thin
 * frame around them:
 *
 *     "Watch first."          <- top
 *     [ the real activity ]   <- children, untouched
 *     [Replay]  [I'm Ready]   <- bottom
 *
 * It invents no activity interface of its own. If the real screen changes,
 * the demonstration changes with it, because it is the same component.
 *
 * The frame sits above and below the activity — never over it — so the
 * target and the path are never covered.
 */

'use strict';

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DEMO_COPY } from '../../utils/demoPolicy';

/**
 * @param {{
 *   title: string,
 *   instruction: string,
 *   played?: boolean,          // one full pass done -> "Now you try."
 *   showReplay?: boolean,
 *   readyLabel?: string,
 *   theme: object,
 *   onReplay: () => void,
 *   onReady: () => void,
 *   children: React.ReactNode, // the REAL activity, in demo mode
 * }} props
 */
export default function HandwritingDemo({
  title,
  instruction,
  played = false,
  showReplay = true,
  readyLabel = DEMO_COPY.READY,
  theme,
  onReplay,
  onReady,
  children,
}) {
  return (
    <View style={styles.root}>
      {/* Top: one instruction at a time, and only one. */}
      <View style={styles.banner}>
        <Text style={[styles.title, { color: theme?.headingText ?? '#1E293B' }]}>{title}</Text>
        <Text style={styles.instruction}>
          {played ? DEMO_COPY.NOW_YOU_TRY : instruction}
        </Text>
      </View>

      {/* Centre: the activity itself, exactly as the child will meet it. */}
      <View style={styles.stage}>{children}</View>

      {/* Bottom: the only two things the child can do. */}
      <View style={styles.buttonRow}>
        {showReplay ? (
          <TouchableOpacity
            style={styles.replayBtn}
            onPress={onReplay}
            accessibilityRole="button"
            accessibilityLabel={DEMO_COPY.REPLAY}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color="#475569" />
            <Text style={styles.replayText}>{DEMO_COPY.REPLAY}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.readyBtn, { backgroundColor: theme?.button ?? '#302E91' }]}
          onPress={onReady}
          accessibilityRole="button"
          accessibilityLabel={readyLabel}
          activeOpacity={0.85}
        >
          <Text style={[styles.readyText, { color: theme?.buttonText ?? '#FFFFFF' }]}>{readyLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  banner:      { alignItems: 'center', paddingTop: 6, paddingBottom: 2 },
  title:       { fontSize: 24, fontWeight: '900', fontFamily: 'Nunito_900Black' },
  instruction: { fontSize: 15, color: '#475569', fontWeight: '600', fontFamily: 'Nunito_600SemiBold', marginTop: 1 },

  // The activity keeps its own sizing; this only gives it the room.
  stage:       { flex: 1, justifyContent: 'center' },

  buttonRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 8 },
  replayBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: '#FFFFFFCC' },
  replayText:  { fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#475569' },
  readyBtn:    { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 16 },
  readyText:   { fontSize: 18, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },
});
