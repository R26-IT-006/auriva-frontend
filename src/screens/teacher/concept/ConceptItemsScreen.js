import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem, getConceptItemsForCategory } from '../../../constants/conceptData';
import { conceptApi } from '../../../api/concept';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { Layout } from '../../../constants/layout';

export default function ConceptItemsScreen({ route, navigation }) {
  const { student, category } = route.params;
  const { width }             = useWindowDimensions();

  const [progressItems, setProgressItems] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [gateVisible,   setGateVisible]   = useState(false);

  const theme    = getAvatarTheme(student?.avatar_key);
  const H_PAD    = Layout.spacing.md;
  const GAP      = 12;
  const COLS     = 2;
  const cardW    = (width - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
  const cardH    = cardW * 1.15;

  const localItems = getConceptItemsForCategory(category.key);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      conceptApi.getConceptItems(category.key, student.sid)
        .then((items) => { if (active) setProgressItems(items); })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [category.key, student.sid])
  );

  // Merge API progress with local display data
  const merged = localItems.map((local) => {
    const progress = progressItems.find((p) => p.concept_key === local.key);
    return {
      ...local,
      is_unlocked:  progress?.is_unlocked   ?? (local.key === localItems[0]?.key),
      tier1_status: progress?.tier1_status  ?? 'not_started',
      tier1_score:  progress?.tier1_score   ?? null,
    };
  });

  function renderCard({ item }) {
    const isLocked    = !item.is_unlocked;
    const isPassed    = item.tier1_status === 'passed';
    const isProgress  = item.tier1_status === 'in_progress';

    return (
      <TouchableOpacity
        activeOpacity={isLocked ? 1 : 0.82}
        disabled={isLocked}
        style={[
          styles.card,
          {
            width: cardW,
            height: cardH,
            backgroundColor: isLocked ? '#F0F0F0' : theme.cardSurface,
            borderColor:     isPassed ? '#4CAF50' : isLocked ? '#D0D0D0' : theme.cardOutline,
          },
        ]}
        onPress={() => navigation.navigate('ConceptImage', {
          student,
          category,
          conceptKey: item.key,
          sessionId:  null,
        })}
      >
        {/* Fruit image */}
        <Image
          source={item.real}
          style={[styles.cardImage, isLocked && styles.cardImageLocked]}
          resizeMode="contain"
        />

        {/* Label */}
        <Text style={[styles.cardLabel, isLocked && styles.cardLabelLocked]}>
          {item.label}
        </Text>

        {/* Locked overlay */}
        {isLocked && (
          <View style={styles.lockedOverlay}>
            <Ionicons name="lock-closed" size={28} color="#AAA" />
          </View>
        )}

        {/* Passed badge */}
        {isPassed && (
          <View style={styles.passedBadge}>
            <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
          </View>
        )}

        {/* In-progress dot */}
        {isProgress && !isPassed && (
          <View style={[styles.progressDot, { backgroundColor: theme.button }]} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.headingText }]}>{category.label}</Text>
          </View>

          <View style={styles.iconBtn} />
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]}>
          Tap a fruit to start learning
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.button} style={styles.loader} />
        ) : (
          <FlatList
            data={merged}
            keyExtractor={(item) => item.key}
            numColumns={COLS}
            renderItem={renderCard}
            contentContainerStyle={[styles.list, { paddingHorizontal: H_PAD }]}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.goBack(); }}
        onCancel={() => setGateVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1 },

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
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
    marginTop: 2,
  },
  loader: {
    flex: 1,
    alignSelf: 'center',
  },
  list: {
    paddingVertical: Layout.spacing.md,
  },
  card: {
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImage: {
    width: '70%',
    aspectRatio: 1,
    marginBottom: 8,
  },
  cardImageLocked: {
    opacity: 0.25,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  cardLabelLocked: {
    color: '#AAAAAA',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240,240,240,0.55)',
  },
  passedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  progressDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
