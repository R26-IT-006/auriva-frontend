import { useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { getOrderedCategories } from '../../../constants/conceptData';
import { Layout } from '../../../constants/layout';

// Derived from the catalogue rather than listed here, so the grid can never offer a
// category that has no concepts behind it.
const CATEGORIES = getOrderedCategories();

function CategoryCard({ item, cardW, cardH, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const isComingSoon = Boolean(item.comingSoon);

  function pressIn() {
    if (isComingSoon) return;
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        disabled={isComingSoon}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.card,
          {
            width: cardW,
            height: cardH,
            backgroundColor: isComingSoon ? '#F0F0F0' : theme.cardSurface,
            borderColor:     isComingSoon ? '#D0D0D0' : theme.cardOutline,
          },
        ]}
      >
        <Image
          source={item.image}
          style={[styles.cardImage, isComingSoon && styles.cardImageDisabled]}
          resizeMode="contain"
        />
        <Text
          style={[styles.cardLabel, isComingSoon && styles.cardLabelDisabled]}
          numberOfLines={2}
        >
          {item.label}
        </Text>

        {/* Same greyed-out + lock treatment as a locked concept card, so "not yet"
            reads the same way everywhere in the module. */}
        {isComingSoon && (
          <View style={styles.comingSoonOverlay}>
            <View style={styles.comingSoonPill}>
              <Ionicons name="lock-closed" size={11} color="#8A8A8A" />
              <Text style={styles.comingSoonText}>Coming soon</Text>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function ConceptCategoriesScreen({ route, navigation }) {
  const student = route.params?.student;
  const { width, height } = useWindowDimensions();
  const [gateVisible, setGateVisible] = useState(false);

  const theme       = getAvatarTheme(student?.avatar_key);
  const isLandscape = width > height;
  const NUM_COLUMNS = isLandscape ? 4 : 3;
  const H_PAD   = Layout.spacing.xl;
  const GAP     = 22;
  const cardW   = (width - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const cardH   = cardW * 0.85;

  function renderCard({ item }) {
    return (
      <CategoryCard
        item={item}
        cardW={cardW}
        cardH={cardH}
        theme={theme}
        // Only key and label travel — the catalogue entry also holds every concept
        // and its asset refs, which has no business sitting in navigation state.
        onPress={() => navigation.navigate('ConceptItems', {
          student,
          category: { key: item.key, label: item.label },
        })}
      />
    );
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative floating shapes */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }]}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="bulb" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Concept Learning</Text>
          </View>

          <View style={styles.iconBtn} />
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]}>
          Choose a category to explore
        </Text>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          numColumns={NUM_COLUMNS}
          key={NUM_COLUMNS}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, { paddingHorizontal: H_PAD }]}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.navigate('StudentDashboard', { student }); }}
        onCancel={() => setGateVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1 },

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
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
    marginTop: 2,
  },
  list: {
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
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    lineHeight: 18,
    color: '#1A1A1A',
  },

  // ── Coming soon (category with artwork but no concepts yet) ────────────────
  cardImageDisabled: {
    opacity: 0.25,
  },
  cardLabelDisabled: {
    color: '#AAAAAA',
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    backgroundColor: 'rgba(240,240,240,0.45)',
  },
  comingSoonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    color: '#8A8A8A',
  },
});
