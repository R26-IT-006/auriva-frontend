import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';

const CATEGORIES = [
  {
    key: 'magic_words',
    label: 'Magic Words',
    subtitle: 'Please, Thank You, and more!',
    icon: 'sparkles',
    watermark: 'sparkles-outline',
    circleColor: '#3ECFB2',   // teal – row 1 left
  },
  {
    key: 'greetings',
    label: 'Greetings',
    subtitle: 'Say hello to the world!',
    icon: 'sunny',
    watermark: 'hand-left-outline',
    circleColor: '#F7C948',   // yellow – row 1 right
  },
  {
    key: 'abilities',
    label: 'Can You?',
    subtitle: 'Run, jump, and climb in English!',
    icon: 'walk',
    watermark: 'person-circle-outline',
    circleColor: '#3B9EE8',   // blue – row 2 left
  },
  {
    key: 'days_of_week',
    label: 'Days of the Week',
    subtitle: 'A journey through time!',
    icon: 'calendar',
    watermark: 'footsteps-outline',
    circleColor: '#3ECFB2',   // teal – row 2 right
  },
];

const H_PAD = 16;
const CARD_GAP = 12;

export default function DialogueCategoryScreen({ route, navigation }) {
  const student = route.params?.student;
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  const maxW     = Math.min(width, 600);
  const cardW    = (maxW - H_PAD * 2 - CARD_GAP) / 2;

  return (
    <View style={styles.root}>

      {/* ── Header (light pastel, avatar-themed) ─────────────────── */}
      <SafeAreaView
        style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Level 1</Text>
          {/* mirror of back button to keep title centred */}
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      {/* ── Gradient body ────────────────────────────────────────── */}
      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Heading */}
            <Text style={[styles.heading, { color: theme.headingText }]}>
              {'Ready to '}
              <Text style={[styles.headingAccent, { color: theme.button }]}>grow</Text>
              {' your English?'}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              {'Pick a magic door and start your adventure today. Every word is a new friend!'}
            </Text>

            {/* ── Card grid: 2 columns, 2 rows ──────────────────── */}
            <View style={[styles.grid, { width: maxW, paddingHorizontal: H_PAD }]}>
              {CATEGORIES.map((cat, i) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.card,
                    {
                      width: cardW,
                      backgroundColor: theme.cardSurface,
                      marginLeft: i % 2 === 1 ? CARD_GAP : 0,
                      marginBottom: CARD_GAP,
                    },
                  ]}
                  activeOpacity={0.82}
                  onPress={() =>
                    navigation.navigate('Level1Overview', { student, categoryKey: cat.key })
                  }
                >
                  {/* Coloured icon circle */}
                  <View style={[styles.iconCircle, { backgroundColor: cat.circleColor }]}>
                    <Ionicons name={cat.icon} size={22} color="#FFFFFF" />
                  </View>

                  {/* Labels */}
                  <Text style={[styles.cardTitle, { color: theme.headingText }]}>
                    {cat.label}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.headingText }]}>
                    {cat.subtitle}
                  </Text>

                  {/* Watermark — bottom-right */}
                  <View style={styles.watermark} pointerEvents="none">
                    <Ionicons
                      name={cat.watermark}
                      size={52}
                      color={theme.cardOutline}
                      style={{ opacity: 0.2 }}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Header */
  headerWrap: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* Body */
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  scroll: {
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
    alignItems: 'center',
  },

  heading: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: Layout.spacing.sm,
    paddingHorizontal: H_PAD,
  },
  headingAccent: {
    fontWeight: '900',
  },

  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.65,
    lineHeight: 20,
    marginBottom: Layout.spacing.lg,
    paddingHorizontal: H_PAD,
  },

  /* Grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  card: {
    borderRadius: 18,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 155,
  },

  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
    lineHeight: 16,
  },

  watermark: {
    position: 'absolute',
    bottom: 6,
    right: 6,
  },
});
