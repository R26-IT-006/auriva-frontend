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
import Svg, { Path } from 'react-native-svg';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { DMSans_800ExtraBold, DMSans_700Bold, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { Layout } from '../../../../constants/layout';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';

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

export default function L2SentencePathScreen({ route, navigation }) {
  const { student, sessionData } = route.params ?? {};
  const topicTitle = TOPIC_TITLES[sessionData?.topic] ?? 'Myself';
  const theme = getAvatarTheme(student?.avatar_key);

  const stops = useMemo(
    () => getStops(sessionData?.topic, sessionData?.sentences ?? []),
    [sessionData?.topic, sessionData?.sentences],
  );

  const [activeId, setActiveId] = useState(null);
  const [completed, setCompleted] = useState({}); // { [stopId]: true }
  const [showGate, setShowGate] = useState(false);

  const [fontsLoaded] = useFonts({
    Colora: require('../../../../../assets/fonts/COLORA.ttf'),
    DMSans_800ExtraBold, DMSans_700Bold, DMSans_600SemiBold,
  });
  const font = (weight) => (fontsLoaded ? { fontFamily: weight, } : null);

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
      // L2ListenWatch → L2SentenceBuild → L2FillGap → L2SentenceTeach
      // (L2SentenceMatch was removed from this chain. L2SentenceTeach still
      // navigates back here with justCompleted when done.)
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
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.backBtn, BACK_BUTTON]} onPress={() => setShowGate(true)} activeOpacity={0.7} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.titlePill}>
            <Text style={styles.titleEmoji}>🌟</Text>
            <Text style={[styles.titleText, fontsLoaded && { fontFamily: 'Colora', }]}>{topicTitle}</Text>
            <Text style={styles.titleEmoji}>🌟</Text>
          </View>
        </View>

        <View style={styles.pathArea}>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 480" preserveAspectRatio="xMidYMid meet">
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
                  <Text style={[styles.cardTitle, font('DMSans_800ExtraBold')]} numberOfLines={2}>
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
                    <Text style={[styles.btnNumber, font('DMSans_800ExtraBold')]}>{stop.id}</Text>
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
                <Text style={[styles.bannerLabel, font('DMSans_700Bold')]}>
                  {activeStop.isPractice ? 'PRACTICE' : `LESSON ${activeStop.id}`}
                </Text>
                <Text style={[styles.bannerTitle, font('DMSans_800ExtraBold')]} numberOfLines={1}>
                  {activeStop.title.replace('\n', ' ')}
                </Text>
              </View>
              <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(activeStop)} activeOpacity={0.85}>
                <Text style={[styles.startBtnText, font('DMSans_800ExtraBold')]}>Start!</Text>
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
  gradient: { flex: 1, overflow: 'hidden' },
  // Decorative background shapes (same as the other module screens).
  blob: { position: 'absolute', borderRadius: rs(999), opacity: 0.08 },
  blobTopRight:   { width: rs(220), height: rs(220), top: rs(-60), right: rs(-60) },
  blobBottomLeft: { width: rs(260), height: rs(260), bottom: rs(-80), left: rs(-80) },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm,
  },
  backBtn: {
    position: 'absolute', left: Layout.spacing.lg, top: Layout.spacing.sm,
    width: rs(40), height: rs(40), borderRadius: rs(20),
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },

  titlePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(12),
    backgroundColor: '#FF7A00',
    alignSelf: 'center',
    paddingVertical: rs(11), paddingHorizontal: rs(30),
    borderRadius: rs(60),
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#C04800', shadowOffset: { width: 0, height: rs(6) }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  titleEmoji: { fontSize: rf(21) },
  titleText: { fontSize: rf(30), fontFamily: 'DMSans_900Black', color: '#FFF' },

  pathArea: { flex: 1, position: 'relative' },

  stopWrap: { position: 'absolute', alignItems: 'center', transform: [{ translateX: -40 }] },
  card: {
    width: rs(118), backgroundColor: '#FFF', borderRadius: rs(14), borderWidth: 3,
    overflow: 'hidden', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 4,
  },
  cardHeader: { width: '100%', alignItems: 'center', paddingVertical: rs(4) },
  cardEmoji: { fontSize: rf(14) },
  cardTitle: { fontSize: rf(12), fontFamily: 'DMSans_800ExtraBold', color: '#1A2B1A', textAlign: 'center', paddingHorizontal: rs(6), paddingVertical: rs(6), lineHeight: rf(15) },
  stem: { width: rs(5), height: rs(16), borderRadius: rs(3) },

  btnTouch: { width: rs(80), height: rs(80), alignItems: 'center', justifyContent: 'center' },
  btnShadow: { position: 'absolute', top: rs(6), width: rs(74), height: rs(74), borderRadius: rs(37) },
  btn: {
    width: rs(74), height: rs(74), borderRadius: rs(37),
    alignItems: 'center', justifyContent: 'center',
  },
  btnPressed: { transform: [{ translateY: 3 }] },
  btnNumber: { fontSize: rf(26), fontFamily: 'DMSans_900Black', color: '#FFF' },
  doneBadge: {
    position: 'absolute', top: -2, right: -2,
    width: rs(24), height: rs(24), borderRadius: rs(12),
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },

  bannerWrap: {
    position: 'absolute', left: 0, right: 0, bottom: Layout.spacing.xl + Layout.spacing.lg,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: rs(14),
    backgroundColor: 'rgba(255,255,255,0.97)',
    maxWidth: rs(480),
    borderRadius: rs(24), borderWidth: 3, borderColor: '#3DBB5A',
    paddingVertical: rs(14), paddingHorizontal: rs(20),
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(6) }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 6,
  },
  bannerEmoji: { fontSize: rf(32) },
  bannerLabel: { fontSize: rf(12), fontFamily: 'DMSans_700Bold', color: '#3DBB5A', letterSpacing: 1, textTransform: 'uppercase' },
  bannerTitle: { fontSize: rf(20), fontFamily: 'DMSans_900Black', color: '#1A2B1A' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(6),
    backgroundColor: '#3DBB5A', borderRadius: rs(13),
    paddingVertical: rs(11), paddingHorizontal: rs(20),
    shadowColor: '#27843D', shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  startBtnText: { fontSize: rf(16), fontFamily: 'DMSans_900Black', color: '#FFF' },
  startBtnEmoji: { fontSize: rf(16) },
});