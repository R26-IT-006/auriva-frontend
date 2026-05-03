import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { Layout } from '../../../constants/layout';

const CATEGORIES = [
  { key: 'colors',        label: 'Colors',               image: require('../../../../assets/concepts/category-images/Colors.png') },
  { key: 'shapes',        label: 'Shapes',               image: require('../../../../assets/concepts/category-images/Shapes.png') },
  { key: 'numbers',       label: 'Numbers',              image: require('../../../../assets/concepts/category-images/Numbers.png') },
  { key: 'classroom',     label: 'Classroom Objects',    image: require('../../../../assets/concepts/category-images/Classroom Objects.png') },
  { key: 'household',     label: 'Household Items',      image: require('../../../../assets/concepts/category-images/Household Items.png') },
  { key: 'house',         label: 'House Parts',          image: require('../../../../assets/concepts/category-images/House.png') },
  { key: 'nature',        label: 'Natural Environment',  image: require('../../../../assets/concepts/category-images/Nature.png') },
  { key: 'family',        label: 'Family Members',       image: require('../../../../assets/concepts/category-images/Family.png') },
  { key: 'professionals', label: 'Professionals',        image: require('../../../../assets/concepts/category-images/Professionals.png') },
  { key: 'animals',       label: 'Animals',              image: require('../../../../assets/concepts/category-images/Animals.png') },
  { key: 'fruits',        label: 'Fruits',               image: require('../../../../assets/concepts/category-images/Fruits.png') },
];

export default function ConceptCategoriesScreen({ route, navigation }) {
  const student = route.params?.student;
  const { width, height } = useWindowDimensions();
  const [gateVisible, setGateVisible] = useState(false);

  const theme       = getAvatarTheme(student?.avatar_key);
  const isLandscape = width > height;
  const VISIBLE = isLandscape ? 4 : 2;
  const H_PAD   = Layout.spacing.md;
  const GAP     = 12;
  const cardW   = (width - H_PAD * 2 - GAP * (VISIBLE - 1)) / VISIBLE;
  const cardH   = cardW * 0.85;
  const snapInterval = cardW + GAP;

  function renderCard({ item, index }) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, { width: cardW, height: cardH, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}
        onPress={() => navigation.navigate('ConceptItems', { student, category: item })}
      >
        <View style={[styles.badge, { backgroundColor: theme.cardOutline }]}>
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <Image source={item.image} style={styles.cardImage} resizeMode="contain" />
        <Text style={styles.cardLabel} numberOfLines={2}>
          {item.label}
        </Text>
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
            <Ionicons name="bulb-outline" size={20} color={theme.headingText} />
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
          horizontal
          renderItem={renderCard}
          contentContainerStyle={[styles.list, { paddingHorizontal: H_PAD }]}
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
        />
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
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
  },
  card: {
    borderRadius: 20,
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFF',
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
});