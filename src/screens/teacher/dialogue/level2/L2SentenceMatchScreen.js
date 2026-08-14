/**
 * L2SentenceMatchScreen  (TASK-18 — Step 4 of Sentence Familiarisation Ladder)
 * Tap-to-match activity: three sentence cards on the left, three emoji cards on the
 * right (both sides shuffled independently). Tap a sentence to select it, then tap
 * its matching emoji to lock the pair. All three pairs matched → advance to
 * L2SentenceTeach.
 *
 * Uses three sentences: the current sentenceIndex + up to two others, so that
 * the child is also reviewing neighbouring sentences. Falls back to duplicates
 * when fewer than 3 sentences are available (shouldn't happen for
 * self_introduction which always has 5).
 *
 * Params: { student, sessionData, sentenceIndex }
 * Output: navigate('L2SentenceTeach', { student, sessionData, sentenceIndex, returnTo: 'L2SentencePath' })
 */
import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

// Emoji keyed by sentence index
const SENTENCE_EMOJIS = { 1: '👤', 2: '🎂', 3: '🏠', 4: '⭐', 5: '🎨' };

/** Fisher-Yates shuffle (pure). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick the 3 sentences to match. Always includes the current one; the other
 * two are drawn from the session sentences in round-robin fashion.
 */
function pickThree(allSentences, currentIndex) {
  const current = allSentences.find((s) => s.index === currentIndex);
  const others  = allSentences.filter((s) => s.index !== currentIndex);
  const picks   = [current, ...others.slice(0, 2)].filter(Boolean);
  // If fewer than 3 sentences exist, pad by repeating
  while (picks.length < 3) picks.push(picks[picks.length - 1]);
  return picks;
}

