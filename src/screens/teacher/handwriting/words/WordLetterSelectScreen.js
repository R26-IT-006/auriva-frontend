import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';

import { getAllWordProgress } from '../../../../utils/storage';
import { fetchWordProgress } from '../../../../utils/wordApi';
import { buildWordRouteParams, getSelectedWords } from '../../../../utils/wordWorkflow';
import { filterUnfinishedWords } from '../../../../utils/wordCompletionHistory';
import { useLockLandscape } from '../../../../utils/useOrientationLock';
import useGatedBack from '../../../../utils/useGatedBack';
import { useToast } from '../../../../context/ToastContext';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import HeaderPillButton from '../../../../components/common/HeaderPillButton';

// ─── Layout ───────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const IS_TABLET  = SCREEN_W >= 768;
// Smaller tiles: more per row (was 4 / 3). Everything inside a tile — letter,
// stars, corner circle — scales from CARD_SIZE, so it all shrinks together.
const NUM_COLS   = IS_TABLET ? 6 : 4;
const SCROLL_PAD = IS_TABLET ? 24 : 16;
const CARD_GAP   = IS_TABLET ? 16 : 10;
const CARD_SIZE  = Math.floor(
  (SCREEN_W - SCROLL_PAD * 2 - CARD_GAP * (NUM_COLS - 1)) / NUM_COLS
);
// Progress stars, scaled with the card (about 21px on a 1280-wide tablet).
const STAR_SIZE  = Math.max(14, Math.round(CARD_SIZE * 0.11));

// ─── Data ─────────────────────────────────────────────────────────────────────

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Shown when a letter has no unfinished words left. Neutral and final —
// it is an achievement, not an error, and there is nothing to retry.
const ALL_WORDS_COMPLETED = 'All words completed!';

