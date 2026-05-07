import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: 'pencil-outline',
    title: 'Position the stylus',
    desc: 'Ensure the child is comfortably holding the tablet stylus or using their finger.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Explain the task',
    desc: 'Tell the child to trace or draw the shapes shown on screen at their own pace.',
  },
  {
    icon: 'hand-left-outline',
    title: 'Do not assist',
    desc: "Avoid guiding the child's hand during drawing. Only assist if they cannot start.",
  },
  {
    icon: 'time-outline',
    title: 'Allow natural speed',
    desc: 'Let the child complete each shape at their own pace. Do not rush or set time limits.',
  },
  {
    icon: 'desktop-outline',
    title: 'System auto-records',
    desc: 'The system automatically captures stroke trajectory, direction, speed, pause count and line stability. No manual recording needed.',
  },
];

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

// ─────────────────────────────────────────────────────────────────────────────

export default function InstructionScreen({ route, navigation }) {
  const { student, theme } = route.params;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const avatar = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron;

  // Responsive sizing helpers
  const cardPad   = width * 0.04;
  const avatarH   = height * 0.28;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        <View style={[styles.root, isLandscape && styles.rootLandscape]}>

          {/* ══ Main content column ══════════════════════════════════════════ */}
          <View style={[styles.contentCol, { padding: cardPad }]}>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={styles.header}>
              <View style={[styles.teacherBadge, { backgroundColor: theme.button + '22', borderColor: theme.button }]}>
                <Ionicons name="person-outline" size={13} color={theme.button} />
                <Text style={[styles.teacherBadgeText, { color: theme.button }]}>FOR TEACHER</Text>
              </View>

              <Text style={[styles.title, { color: theme.headingText }]}>
                Initial Motor Assessment
              </Text>
              <Text style={[styles.subtitle, { color: theme.button }]}>
                Instructions for the Teacher
              </Text>
              <Text style={styles.intro}>
                Please guide {student?.full_name ?? 'the child'} through the following{' '}
                {STEPS.length} steps before the drawing tasks begin.
              </Text>
            </View>

            {/* ── Steps ──────────────────────────────────────────────────── */}
            <View style={styles.stepsContainer}>
              {STEPS.map((step, index) => (
                <StepCard
                  key={index}
                  step={step}
                  index={index}
                  theme={theme}
                />
              ))}
            </View>

            {/* ── Begin button ───────────────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.beginBtn, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate('StudentWelcome', { student, theme })}
              activeOpacity={0.85}
            >
              <Text style={[styles.beginBtnText, { color: theme.buttonText }]}>
                Begin Assessment
              </Text>
            </TouchableOpacity>

          </View>

          {/* ══ Avatar column (landscape: side, portrait: hidden or shown bottom-right) ══ */}
          {isLandscape ? (
            <View style={styles.avatarCol}>
              <Image
                source={avatar}
                style={[styles.avatarLandscape, { height: avatarH }]}
                resizeMode="contain"
              />
              <View style={[styles.speechBubble, { borderColor: theme.button + '33' }]}>
                <Text style={styles.speechText}>Every small step is progress toward{'\n'}something great.</Text>
              </View>
            </View>
          ) : (
            <Image
              source={avatar}
              style={styles.avatarPortrait}
              resizeMode="contain"
              pointerEvents="none"
            />
          )}

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Step card component ──────────────────────────────────────────────────────

function StepCard({ step, index, theme }) {
  return (
    <View style={[styles.stepCard, { borderLeftColor: theme.button }]}>
      {/* Number circle + icon */}
      <View style={[styles.stepCircle, { backgroundColor: theme.button }]}>
        <Text style={styles.stepNumber}>{index + 1}</Text>
      </View>

      {/* Text block */}
      <View style={styles.stepBody}>
        <Text style={[styles.stepTitle, { color: theme.headingText }]}>{step.title}</Text>
        <Text style={styles.stepDesc}>{step.desc}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // Root layout switches between portrait (column) and landscape (row)
  root: {
    flex: 1,
  },
  rootLandscape: {
    flexDirection: 'row',
  },

  // ── Content column ────────────────────────────────────────────────────────
  contentCol: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    marginBottom: '1.5%',
  },

  teacherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    marginBottom: '2%',
  },
  teacherBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  title: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: '1%',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: '1.5%',
    letterSpacing: 0.3,
  },
  intro: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 21,
  },

  // ── Steps ─────────────────────────────────────────────────────────────────
  stepsContainer: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: '1%',
  },

  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: '2.5%',
    paddingVertical: '1.5%',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  stepBody: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
  },

  // ── Begin button ──────────────────────────────────────────────────────────
  beginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 50,
    marginTop: '2%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  beginBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Avatar — landscape (side column) ─────────────────────────────────────
  avatarCol: {
    width: '36%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: '4%',
    paddingRight: '2%',
    gap: 12,
  },
  avatarLandscape: {
    width: '100%',
    flex: 1,
    resizeMode: 'contain',
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  speechText: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },

  // ── Avatar — portrait (bottom-right overlay) ──────────────────────────────
  avatarPortrait: {
    position: 'absolute',
    bottom: 80,
    right: 12,
    width: '18%',
    height: '20%',
    opacity: 0.85,
  },
});
