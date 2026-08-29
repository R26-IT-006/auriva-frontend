import { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  FlatList,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';

const CATEGORIES = [
  {
    key: 'magic_words',
    label: 'Magic Words',
    icon: require('../../../../assets/dialogue-icons/magic words.png'),
  },
  {
    key: 'greetings',
    label: 'Greetings',
    icon: require('../../../../assets/dialogue-icons/greetings.png'),
  },
  {
    key: 'abilities',
    label: 'Can You?',
    icon: require('../../../../assets/dialogue-icons/activities.png'),
  },
  {
    key: 'evaluations',
    label: 'Evaluations',
    // No bespoke Evaluations icon exists yet (later asset task); reusing
    // days_of_the_week.png as the most neutral unused asset in dialogue-icons/
    // (magic words / greetings / activities are all already claimed above).
    icon: require('../../../../assets/dialogue-icons/days_of_the_week.png'),
  },
];

// Mirrors ConceptCategoriesScreen's CategoryCard (press animation, surface/outline
// theming, rounded card + image + label) so the two module screens read as one
// visual system.
function CategoryCard({ item, cardW, cardH, theme, onPress }) {
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
        <Image source={item.icon} style={styles.cardImage} resizeMode="contain" />
        <Text style={styles.cardLabel} numberOfLines={2}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function DialogueCategoryScreen({ route, navigation }) {
  const student = route.params?.student;
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const NUM_COLUMNS = isLandscape ? 4 : 3;
  const H_PAD = Layout.spacing.xl;
  const GAP   = 22;
  const cardW = (width - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const cardH = cardW * 1.05;

  // Intercept Android hardware back → same destination as the UI back arrow
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('DialogueLanding', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  function goToCategory(item) {
    if (item.key === 'evaluations') {
      navigation.navigate('EvaluationMenu', { student });
    } else {
      navigation.navigate('Level1Overview', { student, categoryKey: item.key });
    }
  }

  function renderCard({ item }) {
    return (
      <CategoryCard
        item={item}
        cardW={cardW}
        cardH={cardH}
        theme={theme}
        onPress={() => goToCategory(item)}
      />
    );
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

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }]}
            onPress={() => navigation.navigate('DialogueLanding', { student })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="chatbubbles" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Level 1</Text>
          </View>

          <View style={styles.iconBtn} />
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]}>
          Pick a category and start your adventure!
        </Text>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          numColumns={NUM_COLUMNS}
          key={NUM_COLUMNS}
          renderItem={renderCard}
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: H_PAD }]}
          columnWrapperStyle={{ gap: GAP, justifyContent: 'center' }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
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
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 32,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Layout.spacing.md,
  },
  card: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: {
    width: '70%',
    height: '58%',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
    lineHeight: 18,
    color: '#1A1A1A',
  },
});
