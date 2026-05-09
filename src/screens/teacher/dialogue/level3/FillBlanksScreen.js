import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, BackHandler, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getMockConversation, BLANK_CONFIG, WORD_TILES } from '../../../../data/mockConversation';
import { ChatBubble, PauseModal, ANJALIE_IMAGE } from './_components';

const INITIAL_PLACED = { T1: null, T2: null, T3: null, T4: null, T5: null };
const INITIAL_RESULTS = { T1: null, T2: null, T3: null, T4: null, T5: null };

// After this many ms with no placement, show hint
const HINT_TRIGGER_MS  = 20000;
// How long the hint stays visible
const HINT_DURATION_MS = 5000;

export default function FillBlanksScreen({ route, navigation }) {
  const { student, attempt = 1 } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const avatarKey  = student?.avatar_key ?? 'lily';
  const avatarName = avatarKey.charAt(0).toUpperCase() + avatarKey.slice(1);

  const conversation = getMockConversation(avatarKey, avatarName);

  const [placedWords,   setPlacedWords]   = useState({ ...INITIAL_PLACED });
  const [selectedTile,  setSelectedTile]  = useState(null);
  const [checkResults,  setCheckResults]  = useState({ ...INITIAL_RESULTS });
  const [paused,        setPaused]        = useState(false);
  const [allCorrect,    setAllCorrect]    = useState(false);

  // Hint state: which blank + which word is being hinted right now
  const [hint, setHint] = useState({ visible: false, turnId: null, word: null });

  const placedWordsRef   = useRef({ ...INITIAL_PLACED });
  const hintTriggerRef   = useRef(null);
  const hintHideRef      = useRef(null);
  const hintBlink        = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('L3Demo', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  // Keep placedWordsRef in sync
  useEffect(() => {
    placedWordsRef.current = placedWords;
  }, [placedWords]);

  // Hint cycle: fires HINT_TRIGGER_MS after mount and after each hide
  useEffect(() => {
    scheduleHintTrigger();
    return () => {
      clearTimeout(hintTriggerRef.current);
      clearTimeout(hintHideRef.current);
    };
  }, []);

  function scheduleHintTrigger() {
    clearTimeout(hintTriggerRef.current);
    hintTriggerRef.current = setTimeout(showNextHint, HINT_TRIGGER_MS);
  }

  function showNextHint() {
    const pw = placedWordsRef.current;
    // Find first unfilled blank
    const targetId = Object.keys(BLANK_CONFIG).find((id) => pw[id] === null);
    if (!targetId) return; // all filled — no hint needed

    const word = BLANK_CONFIG[targetId].blankWord;
    setHint({ visible: true, turnId: targetId, word });

    // Blink animation for the hint card
    Animated.loop(
      Animated.sequence([
        Animated.timing(hintBlink, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(hintBlink, { toValue: 0.4, duration: 400, useNativeDriver: true }),
      ]),
      { iterations: 6 }
    ).start();

    // Hide after HINT_DURATION_MS
    hintHideRef.current = setTimeout(() => {
      setHint({ visible: false, turnId: null, word: null });
      hintBlink.setValue(0);
      // Schedule next hint cycle
      scheduleHintTrigger();
    }, HINT_DURATION_MS);
  }

  // Reset hint timer on any interaction
  function resetHintTimer() {
    setHint({ visible: false, turnId: null, word: null });
    hintBlink.setValue(0);
    clearTimeout(hintHideRef.current);
    scheduleHintTrigger();
  }

  function handleTilePress(word) {
    resetHintTimer();
    setSelectedTile((prev) => (prev === word ? null : word));
  }

  function handleBlankPress(turnId) {
    if (!selectedTile) return;
    if (placedWords[turnId] !== null) return;
    resetHintTimer();
    setPlacedWords((prev) => ({ ...prev, [turnId]: selectedTile }));
    setCheckResults((prev) => ({ ...prev, [turnId]: null }));
    setSelectedTile(null);
  }

  function clearBlank(turnId) {
    resetHintTimer();
    setPlacedWords((prev)  => ({ ...prev, [turnId]: null }));
    setCheckResults((prev) => ({ ...prev, [turnId]: null }));
  }

  const allFilled = Object.values(placedWords).every((v) => v !== null);

  function handleCheck() {
    const results = {};
    let wrongCount = 0;
    Object.entries(BLANK_CONFIG).forEach(([id, cfg]) => {
      const placed  = placedWords[id];
      const correct = placed?.toLowerCase() === cfg.blankWord.toLowerCase();
      results[id]   = correct ? 'correct' : 'incorrect';
      if (!correct) wrongCount++;
    });
    setCheckResults(results);

    // Return wrong tiles to panel
    const newPlaced = { ...placedWords };
    Object.entries(results).forEach(([id, res]) => {
      if (res === 'incorrect') newPlaced[id] = null;
    });
    setPlacedWords(newPlaced);

    if (wrongCount === 0) {
      setAllCorrect(true);
      setTimeout(() => {
        navigation.navigate('L3RepeatAudio', { student, pass: 1 });
      }, 1500);
      return;
    }

    if (wrongCount > 3) {
      if (attempt === 1) {
        setTimeout(() => navigation.navigate('L3Demo', { student }), 800);
      } else {
        navigation.navigate('L3RepeatAudio', { student, pass: 1, flaggedWords: true });
      }
    }
    // 1-3 wrong: wrong tiles returned, child retries
  }

  function renderAnjalieBlankBubble(turn) {
    const cfg      = BLANK_CONFIG[turn.id];
    const placed   = placedWords[turn.id];
    const result   = checkResults[turn.id];
    const isHinted = hint.visible && hint.turnId === turn.id;
    const canPlace = selectedTile !== null && placed === null;

    // Resolve {name} placeholder in after-text
    const afterText = cfg.after.replace('{name}', avatarName);

    return (
      <View style={styles.bubbleRow} key={turn.id + '-anjalie'}>
        <Image source={ANJALIE_IMAGE} style={styles.thumb} />

        <View style={styles.anjalieBubble}>
          <View style={styles.inlineText}>
            {cfg.before ? <Text style={styles.bubbleText}>{cfg.before}</Text> : null}

            {/* Blank / filled slot */}
            {placed !== null ? (
              // Filled
              <View style={[
                styles.filledSlot,
                result === 'correct'   ? styles.slotCorrect   :
                result === 'incorrect' ? styles.slotIncorrect : styles.slotNeutral,
              ]}>
                <Text style={styles.filledText}>{placed}</Text>
                {!allCorrect && result !== 'correct' && (
                  <TouchableOpacity onPress={() => clearBlank(turn.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#666" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                )}
                {result === 'correct' && (
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" style={{ marginLeft: 2 }} />
                )}
              </View>
            ) : (
              // Empty — always tappable
              <TouchableOpacity
                onPress={() => handleBlankPress(turn.id)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                activeOpacity={canPlace ? 0.6 : 0.9}
                style={[
                  styles.emptySlot,
                  canPlace  ? styles.emptySlotReady   : styles.emptySlotIdle,
                  isHinted  ? styles.emptySlotHinted  : null,
                ]}
              >
                <Text style={[styles.blankDashes, canPlace && styles.blankDashesReady]}>
                  _ _ _ _ _
                </Text>
              </TouchableOpacity>
            )}

            {afterText ? <Text style={styles.bubbleText}>{afterText}</Text> : null}
          </View>

          {result === 'incorrect' && (
            <Text style={styles.incorrectHint}>Try again!</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PauseModal
          visible={paused}
          onResume={() => setPaused(false)}
          onExit={() => navigation.navigate('DialogueLanding', { student })}
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.cardOutline }]}
            onPress={() => navigation.navigate('L3Demo', { student })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.screenTitle, { color: theme.headingText }]}>
              Fill in the blanks with the given words
            </Text>
            <Text style={[styles.screenTitleSinhala, { color: theme.headingText }]}>
              දෙනු ලබන වචන හිස් ස්ථාන පිරවීමට භාවිතා කරන්න
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.cardOutline }]}
            onPress={() => setPaused(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pause" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Instructions banner */}
        {selectedTile ? (
          <View style={[styles.instructionBanner, { borderColor: theme.button }]}>
            <Text style={[styles.instructionText, { color: theme.headingText }]}>
              Now tap a blank  <Text style={{ fontWeight: '800' }}>_ _ _ _ _</Text>  to place "{selectedTile}"
            </Text>
            <Text style={[styles.instructionSinhala, { color: theme.headingText }]}>
              දැන් හිස් ස්ථානය ස්පර්ශ කර '{selectedTile}' තබන්න
            </Text>
          </View>
        ) : (
          <View style={[styles.instructionBanner, { borderColor: theme.cardOutline, backgroundColor: 'rgba(255,255,255,0.5)' }]}>
            <Text style={[styles.instructionText, { color: theme.headingText, opacity: 0.65 }]}>
              Tap a word below, then tap a blank in the chat to fill it in
            </Text>
            <Text style={[styles.instructionSinhala, { color: theme.headingText }]}>
              පහළ ඇති වචනයක් ස්පර්ශ කර, සංවාදයේ හිස් ස්ථානය ස්පර්ශ කරන්න
            </Text>
          </View>
        )}

        {/* Floating hint card */}
        {hint.visible && (
          <Animated.View style={[styles.hintCard, { opacity: hintBlink, borderColor: theme.button }]}>
            <Ionicons name="bulb-outline" size={18} color="#7A5800" style={{ marginRight: 6, flexShrink: 0 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hintText}>
                Hint: try <Text style={styles.hintWord}>"{hint.word}"</Text> for the highlighted blank
              </Text>
              <Text style={styles.hintTextSinhala}>
                ඉඟිය: උද්දීපිත හිස් ස්ථානය සඳහා '<Text style={styles.hintWord}>{hint.word}</Text>' උත්සාහ කරන්න
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Chat with blanks */}
        <ScrollView
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {conversation.map((turn) => (
            <View key={turn.id}>
              <ChatBubble
                side="left"
                text={turn.avatarText}
                avatarKey={avatarKey}
                image={turn.image}
              />
              {renderAnjalieBlankBubble(turn)}
            </View>
          ))}

          {allCorrect && (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={28} color="#2E7D32" />
              <Text style={styles.successText}>All correct! Well done!</Text>
            </View>
          )}
        </ScrollView>

        {/* Word tile panel */}
        <View style={[styles.tilePanel, { backgroundColor: theme.cardSurface }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tileRow}
            keyboardShouldPersistTaps="always"
          >
            {WORD_TILES.map((word) => {
              const isPlaced   = Object.values(placedWords).includes(word);
              const isSelected = selectedTile === word;
              // Highlight the hinted tile
              const isHintedTile = hint.visible && hint.word === word && !isPlaced;

              return (
                <TouchableOpacity
                  key={word}
                  style={[
                    styles.tile,
                    { borderColor: isHintedTile ? '#FF9800' : theme.button },
                    isPlaced    ? styles.tilePlaced   : null,
                    isSelected  ? styles.tileSelected : null,
                    isHintedTile ? styles.tileHinted  : null,
                  ]}
                  onPress={() => !isPlaced && handleTilePress(word)}
                  activeOpacity={isPlaced ? 1 : 0.72}
                  disabled={isPlaced}
                >
                  <Text style={[
                    styles.tileText,
                    { color: theme.headingText },
                    isPlaced    ? styles.tilePlacedText   : null,
                    isSelected  ? styles.tileSelectedText : null,
                    isHintedTile ? styles.tileHintedText  : null,
                  ]}>
                    {word}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Check button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.checkBtn,
              { backgroundColor: allFilled && !allCorrect ? theme.button : '#BDBDBD' },
            ]}
            onPress={handleCheck}
            disabled={!allFilled || allCorrect}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.checkBtnText}>Check</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   Layout.spacing.sm,
    gap: Layout.spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  screenTitle: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenTitleSinhala: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 2,
  },

  instructionBanner: {
    marginHorizontal: Layout.spacing.md,
    marginBottom: 6,
    borderRadius: Layout.radius.md,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  instructionSinhala: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.72,
    marginTop: 3,
  },

  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    borderWidth: 2,
    borderRadius: Layout.radius.lg,
    marginHorizontal: Layout.spacing.md,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hintText: {
    fontSize: Layout.fontSize.sm,
    color: '#7A5800',
    fontWeight: '600',
  },
  hintTextSinhala: {
    fontSize: Layout.fontSize.xs,
    color: '#7A5800',
    fontWeight: '500',
    marginTop: 3,
    opacity: 0.8,
  },
  hintWord: {
    fontWeight: '900',
    color: '#E65100',
  },

  chatScroll:  { flex: 1 },
  chatContent: { paddingVertical: 4, paddingHorizontal: 4, paddingBottom: Layout.spacing.lg },

  // Anjalie blank bubble row
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginVertical: 5,
    paddingHorizontal: Layout.spacing.sm,
  },
  thumb: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEE', marginLeft: 8,
  },
  anjalieBubble: {
    maxWidth: '72%',
    borderRadius: Layout.radius.lg,
    borderTopRightRadius: 4,
    backgroundColor: '#D5E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  bubbleText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '500',
    color: '#222',
    lineHeight: 22,
  },

  // Empty blank slot
  emptySlot: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotIdle:   { borderColor: '#AAAAAA' },
  emptySlotReady:  { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.1)', borderStyle: 'solid' },
  emptySlotHinted: { borderColor: '#FF9800', backgroundColor: 'rgba(255,152,0,0.1)', borderStyle: 'solid' },
  blankDashes:      { fontSize: 14, color: '#999', letterSpacing: 3, fontWeight: '700' },
  blankDashesReady: { color: '#2E7D32' },

  // Filled slot
  filledSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    minWidth: 60,
  },
  slotNeutral:   { backgroundColor: '#E0F2E9', borderWidth: 1.5, borderColor: '#4CAF50' },
  slotCorrect:   { backgroundColor: '#C8E6C9', borderWidth: 2,   borderColor: '#2E7D32' },
  slotIncorrect: { backgroundColor: '#FFCDD2', borderWidth: 2,   borderColor: '#C62828' },
  filledText: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#222' },

  incorrectHint: {
    fontSize: Layout.fontSize.xs,
    color: '#C62828',
    fontWeight: '600',
    marginTop: 4,
  },

  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,230,201,0.95)',
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    margin: Layout.spacing.md,
    gap: 8,
  },
  successText: { fontSize: Layout.fontSize.lg, color: '#1B5E20', fontWeight: '800' },

  // Tile panel
  tilePanel: {
    borderTopWidth: 1.5,
    borderTopColor: '#E0E0E0',
    paddingVertical: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 5,
  },
  tileRow: {
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.sm,
    alignItems: 'center',
  },
  tile: {
    borderRadius: Layout.radius.lg,
    borderWidth: 2,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tileSelected: { backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 3 },
  tilePlaced:   { opacity: 0.32, borderStyle: 'dashed' },
  tileHinted:   { backgroundColor: 'rgba(255,152,0,0.12)', borderWidth: 2.5, borderColor: '#FF9800' },
  tileText:         { fontSize: Layout.fontSize.md, fontWeight: '700' },
  tileSelectedText: { color: '#2E7D32' },
  tilePlacedText:   { color: '#AAA' },
  tileHintedText:   { color: '#E65100' },

  // Bottom bar
  bottomBar: { padding: Layout.spacing.lg, alignItems: 'flex-end' },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Layout.radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  checkBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '800', color: '#FFF' },
});