// ASD-friendly pastel palette — cycles per letter index
// Tile colours. bg / shine are blended ~55% toward white (lighter tiles);
// border and text keep their full colour so each letter stays easy to read.
const PALETTE = [
  { bg: '#F6FAFF', border: '#BDD8F5', text: '#2B6CB0', shine: '#F0F7FD' }, // sky blue
  { bg: '#F5FBF7', border: '#B7DFC5', text: '#276749', shine: '#ECF7F0' }, // mint green
  { bg: '#F7F5FD', border: '#CBBFF0', text: '#5E3FA3', shine: '#F1EDFB' }, // soft lavender
  { bg: '#FFF8F5', border: '#F5D0AC', text: '#B5631E', shine: '#FDF2E9' }, // warm peach
  { bg: '#FFFCF4', border: '#F0E1A6', text: '#957A0E', shine: '#FDF8E8' }, // golden butter
  { bg: '#FEF7FA', border: '#F0C0D8', text: '#A83264', shine: '#FCEEF6' }, // rose pink
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WordLetterSelectScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  const { requestBack, gateModal } = useGatedBack(() => navigation.goBack());

  // No Progress Report button here by request: the teacher reaches the
  // report from the student profile, not the word chooser.

  const { student, theme } = route.params;

  const { show } = useToast();
  const [wordProgress, setWordProgress] = useState({});
  const globalPulse = useRef(new Animated.Value(1)).current;
  const pulseLoop   = useRef(null);

  // Calm breathing animation — barely perceptible, ASD-friendly
  useEffect(() => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(globalPulse, { toValue: 0.91, duration: 2800, useNativeDriver: true }),
        Animated.timing(globalPulse, { toValue: 1.00, duration: 2800, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, []);

  // Reload progress whenever screen comes into focus — server-backed
  // (final-completion-pass fix, section 24/37: this previously read a local
  // AsyncStorage snapshot via getAllWordProgress(student?.sid ?? 0), which
  // both used the `?? 0` cross-student-unsafe fallback this task explicitly
  // flags and could drift from the real per-student progress across devices
  // or a cleared app cache. Matches WordProgressScreen's own established
  // fetchWordProgress + try/catch pattern.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const authoritative = await fetchWordProgress(student);
          if (active) setWordProgress(authoritative ?? {});
        } catch {
          if (active) setWordProgress({});
        }
      })();
      return () => { active = false; };
    }, [student?.sid])
  );

  const doneCount    = LETTERS.filter(l => !!wordProgress[l.toLowerCase()]).length;
  const progressText = `${doneCount} / ${LETTERS.length} letters started`;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative shapes — same treatment as LetterHome / LetterPractice
          and the Concept / Dialogue landing pages */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe}>

        {/* ── Top bar: back | title | Word Progress ──── */}
        <View style={styles.topBar}>
          <View style={styles.sideGroup}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }, BACK_BUTTON]}
              onPress={requestBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
            </TouchableOpacity>
          </View>

          {/* Module title — same icon circle + 34pt heading as LetterHome,
              LetterPractice and the Concept / Dialogue landing pages. */}
          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="book" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Choose a Letter</Text>
          </View>

          <View style={[styles.sideGroup, styles.topActions]}>
            {/* Shared header pill (HeaderPillButton). */}
            <HeaderPillButton
              variant="primary"
              icon="ribbon-outline"
              label="Word Progress"
              theme={theme}
              onPress={() => navigation.navigate('WordProgress', { student, theme })}
            />
          </View>
        </View>

        {/* ── Subtitle line: the one instruction, with progress beside it ── */}
        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { color: theme.headingText }]}>
            Tap a letter to start practising words
          </Text>
          <View style={[styles.progressPill, { borderColor: theme.cardOutline + '88' }]}>
            <Text style={[styles.progressPillText, { color: theme.headingText }]}>{progressText}</Text>
          </View>
        </View>

        {/* ── Letter grid ──────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {LETTERS.map((letter, i) => {
            const progress    = wordProgress[letter.toLowerCase()];
            const pal         = PALETTE[i % PALETTE.length];

            return (
              <LetterCard
                key={letter}
                letter={letter}
                progress={progress}
                palette={pal}
                globalPulse={globalPulse}
                theme={theme}
                onPress={() => {
                  const selectedLetter = letter.toLowerCase();
                  // Words the child has already finished are dropped HERE,
                  // as the sequence is built — never mid-flow, so an A-E run
                  // already under way is untouched even if it completes the
                  // word it is on. `wordProgress` is the authoritative
                  // server payload this screen already loads on focus.
                  const selectedWords = filterUnfinishedWords(
                    getSelectedWords(selectedLetter), wordProgress, selectedLetter,
                  );

                  if (selectedWords.length === 0) {
                    // Every word for this letter is done. Stay on the chooser
                    // rather than opening an empty flow or repeating one.
                    show(ALL_WORDS_COMPLETED, 'success');
                    return;
                  }

                  navigation.navigate('WordWriting', buildWordRouteParams({
                    student,
                    theme,
                    selectedLetter,
                    selectedWords,
                    currentWordIndex: 0,
                  }));
                }}
              />
            );
          })}
        </ScrollView>

      </SafeAreaView>

      {/* Parent gates for the back button and the Teacher-report button.
          Rendered once each, at the end of the tree, so they overlay the
          whole screen. Only one can be visible at a time — each is opened
          by its own button and closes itself on success or cancel. */}
      {gateModal}
    </LinearGradient>
  );
}

// ─── Letter card ──────────────────────────────────────────────────────────────

