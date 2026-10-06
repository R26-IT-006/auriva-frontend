/**
 * L2FillGapScreen  (TASK-18 — Step 3 of Sentence Familiarisation Ladder)
 * The sentence is shown with exactly one blank where the personalised value belongs.
 * Three options are offered: the CORRECT answer always comes from the DB questionnaire
 * value (sentence.dynamic_value), NOT hardcoded here. Two distractors: one from the
 * backend (sentence.distractor) and one from a frontend constant pool, both filtered
 * to never accidentally match the correct answer.
 *
 * Params: { student, sessionData, sentenceIndex }
 * Output: navigate('L2SentenceTeach', { student, sessionData, sentenceIndex, returnTo: 'L2SentencePath' })
 * (L2SentenceMatch — the old Step 4 — was removed; this screen advances
 * straight to L2SentenceTeach now.)
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { LinearGradient } from 'expo-linear-gradient';
import { rs, rf } from '../../../../utils/responsive';

// Sentence emojis matching L2SentencePathScreen STOPS
const SENTENCE_EMOJIS = { 1: '👤', 2: '🎂', 3: '🏠', 4: '⭐', 5: '🎨' };

// Show the matching waving character instead of the generic emoji on the
// two sentences that are actually about a person's identity:
// self_introduction sentence 1 "My name is ___" / sentence 4 "I am a
// boy/girl" (both about the child, sessionData.gender); describe_friend
// sentence 1 "My friend's name is ___" / sentence 2 "My friend is a
// boy/girl" (both about the friend, sessionData.friend_gender).
const CHARACTER_IMAGES = {
  boy:  require('../../../../../assets/avatar-images/Saman_Waving.png'),
  girl: require('../../../../../assets/avatar-images/Anjalie_Waving.png'),
};
const TOPIC_CHARACTER_SENTENCES = {
  self_introduction: { indices: [1, 4], genderField: 'gender' },
  describe_friend:   { indices: [1, 2], genderField: 'friend_gender' },
};
function getCharacterImage(sessionData, sentenceIndex) {
  const cfg = TOPIC_CHARACTER_SENTENCES[sessionData?.topic];
  if (!cfg || !cfg.indices.includes(sentenceIndex)) return null;
  return CHARACTER_IMAGES[sessionData?.[cfg.genderField]] ?? null;
}

/**
 * Second distractor pool — one entry per sentence index (1-indexed).
 * These are static distractors that make contextual sense as WRONG options
 * alongside the DB distractor.  Filtered at render time if they accidentally
 * match dynamic_value (shouldn't happen for the designed closed sets, but
 * we guard defensively).
 * - S1 (name)     : another common SL name, different from the DB distractor
 * - S2 (age)      : '3'  — always far from school-age children
 * - S3 (hometown) : 'Colombo' — most-recognised Sri Lankan city, likely differs from distractor
 * - S4 (gender)   : 'teacher' — clearly wrong in "I am a ___", aids discrimination
 * - S5 (activity) : 'Sleeping' — not in the ALL_ACTIVITIES enum, always safe
 */
const POOL_DISTRACTORS = ['Saman', '3', 'Colombo', 'teacher', 'Sleeping'];

/**
 * Build the blank sentence by replacing the first occurrence of dynamic_value
 * in the sentence text with three underscores.
 * Falls back to appending "___" if the value isn't found (shouldn't happen in
 * normal questionnaire data).
 */
function buildBlankSentence(text, dynamicValue) {
  const dv = String(dynamicValue ?? '');
  const idx = text.indexOf(dv);
  if (idx === -1) return text + ' ___';
  return text.slice(0, idx) + '___' + text.slice(idx + dv.length);
}

