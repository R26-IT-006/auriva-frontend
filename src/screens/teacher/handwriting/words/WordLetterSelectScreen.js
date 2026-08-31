import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getAllWordProgress } from '../../../../utils/storage';
import { fetchWordProgress } from '../../../../utils/wordApi';
import { buildWordRouteParams, getSelectedWords } from '../../../../utils/wordWorkflow';
import { filterUnfinishedWords } from '../../../../utils/wordCompletionHistory';
import { useLockLandscape } from '../../../../utils/useOrientationLock';
import useGatedBack from '../../../../utils/useGatedBack';
import { useToast } from '../../../../context/ToastContext';

// ─── Layout ───────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const IS_TABLET  = SCREEN_W >= 768;
const NUM_COLS   = IS_TABLET ? 4 : 3;
const SCROLL_PAD = IS_TABLET ? 24 : 16;
const CARD_GAP   = IS_TABLET ? 10 : 8;
const CARD_SIZE  = Math.floor(
  (SCREEN_W - SCROLL_PAD * 2 - CARD_GAP * (NUM_COLS - 1)) / NUM_COLS
);

// ─── Data ─────────────────────────────────────────────────────────────────────

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Shown when a letter has no unfinished words left. Neutral and final —
// it is an achievement, not an error, and there is nothing to retry.
const ALL_WORDS_COMPLETED = 'All words completed!';

// ASD-friendly pastel palette — cycles per letter index
const PALETTE = [
  { bg: '#EAF4FE', border: '#BDD8F5', text: '#2B6CB0', shine: '#DDEEFB' }, // sky blue
  { bg: '#E8F5ED', border: '#B7DFC5', text: '#276749', shine: '#D5EDDE' }, // mint green
  { bg: '#EDE8FA', border: '#CBBFF0', text: '#5E3FA3', shine: '#E0D8F7' }, // soft lavender
  { bg: '#FEF0E8', border: '#F5D0AC', text: '#B5631E', shine: '#FAE3CE' }, // warm peach
  { bg: '#FEF8E6', border: '#F0E1A6', text: '#957A0E', shine: '#FAF0CC' }, // golden butter
  { bg: '#FDEDF3', border: '#F0C0D8', text: '#A83264', shine: '#F9D9EA' }, // rose pink
];

// ─── Avatar map ───────────────────────────────────────────────────────────────

const AVATAR_MAP = {
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
};

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

  // The Progress Report is a teacher-facing surface, so it sits behind the
  // same parent gate the back button uses  -  the useGatedBack(action) form
  // TeacherReportScreen.js already uses for its own non-back actions.
  //
  // Both of these were REFERENCED below and declared nowhere, so evaluating
  // the top bar threw a ReferenceError and the chooser could not render.
  //
  // The destination is TeacherReport - the same route LetterHomeScreen's own
  // gated progress action uses, with the same { student, theme, originRoute }
  // params. Only the BUTTON'S LABEL changed in this phase; the screen behind
  // it is unchanged, and no second report screen was introduced.
  const {
    requestBack: requestTeacherReport,
    gateModal: teacherReportGateModal,
  } = useGatedBack(() => navigation.navigate('TeacherReport', {
    student,
    theme,
    originRoute: 'WordLetterSelect',
  }));

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
      <SafeAreaView style={styles.safe}>

        {/* ── Top bar: back + Rewards/Teacher buttons ─────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: 'rgba(255,255,255,0.28)' }]}
            onPress={requestBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <View style={styles.topActions}>
            <TouchableOpacity
              style={[styles.topOutlineBtn, { borderColor: theme.button, backgroundColor: theme.button + '14' }]}
              onPress={() => navigation.navigate('WordProgress', { student, theme })}
              accessibilityLabel="Word Progress"
            >
              <Ionicons name="ribbon-outline" size={14} color={theme.button} />
              <Text style={[styles.topOutlineBtnText, { color: theme.button }]}>Word Progress</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topFilledBtn, { backgroundColor: theme.button }]}
              onPress={requestTeacherReport}
              accessibilityLabel="Progress Report - needs a code"
            >
              <Ionicons name="document-text-outline" size={14} color={theme.buttonText} />
              <Text style={[styles.topFilledBtnText, { color: theme.buttonText }]}>Progress Report</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Header: avatar + title + progress pill ───────────────────── */}
        <View style={styles.header}>
          <Image
            source={AVATAR_MAP[student?.avatar_key]}
            style={styles.avatar}
            resizeMode="contain"
          />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.headingText }]}>Choose a Letter</Text>
            <Text style={[styles.subtitle, { color: theme.headingText + 'BB' }]}>
              Tap a letter to start practising words
            </Text>
          </View>
          <View style={[styles.progressPill, { backgroundColor: 'rgba(255,255,255,0.32)' }]}>
            <Text style={[styles.progressPillText, { color: theme.headingText }]}>{progressText}</Text>
          </View>
        </View>

        {/* ── Motivation card ──────────────────────────────────────────── */}
        <View style={[styles.motivationCard, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
          <Text style={[styles.motivationText, { color: theme.headingText }]}>
            Pick any letter to start practising words! ⭐
          </Text>
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
      {teacherReportGateModal}
    </LinearGradient>
  );
}