export default function L2SentenceMatchScreen({ route, navigation }) {
  const { student, sessionData, sentenceIndex = 1 } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const allSentences = sessionData?.sentences ?? [];
  const pickedRef    = useRef(pickThree(allSentences, sentenceIndex));
  const picked       = pickedRef.current;

  // Left column: sentences in shuffled order
  const leftRef  = useRef(shuffle(picked.map((s) => s.index)));
  const left     = leftRef.current;

  // Right column: emojis in a DIFFERENT shuffled order
  // Re-shuffle until different from left (guaranteed by the while loop)
  const rightRef = useRef(() => {
    let r;
    do { r = shuffle(picked.map((s) => s.index)); }
    while (r.every((v, i) => v === left[i]));
    return r;
  });
  const right = rightRef.current instanceof Function
    ? (rightRef.current = rightRef.current())
    : rightRef.current;

  // selectedLeft: sentence index currently highlighted (null if none)
  const [selectedLeft,  setSelectedLeft]  = useState(null);
  // matchedPairs: Set of sentence indices that have been matched
  const [matchedPairs,  setMatchedPairs]  = useState(new Set());
  // wrongFlash: index to flash red (null if none)
  const [wrongFlash,    setWrongFlash]    = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []));

  function handleLeftTap(idx) {
    if (matchedPairs.has(idx)) return;
    setSelectedLeft(idx === selectedLeft ? null : idx);
  }

  function handleRightTap(idx) {
    if (matchedPairs.has(idx)) return;
    if (selectedLeft === null) return; // nothing selected on left

    if (selectedLeft === idx) {
      // Correct match!
      const newSet = new Set(matchedPairs);
      newSet.add(idx);
      setMatchedPairs(newSet);
      setSelectedLeft(null);

      if (newSet.size === 3) {
        // All matched — brief pause then navigate to teach screen
        setTimeout(() => {
          navigation.navigate('L2SentenceTeach', {
            student,
            sessionData,
            sentenceIndex,
            returnTo: 'L2SentencePath',
          });
        }, 700);
      }
    } else {
      // Wrong — flash the selected right card
      setWrongFlash(idx);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 7,   duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
      ]).start(() => {
        setWrongFlash(null);
        setSelectedLeft(null);
      });
    }
  }

  const allMatched = matchedPairs.size === 3;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <View style={styles.stepBadge}>
            <Text style={[styles.stepLabel, { color: theme.button }]}>MATCH THE SENTENCES</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.cardOutline }]}>
            <View style={[styles.progressFill, { width: '100%', backgroundColor: theme.button }]} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Instruction */}
          <Text style={[styles.instruction, { color: theme.headingText }]}>
            Tap a sentence, then tap the matching picture!
          </Text>

          {/* Match grid */}
          <View style={styles.grid}>
            {/* Left column: sentence texts */}
            <View style={styles.column}>
              {left.map((idx) => {
                const s       = picked.find((p) => p.index === idx);
                const matched = matchedPairs.has(idx);
                const active  = selectedLeft === idx;
                return (
                  <TouchableOpacity
                    key={`left-${idx}`}
                    style={[
                      styles.sentCard,
                      { borderColor: theme.cardOutline, backgroundColor: theme.cardSurface },
                      active   && { borderColor: theme.button, backgroundColor: theme.button + '22' },
                      matched  && styles.matchedCard,
                    ]}
                    onPress={() => !matched && handleLeftTap(idx)}
                    activeOpacity={0.8}
                    accessibilityLabel={`Sentence: ${s?.text}`}
                  >
                    {matched && <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={styles.matchedIcon} />}
                    <Text
                      style={[
                        styles.sentText,
                        { color: matched ? '#22C55E' : theme.headingText },
                        active && { color: theme.button, fontWeight: '800' },
                      ]}
                      numberOfLines={3}
                    >
                      {s?.text ?? ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Connector arrows area */}
            <View style={styles.connectors}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.connectorRow}>
                  <Ionicons name="arrow-forward" size={18} color={theme.cardOutline} />
                </View>
              ))}
            </View>

            {/* Right column: emojis */}
            <View style={styles.column}>
              {right.map((idx) => {
                const matched  = matchedPairs.has(idx);
                const isWrong  = wrongFlash === idx;
                const emoji    = SENTENCE_EMOJIS[idx] ?? '📖';
                return (
                  <Animated.View
                    key={`right-${idx}`}
                    style={isWrong ? { transform: [{ translateX: shakeAnim }] } : undefined}
                  >
                    <TouchableOpacity
                      style={[
                        styles.emojiCard,
                        { borderColor: theme.cardOutline, backgroundColor: theme.cardSurface },
                        isWrong  && styles.wrongCard,
                        matched  && styles.matchedCard,
                      ]}
                      onPress={() => !matched && handleRightTap(idx)}
                      activeOpacity={0.8}
                      accessibilityLabel={`Picture ${emoji}`}
                    >
                      <Text style={styles.emojiMedium}>{emoji}</Text>
                      {matched && <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={styles.matchedIcon} />}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* Completion message */}
          {allMatched && (
            <View style={[styles.successBanner, { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}>
              <Ionicons name="star" size={22} color="#F59E0B" />
              <Text style={styles.successText}>Great job! Getting ready to learn…</Text>
            </View>
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
    alignItems: 'center',
    gap: Layout.spacing.xs,
  },
  stepBadge: { alignItems: 'center' },
  stepLabel: { fontSize: Layout.fontSize.xs, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  progressTrack: { height: 6, width: '80%', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Layout.spacing.md, gap: Layout.spacing.lg,
  },

  instruction: { fontSize: Layout.fontSize.md, fontWeight: '600', textAlign: 'center', opacity: 0.8 },

  grid: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%' },

  column: { flex: 1, gap: 12 },

  connectors: { width: 30, gap: 12 },
  connectorRow: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sentCard: {
    borderRadius: 12, borderWidth: 2,
    padding: 10, minHeight: 70,
    justifyContent: 'center',
    ...Layout.shadow?.sm,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  sentText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  emojiCard: {
    borderRadius: 12, borderWidth: 2,
    padding: 12, minHeight: 70,
    alignItems: 'center', justifyContent: 'center',
    ...Layout.shadow?.sm,
  },
  emojiMedium: { fontSize: 36 },

  matchedCard: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  wrongCard:   { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  matchedIcon: { marginRight: 4 },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 2,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  successText: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#166534' },
});