// Every letter is open — the grid has no locked state, so there is one card
// treatment and every card is tappable.
// A soft, rounded star: a five-point star whose corners are rounded by a
// round-joined stroke of the same colour. Filled when earned; an outline
// when not.
const STAR_POINTS = '12,3 14.6,8.6 20.6,9.3 16.1,13.4 17.4,19.4 12,16.4 6.6,19.4 7.9,13.4 3.4,9.3 9.4,8.6';
function RoundedStar({ size, color, filled }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon
        points={STAR_POINTS}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 3 : 2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LetterCard({ letter, progress, palette, globalPulse, theme, onPress }) {
  const stars = progress
    ? Math.min(3, Math.round((progress.length / 5) * 3))
    : 0;

  return (
    <Animated.View style={{ opacity: globalPulse }}>
      <TouchableOpacity
        style={[
          styles.card,
          styles.cardUnlocked,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
        onPress={onPress}
        activeOpacity={0.80}
        accessibilityLabel={`Letter ${letter}`}
        accessibilityRole="button"
      >
        {/* Shine circle accent */}
        <View style={[styles.shineCircle, { backgroundColor: palette.shine }]} />

        {/* Progress badge */}
        {progress && (
          <View style={[styles.progressBadge, { backgroundColor: palette.border }]}>
            <Text style={[styles.progressBadgeText, { color: palette.text }]}>
              ★ {progress.length}
            </Text>
          </View>
        )}

        {/* Letter */}
        <Text style={[styles.letter, { color: palette.text }]}>{letter}</Text>

        {/* Stars row — solid gold when earned, an outline in the card's own
            colour when not, sized from the card so they read at a glance. */}
        <View style={styles.starsRow} accessibilityLabel={`${stars} of 3 stars`}>
          {[0, 1, 2].map(i => (
            <RoundedStar
              key={i}
              size={STAR_SIZE}
              filled={i < stars}
              color={i < stars ? '#F5B301' : palette.text + '66'}
            />
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // ── Decorative background shapes (same as LetterHome / LetterPractice) ──
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  blobTopRight: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  blobBottomLeft: {
    width: 260,
    height: 260,
    bottom: -80,
    left: -80,
  },

  // ── Top bar: back | title | Word Progress ────────────────────────────
  // The two side groups share the leftover width equally (flex: 1) so the
  // title stays centred even though the buttons are wider than Back.
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: IS_TABLET ? 24 : 16,
    paddingVertical:   IS_TABLET ? 12 : 8,
  },
  sideGroup: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
  },
  // The landing pages' round, translucent white button.
  backBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.08,
    shadowRadius:   4,
    elevation:      2,
  },
  // marginTop matches the other landing pages, so the title sits at the
  // same height on every one of them.
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     IS_TABLET ? 70 : 24,
  },
  titleIconCircle: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 3 },
    shadowOpacity:  0.15,
    shadowRadius:   5,
    elevation:      3,
  },
  title: {
    fontSize:      IS_TABLET ? 34 : 26,
    fontFamily:    'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  topActions: {
    justifyContent: 'flex-end',
    gap:            10,
  },

  // ── Subtitle line: instruction + progress pill, centred ─────────────────
  subtitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    marginTop:      2,
    marginBottom:   IS_TABLET ? 18 : 12,
    paddingHorizontal: IS_TABLET ? 24 : 16,
  },
  subtitle: {
    fontSize:   15,
    fontFamily: 'DMSans_600SemiBold',
    opacity:    0.6,
  },
  progressPill: {
    backgroundColor:   '#FFFFFF',
    borderWidth:       1.5,
    borderRadius:      20,
    paddingHorizontal: IS_TABLET ? 12 : 9,
    paddingVertical:   IS_TABLET ? 4 : 3,
  },
  progressPillText: {
    fontSize:   IS_TABLET ? 12 : 10,
    fontFamily: 'DMSans_700Bold',
  },

  // Grid
  grid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: SCROLL_PAD,
    gap:               CARD_GAP,
    paddingBottom:     32,
  },

  // Cards
  card: {
    width:          CARD_SIZE,
    height:         CARD_SIZE,
    borderRadius:   IS_TABLET ? 20 : 16,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  cardUnlocked: {
    borderWidth:   2,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius:  8,
    elevation:     3,
  },
  // Shine accent
  shineCircle: {
    position:     'absolute',
    top:          -CARD_SIZE * 0.18,
    right:        -CARD_SIZE * 0.18,
    width:        CARD_SIZE * 0.55,
    height:       CARD_SIZE * 0.55,
    borderRadius: CARD_SIZE * 0.275,
  },

  // Progress badge
  progressBadge: {
    position:          'absolute',
    top:               6,
    left:              6,
    borderRadius:      10,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  progressBadgeText: {
    fontSize:   IS_TABLET ? 10 : 9,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },

  // Letter text
  letter: {
    fontSize:   IS_TABLET ? Math.round(CARD_SIZE * 0.42) : Math.round(CARD_SIZE * 0.44),
    fontWeight: '900',
    lineHeight: IS_TABLET ? Math.round(CARD_SIZE * 0.50) : Math.round(CARD_SIZE * 0.52),
  },

  // Stars
  starsRow: {
    flexDirection: 'row',
    marginTop:     IS_TABLET ? 6 : 4,
    gap:           IS_TABLET ? 4 : 2,
  },
});
