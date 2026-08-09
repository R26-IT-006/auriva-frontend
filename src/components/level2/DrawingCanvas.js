import { useEffect, useRef, useState } from 'react';
import { View, PanResponder, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Layout } from '../../constants/layout';

export const MAX_STROKES = 500;

const COLOURS = [
  '#000000', '#E53935', '#FB8C00', '#FDD835',
  '#43A047', '#1E88E5', '#8E24AA', '#6D4C41',
];

const BRUSH_SIZES = [
  { key: 'thin',   width: 4 },
  { key: 'medium', width: 10 },
  { key: 'thick',  width: 24 },
];

const ERASER_COLOR = '#FFFFFF';

function round1(n) {
  return Math.round(n * 10) / 10;
}

function pathFromPoints(points) {
  if (!points || points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/**
 * Maps a raw touch coordinate (in the canvas container's on-screen pixel
 * space) into the portrait's fixed logical coordinate space, so a stroke
 * looks identical regardless of which device/container size it's drawn or
 * re-edited on (Fix 1 — logical w/h are written once and never rescaled).
 */
export function mapTouchToLogical(touchX, touchY, layoutW, layoutH, logicalW, logicalH) {
  if (!layoutW || !layoutH || !logicalW || !logicalH) return { x: 0, y: 0 };
  return {
    x: round1((touchX / layoutW) * logicalW),
    y: round1((touchY / layoutH) * logicalH),
  };
}

/** Pure MAX_STROKES-enforcing append: beyond the cap, existing strokes are returned untouched. */
export function appendStroke(strokes, newStroke) {
  if (strokes.length >= MAX_STROKES) return strokes;
  return [...strokes, newStroke];
}

export default function DrawingCanvas({ initialStrokes, onChange, disabled }) {
  const [strokes, setStrokes] = useState(() => initialStrokes?.strokes ?? []);
  const [logicalSize, setLogicalSize] = useState(() => (
    initialStrokes?.w && initialStrokes?.h
      ? { w: initialStrokes.w, h: initialStrokes.h }
      : { w: 0, h: 0 }
  ));
  const [layoutSize, setLayoutSize]   = useState({ w: 0, h: 0 });
  const [color, setColor]             = useState(COLOURS[0]);
  const [brushWidth, setBrushWidth]   = useState(BRUSH_SIZES[1].width);
  const [eraser, setEraser]           = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [fullMessage, setFullMessage] = useState(false);

  const disabledRef    = useRef(disabled);    disabledRef.current    = disabled;
  const strokesRef      = useRef(strokes);     strokesRef.current      = strokes;
  const eraserRef        = useRef(eraser);      eraserRef.current       = eraser;
  const colorRef          = useRef(color);        colorRef.current        = color;
  const brushWidthRef      = useRef(brushWidth);   brushWidthRef.current    = brushWidth;
  const logicalSizeRef       = useRef(logicalSize); logicalSizeRef.current   = logicalSize;
  const layoutSizeRef          = useRef(layoutSize); layoutSizeRef.current    = layoutSize;
  const currentPointsRef = useRef([]);
  const emittedInitialRef = useRef(false);

  function emitChange(nextStrokes) {
    onChange?.({
      v: 1,
      w: logicalSizeRef.current.w,
      h: logicalSizeRef.current.h,
      strokes: nextStrokes,
    });
  }

  // Fix 1: as soon as the logical coordinate space is known (immediately for
  // an existing portrait, or after the first layout for a brand-new one),
  // report the current state once — so "Save" with no new drawing still
  // round-trips the loaded strokes byte-identically instead of sending null.
  useEffect(() => {
    if (logicalSize.w > 0 && logicalSize.h > 0 && !emittedInitialRef.current) {
      emittedInitialRef.current = true;
      emitChange(strokesRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logicalSize]);

  function showFullMessage() {
    setFullMessage(true);
    setTimeout(() => setFullMessage(false), 2500);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (evt) => {
        if (disabledRef.current) return;
        if (strokesRef.current.length >= MAX_STROKES) {
          showFullMessage();
          return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        const { w: lw, h: lh } = layoutSizeRef.current;
        const { w: gw, h: gh } = logicalSizeRef.current;
        if (!lw || !lh || !gw || !gh) return;
        const p = mapTouchToLogical(locationX, locationY, lw, lh, gw, gh);
        currentPointsRef.current = [p];
        setCurrentPoints(currentPointsRef.current);
      },
      onPanResponderMove: (evt) => {
        if (disabledRef.current || strokesRef.current.length >= MAX_STROKES) return;
        const { locationX, locationY } = evt.nativeEvent;
        const { w: lw, h: lh } = layoutSizeRef.current;
        const { w: gw, h: gh } = logicalSizeRef.current;
        if (!lw || !lh || !gw || !gh) return;
        const p = mapTouchToLogical(locationX, locationY, lw, lh, gw, gh);
        currentPointsRef.current = [...currentPointsRef.current, p];
        setCurrentPoints(currentPointsRef.current);
      },
      onPanResponderRelease: () => {
        if (disabledRef.current) return;
        const points = currentPointsRef.current;
        currentPointsRef.current = [];
        setCurrentPoints([]);
        if (points.length < 2 || strokesRef.current.length >= MAX_STROKES) return;

        const newStroke = {
          points,
          color: eraserRef.current ? ERASER_COLOR : colorRef.current,
          width: brushWidthRef.current,
        };
        const next = appendStroke(strokesRef.current, newStroke);
        setStrokes(next);
        emitChange(next);
      },
    })
  ).current;

  function handleUndo() {
    if (strokes.length === 0) return;
    const next = strokes.slice(0, -1);
    setStrokes(next);
    emitChange(next);
  }

  function handleClear() {
    Alert.alert('Start again?', 'This will clear the whole picture.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setStrokes([]);
          emitChange([]);
        },
      },
    ]);
  }

  function handleLayout(e) {
    const { width, height } = e.nativeEvent.layout;
    const lw = Math.round(width);
    const lh = Math.round(height);
    setLayoutSize({ w: lw, h: lh });

    // Fix 1: w/h are written ONCE, when a portrait is first created (a
    // brand-new canvas with no stored logical size yet) — from the layout
    // at that moment. An existing portrait's logical size (adopted from
    // initialStrokes at mount) is never touched here.
    if (logicalSizeRef.current.w === 0) {
      const fresh = { w: lw, h: lh };
      logicalSizeRef.current = fresh;
      setLogicalSize(fresh);
    }
  }

  return (
    <View style={styles.container}>
      <View
        style={styles.canvas}
        onLayout={handleLayout}
        {...(disabled ? {} : panResponder.panHandlers)}
      >
        {logicalSize.w > 0 && (
          <Svg width="100%" height="100%" viewBox={`0 0 ${logicalSize.w} ${logicalSize.h}`}>
            {strokes.map((s, i) => (
              <Path
                key={i}
                d={pathFromPoints(s.points)}
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {currentPoints.length > 0 && (
              <Path
                d={pathFromPoints(currentPoints)}
                stroke={eraser ? ERASER_COLOR : color}
                strokeWidth={brushWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </Svg>
        )}

        {fullMessage && (
          <View style={styles.fullBanner}>
            <Text style={styles.fullBannerText}>Your picture is full!</Text>
          </View>
        )}
      </View>

      <View style={styles.toolbar}>
        <View style={styles.swatchRow}>
          {COLOURS.map((c) => (
            <TouchableOpacity
              key={c}
              disabled={disabled}
              onPress={() => { setColor(c); setEraser(false); }}
              style={[
                styles.swatch,
                { backgroundColor: c },
                color === c && !eraser && styles.swatchSelected,
                eraser && styles.swatchDimmed,
              ]}
            />
          ))}
        </View>

        <View style={styles.sizeRow}>
          {BRUSH_SIZES.map((b) => (
            <TouchableOpacity
              key={b.key}
              disabled={disabled}
              onPress={() => setBrushWidth(b.width)}
              style={[styles.sizeBtn, brushWidth === b.width && styles.sizeBtnSelected]}
            >
              <View
                style={{
                  width: b.width,
                  height: b.width,
                  borderRadius: b.width / 2,
                  backgroundColor: eraser ? '#999' : color,
                }}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            disabled={disabled}
            onPress={() => setEraser((e) => !e)}
            style={[styles.actionBtn, eraser && styles.actionBtnActive]}
          >
            <Text style={[styles.actionBtnText, eraser && styles.actionBtnTextActive]}>Eraser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={disabled || strokes.length === 0}
            onPress={handleUndo}
            style={[styles.actionBtn, (disabled || strokes.length === 0) && styles.actionBtnDisabled]}
          >
            <Text style={styles.actionBtnText}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={disabled || strokes.length === 0}
            onPress={handleClear}
            style={[styles.actionBtn, (disabled || strokes.length === 0) && styles.actionBtnDisabled]}
          >
            <Text style={styles.actionBtnText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  canvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  fullBanner: {
    position: 'absolute',
    top: Layout.spacing.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.full,
  },
  fullBannerText: { color: '#FFF', fontSize: Layout.fontSize.sm, fontWeight: '700' },
  toolbar: { marginTop: Layout.spacing.sm, gap: Layout.spacing.sm },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.sm, justifyContent: 'center' },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: '#1A1A1A' },
  swatchDimmed: { opacity: 0.35 },
  sizeRow: { flexDirection: 'row', gap: Layout.spacing.md, justifyContent: 'center', alignItems: 'center' },
  sizeBtn: {
    width: 56,
    height: 56,
    borderRadius: Layout.radius.md,
    borderWidth: 2,
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  sizeBtnSelected: { borderColor: '#1A1A1A' },
  actionRow: { flexDirection: 'row', gap: Layout.spacing.sm, justifyContent: 'center' },
  actionBtn: {
    minWidth: 56,
    height: 56,
    paddingHorizontal: Layout.spacing.md,
    borderRadius: Layout.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#DDD',
  },
  actionBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: Layout.fontSize.sm, fontWeight: '700', color: '#1A1A1A' },
  actionBtnTextActive: { color: '#FFFFFF' },
});
