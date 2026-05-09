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
import { ChatBubble } from './_components';

export default function DemoScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme       = getAvatarTheme(student?.avatar_key);
  const avatarKey   = student?.avatar_key ?? 'lily';
  const avatarName  = avatarKey.charAt(0).toUpperCase() + avatarKey.slice(1);

  const conversation = getMockConversation(avatarKey, avatarName);

  // visibleBubbles: array of strings like 'T1-left', 'T1-right', 'T2-left' …
  const [visibleBubbles, setVisibleBubbles] = useState([]);
  const [completed, setCompleted]           = useState(false);

  const soundRef      = useRef(null);
  const scrollRef     = useRef(null);
  const mountedRef    = useRef(true);
  const isPlayingRef  = useRef(false);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('L3Landing', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupSound();
    };
  }, []);

  async function cleanupSound() {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }

  async function playAndWait(source) {
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

  async function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function runSequence() {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setVisibleBubbles([]);
    setCompleted(false);

    for (let i = 0; i < conversation.length; i++) {
      if (!mountedRef.current) break;
      const turn = conversation[i];

      // Show avatar (left) bubble
      setVisibleBubbles((prev) => [...prev, `${i}-left`]);
      await delay(150);
      scrollRef.current?.scrollToEnd({ animated: true });
      await playAndWait(turn.avatarAudio);
      if (!mountedRef.current) break;

      // 0.5s gap
      await delay(500);
      if (!mountedRef.current) break;

      // Show anjalie (right) bubble
      setVisibleBubbles((prev) => [...prev, `${i}-right`]);
      await delay(150);
      scrollRef.current?.scrollToEnd({ animated: true });
      await playAndWait(turn.anjalieAudio);
      if (!mountedRef.current) break;

      // Gap before next turn
      await delay(500);
    }

    if (mountedRef.current) {
      setCompleted(true);
      isPlayingRef.current = false;
    }
  }

  useEffect(() => {
    runSequence();
  }, []);

  function handleReplay() {
    isPlayingRef.current = false;
    runSequence();
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.cardOutline }]}
            onPress={() => { cleanupSound(); navigation.navigate('L3Landing', { student }); }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.cardOutline }]}
            onPress={handleReplay}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Instruction banner */}
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={18} color="#7A5800" style={{ marginRight: 6, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerText}>
              A simple demonstration of a conversation, with the words and audio. The child listens and observes, no response expected here.
            </Text>
            <Text style={styles.bannerSinhala}>
              සංවාදයේ සරල නිරූපණයකි. දරුවා සවන් දෙමින් නිරීක්ෂණය කරයි, ප්‍රතිචාරයක් අවශ්‍ය නොවේ.
            </Text>
          </View>
        </View>

        {/* Chat */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {conversation.map((turn, i) => (
            <View key={turn.id}>
              {visibleBubbles.includes(`${i}-left`) && (
                <ChatBubble
                  side="left"
                  text={turn.avatarText}
                  avatarKey={avatarKey}
                  image={turn.image}
                />
              )}
              {visibleBubbles.includes(`${i}-right`) && (
                <ChatBubble
                  side="right"
                  text={turn.anjalieText}
                  avatarKey={avatarKey}
                />
              )}
            </View>
          ))}
        </ScrollView>

        {/* Next button */}
        {completed && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.button }]}
              onPress={() => { cleanupSound(); navigation.navigate('L3FillBlanks', { student }); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical:   Layout.spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderRadius: Layout.radius.md,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
    padding: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: '#FFD966',
  },
  bannerText: {
    fontSize: Layout.fontSize.sm,
    color: '#7A5800',
    fontWeight: '500',
    lineHeight: 18,
  },
  bannerSinhala: {
    fontSize: Layout.fontSize.sm,
    color: '#7A5800',
    fontWeight: '500',
    lineHeight: 18,
    opacity: 0.8,
    marginTop: 4,
  },

  chatScroll:   { flex: 1 },
  chatContent:  { paddingVertical: Layout.spacing.sm, paddingBottom: Layout.spacing.xl },

  bottomBar: {
    padding: Layout.spacing.lg,
    alignItems: 'flex-end',
  },
  nextBtn: {
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
  nextBtnText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '800',
  },
});
