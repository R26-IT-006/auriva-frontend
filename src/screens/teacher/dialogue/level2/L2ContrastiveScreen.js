import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { rs, rf } from '../../../../utils/responsive';

const AVATAR_MAP = {
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
};

// Sinhala SOV order: Subject → Object → Verb
const SINHALA_SLOTS = [
  { label: 'මම',       role: 'subject', roleColor: '#3B82F6', eng: 'I',       engSub: 'SUBJECT' },
  { label: 'නැටීම',   role: 'object',  roleColor: '#22C55E', eng: 'dancing', engSub: 'OBJECT'  },
  { label: 'කැමතියි', role: 'verb',    roleColor: '#F97316', eng: 'like',    engSub: 'VERB'    },
];

function SlotPair({ sinhala, english, index, animVal }) {
  return (
    <Animated.View style={[styles.slotCol, { opacity: animVal, transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      {/* Sinhala row */}
      <View style={[styles.slot, { backgroundColor: sinhala.roleColor + '22', borderColor: sinhala.roleColor }]}>
        <Text style={[styles.slotText, { color: sinhala.roleColor }]}>{sinhala.label}</Text>
        <Text style={[styles.slotSub, { color: sinhala.roleColor }]}>{sinhala.role.toUpperCase()}</Text>
      </View>

      {/* Arrow */}
      <Ionicons name="arrow-down" size={18} color={sinhala.roleColor} style={styles.arrowDown} />

      {/* English row */}
      <View style={[styles.slot, { backgroundColor: english.roleColor + '22', borderColor: english.roleColor }]}>
        <Text style={[styles.slotText, { color: english.roleColor }]}>{english.eng}</Text>
        <Text style={[styles.slotSub, { color: english.roleColor }]}>{english.engSub}</Text>
      </View>
    </Animated.View>
  );
}

// English SVO order: Subject(0) → Verb(2) → Object(1)
const ENGLISH_ORDER = [SINHALA_SLOTS[0], SINHALA_SLOTS[2], SINHALA_SLOTS[1]];

export default function L2ContrastiveScreen({ route, navigation }) {
  const { student, sessionData } = route.params ?? {};
  const theme    = getAvatarTheme(student?.avatar_key);
  const avatarImg = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;

  // Animate slots in sequence
  const anims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    Animated.stagger(300, anims.map(a => Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: true }))).start();
  }, []);

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>
            Let's see how English sentences are built!
          </Text>
          <Text style={[styles.headerSinhala, { color: theme.headingText }]}>
            ඉංග්‍රීසි වාක්‍ය කෙසේ සෑදෙනවාදැයි බලමු!
          </Text>
        </View>

        <View style={styles.body}>
          {/* Row labels */}
          <View style={styles.rowLabels}>
            <Text style={[styles.rowLabel, { color: theme.headingText }]}>සිංහල (Sinhala)</Text>
            <View style={{ height: 52 }} />
            <Text style={[styles.rowLabel, { color: theme.headingText }]}>English</Text>
          </View>

          {/* Slot pairs — Sinhala in SOV order (top), English in SVO order (bottom) */}
          <View style={styles.slotsRow}>
            {SINHALA_SLOTS.map((sinSlot, i) => (
              <SlotPair key={i} sinhala={sinSlot} english={ENGLISH_ORDER[i]} index={i} animVal={anims[i]} />
            ))}
          </View>

          {/* Example sentence */}
          <View style={[styles.exampleCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <Ionicons name="bulb-outline" size={20} color={theme.button} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.exampleText, { color: theme.headingText }]}>
                In Sinhala the <Text style={{ fontFamily: 'DMSans_900Black' }}>VERB</Text> comes last — Subject → Object → Verb!
              </Text>
              <Text style={[styles.exampleSinhala, { color: theme.headingText }]}>
                සිංහලෙන් VERB අවසානයේ එයි — Subject → Object → Verb!
              </Text>
            </View>
          </View>

          {/* Avatar + speech bubble */}
          <View style={styles.avatarRow}>
            <View style={[styles.bubble, { backgroundColor: theme.cardSurface }]}>
              <Text style={[styles.bubbleText, { color: theme.headingText }]}>
                "I like dancing"
              </Text>
              <Text style={[styles.bubbleSinhala, { color: theme.headingText }]}>
                "මම නැටීම කැමතියි"
              </Text>
              <View style={[styles.bubbleTail, { borderLeftColor: theme.cardSurface }]} />
            </View>
            <Image source={avatarImg} style={styles.avatar} resizeMode="contain" />
          </View>

          {/* Next */}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.replace('L2SentencePath', { student, sessionData })}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextText, { color: theme.buttonText }]}>Let's Start!</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md, alignItems: 'center' },
  headerTitle: { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_800ExtraBold', textAlign: 'center' },
  headerSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', textAlign: 'center', opacity: 0.65, marginTop: rs(3) },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Layout.spacing.lg, gap: Layout.spacing.md },
  rowLabels: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  rowLabel: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', opacity: 0.7 },
  slotsRow: { flexDirection: 'row', gap: Layout.spacing.sm },
  slotCol: { alignItems: 'center', flex: 1 },
  slot: { borderRadius: Layout.radius.md, borderWidth: 2, paddingVertical: rs(10), paddingHorizontal: rs(8), alignItems: 'center', width: '100%' },
  slotText: { fontSize: rf(15), fontFamily: 'DMSans_800ExtraBold', textAlign: 'center' },
  slotSub: { fontSize: rf(10), fontFamily: 'DMSans_600SemiBold', opacity: 0.7, marginTop: 2 },
  arrowDown: { marginVertical: rs(4) },
  exampleCard: { flexDirection: 'row', alignItems: 'center', gap: rs(8), borderRadius: Layout.radius.lg, borderWidth: 1.5, padding: Layout.spacing.md, width: '100%', maxWidth: rs(620) },
  exampleText: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_600SemiBold', lineHeight: rf(20) },
  exampleSinhala: { fontSize: Layout.fontSize.xs, fontWeight: '500', opacity: 0.7, marginTop: rs(3), lineHeight: rf(18) },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Layout.spacing.sm },
  bubble: { borderRadius: rs(16), paddingHorizontal: rs(16), paddingVertical: rs(10), ...Layout.shadow.sm, position: 'relative' },
  bubbleText: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold' },
  bubbleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.65, marginTop: 2 },
  bubbleTail: { position: 'absolute', right: rs(-10), bottom: rs(12), width: 0, height: 0, borderTopWidth: 8, borderTopColor: 'transparent', borderBottomWidth: 8, borderBottomColor: 'transparent', borderLeftWidth: 10 },
  avatar: { width: rs(80), height: rs(100) },
  nextBtn: {
    gap: rs(8),
    paddingHorizontal: rs(32),
    paddingVertical: rs(14),
    borderRadius: rs(16),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextText: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
  },
});