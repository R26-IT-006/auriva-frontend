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
import { afterGuidedAttempt, buildWordRouteParams, resolveWordSession } from '../../../utils/wordWorkflow';
import { childFeedbackMessage } from '../../../utils/wordFeedback';
import { clampToCanvas, isImplausibleJump, pageToLocal } from '../../../utils/touchPointSanitize';
import { useLearningSessionActivity } from '../../../context/LearningSessionContext';
import { LIVE_ACTIVITY_TYPES } from '../../../constants/liveSessionPolicy';
import { buildProgressPatch, buildScorePatch } from '../../../utils/liveSessionSnapshot';
import BreakPromptModal from '../../../components/handwriting/BreakPromptModal';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 16;

// Two-column split — all sizes relative to screen, zero hardcoded pixels.
// Image column is deliberately narrow (vs. the 0.43 letter-tracing screens
// use for one big letter) so the canvas gets most of the width — a whole
// word needs far more horizontal room than a single letter does.
const COL_L    = Math.round(SCREEN_W * 0.28);           // left column (image)
const IMG_SIZE = COL_L - 8;                              // image fills the column
const CANVAS_W = SCREEN_W - COL_L - PAD * 2;            // canvas = right column width
const CANVAS_H = Math.round(SCREEN_H * 0.46);           // 46 % of screen height

// 4-line handwriting ruling — baseline/descender match the LETTER_PATHS
// fy=0.64/0.92 convention so the word guide sits exactly on these lines.
const LINE_1 = Math.round(CANVAS_H * 0.08);  // cap line     — blue solid
const LINE_2 = Math.round(CANVAS_H * 0.36);  // x-height     — blue solid
const LINE_3 = Math.round(CANVAS_H * 0.64);  // baseline     — red dashed
const LINE_4 = Math.round(CANVAS_H * 0.92);  // descender    — blue solid

// â”€â”€â”€ Attempt colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ATTEMPT_BADGE = {
  1: { bg: '#FFCBA8', border: '#FF8C42', text: '#7A2D00' },
  2: { bg: '#FFE97A', border: '#F0C000', text: '#5A4000' },
  3: { bg: '#A8E6A8', border: '#4CAF50', text: '#1B5E20' },
};

const ATTEMPT_TITLES = {
  1: 'Attempt 1 · Watch & Trace',
  2: 'Attempt 2 · Follow the Guide',
  3: 'Attempt 3 · Write Freely',
};

const ATTEMPT_HINTS = {
  1: 'Listen to the letters — then trace the word!',
  2: 'Trace the word — ① marks where to start.',
  3: 'Write the word from memory — no guide this time!',
};

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
function getFeedbackFromScore(score) {
  if (score >= 75) return { label: 'Excellent! ✓',   color: '#2E7D32', bg: '#E8F5E9' };
  if (score >= 50) return { label: 'Good effort! ✓', color: '#E65100', bg: '#FFF3E0' };
  return                   { label: 'Keep going!',    color: '#C62828', bg: '#FFEBEE' };
}