/** Fisher-Yates shuffle (pure). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build the three option strings; returns in shuffled order. */
function buildOptions(sentence, sentenceIndex) {
  const correct = String(sentence.dynamic_value ?? '');
  const dist1   = String(sentence.distractor  ?? '');

  // Pick pool distractor, fall back to a safe string if it clashes
  let pool = POOL_DISTRACTORS[(sentenceIndex - 1) % POOL_DISTRACTORS.length];
  if (pool === correct || pool === dist1) {
    // Fallback: use the distractor from the next sentence if available, otherwise use 'Other'
    pool = sentenceIndex === 2 ? '15' : 'Matara';
    if (pool === correct || pool === dist1) pool = 'Other';
  }

  // Guard against a sentence with a missing/empty distractor (or a distractor
  // that happens to collide with the pool value) producing duplicate/blank
  // option tiles — every rendered option must be a distinct, non-empty
  // string. `correct` is kept even if empty so the caller's missing-data
  // check (below) can still detect and skip an unscoreable exercise.
  const seen = new Set([correct].filter(Boolean));
  const options = [correct];
  for (const candidate of [dist1, pool, ...POOL_DISTRACTORS]) {
    if (options.length >= 3) break;
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      options.push(candidate);
    }
  }

  return shuffle(options);
}

