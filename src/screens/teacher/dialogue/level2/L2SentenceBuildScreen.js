/**
 * L2SentenceBuildScreen  (TASK-18 — Step 2 of Sentence Familiarisation Ladder)
 * The child taps shuffled word tiles to build the sentence in the correct order.
 * Tapping a placed tile returns it to the tray.
 * Wrong order on Confirm: incorrect tiles shake and return to the tray.
 *
 * Params: { student, sessionData, sentenceIndex }
 * Output: navigate('L2FillGap', { student, sessionData, sentenceIndex })
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

// Fisher-Yates shuffle (pure, no mutation of original)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns the initial shuffled tray order — guaranteed different from correct order
// when length > 1.
function initialShuffle(words) {
  if (words.length <= 1) return words.map((w, i) => ({ word: w, origIdx: i }));
  let order;
  do {
    order = shuffle(words.map((w, i) => ({ word: w, origIdx: i })));
  } while (order.every((item, i) => item.origIdx === i));
  return order;
}

export default function L2SentenceBuildScreen({ route, navigation }) {
  const { student, sessionData, sentenceIndex = 1 } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const sentence = (sessionData?.sentences ?? []).find((s) => s.index === sentenceIndex);
  const words    = sentence?.words ?? (sentence?.text?.split(' ') ?? []);

  // Tray: array of { word, origIdx } or null (when placed)
  const [tray,   setTray]   = useState(() => initialShuffle(words));
  // Slots: array of { word, origIdx } or null
  const [slots,  setSlots]  = useState(() => Array(words.length).fill(null));
  // Track which slot indices are wrong (for shake)
  const [wrongSlots, setWrongSlots] = useState([]);
  const shakeAnims = useRef(words.map(() => new Animated.Value(0))).current;

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []));

  // Re-init when sentenceIndex changes (shouldn't happen, but guard it)
  useEffect(() => {
    setTray(initialShuffle(words));
    setSlots(Array(words.length).fill(null));
    setWrongSlots([]);
  }, [sentenceIndex]);

  function placeTile(trayIdx) {
    const item = tray[trayIdx];
    if (!item) return; // already placed
    // Find first empty slot
    const firstEmpty = slots.findIndex((s) => s === null);
    if (firstEmpty === -1) return; // all filled already
    const newTray  = [...tray];
    const newSlots = [...slots];
    newTray[trayIdx]    = null;
    newSlots[firstEmpty] = item;
    setTray(newTray);
    setSlots(newSlots);
    setWrongSlots([]);
  }

  function returnTile(slotIdx) {
    const item = slots[slotIdx];
    if (!item) return;
    // Put back in its tray position
    const newTray  = [...tray];
    const newSlots = [...slots];
    newTray[item.origIdx] = item;
    newSlots[slotIdx]     = null;
    setTray(newTray);
    setSlots(newSlots);
    setWrongSlots([]);
  }

  function handleConfirm() {
    // Check order: slots[i].origIdx should equal i
    const allFilled = slots.every((s) => s !== null);
    if (!allFilled) return;

    const bad = slots
      .map((s, i) => ({ slotIdx: i, correct: s.origIdx === i }))
      .filter((x) => !x.correct)
      .map((x) => x.slotIdx);

    if (bad.length === 0) {
      // Correct!
      navigation.navigate('L2FillGap', { student, sessionData, sentenceIndex });
      return;
    }

    // Shake wrong tiles then return them to tray
    setWrongSlots(bad);
    const shakeSeq = bad.map((i) =>
      Animated.sequence([
        Animated.timing(shakeAnims[i], { toValue: 8,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnims[i], { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnims[i], { toValue: 6,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnims[i], { toValue: 0,  duration: 60, useNativeDriver: true }),
      ])
    );
    Animated.parallel(shakeSeq).start(() => {
      // Return wrong tiles to tray
      const newTray  = [...tray];
      const newSlots = [...slots];
      bad.forEach((i) => {
        const item = newSlots[i];
        if (item) {
          newTray[item.origIdx] = item;
          newSlots[i] = null;
        }
      });
      setTray(newTray);
      setSlots(newSlots);
      setWrongSlots([]);
    });
  }

  const allFilled = slots.every((s) => s !== null);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <View style={styles.stepBadge}>
            <Text style={[styles.stepLabel, { color: theme.button }]}>BUILD THE SENTENCE</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.cardOutline }]}>
            <View style={[styles.progressFill, { width: '50%', backgroundColor: theme.button }]} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Instruction */}
          <Text style={[styles.instruction, { color: theme.headingText }]}>
            Tap the words to build the sentence!
          </Text>

          {/* Slots row */}
          <View style={[styles.slotsContainer, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <View style={styles.slotsRow}>
              {slots.map((item, i) => {
                const isWrong = wrongSlots.includes(i);
                return (
                  <Animated.View
                    key={i}
                    style={{ transform: [{ translateX: shakeAnims[i] }] }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.slot,
                        item ? styles.slotFilled : styles.slotEmpty,
                        item && { backgroundColor: theme.button + '22', borderColor: theme.button },
                        isWrong && styles.slotWrong,
                      ]}
                      onPress={() => item && returnTile(i)}
                      activeOpacity={item ? 0.7 : 1}
                      accessibilityLabel={item ? `Return word ${item.word}` : 'Empty slot'}
                    >
                      {item ? (
                        <Text style={[styles.slotText, { color: theme.button }]}>{item.word}</Text>
                      ) : (
                        <View style={[styles.slotPlaceholder, { backgroundColor: theme.cardOutline }]} />
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* Tray row */}
          <View style={styles.trayLabel}>
            <Ionicons name="hand-left-outline" size={16} color={theme.headingText} />
            <Text style={[styles.trayLabelText, { color: theme.headingText }]}>Tap a word to place it</Text>
          </View>
          <View style={[styles.tray, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            {tray.map((item, i) => (
              item ? (
                <TouchableOpacity
                  key={i}
                  style={[styles.tile, { backgroundColor: theme.button, borderColor: theme.button }]}
                  onPress={() => placeTile(i)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Place word ${item.word}`}
                >
                  <Text style={[styles.tileText, { color: theme.buttonText }]}>{item.word}</Text>
                </TouchableOpacity>
              ) : (
                <View key={i} style={styles.tilePlaceholder} />
              )
            ))}
          </View>
        </View>

        {/* Confirm button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              { backgroundColor: allFilled ? theme.button : theme.cardOutline },
            ]}
            onPress={handleConfirm}
            disabled={!allFilled}
            activeOpacity={0.85}
            accessibilityLabel="Check my sentence"
          >
            <Ionicons name="checkmark-circle-outline" size={22} color={allFilled ? theme.buttonText : theme.headingText} />
            <Text style={[styles.confirmText, { color: allFilled ? theme.buttonText : theme.headingText }]}>
              Check!
            </Text>
          </TouchableOpacity>
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

  body: { flex: 1, paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.lg, gap: Layout.spacing.md },

  instruction: { fontSize: Layout.fontSize.md, fontWeight: '600', textAlign: 'center' },

  slotsContainer: {
    borderRadius: Layout.radius.lg ?? 16,
    borderWidth: 2,
    padding: Layout.spacing.md,
    minHeight: 80,
  },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  slot: {
    borderRadius: 10, borderWidth: 2,
    paddingVertical: 8, paddingHorizontal: 12,
    minWidth: 48, alignItems: 'center', justifyContent: 'center',
  },
  slotEmpty: { borderStyle: 'dashed', borderColor: '#AAAAAA', backgroundColor: 'transparent' },
  slotFilled: {},
  slotWrong: { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
  slotPlaceholder: { width: 32, height: 4, borderRadius: 2 },
  slotText: { fontSize: Layout.fontSize.md, fontWeight: '700' },

  trayLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.6 },
  trayLabelText: { fontSize: Layout.fontSize.xs, fontWeight: '600' },

  tray: {
    borderRadius: Layout.radius.lg ?? 16,
    borderWidth: 2,
    padding: Layout.spacing.md,
    minHeight: 80,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tile: {
    borderRadius: 10, borderWidth: 2,
    paddingVertical: 10, paddingHorizontal: 14,
    ...Layout.shadow?.sm,
  },
  tileText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  tilePlaceholder: { width: 56, height: 40 }, // ghost spacer

  footer: { paddingHorizontal: Layout.spacing.xl, paddingBottom: Layout.spacing.xl, alignItems: 'center' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full ?? 100,
    ...Layout.shadow?.md,
  },
  confirmText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
