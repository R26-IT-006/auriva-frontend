import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Animated,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Polygon, Path, Rect, Text as SvgText } from 'react-native-svg';
import * as Speech from 'expo-speech';
import { VideoView, useVideoPlayer } from 'expo-video';
import WordImageDisplay from '../../../components/word/WordImageDisplay';
import WORD_VIDEOS from '../../../constants/wordVideos';
import {
  buildWordGuide,
  wordGuideToSvgPath,
  wordGuideGhostDots,
  buildWordTracerStrokes,
  getWordStrokeDirectionHint,
  computeWordDTW,
  buildWordLetterBoxes,
} from '../../../constants/wordPaths';
import { featuresToScore } from '../../../utils/adaptiveSequencing';
import { submitWordAttempt, newActionId } from '../../../utils/wordApi';
import { GUIDED_SUPPORT, afterGuidedAttempt, buildWordRouteParams, resolveWordSession } from '../../../utils/wordWorkflow';
// One-time word-writing introduction — see utils/demoPolicy.js.
import { useDemoDetour } from '../../../utils/demoDetour';
import { DEMO_KEYS } from '../../../utils/demoPolicy';
import { childFeedbackMessage } from '../../../utils/wordFeedback';
import { clampToCanvas, isImplausibleJump, pageToLocal, mapTouchToCanvas } from '../../../utils/touchPointSanitize';
import { useLearningSessionActivity } from '../../../context/LearningSessionContext';
import { LIVE_ACTIVITY_TYPES } from '../../../constants/liveSessionPolicy';
import { buildProgressPatch, buildScorePatch } from '../../../utils/liveSessionSnapshot';
import BreakPromptModal from '../../../components/handwriting/BreakPromptModal';
import { useLockLandscape } from '../../../utils/useOrientationLock';
// The shared word-writing presentation - this screen and the demonstration
// render the SAME component, in different modes.
import WordWritingStage from '../../../components/handwriting/WordWritingStage';
import AttemptAvatarFeedback from '../AttemptAvatarFeedback';
import { instructionForSupport } from '../../../constants/childInstructions';
import {
  PAD, COL_L, IMG_SIZE, CANVAS_W, CANVAS_H, LINE_1, LINE_2, LINE_3, LINE_4,
  WORD_SCREEN_W,
} from '../../../constants/wordCanvasLayout';
import useGatedBack from '../../../utils/useGatedBack';
import { goBackToOrigin } from '../../../utils/backToOrigin';
import { SPEECH_LOCALE_EN } from '../../../constants/speechLocale';
import { hasCanvasDrawing } from '../../../utils/canvasDrawingState';
import { actionRowMinHeight } from '../../../constants/writingActionRow';
import { spokenWord, spokenLetter } from '../../../utils/wordSpeech';
import { startGuideReplayCycle } from '../../../utils/guideReplayCycle';

// The same dwell the letter screens give their avatar feedback.
const ATTEMPT_FEEDBACK_MS = 2200;

// The canvas view's own borderWidth. measure() reports the BORDER box while
// the Svg starts inside the border, so this removes that systematic offset.
// Kept next to the import so one file has one value.
const CANVAS_BORDER_WIDTH = 1.5;

// Canvas geometry (CANVAS_W/CANVAS_H, the 4-line ruling, the column split)
// now lives in ONE place, imported above and shared with the "watch first"
// demonstration, so a demo can never lay this word out at a different size.
// Every value is unchanged - see constants/wordCanvasLayout.js.
//
// The screen width keeps its original local name because the intro-video
// overlay below sizes itself from it. Aliased rather than re-measured: a
// second Dimensions.get('window') call would be a second source of truth for
// the same number.
const SCREEN_W = WORD_SCREEN_W;

// â”€â”€â”€ Attempt colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ATTEMPT_BADGE = {
  1: { bg: '#FFCBA8', border: '#FF8C42', text: '#7A2D00' },
  2: { bg: '#FFE97A', border: '#F0C000', text: '#5A4000' },
  3: { bg: '#A8E6A8', border: '#4CAF50', text: '#1B5E20' },
};

