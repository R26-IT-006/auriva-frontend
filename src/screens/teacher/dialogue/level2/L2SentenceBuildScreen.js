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
import { LinearGradient } from 'expo-linear-gradient';
import { rs, rf } from '../../../../utils/responsive';

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
            <Text style={[styles.stepLabel, { color: theme.button }]}>BUILD THE SENTENCE</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.cardOutline }]}>
            <View style={[styles.progressFill, { width: '67%', backgroundColor: theme.button }]} />
          </View>
        </View>

        <View style={styles.body}>
          {/* One white activity card framed in the theme outline, like the other modules. */}
          <View style={[styles.card, { borderColor: theme.cardOutline }]}>
            <Text style={[styles.instruction, { color: theme.headingText }]}>
              Tap the words to build the sentence!
            </Text>

            {/* Sentence slots */}
            <View style={[styles.slotsZone, { borderColor: theme.cardOutline, backgroundColor: theme.cardOutline + '14' }]}>
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
                          item ? { borderColor: theme.button } : { borderColor: theme.cardOutline },
                          isWrong && styles.slotWrong,
                        ]}
                        onPress={() => item && returnTile(i)}
                        activeOpacity={item ? 0.7 : 1}
                        accessibilityLabel={item ? `Return word ${item.word}` : 'Empty slot'}
                      >
                        {item ? (
                          <Text style={[styles.slotText, { color: theme.button }]}>{item.word}</Text>
                        ) : (
                          <Text style={[styles.slotNumber, { color: theme.cardOutline }]}>{i + 1}</Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>

            {/* Word bank */}
            <View style={styles.trayLabel}>
              <Ionicons name="hand-left-outline" size={16} color={theme.headingText} />
              <Text style={[styles.trayLabelText, { color: theme.headingText }]}>Tap a word to place it</Text>
            </View>
            <View style={styles.tray}>
              {tray.map((item, i) => (
                item ? (
                  <TouchableOpacity
                    key={i}
                    style={[styles.tile, { backgroundColor: theme.button }]}
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
        </View>

        {/* Confirm button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              { backgroundColor: theme.button },
              !allFilled && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!allFilled}
            activeOpacity={0.85}
            accessibilityLabel="Check my sentence"
          >
            <Ionicons name="checkmark-circle" size={24} color={theme.buttonText} />
            <Text style={[styles.confirmText, { color: theme.buttonText }]}>
              Check!
            </Text>
          </TouchableOpacity>
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

  body: { flex: 1, justifyContent: 'center', paddingHorizontal: Layout.spacing.lg },

  card: {
    width: '100%',
    maxWidth: rs(760),
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: rs(28),
    borderWidth: 3,
    paddingHorizontal: rs(32),
    paddingTop: rs(26),
    paddingBottom: rs(30),
    gap: rs(18),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },

  instruction: { fontSize: rf(24), fontFamily: 'DMSans_800ExtraBold', textAlign: 'center' },

  slotsZone: {
    borderRadius: rs(20),
    borderWidth: 2,
    borderStyle: 'dashed',
    paddingVertical: rs(20),
    paddingHorizontal: rs(16),
  },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(12), justifyContent: 'center' },
  slot: {
    borderRadius: rs(14), borderWidth: 2,
    minHeight: rs(58), minWidth: rs(90),
    paddingHorizontal: rs(16),
    alignItems: 'center', justifyContent: 'center',
  },
  slotEmpty: { borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  slotFilled: { backgroundColor: '#FFFFFF', borderBottomWidth: 5 },
  slotWrong: { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
  slotNumber: { fontSize: rf(18), fontFamily: 'DMSans_800ExtraBold' },
  slotText: { fontSize: rf(24), fontFamily: 'DMSans_800ExtraBold' },

  trayLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6), opacity: 0.6, marginTop: rs(4) },
  trayLabelText: { fontSize: rf(14), fontFamily: 'DMSans_600SemiBold' },

  tray: {
    minHeight: rs(64),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Raised 3D word tiles, like the buttons in the other modules.
  tile: {
    minHeight: rs(58),
    minWidth: rs(90),
    paddingHorizontal: rs(20),
    borderRadius: rs(14),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  tileText: { fontSize: rf(24), fontFamily: 'DMSans_800ExtraBold' },
  tilePlaceholder: { width: rs(90), height: rs(58) }, // ghost spacer

  footer: { paddingHorizontal: Layout.spacing.xl, paddingBottom: Layout.spacing.xl, alignItems: 'center' },
  // Raised 3D button, like the ones used in the other modules.
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(10),
    minWidth: rs(240), paddingHorizontal: rs(40), paddingVertical: rs(16),
    borderRadius: rs(16),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: rf(20), fontFamily: 'DMSans_800ExtraBold' },
});
