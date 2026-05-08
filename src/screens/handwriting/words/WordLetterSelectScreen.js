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

import { getAllWordProgress } from '../../../utils/storage';

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
  boba:     require('../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../assets/avatar-images/Megatron.png'),
};

// ─── Unlock logic ─────────────────────────────────────────────────────────────

function computeUnlocked(wordProgress) {
  const map = {};
  LETTERS.forEach((letter, i) => {
    const prev = i > 0 ? LETTERS[i - 1].toLowerCase() : null;
    map[letter] = i < 3 || (prev ? !!wordProgress[prev] : false);
  });
  return map;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WordLetterSelectScreen({ route, navigation }) {
  const { student, theme } = route.params;

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

  // Reload progress whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      getAllWordProgress(student?.sid ?? 0).then(data => {
        setWordProgress(data ?? {});
      });
    }, [student?.sid])
  );

  const unlocked     = computeUnlocked(wordProgress);
  const doneCount    = LETTERS.filter(l => !!wordProgress[l.toLowerCase()]).length;
  const progressText = `${doneCount} / ${LETTERS.length} letters`;

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
            onPress={() => navigation.goBack()}
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
              accessibilityLabel="View rewards"
            >
              <Ionicons name="ribbon-outline" size={14} color={theme.button} />
              <Text style={[styles.topOutlineBtnText, { color: theme.button }]}>Rewards</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topFilledBtn, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate('TeacherReport', { student, theme })}
              accessibilityLabel="Teacher report"
            >
              <Ionicons name="document-text-outline" size={14} color={theme.buttonText} />
              <Text style={[styles.topFilledBtnText, { color: theme.buttonText }]}>Teacher</Text>
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
            Complete each letter to unlock the next one! ⭐
          </Text>
        </View>

        {/* ── Letter grid ──────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {LETTERS.map((letter, i) => {
            const isUnlocked  = unlocked[letter];
            const progress    = wordProgress[letter.toLowerCase()];
            const pal         = PALETTE[i % PALETTE.length];

            return (
              <LetterCard
                key={letter}
                letter={letter}
                isUnlocked={isUnlocked}
                progress={progress}
                palette={pal}
                globalPulse={globalPulse}
                theme={theme}
                onPress={() => {
                  if (isUnlocked) {
                    navigation.navigate('WordWriting', { student, theme, letter: letter.toLowerCase() });
                  }
                }}
              />
            );
          })}
        </ScrollView>

      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Letter card ──────────────────────────────────────────────────────────────

function LetterCard({ letter, isUnlocked, progress, palette, globalPulse, theme, onPress }) {
  const stars = progress
    ? Math.min(3, Math.round((progress.length / 5) * 3))
    : 0;

  if (!isUnlocked) {
    return (
      <View style={[styles.card, styles.cardLocked]}>
        <Text style={styles.letterLocked}>{letter}</Text>
        <Ionicons name="lock-closed" size={IS_TABLET ? 14 : 12} color="#BBBBBB" style={{ marginTop: 3 }} />
      </View>
    );
  }

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
  },
  subtitle: {
    fontSize:   IS_TABLET ? 13 : 11,
    fontWeight: '500',
  },
  progressPill: {
    borderRadius:      20,
    paddingHorizontal: IS_TABLET ? 12 : 9,
    paddingVertical:   IS_TABLET ? 5 : 4,
  },
  progressPillText: {
    fontSize:   IS_TABLET ? 12 : 10,
    fontWeight: '700',
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
  cardLocked: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.30)',
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
  },

  // Letter text
  letter: {
    fontSize:   IS_TABLET ? Math.round(CARD_SIZE * 0.42) : Math.round(CARD_SIZE * 0.44),
    fontWeight: '900',
    lineHeight: IS_TABLET ? Math.round(CARD_SIZE * 0.50) : Math.round(CARD_SIZE * 0.52),
  },
  letterLocked: {
    fontSize:   IS_TABLET ? Math.round(CARD_SIZE * 0.40) : Math.round(CARD_SIZE * 0.42),
    fontWeight: '900',
    color:      '#CCCCCC',
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