// Attempt 1/2/3 map onto the SAME three support levels the letter screens
// use, so they now show the same words from the same file rather than a
// second, differently-worded copy. The attempt number itself is unchanged and
// still drives every guide, tracer and scoring decision — it just no longer
// addresses the child.
const ATTEMPT_SUPPORT_LEVEL = { 1: 'high', 2: 'medium', 3: 'low' };

// â”€â”€â”€ Length-group celebrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LENGTH_CELEBRATIONS = {
  3: {
    emoji: '⭐', title: 'Short Words Done!',
    message: 'Great job writing the short words!\nReady for longer ones?',
    gradient: ['#E3F2FD', '#BBDEFB'], color: '#1565C0',
  },
  4: {
    emoji: '🌟', title: '4-Letter Words Done!',
    message: "You're getting stronger!\nTime for the longer words.",
    gradient: ['#F3E5F5', '#E1BEE7'], color: '#6A1B9A',
  },
  5: {
    emoji: '🏆', title: 'Long Words Done!',
    message: 'You nailed all the long words!\nAmazing work!',
    gradient: ['#FFF8E1', '#FFE082'], color: '#E65100',
  },
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getLengthGroup(word) {
  const l = word.length;
  if (l <= 3) return 3;
  if (l <= 4) return 4;
  return 5;
}

function getSpelling(word) {
  return word.replace(/[^a-z]/gi, '').split('').join(' · ');
}

function calculateSmoothness(paths) {
  const all = paths.flat();
  if (all.length < 3) return 0;
  const changes = [];
  for (let i = 1; i < all.length - 1; i++) {
    const v1x = all[i].x - all[i-1].x, v1y = all[i].y - all[i-1].y;
    const v2x = all[i+1].x - all[i].x, v2y = all[i+1].y - all[i].y;
    const l1 = Math.sqrt(v1x*v1x + v1y*v1y);
    const l2 = Math.sqrt(v2x*v2x + v2y*v2y);
    if (l1 > 0 && l2 > 0) {
      changes.push(Math.acos(Math.max(-1, Math.min(1, (v1x*v2x + v1y*v2y) / (l1*l2)))));
    }
  }
  return changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
}

// Score comes from featuresToScore({ smoothness, dtw_distance }) — the same
// weighting letter tracing uses, so word feedback is on the same 0-100 scale.
// The BOUNDARY is unchanged: the pill this replaced already drew its line at
// 50 — 'Excellent! ✓' and 'Good effort! ✓' both carried the tick, 'Keep going!'
// did not. Only the presentation moved to the avatar; nothing here decides a
// score, and nothing downstream reads a number.
function getFeedbackFromScore(score) {
  // A missing/failed score is not a pass. The old client-side estimate always
  // produced a number; the server's may not.
  return { passed: Number.isFinite(score) && score >= 50 };
}

