/**
 * L2SentencePathScreen
 * Sits between L2Contrastive and the per-sentence teaching flow. Replaces the
 * old behavior where L2SentenceTeach auto-looped through all 5 sentences —
 * now each of the 5 sentence stops is picked individually from this path,
 * teaches just that one sentence (step1 Listen → step2 drag → step3 → step4
 * Speak), then returns here. The 6th stop, "Let's Practice!", launches the
 * existing L2ListenTogether → L2Production flow (full paragraph, then
 * sentence-by-sentence repeat) which still ends at L2SessionComplete.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect, Polygon } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Nunito_800ExtraBold, Nunito_700Bold, Nunito_600SemiBold } from '@expo-google-fonts/nunito';
import { Layout } from '../../../../constants/layout';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';

const TOPIC_TITLES = {
  self_introduction: 'Myself',
  describe_friend:   'My Friend',
  describe_pet:      'My Pet',
};

// Static stops for self_introduction (always 5 sentences, fixed titles).
const SELF_INTRO_STOPS = [
  { id: 1, sentenceIndex: 1, title: 'My Name',          emoji: '👤' },
  { id: 2, sentenceIndex: 2, title: 'My Age',            emoji: '🎂' },
  { id: 3, sentenceIndex: 3, title: 'Where do I Live?',  emoji: '🏠' },
  { id: 4, sentenceIndex: 4, title: 'Who am I?',         emoji: '⭐' },
  { id: 5, sentenceIndex: 5, title: 'My Hobbies',        emoji: '🎨' },
  { id: 6, sentenceIndex: null, title: "Let's Practice!", emoji: '🏆', isPractice: true },
];

// Per-sentence stop metadata for topics with variable sentence counts.
// Index matches the sentence index from the backend sentence builder.
const FRIEND_STOP_META = {
  1: { title: "My Friend's Name", emoji: '👫' },
  2: { title: 'Girl or Boy?',     emoji: '🚻' },
  3: { title: 'Their Age',        emoji: '🎂' },
  4: { title: 'Their Grade',      emoji: '📚' },
  5: { title: 'Why I Like Them',  emoji: '💛' },
};
const PET_STOP_META = {
  1: { title: 'My Pet',          emoji: '🐾' },
  2: { title: "Pet's Name",      emoji: '🏷️' },
  3: { title: 'What It Does',    emoji: '🌈' },
  4: { title: 'What It Eats',    emoji: '🍖' },
  5: { title: 'Where It Lives',  emoji: '🏡' },
};

/**
 * Build the stop array from session data.
 * For self_introduction: return the static SELF_INTRO_STOPS (5 sentences + practice).
 * For friend/pet: derive stops from sessionData.sentences (variable count 2–5)
 * using the meta tables above, then append a practice stop.
 */
function getStops(topic, sentences = []) {
  if (!topic || topic === 'self_introduction') return SELF_INTRO_STOPS;

  const meta = topic === 'describe_friend' ? FRIEND_STOP_META : PET_STOP_META;

  const sentenceStops = [...sentences]
    .sort((a, b) => a.index - b.index)
    .map((s, i) => ({
      id: i + 1,
      sentenceIndex: s.index,
      title: meta[s.index]?.title ?? `Sentence ${s.index}`,
      emoji: meta[s.index]?.emoji ?? '📖',
    }));

  const practiceId = sentenceStops.length + 1;
  return [
    ...sentenceStops,
    { id: practiceId, sentenceIndex: null, title: "Let's Practice!", emoji: '🏆', isPractice: true },
  ];
}

// Positions as % of the path area — alternating up/down zigzag, matching the wireframe.
// Shifted up vs. the original 40–80% band (and back down a little from the first
// pass) so the lowest stops keep clear of the floating start banner.
const POSITIONS = [
  { left: '6%',  top: '34%' },
  { left: '22%', top: '52%' },
  { left: '39%', top: '18%' },
  { left: '56%', top: '42%' },
  { left: '73%', top: '16%' },
  { left: '89%', top: '29%' },
];

const ROAD_PATH = 'M 79 260 C 110 260, 130 360, 210 360 C 290 360, 320 190, 400 190 C 480 190, 510 300, 590 300 C 660 300, 700 160, 770 160 C 830 160, 870 250, 900 250';

const TREES = [
  { x: 60,  y: 90,  s: 0.85, c1: '#FF6B9D', c2: '#E83A6D', c3: '#FF9DC0' },
  { x: 200, y: 55,  s: 1.0,  c1: '#A855F7', c2: '#7C3AED', c3: '#C084FC' },
  { x: 400, y: 340, s: 1.0,  c1: '#80f0f4', c2: '#7d58be', c3: '#C084FC' },
  { x: 500, y: 60,  s: 0.85, c1: '#EAB308', c2: '#CA8A04', c3: '#FDE047' },
  { x: 780, y: 400, s: 0.9,  c1: '#3B82F6', c2: '#1D4ED8', c3: '#93C5FD' },
  { x: 900, y: 90,  s: 0.8,  c1: '#22C55E', c2: '#15803D', c3: '#86EFAC' },
  { x: 40,  y: 360, s: 0.75, c1: '#22C55E', c2: '#15803D', c3: '#86EFAC' },
  { x: 950, y: 340, s: 0.8,  c1: '#F97316', c2: '#EA580C', c3: '#FBA56C' },
];

