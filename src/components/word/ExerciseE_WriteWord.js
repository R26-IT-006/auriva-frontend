import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Line, Circle, Polyline, Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import WordImageDisplay from './WordImageDisplay';
import { buildWordGuide, wordGuideToSvgPath, wordGuideGhostDots, buildWordLetterBoxes } from '../../constants/wordPaths';
import { evaluateWordAttempt } from '../../utils/wordScoring';
import { submitWordAttempt, newActionId } from '../../utils/wordApi';
import { childFeedbackMessage } from '../../utils/wordFeedback';
import { computeExerciseECanvasSize } from '../../utils/wordExerciseECanvas';
import { clampToCanvas, isImplausibleJump, pageToLocal } from '../../utils/touchPointSanitize';
// Proposal FR-13, Phase 7A — the base (non-registering) hook: the parent
// WordActivityScreen already registers/unregisters this whole A-E flow as
// one active learning screen; this component only needs the stroke
// notifiers so the break prompt never interrupts a stroke drawn here.
import { useLearningSession } from '../../context/LearningSessionContext';

// Responsive canvas (final-completion-pass fix) — was a fixed ~490×220,
// which could clip on a small phone or leave excessive empty width on a
// tablet. The actual sizing math lives in wordExerciseECanvas.js (a pure,
// unit-tested helper — see wordExerciseECanvas.test.js) so it stays covered
// without needing a React Native rendering harness. This SAME CANVAS_W/
// CANVAS_H feeds the guide path, the guide boxes, the PanResponder's touch
// coordinates (locationX/Y are already canvas-relative), and the submitted
// payload below — one transform, one coordinate system, matching
// WordWritingScreen's own module-level sizing.
const { width: SCREEN_W } = Dimensions.get('window');
const { width: CANVAS_W, height: CANVAS_H } = computeExerciseECanvasSize(SCREEN_W);
const LINE_1 = Math.round(CANVAS_H * 0.10);
const LINE_2 = Math.round(CANVAS_H * 0.37);
// Baseline/descender match the LETTER_PATHS fy=0.64/0.92 convention so the
// reference-path guide sits exactly on these ruling lines (see WordWritingScreen).
const LINE_3 = Math.round(CANVAS_H * 0.64);
const LINE_4 = Math.round(CANVAS_H * 0.92);

