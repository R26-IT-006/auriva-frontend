import { useEffect, useRef, useState } from 'react';
import { View, PanResponder, TouchableOpacity, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Layout } from '../../constants/layout';

export const MAX_STROKES = 500;

const COLOURS = [
  '#000000', '#E53935', '#FB8C00', '#FDD835',
  '#43A047', '#1E88E5', '#8E24AA', '#6D4C41',
  '#9E9E9E', '#EC407A', '#FFAB91', '#F5CBA7',
  '#AED581', '#4DD0E1', '#90CAF9', '#CE93D8',
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

// toolbarFooter: optional element pinned to the bottom of the side tool panel
// (L2PortraitScreen puts its Save button there).
export default function DrawingCanvas({ initialStrokes, onChange, disabled, toolbarFooter = null }) {
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
  const [confirmClear, setConfirmClear] = useState(false);

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

  // Asks first in an in-app pop-up (styled like the rest of the app) rather
  // than the plain system alert.
  function handleClear() {
    setConfirmClear(true);
  }

  function confirmClearAll() {
    setConfirmClear(false);
    setStrokes([]);
    emitChange([]);
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

      {/* Tool panel at the side, so the canvas gets the full height. */}
      <View style={styles.toolbar}>
        <Text style={styles.toolLabel}>Colours</Text>
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

        <Text style={styles.toolLabel}>Brush</Text>
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

        {toolbarFooter ? (
          <>
            <View style={{ flex: 1 }} />
            {toolbarFooter}
          </>
        ) : null}
      </View>

      {/* "Start again?" confirmation */}
      <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.confirmTitle}>Start again?</Text>
            <Text style={styles.confirmText}>This will clear the whole picture.</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmCancel]} onPress={() => setConfirmClear(false)} activeOpacity={0.8}>
                <Text style={[styles.confirmBtnText, { color: '#1A1A1A' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmClear]} onPress={confirmClearAll} activeOpacity={0.85}>
                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const TOOL_W = 196;

const styles = StyleSheet.create({
  // Canvas on the left taking all remaining space; tools in a column on the right.
  container: { flex: 1, flexDirection: 'row', gap: 16 },
  canvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
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
  toolbar: {
    width: TOOL_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  toolLabel: { fontSize: 12, fontFamily: 'DMSans_800ExtraBold', color: '#666', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  // 16 colours as a 4 × 4 grid.
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: '#1A1A1A' },
  swatchDimmed: { opacity: 0.35 },
  sizeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  sizeBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  sizeBtnSelected: { borderColor: '#1A1A1A' },
  // Eraser / Undo / Clear all stacked full-width.
  actionRow: { gap: 8 },
  actionBtn: {
    height: 46,
    paddingHorizontal: Layout.spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#DDD',
  },
  actionBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 15, fontFamily: 'DMSans_800ExtraBold', color: '#1A1A1A' },
  actionBtnTextActive: { color: '#FFFFFF' },

  // "Start again?" pop-up — centred white card, 3D buttons.
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Layout.spacing.lg },
  confirmCard: {
    width: '100%', maxWidth: 420, alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 28,
    paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  confirmIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  confirmTitle: { fontSize: 24, fontFamily: 'DMSans_800ExtraBold', color: '#1A1A2E' },
  confirmText: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: '#666', textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: 14, marginTop: 14 },
  confirmBtn: {
    minWidth: 130, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  confirmCancel: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#DDD' },
  confirmClear: { backgroundColor: '#EF4444', borderBottomColor: 'rgba(0,0,0,0.22)' },
  confirmBtnText: { fontSize: 17, fontFamily: 'DMSans_800ExtraBold' },
});
