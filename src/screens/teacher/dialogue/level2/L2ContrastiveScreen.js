import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

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
                In Sinhala the <Text style={{ fontWeight: '900' }}>VERB</Text> comes last — Subject → Object → Verb!
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
            onPress={() => navigation.replace('L2SentenceTeach', { student, sessionData, sentenceIndex: 1 })}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextText, { color: theme.buttonText }]}>Let's Start!</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
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
  headerTitle: { fontSize: Layout.fontSize.lg, fontWeight: '800', textAlign: 'center' },
  headerSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', textAlign: 'center', opacity: 0.65, marginTop: 3 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Layout.spacing.lg, gap: Layout.spacing.md },
  rowLabels: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  rowLabel: { fontSize: Layout.fontSize.sm, fontWeight: '700', opacity: 0.7 },
  slotsRow: { flexDirection: 'row', gap: Layout.spacing.sm },
  slotCol: { alignItems: 'center', flex: 1 },
  slot: { borderRadius: Layout.radius.md, borderWidth: 2, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', width: '100%' },
  slotText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  slotSub: { fontSize: 10, fontWeight: '600', opacity: 0.7, marginTop: 2 },
  arrowDown: { marginVertical: 4 },
  exampleCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Layout.radius.lg, borderWidth: 1.5, padding: Layout.spacing.md, width: '100%' },
  exampleText: { fontSize: Layout.fontSize.sm, fontWeight: '500', lineHeight: 20 },
  exampleSinhala: { fontSize: Layout.fontSize.xs, fontWeight: '500', opacity: 0.7, marginTop: 3, lineHeight: 18 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Layout.spacing.sm },
  bubble: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, ...Layout.shadow.sm, position: 'relative' },
  bubbleText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  bubbleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.65, marginTop: 2 },
  bubbleTail: { position: 'absolute', right: -10, bottom: 12, width: 0, height: 0, borderTopWidth: 8, borderTopColor: 'transparent', borderBottomWidth: 8, borderBottomColor: 'transparent', borderLeftWidth: 10 },
  avatar: { width: 80, height: 100 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md, borderRadius: Layout.radius.full, ...Layout.shadow.md },
  nextText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