export default function L2FillGapScreen({ route, navigation }) {
  const { student, sessionData, sentenceIndex = 1 } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const sentence    = (sessionData?.sentences ?? []).find((s) => s.index === sentenceIndex);
  const correct     = String(sentence?.dynamic_value ?? '');
  const blankText   = buildBlankSentence(sentence?.text ?? '___', correct);
  const options     = useRef(buildOptions(sentence ?? {}, sentenceIndex)).current;
  const emoji       = SENTENCE_EMOJIS[sentenceIndex] ?? '📖';
  const characterImage = getCharacterImage(sessionData, sentenceIndex);

  const [selected,  setSelected]  = useState(null);   // null | 'correct' | 'wrong'
  const [chosenOpt, setChosenOpt] = useState(null);   // which option string was tapped
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []));

  // Guard: without a real dynamic_value this exercise has no correct answer
  // to award, and every option tile would render blank — skip straight
  // through instead of showing an unsolvable puzzle (same fallback pattern
  // Cat3Phase2NonVerbalScreen.js uses when its own data is missing).
  useEffect(() => {
    if (!correct) {
      navigation.navigate('L2SentenceTeach', { student, sessionData, sentenceIndex, returnTo: 'L2SentencePath' });
    }
  }, []);

  function handleOption(opt) {
    if (selected === 'correct') return; // already done
    setChosenOpt(opt);
    if (opt === correct) {
      setSelected('correct');
      // Short pause, then advance
      setTimeout(() => {
        navigation.navigate('L2SentenceTeach', { student, sessionData, sentenceIndex, returnTo: 'L2SentencePath' });
      }, 900);
    } else {
      setSelected('wrong');
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: true }),
      ]).start(() => {
        setSelected(null);
        setChosenOpt(null);
      });
    }
  }

  if (!correct) return null; // navigating away — see the guard effect above

  // Split blankText on '___' for styled rendering
  const parts = blankText.split('___');

  const filledWord = selected === 'correct' ? chosenOpt : null;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}>
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <View style={styles.stepBadge}>
            <Text style={[styles.stepLabel, { color: theme.button }]}>FILL IN THE BLANK</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.cardOutline }]}>
            <View style={[styles.progressFill, { width: '100%', backgroundColor: theme.button }]} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Character / emoji — overlaps the top of the card */}
          {characterImage ? (
            <Image source={characterImage} style={styles.characterImg} resizeMode="contain" />
          ) : (
            <Text style={styles.emojiLarge}>{emoji}</Text>
          )}

          {/* White activity card framed in the theme outline, like the other modules. */}
          <View style={[styles.card, { borderColor: theme.cardOutline }]}>

            {/* Sentence with a real blank box */}
            <View style={styles.sentenceRow}>
              {parts[0] ? (
                <Text style={[styles.sentenceText, { color: theme.headingText }]}>{parts[0].trim()}</Text>
              ) : null}
              <View
                style={[
                  styles.blankBox,
                  { borderColor: filledWord ? '#22C55E' : theme.button },
                  filledWord ? styles.blankBoxFilled : { backgroundColor: theme.cardOutline + '18' },
                ]}
              >
                <Text style={[styles.blankText, { color: filledWord ? '#16A34A' : theme.button }]}>
                  {filledWord ?? '?'}
                </Text>
              </View>
              {parts[1]?.trim() ? (
                <Text
                  style={[
                    styles.sentenceText,
                    { color: theme.headingText },
                    // A trailing "." / "!" hugs the blank instead of floating a gap away.
                    /^[.,!?]/.test(parts[1].trim()) && { marginLeft: -8 },
                  ]}
                >
                  {parts[1].trim()}
                </Text>
              ) : null}
            </View>

            {/* Instruction */}
            <View style={styles.hintPill}>
              <Ionicons name="hand-left-outline" size={15} color={theme.headingText} />
              <Text style={[styles.instruction, { color: theme.headingText }]}>
                Tap the correct word to fill the blank!
              </Text>
            </View>

            {/* Options */}
            <Animated.View
              style={[
                styles.optionsRow,
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              {options.map((opt, idx) => {
                const isSelected = chosenOpt === opt;
                const isCorrect  = selected === 'correct' && isSelected;
                const isWrong    = selected === 'wrong'   && isSelected;
                return (
                  <TouchableOpacity
                    key={`${opt}-${idx}`}
                    style={[
                      styles.option,
                      { borderColor: theme.cardOutline },
                      isCorrect && styles.optionCorrect,
                      isWrong   && styles.optionWrong,
                    ]}
                    onPress={() => handleOption(opt)}
                    activeOpacity={0.8}
                    accessibilityLabel={`Option: ${opt}`}
                  >
                    {isCorrect && (
                      <Ionicons name="checkmark-circle" size={24} color="#22C55E" style={{ marginRight: 6 }} />
                    )}
                    {isWrong && (
                      <Ionicons name="close-circle" size={24} color="#EF4444" style={{ marginRight: 6 }} />
                    )}
                    <Text style={[
                      styles.optionText,
                      { color: theme.headingText },
                      isCorrect && { color: '#16A34A' },
                      isWrong   && { color: '#EF4444' },
                    ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          </View>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },

  // Decorative background shapes (same as the other module screens).
  blob: { position: 'absolute', borderRadius: rs(999), opacity: 0.08 },
  blobTopRight:   { width: rs(220), height: rs(220), top: rs(-60), right: rs(-60) },
  blobBottomLeft: { width: rs(260), height: rs(260), bottom: rs(-80), left: rs(-80) },

  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
    alignItems: 'center',
    gap: Layout.spacing.xs,
  },
  stepBadge: { alignItems: 'center' },
  stepLabel: { fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_800ExtraBold', letterSpacing: 1.2, textTransform: 'uppercase' },
  progressTrack: { height: rs(6), width: '80%', borderRadius: rs(3), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: rs(3) },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl, paddingBottom: Layout.spacing.lg,
  },

  emojiLarge: { fontSize: rf(60), marginBottom: rs(-18), zIndex: 2 },
  // Sits on the top edge of the card, like the avatar on the completion screens.
  characterImg: { width: rs(190), height: rs(220), marginBottom: rs(-34), zIndex: 2 },

  card: {
    width: '100%',
    maxWidth: rs(680),
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: rs(28),
    borderWidth: 3,
    paddingHorizontal: rs(32),
    paddingTop: rs(44),
    paddingBottom: rs(30),
    gap: rs(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },

  sentenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(12),
  },
  sentenceText: {
    fontSize: rf(30),
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
  },
  blankBox: {
    minWidth: rs(130),
    height: rs(56),
    paddingHorizontal: rs(16),
    borderRadius: rs(14),
    borderWidth: 2.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankBoxFilled: { borderStyle: 'solid', backgroundColor: '#DCFCE7' },
  blankText: { fontSize: rf(28), fontFamily: 'DMSans_900Black' },

  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    opacity: 0.65,
  },
  instruction: { fontSize: rf(14), fontFamily: 'DMSans_600SemiBold', textAlign: 'center' },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: rs(16) },
  // Raised 3D answer tiles, like the buttons in the other modules.
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: rs(16), borderWidth: 2, borderBottomWidth: 5,
    paddingVertical: rs(16), paddingHorizontal: rs(26),
    minWidth: rs(140),
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  optionCorrect: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  optionWrong:   { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  optionText: { fontSize: rf(22), fontFamily: 'DMSans_800ExtraBold' },
});
