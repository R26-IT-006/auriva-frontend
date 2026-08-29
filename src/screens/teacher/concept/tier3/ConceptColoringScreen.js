import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getConceptItem } from '../../../../data/conceptData';
import { conceptApi } from '../../../../api/concept';
import { Layout } from '../../../../constants/layout';

const COLORS = [
  { key: 'red',    hex: '#E53935' },
  { key: 'orange', hex: '#FB8C00' },
  { key: 'yellow', hex: '#FDD835' },
  { key: 'green',  hex: '#43A047' },
  { key: 'blue',   hex: '#1E88E5' },
  { key: 'purple', hex: '#8E24AA' },
  { key: 'brown',  hex: '#6D4C41' },
  { key: 'pink',   hex: '#F48FB1' },
  { key: 'black',  hex: '#212121' },
  { key: 'white',  hex: '#FFFFFF' },
];

const STROKE_WIDTH = 14;

export default function ConceptColoringScreen({ route, navigation }) {
  const { student, category, conceptKey } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);

  const { width, height } = useWindowDimensions();
  const CANVAS_SIZE = Math.min(width * 0.5, height * 0.62);

  const [activeColor, setActiveColor] = useState('#E53935');
  const [strokes,     setStrokes]     = useState([]);
  const [current,     setCurrent]     = useState(null);
  const [saving,      setSaving]      = useState(false);

  const activeColorRef = useRef('#E53935');
  const currentDRef    = useRef('');
  const sessionStart   = useRef(Date.now());
  const colorScales    = useRef(COLORS.map(() => new Animated.Value(1))).current;
  // The view captured on Continue — artwork plus strokes, without the palette,
  // buttons or the themed background around them.
  const canvasRef      = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      Speech.speak(`Let's colour the ${concept?.label?.toLowerCase()}!`, { language: 'en-US', rate: 0.8 });
    }, 400);
    // Without this the prompt keeps talking after the child leaves the screen.
    return () => { clearTimeout(timer); Speech.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectColor(hex, index) {
    activeColorRef.current = hex;
    setActiveColor(hex);
    Animated.sequence([
      Animated.timing(colorScales[index], { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(colorScales[index], { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
  }

  // Move the finished stroke into the committed list. Only this runs per stroke,
  // so the committed paths re-render once instead of on every touch sample.
  function commitStroke() {
    const d = currentDRef.current;
    currentDRef.current = '';
    setCurrent(null);
    if (d) setStrokes(prev => [...prev, { d, color: activeColorRef.current }]);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      // Don't let a parent view steal the gesture halfway through a stroke.
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        // Zero-length line + round linecap = a visible dot, so a plain tap marks
        // the page instead of doing nothing.
        currentDRef.current = `M${x.toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`;
        setCurrent({ d: currentDRef.current, color: activeColorRef.current });
      },

      onPanResponderMove: (evt) => {
        if (!currentDRef.current) return;
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentDRef.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        setCurrent({ d: currentDRef.current, color: activeColorRef.current });
      },

      onPanResponderRelease:   commitStroke,
      onPanResponderTerminate: commitStroke,
    })
  ).current;

  function handleUndo()  { setStrokes(prev => prev.slice(0, -1)); }
  function handleReset() { currentDRef.current = ''; setCurrent(null); setStrokes([]); }

  async function handleContinue() {
    if (saving) return;
    Speech.stop();

    const timeSpentMs = Date.now() - sessionStart.current;

    conceptApi.logInteraction({
      studentId: student.sid, sessionId: null,
      categoryKey: category.key, conceptKey,
      tier: 4, eventType: 'coloring_complete',
      eventData: { stroke_count: strokes.length, time_spent_ms: timeSpentMs },
    }).catch(() => {});

    // Save the picture the child actually made. An empty page is not artwork, so
    // a colouring with no strokes just moves on.
    if (strokes.length > 0) {
      setSaving(true);
      try {
        const uri = await captureRef(canvasRef, { format: 'png', quality: 1, result: 'tmpfile' });
        await conceptApi.saveColoring({
          studentId:   student.sid,
          categoryKey: category.key,
          conceptKey,
          uri,
          strokeCount: strokes.length,
          timeSpentMs,
        });
      } catch {
        // The child is finished either way — a failed upload must not trap them
        // on this screen or turn their session into an error message.
      } finally {
        setSaving(false);
      }
    }

    navigation.replace('ConceptItems', { student, category });
  }

  if (!concept) return null;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Pill — above everything, centred on the canvas axis */}
        <View style={[styles.pill, { backgroundColor: theme.cardSurface }]}>
          <Text style={[styles.pillText, { color: theme.headingText }]}>
            Colour the {concept.label.toLowerCase()}!
          </Text>
          {concept.labelSi && (
            <Text style={[styles.pillTextSi, { color: theme.headingText }]}>
              {concept.labelSi} වර්ණ ගන්වමු!
            </Text>
          )}
        </View>

        {/* Palette + Canvas side by side, both starting at the same top */}
        <View style={styles.row}>

          {/* Palette locked to canvas height so tops and bottoms line up */}
          <View style={[styles.palette, { backgroundColor: theme.cardSurface, height: CANVAS_SIZE }]}>
            {COLORS.map((c, i) => {
              const isActive = c.hex === activeColor;
              return (
                <TouchableOpacity key={c.key} onPress={() => selectColor(c.hex, i)} activeOpacity={0.8}>
                  <Animated.View
                    style={[
                      styles.swatch,
                      { backgroundColor: c.hex, transform: [{ scale: colorScales[i] }] },
                      isActive && styles.swatchActive,
                      c.hex === '#FFFFFF' && styles.swatchWhite,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Canvas */}
          <View
            ref={canvasRef}
            collapsable={false}
            style={[
              styles.canvasBox,
              { width: CANVAS_SIZE, height: CANVAS_SIZE, borderColor: theme.cardOutline },
            ]}
          >
            {concept.coloring && (
              <View style={styles.imageWrap}>
                <Image source={concept.coloring} style={styles.coloringImage} resizeMode="contain" />
              </View>
            )}

            <Svg
              style={StyleSheet.absoluteFill}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              pointerEvents="none"
            >
              {strokes.map((s, i) => (
                <Path
                  key={i}
                  d={s.d}
                  stroke={s.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {current && (
                <Path
                  d={current.d}
                  stroke={current.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </Svg>

            {/* Touch layer on top of the artwork. The gesture must land on a plain
                View: on an <Svg> the touch resolves to whichever child element is
                under the finger, so locationX/locationY become relative to that
                element and strokes jump once the page has ink on it. */}
            <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
          </View>

        </View>

        {/* Undo / Reset — centred below the canvas */}
        <View style={styles.toolRow}>
          <TouchableOpacity
            style={[styles.toolBtn, { backgroundColor: theme.cardSurface }]}
            onPress={handleUndo}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-undo" size={20} color={theme.headingText} />
            <Text style={[styles.toolBtnText, { color: theme.headingText }]}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, { backgroundColor: theme.cardSurface }]}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color={theme.headingText} />
            <Text style={[styles.toolBtnText, { color: theme.headingText }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Continue */}
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: theme.button }, saving && styles.continueBtnBusy]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={[styles.continueBtnText, { color: theme.buttonText }]}>
            {saving ? 'Saving…' : 'Continue'}
          </Text>
          {saving
            ? <ActivityIndicator size="small" color={theme.buttonText} />
            : <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />}
        </TouchableOpacity>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 16,
    gap: 14,
  },

  pill: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pillText: {
    fontSize: 22,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  pillTextSi: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    opacity: 0.65,
    textAlign: 'center',
    marginTop: 2,
  },

  /* Palette and canvas share the same row, tops flush */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },

  palette: {
    width: 64,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  swatchWhite: {
    borderWidth: 1.5,
    borderColor: '#ccc',
  },

  canvasBox: {
    borderRadius: 20,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
  },

  imageWrap: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '80%',
    height: '80%',
  },
  coloringImage: {
    width: '100%',
    height: '100%',
  },

  toolRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toolBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 44,
    paddingVertical: 16,
    borderRadius: 36,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  continueBtnBusy: {
    opacity: 0.7,
  },
  continueBtnText: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
  },
});