// ─── Letter card ──────────────────────────────────────────────────────────────

// Every letter is open — the grid has no locked state, so there is one card
// treatment and every card is tappable.
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

        {/* Stars row */}
        <View style={styles.starsRow}>
          {[0, 1, 2].map(i => (
            <Text key={i} style={styles.star}>{i < stars ? '⭐' : '☆'}</Text>
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

  // Top bar
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: IS_TABLET ? 24 : 16,
    paddingVertical:   IS_TABLET ? 12 : 8,
  },
  backBtn: {
    width:          IS_TABLET ? 44 : 38,
    height:         IS_TABLET ? 44 : 38,
    borderRadius:   IS_TABLET ? 22 : 19,
    alignItems:     'center',
    justifyContent: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap:           IS_TABLET ? 10 : 8,
    alignItems:    'center',
  },
  topOutlineBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    borderWidth:       1.5,
    borderRadius:      20,
    paddingHorizontal: IS_TABLET ? 14 : 10,
    paddingVertical:   IS_TABLET ? 7 : 5,
  },
  topOutlineBtnText: {
    fontSize:   IS_TABLET ? 13 : 11,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  topFilledBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    borderRadius:      20,
    paddingHorizontal: IS_TABLET ? 14 : 10,
    paddingVertical:   IS_TABLET ? 7 : 5,
  },
  topFilledBtnText: {
    fontSize:   IS_TABLET ? 13 : 11,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: IS_TABLET ? 24 : 16,
    paddingBottom:     IS_TABLET ? 14 : 10,
    gap:               IS_TABLET ? 14 : 10,
  },
  avatar: {
    width:  IS_TABLET ? 56 : 44,
    height: IS_TABLET ? 56 : 44,
  },
  headerText: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontSize:   IS_TABLET ? 22 : 18,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
  },
  subtitle: {
    fontSize:   IS_TABLET ? 13 : 11,
    fontWeight: '500',
    fontFamily: 'Nunito_600SemiBold',
  },
  progressPill: {
    borderRadius:      20,
    paddingHorizontal: IS_TABLET ? 12 : 9,
    paddingVertical:   IS_TABLET ? 5 : 4,
  },
  progressPillText: {
    fontSize:   IS_TABLET ? 12 : 10,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },

  // Motivation card
  motivationCard: {
    marginHorizontal:  IS_TABLET ? 24 : 16,
    marginBottom:      IS_TABLET ? 14 : 10,
    borderRadius:      14,
    paddingHorizontal: IS_TABLET ? 16 : 12,
    paddingVertical:   IS_TABLET ? 9 : 7,
  },
  motivationText: {
    fontSize:   IS_TABLET ? 14 : 12,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    textAlign:  'center',
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
    marginTop:     IS_TABLET ? 4 : 3,
    gap:           1,
  },
  star: {
    fontSize: IS_TABLET ? 11 : 9,
  },
});