export default function ExerciseE_WriteWord({ wordEntry, theme, student, onComplete }) {
  const { word, emoji, imageKey } = wordEntry;
  const { notifyStrokeStart, notifyStrokeEnd } = useLearningSession();
  const [currentPath, setCurrentPath] = useState([]);
  const [allPaths, setAllPaths] = useState([]);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const actionIdRef = useRef(null);
  const startTimeRef = useRef(null);
  // Border-touch bug fix — see touchPointSanitize.js / WordWritingScreen.js.
  const canvasRef       = useRef(null);
  const canvasOriginRef = useRef({ x: 0, y: 0 });
  const measureCanvasOrigin = useCallback(() => {
    canvasRef.current?.measureInWindow((x, y) => { canvasOriginRef.current = { x, y }; });
  }, []);

  const hasDrawn = allPaths.length > 0;

  const wordGuide  = useMemo(() => buildWordGuide(word), [word]);
  const guidePathD = useMemo(
    () => wordGuideToSvgPath(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );
  const guideDots = useMemo(
    () => wordGuideGhostDots(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );

  // Visible letter-size/spacing guide boxes — same instructional support as
  // WordWritingScreen's guided attempts, reinforcing size/spacing without
  // handing the child a full traced-letter answer (see wordPaths.js).
  const letterBoxes = useMemo(
    () => buildWordLetterBoxes(word, CANVAS_W, CANVAS_H),
    [word]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !done,
      onMoveShouldSetPanResponder: () => !done,
      onPanResponderGrant: (evt) => {
        notifyStrokeStart(); // FR-13 — a stroke is now in progress; the break prompt must not appear
        startTimeRef.current = Date.now();
        const local = pageToLocal(evt.nativeEvent.pageX, evt.nativeEvent.pageY, canvasOriginRef.current);
        const { x, y } = clampToCanvas(local.x, local.y, CANVAS_W, CANVAS_H);
        setCurrentPath([{ x, y, t: 0 }]);
      },
      onPanResponderMove: (evt) => {
        const local = pageToLocal(evt.nativeEvent.pageX, evt.nativeEvent.pageY, canvasOriginRef.current);
        const { x, y } = clampToCanvas(local.x, local.y, CANVAS_W, CANVAS_H);
        setCurrentPath(prev => {
          const last = prev[prev.length - 1];
          // Border-touch bug fix — see touchPointSanitize.js.
          if (last && isImplausibleJump(last, { x, y }, CANVAS_W, CANVAS_H)) return prev;
          return [...prev, { x, y, t: Date.now() - startTimeRef.current }];
        });
      },
      onPanResponderRelease: () => {
        notifyStrokeEnd(); // FR-13 — stroke finished; the break prompt may now be shown if eligible
        setCurrentPath(prev => {
          if (prev.length > 2) {
            setAllPaths(paths => [...paths, prev]);
          }
          return [];
        });
      },
      // Gesture-cancellation audit — finalize an interrupted stroke exactly
      // like a normal release (same "keep if usable, discard if too short"
      // rule as onPanResponderRelease / WordWritingScreen / LetterWritingScreen)
      // instead of leaving a dangling currentPath.
      onPanResponderTerminate: () => {
        notifyStrokeEnd(); // FR-13 — same as release: an OS-interrupted gesture must not leave isWriting stuck true
        setCurrentPath(prev => {
          if (prev.length > 2) {
            setAllPaths(paths => [...paths, prev]);
          }
          return [];
        });
      },
    })
  ).current;

  function handleClear() {
    if (done) return;
    setCurrentPath([]);
    setAllPaths([]);
    setResult(null);
  }

  async function handleDone() {
    if (!hasDrawn || done || submitting) return;
    setSubmitting(true); setSaveError(null);
    actionIdRef.current ||= newActionId();
    try {
      const authoritative = await submitWordAttempt({student,actionId:actionIdRef.current,word,stage:'practice_exercise_e',strokes:allPaths,canvas_width:CANVAS_W,canvas_height:CANVAS_H});
      // childFeedback/layoutMessage are advisory only — see wordFeedback.js
      // and section 5 of the completion-pass task: never read anywhere that
      // decides authoritative.passed above.
      const nextResult={score:authoritative.score,passed:authoritative.passed,completed:authoritative.completion_passed,layoutMessage:childFeedbackMessage(authoritative.child_feedback)};setResult(nextResult);
      if (!authoritative.passed) { actionIdRef.current=null; return; }
      setDone(true); setTimeout(() => onComplete(true), 500);
    } catch { setSaveError('Could not save yet. Check the connection and try again.'); }
    finally { setSubmitting(false); }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.leftCol}>
        <View style={[styles.imageBg, { backgroundColor: theme.button + '10', borderColor: theme.button + '26' }]}>
          <WordImageDisplay imageKey={imageKey} emoji={emoji} size={130} />
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          Write the word
        </Text>

        <View
          style={[styles.canvasCard, { borderColor: theme.button + '32' }]}
          ref={canvasRef}
          onLayout={measureCanvasOrigin}
          {...panResponder.panHandlers}
          accessible
          accessibilityLabel="Word handwriting practice area"
        >
          <Svg width={CANVAS_W} height={CANVAS_H}>
            <Line x1="0" y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#9BC4E8" strokeWidth="1.5" />
            <Line x1="0" y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#9BC4E8" strokeWidth="1.5" />
            <Line
              x1="0"
              y1={LINE_3}
              x2={CANVAS_W}
              y2={LINE_3}
              stroke="#D88989"
              strokeWidth="1.5"
              strokeDasharray="8,7"
            />
            <Line x1="0" y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#9BC4E8" strokeWidth="1.5" />

            {/* Visible letter-size/spacing guide boxes — spatial guidance
                only (no traced-letter answer). Below all ink/guide layers. */}
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

            {/* Reference-path guide — same LETTER_PATHS-based system as
                letter tracing, instead of a flat ghost-text outline. */}
            {guidePathD && (
              <>
                <Path
                  d={guidePathD}
                  stroke={`${theme.button}24`}
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
                    fill={`${theme.button}24`}
                  />
                ))}
              </>
            )}

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

        <View style={styles.actions}>
          {result && !result.passed && (
            <Text accessibilityRole="alert" style={styles.retryText}>
              {result.completed ? `Score ${result.score}/100 — try once more` : 'Finish every letter, then try Done again'}
              {/* Layout advisory shown alongside retry feedback (section 4)
                  only when the word was actually complete — an incomplete
                  word has no meaningful size/spacing metrics to advise on. */}
              {result.completed && result.layoutMessage ? `\n${result.layoutMessage}` : ''}
            </Text>
          )}
          {/* Passed + a layout advisory — optional, brief, neutral; never a
              pass criterion (the checkmark/onComplete above already fired). */}
          {result && result.passed && result.layoutMessage && (
            <Text style={styles.layoutHintText}>{result.layoutMessage}</Text>
          )}
          {saveError && <Text accessibilityRole="alert" style={styles.retryText}>{saveError}</Text>}
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
            onPress={handleClear}
            activeOpacity={0.72}
            disabled={done}
            accessibilityRole="button"
            accessibilityLabel="Clear the canvas"
          >
            <Ionicons name="refresh" size={16} color={theme.headingText} />
            <Text style={[styles.clearText, { color: theme.headingText }]}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.doneBtn,
              { backgroundColor: hasDrawn ? theme.button : '#D6DAE3' },
            ]}
            onPress={handleDone}
            activeOpacity={0.82}
            disabled={!hasDrawn || done || submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit this word attempt"
          >
            <Text style={[styles.doneText, { color: hasDrawn ? theme.buttonText : '#7B8190' }]}>
              {submitting ? 'Saving…' : 'Done'}
            </Text>
            {done && <Ionicons name="checkmark-circle" size={18} color={theme.buttonText} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
    width: '100%',
  },
  leftCol: {
    width: 170,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imageBg: {
    width: 150,
    height: 150,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  instruction: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  canvasCard: {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '800',
  },
  retryText: { color: '#B91C1C', fontSize: 13, fontWeight: '700', maxWidth: 210, textAlign: 'center' },
  // Neutral (not red/error-styled) — an advisory, not a failure message.
  layoutHintText: { color: '#5B5470', fontSize: 12, fontWeight: '600', maxWidth: 220, textAlign: 'center' },
});
