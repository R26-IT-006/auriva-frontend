import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../constants/backButton';
import FlowOverviewModal from '../../../components/common/FlowOverviewModal';
import HeaderPillButton from '../../../components/common/HeaderPillButton';
import { buildDialogueFlow } from '../../../data/dialogueFlow';

// "How it works" stages — static, so built once.
const DIALOGUE_FLOW = buildDialogueFlow();

const LEVELS = [
  {
    key: 'level1',
    label: 'Level 1',
    subtitle: 'Dialogue Word Learning',
    image: require('../../../../assets/dialogue-icons/talking.png'),
  },
  {
    key: 'level2',
    label: 'Level 2',
    subtitle: 'Sentence Construction',
    image: require('../../../../assets/dialogue-icons/word-of-mouth.png'),
  },
];

// Mirrors ConceptCategoriesScreen's CategoryCard (press animation, surface/outline
// theming, rounded card + image + label) so the two module landing screens read
// as one visual system.
function LevelCard({ item, cardW, cardH, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.card,
          { width: cardW, height: cardH, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
        ]}
      >
        <Image source={item.image} style={styles.cardImage} resizeMode="contain" />
        <Text style={styles.cardLabel} numberOfLines={1}>{item.label}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function DialogueLandingScreen({ route, navigation }) {
  const student   = route.params?.student;
  const theme     = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();
  const [showFlow, setShowFlow] = useState(false);

  // Intercept Android hardware back → same destination as the UI back arrow
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('StudentDashboard', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  const H_PAD = Layout.spacing.lg;
  const GAP   = 48;
  const cardW = Math.min(((width - H_PAD * 2 - GAP) / 2) * 0.8, 300);
  const cardH = cardW * 0.95;

  function goToLevel(key) {
    if (key === 'level1') {
      navigation.navigate('DialogueCategory', { student });
    } else if (key === 'level2') {
      navigation.navigate('L2TopicSelection', { student });
    }
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative floating shapes — same treatment as ConceptCategoriesScreen */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Header — same layout as ConceptCategoriesScreen ─── */}
        {/* Top bar: back | title | header pills — equal-width side groups keep
            the title centred, same layout as the other module headers. */}
        <View style={styles.topBar}>
          <View style={styles.sideGroup}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }, BACK_BUTTON]}
              onPress={() => navigation.navigate('StudentDashboard', { student })}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="chatbubbles" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Dialogue Module</Text>
          </View>

          <View style={[styles.sideGroup, styles.topBtnGroup]}>
            {/* "How it works" — teacher-facing flow overview (FlowOverviewModal). */}
            <HeaderPillButton
              variant="outline"
              icon="map"
              label="How it works"
              theme={theme}
              onPress={() => setShowFlow(true)}
            />
          </View>
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]}>
          Choose a level to begin
        </Text>

        {/* ── Body ────────────────────────────────────────────── */}
        <View style={styles.body}>

          <View style={[styles.levels, { gap: GAP }]}>
            {LEVELS.map((level) => (
              <LevelCard
                key={level.key}
                item={level}
                cardW={cardW}
                cardH={cardH}
                theme={theme}
                onPress={() => goToLevel(level.key)}
              />
            ))}
          </View>

        </View>
      </SafeAreaView>

      <FlowOverviewModal
        visible={showFlow}
        onClose={() => setShowFlow(false)}
        theme={theme}
        stages={DIALOGUE_FLOW}
        subtitle="How the Dialogue module works"
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // ── Decorative background shapes ──────────────────────────────────────────
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  blobTopRight: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  blobBottomLeft: {
    width: 260,
    height: 260,
    bottom: -80,
    left: -80,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  // Equal-width side groups keep the title centred (same as the other module headers).
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBtnGroup: {
    justifyContent: 'flex-end',
    gap: 10,
  },
  iconBtn: {
    width:  40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    // Extra bottom padding lifts the vertically-centred cards a little higher.
    paddingBottom: 120,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 70,
  },
  titleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
    marginTop: 2,
  },

  levels: {
    flexDirection: 'row',
  },

  card: {
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardImage: {
    width: '62%',
    height: '50%',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 24,
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  cardSubtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
    lineHeight: 19,
    color: '#4A4A4A',
    marginTop: 4,
  },
});