// Slower than letter tracing's tracer (0.28 px/ms) — a whole word is a lot
// more path for a child to visually follow than one letter.
const TRACER_PX_PER_MS = 0.16;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function WordWritingScreen({ route, navigation }) {
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
  const [hasDrawn,      setHasDrawn]      = useState(false);
  const [feedbackData,  setFeedbackData]  = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Word-writing child-feedback task — the backend's post-save size/spacing
  // advisory, shown as a brief, separate pill (see styles.layoutFeedbackPill)
  // so it survives resetCanvas()'s clearing of feedbackData (the LOCAL,
  // pre-save estimate) and is still visible for a moment after the screen
  // has already advanced to the next attempt — advancing never waits on it.
  const [childFeedbackText, setChildFeedbackText] = useState(null);
  const childFeedbackTimerRef = useRef(null);
  const [showWordVideo, setShowWordVideo] = useState(() => {
    return !!(wordEntry && WORD_VIDEOS[wordEntry.word]);
  });
  const [reduceMotion,    setReduceMotion]    = useState(false);
  const [tracerVisible,   setTracerVisible]   = useState(false);
  const [tracerKeyframes, setTracerKeyframes] = useState(null);
  const tracerProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const src = WORD_VIDEOS[wordEntry?.word] ?? null;
    if (src) setShowWordVideo(true);
  }, [wordEntry?.word]);

  const allPathsRef    = useRef([]);
  const startTimeRef   = useRef(null);
  // Border-touch bug fix — the canvas's own on-screen origin, measured once
  // on layout via measureInWindow(). Touch coordinates are derived from
  // this + nativeEvent.pageX/Y (screen-absolute, always one stable frame)
  // instead of nativeEvent.locationX/Y, which can silently re-base mid-drag
  // right at a view boundary like the canvas's border — see
  // touchPointSanitize.js for the full explanation.
  const canvasRef       = useRef(null);
  const canvasOriginRef = useRef({ x: 0, y: 0 });
  const measureCanvasOrigin = useCallback(() => {
    canvasRef.current?.measureInWindow((x, y) => { canvasOriginRef.current = { x, y }; });
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

    const anim = Animated.loop(
      Animated.sequence([Animated.delay(500), ...strokeAnims, Animated.delay(1200)]),
      { resetBeforeIteration: true }
    );
    anim.start();

    return () => {
      setTracerVisible(false);
      anim.stop();
    };
  }, [attempt, hasDrawn, wordGuide, reduceMotion, tracerProgress]);

  // â”€â”€ Speech â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const MUTED_WRITING_WORDS = new Set(['axe', 'album', 'arrow']);

  const spellWord = useCallback((w = word) => {
    if (MUTED_WRITING_WORDS.has(w)) return;
    spellCancelRef.current = true;
    spellTimersRef.current.forEach(clearTimeout);
    spellTimersRef.current = [];
    Speech.stop();

    spellCancelRef.current = false;
    const letters = w.replace(/[^a-z]/gi, '').split('');
    let delay = 200;
    letters.forEach(ltr => {
      const t = setTimeout(() => {
        if (!spellCancelRef.current)
          Speech.speak(ltr.toUpperCase(), { rate: 0.8, language: 'en-US' });
      }, delay);
      spellTimersRef.current.push(t);
      delay += 750;
    });
    const ft = setTimeout(() => {
      if (!spellCancelRef.current)
        Speech.speak(w.replace(/-/g, ' '), { rate: 0.82, language: 'en-US' });
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
    clearTimeout(childFeedbackTimerRef.current);
    setChildFeedbackText(null);
  }, [word]);

  // Stop speech when leaving the screen
  useEffect(() => {
    return () => {
      spellCancelRef.current = true;
      spellTimersRef.current.forEach(clearTimeout);
      Speech.stop();
      clearTimeout(childFeedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (hasDrawn && allPathsRef.current.length > 0) {
      const smoothness   = calculateSmoothness(allPathsRef.current);
      const dtw_distance = computeWordDTW(wordGuide.rawPath, allPathsRef.current, CANVAS_W, CANVAS_H);
      const score = featuresToScore({ smoothness, dtw_distance });
      setFeedbackData(getFeedbackFromScore(score));
    }
  }, [hasDrawn, wordGuide]);

  // â”€â”€ PanResponder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        notifyStrokeStart(); // FR-13 — a stroke is now in progress; the break prompt must not appear
        startTimeRef.current = Date.now();
        const local = pageToLocal(evt.nativeEvent.pageX, evt.nativeEvent.pageY, canvasOriginRef.current);
        const { x, y } = clampToCanvas(local.x, local.y, CANVAS_W, CANVAS_H);
        setCurrentPath([{ x, y, t: 0 }]);
        if (allPathsRef.current.length === 0) spellWordRef.current?.();
      },
      onPanResponderMove: (evt) => {
        const local = pageToLocal(evt.nativeEvent.pageX, evt.nativeEvent.pageY, canvasOriginRef.current);
        const { x, y } = clampToCanvas(local.x, local.y, CANVAS_W, CANVAS_H);
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
    const message = childFeedbackMessage(saved?.child_feedback);
    clearTimeout(childFeedbackTimerRef.current);
    setChildFeedbackText(message);
    if (message) {
      childFeedbackTimerRef.current = setTimeout(() => setChildFeedbackText(null), 3200);
    }

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
            onPress={() => navigation.goBack()}
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

        {/* â”€â”€ Main area: image LEFT · content RIGHT â”€â”€ */}
        <View style={styles.mainRow}>

          {/* Left column — large image */}
          <View style={styles.imageCol}>
            <Animated.View style={{ transform: [{ scale: imageScale }] }}>
              <WordImageDisplay imageKey={imageKey} emoji={emoji} size={IMG_SIZE} />
            </Animated.View>
          </View>

          {/* Right column — word card + spelling + badge + canvas */}
          <View style={styles.contentCol}>

            {/* Word title card */}
            <View style={[styles.wordCard, {
              backgroundColor: theme.button + '14',
              borderColor:     theme.button + '35',
            }]}>
              <Text
                style={[styles.wordTitle, { color: theme.headingText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {displayWord}
              </Text>
              <TouchableOpacity
                style={[styles.soundBtn, { backgroundColor: theme.button }]}
                onPress={() => spellWordRef.current?.()}
                activeOpacity={0.75}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Replay pronunciation of ${word}`}
              >
                <Ionicons name="volume-high" size={18} color={theme.buttonText} />
              </TouchableOpacity>
            </View>

            {/* Spelling */}
            <Text style={[styles.spellingText, { color: theme.headingText }]}>
              {spelling}
            </Text>

            {/* Attempt badge */}
            <View style={[styles.attemptBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[styles.attemptTitle, { color: badge.text }]}>
                {ATTEMPT_TITLES[attempt]}
              </Text>
              <Text style={[styles.attemptHint, { color: badge.text }]}>
                {ATTEMPT_HINTS[attempt]}
              </Text>
            </View>

            {/* Writing canvas — canvasOuter wraps the card so the tracer dot
                is never clipped by the card's overflow:hidden */}
            <View style={styles.canvasOuter}>
              <View
                style={[styles.canvasCard, { borderColor: theme.cardOutline ?? '#D0D0D0' }]}
                ref={canvasRef}
                onLayout={measureCanvasOrigin}
                {...panResponder.panHandlers}
                accessible
                accessibilityLabel="Word handwriting practice area"
              >
                <Svg width={CANVAS_W} height={CANVAS_H}>

                  {/* 4-line ruling */}
                  <Line x1={0} y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#90CAF9" strokeWidth={1.5} />
                  <Line x1={0} y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#90CAF9" strokeWidth={1} />
                  <Line x1={0} y1={LINE_3} x2={CANVAS_W} y2={LINE_3} stroke="#EF9A9A" strokeWidth={1.5} strokeDasharray="10,6" />
                  <Line x1={0} y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#90CAF9" strokeWidth={1.5} />

                  {/* Visible letter-size/spacing guide boxes — instructional
                      only, shown on every attempt. Thin, low-prominence
                      border; no fill; rendered below the guide path/tracer/
                      ink so handwriting always stays clearly on top. Purely
                      decorative — writing outside a box never clips strokes
                      or affects scoring (see wordPaths.js). */}
                  {letterBoxes.map(box => (
                    <Rect
                      key={`letter-box-${box.index}`}
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      rx={4}
                      fill="rgba(120,120,140,0.05)"
                      stroke="rgba(120,120,140,0.45)"
                      strokeWidth={1}
                    />
                  ))}

                  {/* Reference-path guide — built from the same per-letter
                      LETTER_PATHS waypoints letter tracing uses, laid out
                      left-to-right across the word. Ghost dots mark single-
                      point strokes (the 'i' / 'j' dots). */}
                  {guideOpacity > 0 && guidePathD && (
                    <>
                      <Path
                        d={guidePathD}
                        stroke={`rgba(80,80,80,${guideOpacity})`}
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      {guideDots.map((dot, idx) => (
                        <Circle
                          key={`ghost-dot-${idx}`}
                          cx={dot.cx}
                          cy={dot.cy}
                          r={3.5}
                          fill={`rgba(80,80,80,${guideOpacity})`}
                        />
                      ))}
                    </>
                  )}

                  {/* Stroke-order marker (attempt 2) — same system as letter
                      tracing: numbered start dot + direction arrow(s) for
                      the current stroke, advancing letter by letter as each
                      stroke is completed. Number resets per letter (1, 2, 3…),
                      matching what single-letter tracing shows. */}
                  {attempt === 2 && activeStrokeDesc && activeDirectionHint && (
                    <>
                      <Circle
                        cx={activeDirectionHint.start.x}
                        cy={activeDirectionHint.start.y}
                        r={11}
                        fill="none"
                        stroke={theme.button}
                        strokeWidth={2}
                        opacity={0.72}
                      />
                      <Circle
                        cx={activeDirectionHint.start.x}
                        cy={activeDirectionHint.start.y}
                        r={8}
                        fill={theme.button}
                        opacity={0.80}
                      />
                      <SvgText
                        x={activeDirectionHint.start.x}
                        y={activeDirectionHint.start.y + 4}
                        fontSize={11}
                        fill={theme.buttonText ?? '#FFFFFF'}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {activeStrokeDesc.localStrokeIndex + 1}
                      </SvgText>
                      {activeDirectionHint.endGuides.map((guide, index) => (
                        <Circle
                          key={`stroke-end-${index}`}
                          cx={guide.x}
                          cy={guide.y}
                          r={index === activeDirectionHint.endGuides.length - 1 ? 6 : 4.5}
                          fill="none"
                          stroke={theme.button}
                          strokeWidth={2}
                          opacity={0.72}
                        />
                      ))}
                      {activeDirectionHint.arrows.map((arrow, index) => (
                        <React.Fragment key={`stroke-arrow-${index}`}>
                          <Line
                            x1={arrow.shaftStart.x}
                            y1={arrow.shaftStart.y}
                            x2={arrow.tip.x}
                            y2={arrow.tip.y}
                            stroke={theme.button}
                            strokeWidth={3.5}
                            strokeLinecap="round"
                          />
                          <Polygon points={arrow.arrowHead} fill={theme.button} />
                        </React.Fragment>
                      ))}
                    </>
                  )}

                  {/* Completed strokes */}
                  {allPaths.map((stroke, i) => (
                    <Polyline
                      key={i}
                      points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
                      stroke={theme.button}
                      strokeWidth={4.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}

                  {/* Live stroke */}
                  {currentPath.length > 1 && (
                    <Polyline
                      points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                      stroke={theme.button}
                      strokeWidth={4.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity={0.75}
                    />
                  )}

                </Svg>
              </View>

              {/* Tracer dot — traces the whole word guide during Attempt 1 */}
              {attempt === 1 && !hasDrawn && tracerVisible && tracerXInterp && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Animated.View
                    style={[
                      styles.tracerDot,
                      {
                        backgroundColor: theme.button,
                        transform: [
                          { translateX: tracerXInterp },
                          { translateY: tracerYInterp },
                        ],
                      },
                    ]}
                  />
                </View>
              )}
            </View>

          </View>
        </View>

        {/* â”€â”€ Feedback pill â”€â”€ */}
        {feedbackData && (
          <View style={[styles.feedbackPill, { backgroundColor: feedbackData.bg }]}>
            <Text style={[styles.feedbackText, { color: feedbackData.color }]}>
              {feedbackData.label}
            </Text>
          </View>
        )}

        {/* â”€â”€ Child layout-feedback pill â”€â”€ shown only after an authoritative
            backend save that returned a size/spacing advisory; auto-dismisses
            and never blocks/represents pass-fail (see handleNext). */}
        {childFeedbackText && (
          <View style={styles.layoutFeedbackPill} accessibilityRole="text">
            <Text style={styles.layoutFeedbackText}>{childFeedbackText}</Text>
          </View>
        )}

        {/* â”€â”€ Buttons â”€â”€ */}
        {saveError && <Text accessibilityRole="alert" style={{ color:'#B91C1C', fontWeight:'700', textAlign:'center' }}>{saveError}</Text>}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
            onPress={resetCanvas}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Clear the canvas"
          >
            <Text style={[styles.clearText, { color: theme.headingText }]}>Clear</Text>
          </TouchableOpacity>

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
  letterBadgeText: { fontSize: 14, fontWeight: '900' },
  counterText:     { fontSize: 13, fontWeight: '700' },
  headerDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  // â”€â”€ Main two-column layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mainRow: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: PAD,
    paddingBottom: 4,
  },

  // Left: large image, centered vertically
  imageCol: {
    width: COL_L,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },

  // Right: stacked content
  contentCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },

  // Word title card (rounded box with light theme tint)
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  wordTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  soundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },

  // Spelling  (a · p · p · l · e)
  spellingText: {
    fontSize: 12,
    fontStyle: 'italic',
    letterSpacing: 1.5,
    opacity: 0.65,
    paddingLeft: 2,
  },

  // Attempt badge
  attemptBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  attemptTitle: { fontSize: 12, fontWeight: '800' },
  attemptHint:  { fontSize: 10, marginTop: 2, textAlign: 'center', opacity: 0.85 },

  // Canvas
  canvasOuter: {
    width:  CANVAS_W,
    height: CANVAS_H,
  },
  canvasCard: {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  // â”€â”€ Tracer dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  tracerDot: {
    position: 'absolute',
    left: -13,
    top: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
  },

  // â”€â”€ Feedback pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  feedbackPill: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 50,
    marginBottom: 4,
  },
  feedbackText: { fontSize: 13, fontWeight: '700' },

  // â”€â”€ Child layout-feedback pill â”€â”€ deliberately neutral/calm (not a
  // pass/fail colour, not red/green) — an advisory, not a verdict.
  layoutFeedbackPill: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 50,
    marginBottom: 4,
    backgroundColor: '#F1EFFA',
  },
  layoutFeedbackText: { fontSize: 12, fontWeight: '600', color: '#5B5470', textAlign: 'center' },

  // â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  buttonsRow: {
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
  clearText: { fontSize: 13, fontWeight: '600' },
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
  nextText: { fontSize: 13, fontWeight: '800' },

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
  celebTitle:   { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  celebMessage: { fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  celebStars:   { flexDirection: 'row', gap: 8, marginBottom: 24 },
  celebStar:    { fontSize: 28 },
  celebBtn:     { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 50, width: '100%', alignItems: 'center' },
  celebBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
});
