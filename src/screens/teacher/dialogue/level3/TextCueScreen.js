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

// CB-S07: Same chat flow but NO audio for Anjalie's turn.
// Avatar audio still plays so the child knows what's being asked.
export default function TextCueScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const avatarKey  = student?.avatar_key ?? 'lily';
  const avatarName = avatarKey.charAt(0).toUpperCase() + avatarKey.slice(1);

  const conversation = getMockConversation(avatarKey, avatarName);

  const [currentTurn,  setCurrentTurn]  = useState(0);
  const [shownBubbles, setShownBubbles] = useState([]);
  const [micState,     setMicState]     = useState('idle');
  const [paused,       setPaused]       = useState(false);
  const [struggleCount, setStruggleCount] = useState(0);

  const soundRef   = useRef(null);
  const mountedRef = useRef(true);
  const scrollRef  = useRef(null);
  const timeoutRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('L3RepeatAudio', { student, pass: 2 });
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

  async function playTurn(turnIndex) {
    if (!mountedRef.current) return;
    const turn = conversation[turnIndex];

    // Show avatar (left) bubble — play avatar audio
    setShownBubbles((prev) => [...prev, `${turnIndex}-left`]);
    await new Promise((r) => setTimeout(r, 150));
    scrollRef.current?.scrollToEnd({ animated: true });
    await playAudio(turn.avatarAudio);
    if (!mountedRef.current) return;

    // Show anjalie (right) bubble — NO audio, just text in green
    setShownBubbles((prev) => [...prev, `${turnIndex}-right`]);
    await new Promise((r) => setTimeout(r, 150));
    scrollRef.current?.scrollToEnd({ animated: true });

    // Mic becomes available immediately
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
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setMicState('done');
      timeoutRef.current = setTimeout(() => advanceTurn(false), 600);
    }, 3000);
  }

  // Auto-advance at 20s with no attempt
  useEffect(() => {
    if (micState === 'idle' && shownBubbles.includes(`${currentTurn}-right`)) {
      const autoAdvance = setTimeout(() => {
        if (micState === 'idle' && mountedRef.current) {
          // Count as a struggle turn
          advanceTurn(true);
        }
      }, 20000);
      return () => clearTimeout(autoAdvance);
    }
  }, [micState, shownBubbles, currentTurn]);

  function advanceTurn(struggled) {
    if (!mountedRef.current) return;
    const newCount = struggled ? struggleCount + 1 : 0;
    setStruggleCount(newCount);

    if (newCount >= 3) {
      // Redirect to audio-supported version
      cleanupSound();
      navigation.navigate('L3RepeatAudio', { student, pass: 2 });
      return;
    }

    const next = currentTurn + 1;
    if (next >= conversation.length) {
      cleanupSound();
      navigation.navigate('L3Independent', { student });
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
            onPress={() => { cleanupSound(); navigation.navigate('L3RepeatAudio', { student, pass: 2 }); }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerText, { color: theme.headingText }]}>
              {avatarName} wants to talk to you!{'\n'}Can you answer his questions?
            </Text>
            <Text style={[styles.headerSinhala, { color: theme.headingText }]}>
              {avatarName} ඔබ සමඟ කතා කිරීමට කැමතියි!{'\n'}ඔහුගේ ප්‍රශ්නවලට පිළිතුරු දිය හැකිද?
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
          <Text style={[styles.stageLabel, { color: theme.headingText }]}>Text cue — no audio  ·  පෙළ ඉඟිය — ශ්‍රව්‍ය නොමැත</Text>
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
  stageLabel: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '600',
    opacity: 0.55,
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
