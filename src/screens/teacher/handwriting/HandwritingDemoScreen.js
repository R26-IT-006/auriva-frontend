/**
 * HandwritingDemoScreen.js
 *
 * The "watch first" detour. One screen, all nine demonstrations.
 *
 * ── What this screen is, and is not ─────────────────────────────────────
 * It is a controller: it works out WHICH demonstration is due, loads the
 * real reference geometry for it, drives the animation, and navigates on.
 * It is NOT an activity interface. Every demonstration below renders the
 * activity's OWN component — LetterWritingStage, WordWritingStage,
 * ShapeAssessmentStage, ExerciseD_SpellWord — in demo mode, so the child
 * watches the exact screen they are about to use, at the exact size, with
 * the exact guide and the exact tracer, and only the interaction removed.
 *
 * ── The navigation contract ─────────────────────────────────────────────
 * Identical to PreWritingActivityScreen's, which this flow has already
 * proven: the origin screen pushes here with `nextRoute` + `nextParams`,
 * and the only way out forwards those verbatim via
 * `navigation.replace(nextRoute, nextParams)`. Forwarding the caller's own
 * params rather than rebuilding them is what guarantees the real activity
 * resumes exactly where it was.
 *
 * ── When the demo is recorded as done ───────────────────────────────────
 * Only when the child presses "I'm Ready". Navigating INTO the demo marks
 * nothing persistent — that is the in-memory latch's job (demoGuard.js). A
 * crash, a forced close, or a hardware-back out of this screen therefore
 * leaves the demonstration un-consumed and the child is offered it again.
 *
 * ── This screen writes no handwriting data ──────────────────────────────
 * No canvas of its own, no PanResponder, nothing from api/. It cannot
 * create an attempt, a trajectory, an assessment record, a score, a
 * progress row or model input, because there is no code here that could —
 * and the stages it renders attach no touch handlers at all in demo mode.
 */

'use strict';

import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, AccessibilityInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import { useLockLandscape } from '../../../utils/useOrientationLock';
import HandwritingDemo from '../../../components/handwriting/HandwritingDemo';
import useDemoPathAnimation from '../../../components/handwriting/useDemoPathAnimation';
import { getDemoPresentation, DEMO_TYPES, DEMO_COPY } from '../../../utils/demoPolicy';
import {
  buildLetterDemoTimeline, buildWordDemoTimeline, buildShapeDemoTimeline,
} from '../../../utils/demoPlayback';
import { markDemoShown } from '../../../utils/storage';

// The real activities' own presentation — never a substitute.
import LetterWritingStage, {
  SUPPORT_BADGE,
} from '../../../components/handwriting/LetterWritingStage';
import WordWritingStage from '../../../components/handwriting/WordWritingStage';
import ShapeAssessmentStage from '../../../components/handwriting/ShapeAssessmentStage';
import ExerciseD_SpellWord from '../../../components/word/ExerciseD_SpellWord';

import { SUPPORT_LEVELS, getSupportPresentation } from '../../../constants/handwritingSupportLevels';
import { instructionForSupport } from '../../../constants/childInstructions';
import { CANVAS_W as LETTER_CANVAS_W, CANVAS_H as LETTER_CANVAS_H } from '../../../constants/letterCanvasLayout';
import { CANVAS_W as WORD_CANVAS_W, CANVAS_H as WORD_CANVAS_H } from '../../../constants/wordCanvasLayout';
import {
  CANVAS_WIDTH as SHAPE_CANVAS_W, CANVAS_HEIGHT as SHAPE_CANVAS_H,
  POINTER_HALF, SHAPE_STARTS,
} from '../../../constants/shapeCanvasLayout';
import { computeShapeTemplate } from '../../../utils/unifiedShapeScoreMirror';
import {
  buildWordGuide, buildWordTracerStrokes, wordGuideToSvgPath, wordGuideGhostDots,
  buildWordLetterBoxes,
} from '../../../data/wordPaths';
import { ANGULAR_LOWERCASE, ANGULAR_UPPERCASE } from '../../../utils/demoPlayback';
import {
  LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS,
} from '../../../constants/activityPreviewLetterPaths';