const STARS = [
  { x: 260, y: 100, s: 0.9 },
  { x: 620, y: 110, s: 0.8 },
  { x: 340, y: 380, s: 0.85 },
  { x: 700, y: 360, s: 0.75 },
];

function LollipopTree({ x, y, s, c1, c2, c3 }) {
  const r = 20 * s;
  return (
    <>
      <Rect x={x - 3 * s} y={y} width={6 * s} height={32 * s} rx={3} fill="#8B6426" />
      <Circle cx={x - 13 * s} cy={y - 5 * s} r={r} fill={c3} />
      <Circle cx={x + 13 * s} cy={y - 5 * s} r={r} fill={c2} />
      <Circle cx={x} cy={y - 18 * s} r={r * 1.05} fill={c1} />
    </>
  );
}

function StarSparkle({ x, y, s }) {
  const sz = 9 * s;
  const pts = [
    [0, -sz], [sz * 0.35, -sz * 0.35], [sz, 0], [sz * 0.35, sz * 0.35],
    [0, sz], [-sz * 0.35, sz * 0.35], [-sz, 0], [-sz * 0.35, -sz * 0.35],
  ].map(([px, py]) => `${x + px},${y + py}`).join(' ');
  return <Polygon points={pts} fill="#FFD700" stroke="#F59E0B" strokeWidth={1} />;
}