// Slower than letter tracing's tracer (0.28 px/ms) — a whole word is a lot
// more path for a child to visually follow than one letter.
const TRACER_PX_PER_MS = 0.16;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function WordWritingScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  // Back returns to the interface this flow STARTED from, not one frame down.
  //
  // Every warm-up detour is entered with navigation.navigate('PreWritingActivity'
  // | 'HandwritingDemo') — a PUSH — and left with navigation.replace(nextRoute).
  // replace() swaps the top frame, so each detour permanently leaves the frame
  // it was pushed over behind it. After one category transition the stack reads
  // [WordLetterSelect, WordWriting, WordWriting], and goBack() landed on that stale
  // copy — a previous letter, mid-cycle, from before the detour. A second
  // detour left two.
  //
  // goBackToOrigin pops to the named route instead, so the depth of the stack
  // stops mattering. It falls back to goBack() when the origin is not below
  // this screen (an assessment or Writing-Check entry), which is the previous
  // behaviour and safe. Navigation only: nothing here writes an attempt,
  // consumes a cycle, or replays a warm-up.
  const backOrigin = route.params?.originRoute ?? 'WordLetterSelect';
  const { requestBack, gateModal } = useGatedBack(
    () => goBackToOrigin(navigation, backOrigin)
  );

  const { student, theme } = route.params;
  const { selectedLetter, selectedWords, currentWordIndex, currentWord: wordEntry } = resolveWordSession(route.params);

  // Proposal FR-13, Phase 7A / FR-16, Phase 7B — see LetterWritingScreen.js's
  // identical block. No collection_mode concept on this screen.
  const { notifyStrokeStart, notifyStrokeEnd, notifyLiveSessionUpdate } = useLearningSessionActivity({
    studentId: student.sid,
    activityType: LIVE_ACTIVITY_TYPES.WORD_WRITING,
  });

  const [attempt,       setAttempt]       = useState(1);
  const [currentPath,   setCurrentPath]   = useState([]);
  const [allPaths,      setAllPaths]      = useState([]);
  // Clear follows the CANVAS, not the session: it appears with the
  // child's first point and disappears again the moment the canvas is
  // empty. Deliberately not `hasDrawn`, which gates the guide and the
  // tracer and stays true after a clear.
  const canClearCanvas = hasCanvasDrawing({ allPaths, currentPath });
  const [hasDrawn,      setHasDrawn]      = useState(false);
  const [feedbackData,  setFeedbackData]  = useState(null);
  const feedbackTimerRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Word-writing child-feedback task — the backend's post-save size/spacing
  // advisory, shown as a brief, separate pill (see styles.layoutFeedbackPill)
  // so it survives resetCanvas()'s clearing of feedbackData (the LOCAL,
  // pre-save estimate) and is still visible for a moment after the screen
  // has already advanced to the next attempt — advancing never waits on it.
  const [childFeedbackText, setChildFeedbackText] = useState(null);
  const [showWordVideo, setShowWordVideo] = useState(() => {
    return !!(wordEntry && WORD_VIDEOS[wordEntry.word]);
  });
  const [reduceMotion,    setReduceMotion]    = useState(false);
  const [tracerVisible,   setTracerVisible]   = useState(false);
  const [tracerKeyframes, setTracerKeyframes] = useState(null);
  const tracerProgress = useRef(new Animated.Value(0)).current;
  // The guide stops at the child's FIRST TOUCH, not when the stroke ends.
  // `hasDrawn` only flips on release, so it is too late to be the stop signal
  // here; this ref lets the grant handler cancel the cycle immediately
  // without changing what `hasDrawn` means to support, audio or scoring.
  const stopGuideRef = useRef(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const src = WORD_VIDEOS[wordEntry?.word] ?? null;
    if (src) setShowWordVideo(true);
  }, [wordEntry?.word]);

  // ── One-time word-writing introduction (utils/demoPolicy.js) ─────────────
  // Shown the first time this child writes a word — ONCE, not per word.
  //
  // Deliberately suppressed when this word already has an intro video: that
  // video plays automatically on this same transition, and demo -> video ->
  // writing would be two tutorials stacked before one activity. The video is
  // the richer introduction of the two, so where one exists it satisfies the
  // introduction and the animated demo stands down. (The key is left unmarked
  // in that case, so a later word without a video still gets the demo.)
  const hasIntroVideo = !!(wordEntry && WORD_VIDEOS[wordEntry.word]);

  useDemoDetour({
    studentId: student?.sid,
    demoKey: DEMO_KEYS.WORD_WRITING_INTRO,
    enabled: !!wordEntry?.word && !hasIntroVideo && attempt === 1 && !hasDrawn,
    navigate: () => {
      navigation.navigate('HandwritingDemo', {
        student, theme,
        demoKey: DEMO_KEYS.WORD_WRITING_INTRO,
        // The whole word, animated letter by letter in writing order from
        // wordPaths.js's own composed guide — the exact strokes this screen
        // traces.
        word: wordEntry.word,
        nextRoute: 'WordWriting',
        nextParams: buildWordRouteParams({
          student, theme, selectedLetter, selectedWords, currentWordIndex,
        }),
      });
    },
  });

  const allPathsRef    = useRef([]);
  const startTimeRef   = useRef(null);
  // Border-touch bug fix — the canvas's own on-screen origin, measured once
  // on layout via View.measure(). Touch coordinates are derived from
  // this + nativeEvent.pageX/Y (screen-absolute, always one stable frame)
  // instead of nativeEvent.locationX/Y, which can silently re-base mid-drag
  // right at a view boundary like the canvas's border — see
  // touchPointSanitize.js for the full explanation.
  const canvasRef       = useRef(null);
  const canvasOriginRef = useRef({ x: 0, y: 0 });
  // ORIGIN — View.measure() reports this view's own pageX/pageY, the SAME
  // space nativeEvent.pageX/pageY uses. measureInWindow() reports WINDOW
  // space, which on Android excludes the system inset the touch includes;
  // mixing the two left a constant vertical offset on Y and none on X.
  const measureCanvasOrigin = useCallback(() => {
    canvasRef.current?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
        canvasOriginRef.current = { x: pageX, y: pageY };
      }
    });
  }, []);
  const spellCancelRef = useRef(false);
  const spellTimersRef = useRef([]);
  const submitActionIdRef = useRef(null);

  const imageScale   = useRef(new Animated.Value(0.85)).current;

  const word          = wordEntry?.word  ?? selectedLetter;
  const emoji         = wordEntry?.emoji ?? '📝';
  const imageKey      = wordEntry?.imageKey ?? '';
  const isLastAttempt = attempt === 3;
  const guideOpacity  = attempt === 3 ? 0 : attempt === 1 ? 0.15 : 0.28;
  const badge         = ATTEMPT_BADGE[attempt];
  const displayWord   = word.charAt(0).toUpperCase() + word.slice(1);
  const spelling      = getSpelling(word);

  // â”€â”€ Reference-path guide (same LETTER_PATHS-based system as letter tracing) â”€â”€
  // Proposal FR-16, Phase 7B — see LetterWritingScreen.js's identical block.
  // No case_type/support_level concept on this screen.
  useEffect(() => {
    notifyLiveSessionUpdate(buildProgressPatch({ currentItem: word, attemptNumber: attempt }));
  }, [word, attempt, notifyLiveSessionUpdate]);

  const wordGuide = useMemo(() => buildWordGuide(word), [word]);
  const guidePathD = useMemo(
    () => wordGuideToSvgPath(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );
  const guideDots = useMemo(
    () => wordGuideGhostDots(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );

  // Visible letter-size/spacing guide boxes — shown on ALL three attempts
  // (unlike the reference path/tracer, which fade out by Attempt 3), since
  // they're spatial-organization support, not letter-form/tracing support.
  // See wordPaths.js's buildWordLetterBoxes for what this reuses/why.
  const letterBoxes = useMemo(
    () => buildWordLetterBoxes(word, CANVAS_W, CANVAS_H),
    [word]
  );

  // Attempt-2 stroke-order marker — advances through the word's strokes as
  // each one is completed, exactly like letter tracing's activeGuideStroke.
  const activeGuideStroke = Math.min(allPaths.length, wordGuide.strokeDescriptors.length - 1);
  const activeStrokeDesc  = wordGuide.strokeDescriptors[activeGuideStroke] ?? null;
  const activeDirectionHint = useMemo(
    () => activeStrokeDesc
      ? getWordStrokeDirectionHint(activeStrokeDesc.points, CANVAS_W, CANVAS_H, activeStrokeDesc.angular)
      : null,
    [activeStrokeDesc]
  );

  const tracerXInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange:  tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.xRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  const tracerYInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange:  tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.yRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  // â”€â”€ Tracer dot animation for Attempt 1 ("Watch & Trace") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (reduceMotion || attempt !== 1 || hasDrawn || wordGuide.strokeDescriptors.length === 0) {
      setTracerVisible(false);
      return undefined;
    }

    const perStroke = buildWordTracerStrokes(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H);

    const inputRange = [];
    const xRange = [];
    const yRange = [];
    const strokeBounds = [];
    let offset = 0;
    for (const { points } of perStroke) {
      if (points.length === 0) continue;
      const start = offset;
      for (let k = 0; k < points.length; k++) {
        inputRange.push(offset + k);
        xRange.push(points[k].x);
        yRange.push(points[k].y);
      }
      offset += points.length;
      strokeBounds.push({ start, end: offset - 1 });
    }

    if (inputRange.length < 2) { setTracerVisible(false); return undefined; }

    setTracerKeyframes({ inputRange, xRange, yRange });
    tracerProgress.setValue(0);
    setTracerVisible(true);

    // Rebuilt fresh for every pass, so no animation object carries state
    // between passes. Stroke order is the canonical order, played forward,
    // every time: nothing here reverses waypoints, the path, or the bounds.
    const buildForwardSequence = () => {
      const strokeAnims = [];
      for (let s = 0; s < strokeBounds.length; s++) {
        if (s > 0) {
          strokeAnims.push(Animated.delay(320));
          strokeAnims.push(Animated.timing(tracerProgress, {
            toValue: strokeBounds[s].start, duration: 1, useNativeDriver: true,
          }));
        }
        const len = perStroke[s].totalLength;
        const dur = Math.max(400, Math.round(len / TRACER_PX_PER_MS));
        strokeAnims.push(Animated.timing(tracerProgress, {
          toValue: strokeBounds[s].end, duration: dur, useNativeDriver: true,
        }));
      }
      return Animated.sequence([Animated.delay(500), ...strokeAnims]);
    };

    // Forward-only: setValue(0) -> 0..1 -> idle pause -> setValue(0) -> 0..1.
    // The trailing Animated.delay(1200) that used to pad the loop is now the
    // controller's idle gap. See guideReplayCycle.js for why Animated.loop's
    // resetBeforeIteration never reached tracerProgress and played it backward.
    const cycle = startGuideReplayCycle({
      progress: tracerProgress,
      buildForwardSequence,
    });
    stopGuideRef.current = () => cycle.stop();

    return () => {
      setTracerVisible(false);
      cycle.stop();
      stopGuideRef.current = null;
    };
  }, [attempt, hasDrawn, wordGuide, reduceMotion, tracerProgress]);

  // â”€â”€ Speech â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // There is no mute list. This used to open with
  // `MUTED_WRITING_WORDS = new Set(['axe', 'album', 'arrow'])`, which skipped
  // those three words outright — a leftover allow/deny list, not a bug in how
  // the current word was resolved.
  const spellWord = useCallback((w = word) => {
    const spoken = spokenWord(w);
    if (!spoken) return;
    spellCancelRef.current = true;
    spellTimersRef.current.forEach(clearTimeout);
    spellTimersRef.current = [];
    Speech.stop();

    spellCancelRef.current = false;
    const letters = spoken.replace(/[^a-z]/gi, '').split('');
    let delay = 200;
    letters.forEach(ltr => {
      const t = setTimeout(() => {
        if (!spellCancelRef.current && spokenLetter(ltr))
          Speech.speak(spokenLetter(ltr), { rate: 0.8, language: SPEECH_LOCALE_EN });
      }, delay);
      spellTimersRef.current.push(t);
      delay += 750;
    });
    const ft = setTimeout(() => {
      if (!spellCancelRef.current)
        Speech.speak(spoken, { rate: 0.82, language: SPEECH_LOCALE_EN });
    }, delay + 350);
    spellTimersRef.current.push(ft);
  }, [word]);

  const spellWordRef = useRef(spellWord);
  spellWordRef.current = spellWord;

  // Bounce image in on each new word
  useEffect(() => {
    imageScale.setValue(0.85);
    Animated.spring(imageScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: false }).start();
  }, [word, imageScale]);

  // New word — no stale feedback/score state carries over (section 18: next
  // word must start with no previous feedback state, no previous score state).
  useEffect(() => {
    setChildFeedbackText(null);
  }, [word]);

  // Stop speech when leaving the screen
  useEffect(() => {
    return () => {
      spellCancelRef.current = true;
      spellTimersRef.current.forEach(clearTimeout);
      Speech.stop();
      // A screen torn down mid-feedback must not resolve into a transition.
      clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // There is deliberately no drawing-time verdict here.
  //
  // This used to be an effect on [hasDrawn]: the moment the child lifted their
  // finger from the FIRST stroke it scored the canvas locally and showed the
  // avatar — mid-attempt, from a client-side estimate, before anything was
  // submitted. Feedback now comes from the server's own score for the attempt
  // the child explicitly submitted; see handleNext.

  // â”€â”€ PanResponder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        stopGuideRef.current?.();  // first touch cancels the idle replay
        notifyStrokeStart(); // FR-13 — a stroke is now in progress; the break prompt must not appear
        startTimeRef.current = Date.now();
        const { x, y } = mapTouchToCanvas({
          pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY,
          origin: canvasOriginRef.current,
          logical: { width: CANVAS_W, height: CANVAS_H },
          inset: CANVAS_BORDER_WIDTH,
        });
        setCurrentPath([{ x, y, t: 0 }]);
        if (allPathsRef.current.length === 0) spellWordRef.current?.();
      },
      onPanResponderMove: (evt) => {
        const { x, y } = mapTouchToCanvas({
          pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY,
          origin: canvasOriginRef.current,
          logical: { width: CANVAS_W, height: CANVAS_H },
          inset: CANVAS_BORDER_WIDTH,
        });
        setCurrentPath(prev => {
          const last = prev[prev.length - 1];
          // Border-touch bug fix: a raw touch coordinate right at/near the
          // canvas edge can occasionally glitch to a far-away value for one
          // event — clamping (above) catches genuine overshoot, this catches
          // an implausible same-event jump so it's dropped instead of drawn
          // as a stray straight line (see touchPointSanitize.js).
          if (last && isImplausibleJump(last, { x, y }, CANVAS_W, CANVAS_H)) return prev;
          return [...prev, { x, y, t: Date.now() - startTimeRef.current }];
        });
      },
      onPanResponderRelease: () => {
        notifyStrokeEnd(); // FR-13 — stroke finished; the break prompt may now be shown if eligible
        setCurrentPath(prev => {
          if (prev.length > 2) {
            const updated = [...allPathsRef.current, prev];
            allPathsRef.current = updated;
            setAllPaths(updated);
            setHasDrawn(true);
          }
          return [];
        });
      },
      // Gesture-cancellation audit — if the OS/another responder interrupts
      // mid-stroke (e.g. an incoming call, a system gesture), finalize
      // whatever was drawn so far exactly like a normal release, instead of
      // silently dropping it or leaving a dangling currentPath. Identical
      // logic to onPanResponderRelease and to LetterWritingScreen's own
      // onPanResponderTerminate — same "usable stroke kept, too-short one
      // discarded" rule everywhere in the app.
      onPanResponderTerminate: () => {
        notifyStrokeEnd(); // FR-13 — same as release: an OS-interrupted gesture must not leave isWriting stuck true
        setCurrentPath(prev => {
          if (prev.length > 2) {
            const updated = [...allPathsRef.current, prev];
            allPathsRef.current = updated;
            setAllPaths(updated);
            setHasDrawn(true);
          }
          return [];
        });
      },
    })
  ).current;

  // â”€â”€ Canvas helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const resetCanvas = useCallback(() => {
    setAllPaths([]);
    allPathsRef.current = [];
    setCurrentPath([]);
    setHasDrawn(false);
    setFeedbackData(null);
    spellCancelRef.current = true;
    spellTimersRef.current.forEach(clearTimeout);
    Speech.stop();
  }, []);

  const handleNext = useCallback(async () => {
    if (submitting || !hasDrawn) return;
    setSubmitting(true); setSaveError(null);
    let saved;
    try {
      submitActionIdRef.current ||= newActionId();
      saved = await submitWordAttempt({student,actionId:submitActionIdRef.current,word,stage:'guided_word_writing',attempt_number:attempt,strokes:allPathsRef.current,canvas_width:CANVAS_W,canvas_height:CANVAS_H});
      submitActionIdRef.current = null;
    } catch { setSaveError('Could not save yet. Check the connection and try again.'); setSubmitting(false); return; }
    setSubmitting(false);

    // Proposal FR-16, Phase 7B — see LetterWritingScreen.js's identical
    // block. `saved.score` is the server's own authoritative score.
    if (typeof saved?.score === 'number') {
      notifyLiveSessionUpdate(buildScorePatch(saved.score));
    }

    // Child-feedback task — shown after the AUTHORITATIVE backend save, never
    // live while drawing, and never blocking progression: the attempt/word
    // transition below always proceeds once the save succeeds, regardless of
    // whether there's a layout advisory to show.
    // No timer of its own any more: the advisory IS the avatar's message, so
    // it appears and clears with the avatar, on one dwell.
    setChildFeedbackText(childFeedbackMessage(saved?.child_feedback));

    // The verdict, from the score the SERVER returned for this attempt. Shown
    // for the same dwell the letter screens use, then the existing transition
    // runs — one feedback event, one continuation.
    setFeedbackData(getFeedbackFromScore(saved?.score));
    await new Promise((resolve) => {
      feedbackTimerRef.current = setTimeout(resolve, ATTEMPT_FEEDBACK_MS);
    });
    setFeedbackData(null);
    setChildFeedbackText(null);

    const transition = afterGuidedAttempt(attempt);
    if (transition.type === 'attempt') {
      setAttempt(transition.attemptNumber);
      resetCanvas();
      return;
    }
    navigation.replace('WordPractice', buildWordRouteParams({
      student,
      theme,
      selectedLetter,
      selectedWords,
      currentWordIndex,
    }));
  }, [resetCanvas, submitting, hasDrawn, student, theme, selectedLetter, selectedWords, currentWordIndex, word, attempt, navigation]);

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* â”€â”€ Compact header â”€â”€ */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={requestBack}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={[styles.letterBadge, { backgroundColor: theme.button }]}>
              <Text style={[styles.letterBadgeText, { color: theme.buttonText }]}>
                {selectedLetter.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.counterText, { color: theme.headingText }]}>
              {currentWordIndex + 1} / {selectedWords.length}
            </Text>
          </View>

          <View style={styles.headerDots}>
            {[1, 2, 3].map(n => (
              <View
                key={n}
                style={[
                  styles.dot,
                  n < attempt  && { backgroundColor: theme.button, borderColor: theme.button },
                  n === attempt && { borderColor: theme.button },
                  n > attempt  && { borderColor: theme.button + '40' },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Main area: image LEFT | content RIGHT.
            Rendered by the SHARED WordWritingStage so the "watch first"
            demonstration and this practice screen are the same layout from
            the same file, never two copies that can drift apart. */}
        <WordWritingStage
          mode="practice"
          theme={theme}
          imageKey={imageKey}
          emoji={emoji}
          imageScale={imageScale}
          displayWord={displayWord}
          word={word}
          spelling={spelling}
          badge={badge}
          instruction={instructionForSupport(ATTEMPT_SUPPORT_LEVEL[attempt])}
          guideOpacity={guideOpacity}
          guidePathD={guidePathD}
          guideDots={guideDots}
          letterBoxes={letterBoxes}
          attempt={attempt}
          showStrokeOrder={attempt === 2}
          activeStrokeDesc={activeStrokeDesc}
          activeDirectionHint={activeDirectionHint}
          allPaths={allPaths}
          currentPath={currentPath}
          hasDrawn={hasDrawn}
          tracerVisible={tracerVisible}
          tracerXInterp={tracerXInterp}
          tracerYInterp={tracerYInterp}
          onSpeakWord={() => spellWordRef.current?.()}
          canvasRef={canvasRef}
          onCanvasLayout={measureCanvasOrigin}
          panHandlers={panResponder.panHandlers}
        />

        {/* The layout advisory used to live here, in its own pill under the
            canvas, and appeared at the same moment as the avatar — two
            feedbacks for one attempt. It now goes THROUGH the avatar as its
            message (see `note` below), so there is exactly one. */}

        {/* Same overlay the letter screens use — one feedback mechanism for
            the whole handwriting module, not a second one for words. The
            support level is the one this attempt actually presented, so the
            wording ("Great tracing" / "Nice guide work" / "You wrote it
            yourself") describes what the child just did. */}
        {feedbackData && (
          <AttemptAvatarFeedback
            avatarKey={student?.avatar_key}
            passed={feedbackData.passed}
            note={childFeedbackText}
            supportLevel={GUIDED_SUPPORT[attempt]}
            theme={theme}
          />
        )}

        {/* â”€â”€ Buttons â”€â”€ */}
        {saveError && <Text accessibilityRole="alert" style={{ color:'#B91C1C', fontWeight:'700', fontFamily: 'Nunito_700Bold', textAlign:'center' }}>{saveError}</Text>}
        <View style={styles.buttonsRow}>
          {canClearCanvas && (
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
              onPress={resetCanvas}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear the canvas"
            >
              <Text style={[styles.clearText, { color: theme.headingText }]}>Clear</Text>
            </TouchableOpacity>
          )}

          {hasDrawn && (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.button }]}
              onPress={handleNext}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Save this word attempt and continue"
              activeOpacity={0.85}
            >
              <Text style={[styles.nextText, { color: theme.buttonText }]}>
                {submitting ? 'Saving…' : isLastAttempt
                  ? 'Start Activities! 🎯'
                  : `Attempt ${attempt + 1} →`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* â”€â”€ Attempt dots â”€â”€ */}
        <View style={styles.bottomDots}>
          {[1, 2, 3].map(n => (
            <View
              key={n}
              style={[
                styles.dot,
                n < attempt  && { backgroundColor: theme.button, borderColor: theme.button },
                n === attempt && { borderColor: theme.button },
                n > attempt  && { borderColor: theme.button + '40' },
              ]}
            />
          ))}
        </View>

      </SafeAreaView>

      {/* â”€â”€ Celebration overlay â”€â”€ */}
      {/* â”€â”€ Word video modal â”€â”€ */}
      {showWordVideo && wordEntry && WORD_VIDEOS[wordEntry.word] && (
        <WordVideoModal
          videoSource={WORD_VIDEOS[wordEntry.word]}
          theme={theme}
          onDismiss={() => setShowWordVideo(false)}
        />
      )}

      <BreakPromptModal navigation={navigation} student={student} theme={theme} />


      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

// â”€â”€â”€ Word video modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WordVideoModal({ videoSource, theme, onDismiss }) {
  const player = useVideoPlayer(videoSource, p => { p.loop = false; p.play(); });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onDismiss);
    return () => sub.remove();
  }, [player]);

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={1}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close video"
      >
        <LinearGradient
          colors={theme.backgroundGradient}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <VideoView
            player={player}
            style={{ width: SCREEN_W, flex: 1 }}
            contentFit="contain"
            nativeControls={false}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Modal>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  letterBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterBadgeText: { fontSize: 14, fontWeight: '900', fontFamily: 'Nunito_900Black' },
  counterText:     { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  headerDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  // â”€â”€ Main two-column layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Left: large image, centered vertically
  // Right: stacked content
  // Word title card (rounded box with light theme tint)
  // Spelling  (a · p · p · l · e)
  // Attempt badge
  // Canvas
  // â”€â”€ Tracer dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // â”€â”€ Child layout-feedback pill â”€â”€ deliberately neutral/calm (not a
  // pass/fail colour, not red/green) — an advisory, not a verdict.

  // â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  buttonsRow: {
    // Reserved BEFORE anything is in it. Clear appears on the first drawn
    // point and Next when the finger lifts; without this the row grew twice
    // mid-stroke and `mainRow` (flex: 1, centred) re-centred the canvas
    // upward under the child's finger. See constants/writingActionRow.js.
    minHeight: actionRowMinHeight({
      // Clear is the taller child here too — 10px padding plus a 1.5px
      // border beats Next's borderless 11px.
      maxButtonPaddingVertical: 10, maxButtonBorderWidth: 1.5, rowPaddingVertical: 6,
    }),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAD,
    paddingVertical: 6,
  },
  clearBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 50,
  },
  clearText: { fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },
  nextBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nextText: { fontSize: 13, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },

  // â”€â”€ Attempt dots (bottom) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  bottomDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    backgroundColor: 'transparent',
  },

  // â”€â”€ Celebration overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  celebOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99,
  },
  celebGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  celebCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  celebEmoji:   { fontSize: 64, marginBottom: 16 },
  celebTitle:   { fontSize: 24, fontWeight: '900', fontFamily: 'Nunito_900Black', textAlign: 'center', marginBottom: 12 },
  celebMessage: { fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  celebStars:   { flexDirection: 'row', gap: 8, marginBottom: 24 },
  celebStar:    { fontSize: 28 },
  celebBtn:     { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 50, width: '100%', alignItems: 'center' },
  celebBtnText: { fontSize: 17, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF' },
});