// The demonstration shows the child what Attempt 1 will look like, so it
// borrows Attempt 1's own support presentation rather than choosing its own
// guide opacity. HIGH support = the ghost letter at 0.14 plus the tracer.
const DEMO_SUPPORT = getSupportPresentation({
  supportLevel: SUPPORT_LEVELS.HIGH, attempt: 1, collectionMode: false,
});

// The badge keeps the real activity's chrome, with the demonstration's own
// words in it — never an attempt number, which would be a lie here.
const DEMO_BADGE = SUPPORT_BADGE[SUPPORT_LEVELS.HIGH];
// The demonstration IS the high-support presentation, so it shows the same
// bilingual instruction the child will see on their first attempt.
const DEMO_INSTRUCTION = instructionForSupport(SUPPORT_LEVELS.HIGH);

// One representative shape teaches the assessment's single interaction:
// follow the path with your finger.
const DEMO_SHAPE = {
  id: 'horizontal_line',
  instruction:   'Trace left to right',
  instructionSi: 'වමේ සිට දකුණට අඳින්න',
  pageLabel:     'Watch first',
};

export default function HandwritingDemoScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape.
  // Locked here too, so a demo can never hand the real activity back a
  // portrait screen — see utils/useOrientationLock.js.
  useLockLandscape();

  const {
    student, theme,
    demoKey,
    letter = null, caseType = null,
    word = null,
    shapeId = null,
    tapLetters = null,
    nextRoute, nextParams,
  } = route.params ?? {};

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (active) setReduceMotion(!!v); });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => { active = false; sub?.remove?.(); };
  }, []);

  // Replay bumps this. It restarts the animation and nothing else.
  const [playToken, setPlayToken] = useState(0);
  const [played, setPlayed] = useState(false);

  const presentation = getDemoPresentation(demoKey);
  const type = presentation?.type ?? DEMO_TYPES.PATH;
  const isShape = !!shapeId;
  const isWord  = !isShape && !!word;
  const isLetter = !isShape && !isWord && !!letter;

  // Built from the SAME reference geometry the real activity uses, at the
  // SAME canvas dimensions — never a demo-only path or a demo-only size.
  const timeline = useMemo(() => {
    if (type !== DEMO_TYPES.PATH) return null;
    if (isShape) {
      return buildShapeDemoTimeline({
        shapeId, canvasW: SHAPE_CANVAS_W, canvasH: SHAPE_CANVAS_H, computeShapeTemplate,
        // The template is already in the assessment canvas's own coordinates,
        // so it must NOT be rescaled - the pointer has to run along the very
        // dashed guide GuideShape draws.
        fitToCanvas: false,
      });
    }
    if (isWord) {
      return buildWordDemoTimeline({
        word, canvasW: WORD_CANVAS_W, canvasH: WORD_CANVAS_H,
        buildWordGuide, buildWordTracerStrokes,
      });
    }
    if (isLetter) {
      return buildLetterDemoTimeline({
        letter, caseType, canvasW: LETTER_CANVAS_W, canvasH: LETTER_CANVAS_H,
      });
    }
    return null;
  }, [type, isShape, isWord, isLetter, shapeId, word, letter, caseType]);

  const { x: tracerX, y: tracerY, visible: tracerVisible } = useDemoPathAnimation({
    timeline, reduceMotion, playToken, onPassComplete: () => setPlayed(true),
  });

  // Word guide geometry — the same helpers WordWritingScreen renders from.
  const wordGuide = useMemo(
    () => (isWord ? buildWordGuide(word) : null),
    [isWord, word],
  );

  /**
   * The only exit. Records completion, then hands control back to the real
   * activity with the caller's own params untouched.
   */
  const handleReady = async () => {
    try {
      if (student?.sid != null && demoKey) await markDemoShown(student.sid, demoKey);
    } catch {
      // Deliberately swallowed: a storage failure means the demo may be
      // offered once more, which is the harmless direction.
    }
    if (nextRoute) navigation.replace(nextRoute, nextParams);
    else navigation.goBack();
  };

  const handleReplay = () => { setPlayed(false); setPlayToken((t) => t + 1); };

  function renderActivity() {
    if (type === DEMO_TYPES.TAP) {
      const demoWord = { word: (tapLetters ?? []).join(''), emoji: null, imageKey: null };
      if (!demoWord.word) return null;
      return (
        <ExerciseD_SpellWord
          key={`demo-${playToken}`}
          wordEntry={demoWord}
          theme={theme}
          onComplete={undefined}
          demoMode
          demoPlayToken={playToken}
          onDemoPassComplete={() => setPlayed(true)}
        />
      );
    }

    if (isShape) {
      return (
        <ShapeAssessmentStage
          mode="demo"
          theme={theme}
          shape={DEMO_SHAPE}
          startDot={SHAPE_STARTS[shapeId] ?? null}
          showPulse
          // Centred on the path exactly as the real screen centres its own
          // pointer (pathPoints.map(p => p.x - POINTER_HALF)).
          pointerLeft={tracerVisible && tracerX ? Animated.subtract(tracerX, POINTER_HALF) : null}
          pointerTop={tracerVisible && tracerY ? Animated.subtract(tracerY, POINTER_HALF) : null}
        />
      );
    }

    if (isWord) {
      return (
        <WordWritingStage
          mode="demo"
          theme={theme}
          displayWord={word}
          word={word}
          spelling={word.replace(/[^a-z]/gi, '').split('').join(' · ')}
          badge={DEMO_BADGE}
          instruction={DEMO_INSTRUCTION}
          guideOpacity={DEMO_SUPPORT.guideOpacity}
          guidePathD={wordGuide ? wordGuideToSvgPath(wordGuide.strokeDescriptors, WORD_CANVAS_W, WORD_CANVAS_H) : null}
          guideDots={wordGuide ? wordGuideGhostDots(wordGuide.strokeDescriptors, WORD_CANVAS_W, WORD_CANVAS_H) : []}
          letterBoxes={buildWordLetterBoxes(word, WORD_CANVAS_W, WORD_CANVAS_H)}
          showStrokeOrder={false}
          tracerVisible={tracerVisible}
          tracerXInterp={tracerX}
          tracerYInterp={tracerY}
        />
      );
    }

    if (isLetter) {
      const upper = caseType === 'uppercase';
      const ch = upper ? letter.toUpperCase() : letter.toLowerCase();
      return (
        <LetterWritingStage
          mode="demo"
          letter={ch}
          theme={theme}
          rawPath={upper ? UPPERCASE_LETTER_PATHS[ch] : LOWERCASE_LETTER_PATHS[ch]}
          isAngular={(upper ? ANGULAR_UPPERCASE : ANGULAR_LOWERCASE).has(ch)}
          guideOpacity={DEMO_SUPPORT.guideOpacity}
          supportPresentation={DEMO_SUPPORT}
          badge={DEMO_BADGE}
          instruction={DEMO_INSTRUCTION}
          tracerVisible={tracerVisible}
          tracerXInterp={tracerX}
          tracerYInterp={tracerY}
        />
      );
    }

    return null;
  }

  return (
    <>
      <StatusBar hidden />
      <LinearGradient
        colors={theme?.backgroundGradient ?? ['#EAF3FD', '#F7FBFF', '#FFFFFF']}
        style={styles.fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={styles.fill}>
          <HandwritingDemo
            title={presentation?.title ?? DEMO_COPY.WATCH_FIRST}
            instruction={presentation?.instruction ?? DEMO_COPY.START_HERE}
            played={played}
            theme={theme}
            onReplay={handleReplay}
            onReady={handleReady}
          >
            <View style={styles.activity}>{renderActivity()}</View>
          </HandwritingDemo>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  fill:     { flex: 1 },
  // The activity keeps its own dimensions; this only centres it.
  activity: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
