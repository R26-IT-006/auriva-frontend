import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getMockConversation } from '../../../../data/mockConversation';
import { ChatBubble, MicButton, TurnProgressDots, PauseModal } from './_components';

// pass=1 → CB-S04, navigates to L3Feedback on complete
// pass=2 → CB-S06, navigates to L3TextCue on complete
export default function RepeatAudioScreen({ route, navigation }) {
  const { student, pass = 1 } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const avatarKey  = student?.avatar_key ?? 'lily';
  const avatarName = avatarKey.charAt(0).toUpperCase() + avatarKey.slice(1);

  const conversation = getMockConversation(avatarKey, avatarName);

  const [currentTurn,    setCurrentTurn]    = useState(0);
  const [shownBubbles,   setShownBubbles]   = useState([]); // ['T1-left', 'T1-right', ...]
  const [micState,       setMicState]       = useState('idle'); // idle | listening | done
  const [paused,         setPaused]         = useState(false);

  const soundRef    = useRef(null);
  const mountedRef  = useRef(true);
  const scrollRef   = useRef(null);
  const timeoutRef  = useRef(null);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('L3Demo', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupSound();
      clearTimeout(timeoutRef.current);
    };
  }, []);

  async function cleanupSound() {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }

  async function playAudio(source) {
    await cleanupSound();
    return new Promise((resolve) => {
      Audio.Sound.createAsync(source)
        .then(({ sound }) => {
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              soundRef.current = null;
              resolve();
            }
          });
          sound.playAsync().catch(() => resolve());
        })
        .catch(() => resolve());
    });
  }

  // Trigger a turn: show avatar bubble + play avatar audio, then show anjalie bubble + play audio
  async function playTurn(turnIndex) {
    if (!mountedRef.current) return;
    const turn = conversation[turnIndex];

    // Show avatar left bubble
    setShownBubbles((prev) => [...prev, `${turnIndex}-left`]);
    await new Promise((r) => setTimeout(r, 150));
    scrollRef.current?.scrollToEnd({ animated: true });
    await playAudio(turn.avatarAudio);
    if (!mountedRef.current) return;

    // Show anjalie right bubble (active — green, with audio)
    setShownBubbles((prev) => [...prev, `${turnIndex}-right`]);
    await new Promise((r) => setTimeout(r, 150));
    scrollRef.current?.scrollToEnd({ animated: true });
    await playAudio(turn.anjalieAudio);
    if (!mountedRef.current) return;

    // Enable mic for child to repeat
    setMicState('idle');
  }

  useEffect(() => {
    if (currentTurn < conversation.length) {
      playTurn(currentTurn);
    }
  }, [currentTurn]);

  function handleMicPress() {
    if (micState !== 'idle') return;
    setMicState('listening');
    // Mock 3-second recording
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setMicState('done');
      // Advance after short delay
      timeoutRef.current = setTimeout(() => advanceTurn(), 600);
    }, 3000);
  }

  // Auto-advance timeout: 20s after anjalie bubble appears
  useEffect(() => {
    if (micState === 'idle' && shownBubbles.includes(`${currentTurn}-right`)) {
      const autoAdvance = setTimeout(() => {
        if (micState === 'idle' && mountedRef.current) advanceTurn();
      }, 20000);
      return () => clearTimeout(autoAdvance);
    }
  }, [micState, shownBubbles, currentTurn]);

  function advanceTurn() {
    if (!mountedRef.current) return;
    const next = currentTurn + 1;
    if (next >= conversation.length) {
      // All 5 turns done
      cleanupSound();
      if (pass === 1) {
        navigation.navigate('L3Feedback', { student });
      } else {
        navigation.navigate('L3TextCue', { student });
      }
    } else {
      setMicState('idle');
      setCurrentTurn(next);
    }
  }

  const isAnjalieActive = (i) => i === currentTurn && shownBubbles.includes(`${i}-right`);
  const isMicVisible    = shownBubbles.includes(`${currentTurn}-right`) && micState !== 'done';

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PauseModal
          visible={paused}
          onResume={() => setPaused(false)}
          onExit={() => { cleanupSound(); navigation.navigate('DialogueLanding', { student }); }}
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.cardOutline }]}
            onPress={() => { cleanupSound(); navigation.navigate('L3Demo', { student }); }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerText, { color: theme.headingText }]}>
              {avatarName} wants to talk with you!{'\n'}Can you repeat what Anjalie says?
            </Text>
            <Text style={[styles.headerSinhala, { color: theme.headingText }]}>
              {avatarName} ඔබ සමඟ කතා කිරීමට කැමතියි!{'\n'}Anjalie කියන දේ නැවත කිව හැකිද?
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

        {/* Progress dots */}
        <View style={styles.progressRow}>
          <TurnProgressDots current={currentTurn} total={5} />
          <Text style={[styles.passLabel, { color: theme.headingText }]}>
            Pass {pass} of 2  ·  වාරය {pass} / 2
          </Text>
        </View>

        {/* Chat */}
        <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
          {conversation.map((turn, i) => (
            <View key={turn.id}>
              {shownBubbles.includes(`${i}-left`) && (
                <ChatBubble
                  side="left"
                  text={turn.avatarText}
                  avatarKey={avatarKey}
                  image={turn.image}
                />
              )}
              {shownBubbles.includes(`${i}-right`) && (
                <ChatBubble
                  side="right"
                  text={turn.anjalieText}
                  avatarKey={avatarKey}
                  active={isAnjalieActive(i)}
                  subLabel={isAnjalieActive(i) ? 'Can you repeat this?' : null}
                />
              )}
            </View>
          ))}
        </ScrollView>

        {/* Mic area */}
        <View style={styles.micArea}>
          {isMicVisible && (
            <MicButton state={micState} onPress={handleMicPress} />
          )}
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
    flexShrink: 0,
  },
  headerText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  headerSinhala: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.72,
    lineHeight: 16,
    marginTop: 2,
  },

  progressRow: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.xs,
    gap: 6,
  },
  passLabel: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '600',
    opacity: 0.6,
  },

  chatScroll:  { flex: 1 },
  chatContent: { paddingVertical: Layout.spacing.sm, paddingBottom: 80 },

  micArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Layout.spacing.lg,
    minHeight: 80,
  },
});