export default function L2SentencePathScreen({ route, navigation }) {
  const { student, sessionData } = route.params ?? {};
  const topicTitle = TOPIC_TITLES[sessionData?.topic] ?? 'Myself';

  const stops = useMemo(
    () => getStops(sessionData?.topic, sessionData?.sentences ?? []),
    [sessionData?.topic, sessionData?.sentences],
  );

  const [activeId, setActiveId] = useState(null);
  const [completed, setCompleted] = useState({}); // { [stopId]: true }
  const [showGate, setShowGate] = useState(false);

  const [fontsLoaded] = useFonts({
    Colora: require('../../../../../assets/fonts/COLORA.ttf'),
    Nunito_800ExtraBold, Nunito_700Bold, Nunito_600SemiBold,
  });
  const font = (weight) => (fontsLoaded ? { fontFamily: weight, fontWeight: 'normal' } : null);

  // Pick up completion signal when returning from a sentence-teach or practice screen.
  useFocusEffect(useCallback(() => {
    const justCompleted = route.params?.justCompleted;
    if (justCompleted) {
      setCompleted((prev) => ({ ...prev, [justCompleted]: true }));
      navigation.setParams({ justCompleted: undefined });
    }
  }, [route.params?.justCompleted]));

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setShowGate(true); return true; });
    return () => sub.remove();
  }, []));

  function handleStart(stop) {
    setActiveId(null);
    if (stop.isPractice) {
      navigation.navigate('L2ListenTogether', { student, sessionData });
    } else {
      // TASK-18: route through the Sentence Familiarisation Ladder before teaching.
      // L2ListenWatch → L2SentenceBuild → L2FillGap → L2SentenceMatch → L2SentenceTeach
      // (L2SentenceTeach still navigates back here with justCompleted when done.)
      navigation.navigate('L2ListenWatch', {
        student,
        sessionData,
        sentenceIndex: stop.sentenceIndex,
      });
    }
  }

  const activeStop = stops.find((s) => s.id === activeId);

  return (
    <LinearGradient
      colors={['#A8DCF0', '#C8E8F5', '#D4E870', '#BEDD40', '#A5C820']}
      locations={[0, 0.12, 0.28, 0.55, 1]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowGate(true)} activeOpacity={0.7} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color="#1A2B1A" />
          </TouchableOpacity>

          <View style={styles.titlePill}>
            <Text style={styles.titleEmoji}>🌟</Text>
            <Text style={[styles.titleText, fontsLoaded && { fontFamily: 'Colora', fontWeight: 'normal' }]}>{topicTitle}</Text>
            <Text style={styles.titleEmoji}>🌟</Text>
          </View>
        </View>

        <View style={styles.pathArea}>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 480" preserveAspectRatio="xMidYMid meet">
            {TREES.map((t, i) => <LollipopTree key={i} {...t} />)}
            {STARS.map((s, i) => <StarSparkle key={i} {...s} />)}
            <Path d={ROAD_PATH} fill="none" stroke="#A07848" strokeWidth={56} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={ROAD_PATH} fill="none" stroke="#F2C98A" strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={ROAD_PATH} fill="none" stroke="#E8B87A" strokeWidth={3.5} strokeLinecap="round" strokeDasharray="18 16" />
          </Svg>

          {stops.map((stop, i) => {
            const pos = POSITIONS[i];
            const isDone = !!completed[stop.sentenceIndex];
            const accent = stop.isPractice ? '#FFB800' : '#3DBB5A';
            const btnColor = stop.isPractice ? '#FFB800' : '#E83A6D';

            return (
              <View key={stop.id} style={[styles.stopWrap, { left: pos.left, top: pos.top }]}>
                {/* Label card */}
                <View style={[styles.card, { borderColor: accent }]}>
                  <View style={[styles.cardHeader, { backgroundColor: accent }]}>
                    <Text style={styles.cardEmoji}>{stop.emoji}</Text>
                  </View>
                  <Text style={[styles.cardTitle, font('Nunito_800ExtraBold')]} numberOfLines={2}>
                    {stop.title}
                  </Text>
                </View>
                <View style={[styles.stem, { backgroundColor: accent }]} />

                {/* Button */}
                <TouchableOpacity
                  style={styles.btnTouch}
                  activeOpacity={0.85}
                  onPress={() => setActiveId(activeId === stop.id ? null : stop.id)}
                  accessibilityLabel={`${stop.title}${isDone ? ', completed' : ''}`}
                >
                  <View style={[styles.btnShadow, { backgroundColor: '#9B1040' }, stop.isPractice && { backgroundColor: '#B07D00' }]} />
                  <View style={[styles.btn, { backgroundColor: btnColor }, activeId === stop.id && styles.btnPressed]}>
                    <Text style={[styles.btnNumber, font('Nunito_800ExtraBold')]}>{stop.id}</Text>
                  </View>
                  {isDone && (
                    <View style={styles.doneBadge}>
                      <Ionicons name="checkmark" size={13} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {activeStop && (
          <View style={styles.bannerWrap} pointerEvents="box-none">
            <View style={styles.banner}>
              <Text style={styles.bannerEmoji}>{activeStop.emoji}</Text>
              <View>
                <Text style={[styles.bannerLabel, font('Nunito_700Bold')]}>
                  {activeStop.isPractice ? 'PRACTICE' : `LESSON ${activeStop.id}`}
                </Text>
                <Text style={[styles.bannerTitle, font('Nunito_800ExtraBold')]} numberOfLines={1}>
                  {activeStop.title.replace('\n', ' ')}
                </Text>
              </View>
              <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(activeStop)} activeOpacity={0.85}>
                <Text style={[styles.startBtnText, font('Nunito_800ExtraBold')]}>Start!</Text>
                <Text style={styles.startBtnEmoji}>🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </SafeAreaView>

      <ParentGateModal
        visible={showGate}
        onSuccess={() => { setShowGate(false); navigation.navigate('L2TopicSelection', { student }); }}
        onCancel={() => setShowGate(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm,
  },
  backBtn: {
    position: 'absolute', left: Layout.spacing.lg, top: Layout.spacing.sm,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },

  titlePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#FF7A00',
    alignSelf: 'center',
    paddingVertical: 11, paddingHorizontal: 30,
    borderRadius: 60,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#C04800', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  titleEmoji: { fontSize: 21 },
  titleText: { fontSize: 30, fontWeight: '900', color: '#FFF' },

  pathArea: { flex: 1, position: 'relative' },

  stopWrap: { position: 'absolute', alignItems: 'center', transform: [{ translateX: -40 }] },
  card: {
    width: 118, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 3,
    overflow: 'hidden', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 4,
  },
  cardHeader: { width: '100%', alignItems: 'center', paddingVertical: 4 },
  cardEmoji: { fontSize: 14 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#1A2B1A', textAlign: 'center', paddingHorizontal: 6, paddingVertical: 6, lineHeight: 15 },
  stem: { width: 5, height: 16, borderRadius: 3 },

  btnTouch: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  btnShadow: { position: 'absolute', top: 6, width: 74, height: 74, borderRadius: 37 },
  btn: {
    width: 74, height: 74, borderRadius: 37,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPressed: { transform: [{ translateY: 3 }] },
  btnNumber: { fontSize: 26, fontWeight: '900', color: '#FFF' },
  doneBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },

  bannerWrap: {
    position: 'absolute', left: 0, right: 0, bottom: Layout.spacing.xl + Layout.spacing.lg,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.97)',
    maxWidth: 480,
    borderRadius: 24, borderWidth: 3, borderColor: '#3DBB5A',
    paddingVertical: 14, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 6,
  },
  bannerEmoji: { fontSize: 32 },
  bannerLabel: { fontSize: 12, fontWeight: '700', color: '#3DBB5A', letterSpacing: 1, textTransform: 'uppercase' },
  bannerTitle: { fontSize: 20, fontWeight: '900', color: '#1A2B1A' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#3DBB5A', borderRadius: 13,
    paddingVertical: 11, paddingHorizontal: 20,
    shadowColor: '#27843D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  startBtnText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  startBtnEmoji: { fontSize: 16 },
});