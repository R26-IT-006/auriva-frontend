import { useEffect, useState } from 'react';
import FriendNameStep from './FriendNameStep';
import PetPicker from './PetPicker';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { DMSans_800ExtraBold, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';
import { useToast } from '../../../../context/ToastContext';
import PortraitView from '../../../../components/level2/PortraitView';

// Book-cover style topic images. Self-Introduction's cover isn't generated
// yet — it falls back to the coral gradient + icon below until it is.
const COVER_IMAGES = {
  
  self_introduction: require('../../../../../assets/Level2/Topic_selection/self_introduction.png'),
  describing_friend: require('../../../../../assets/Level2/Topic_selection/describe_friend.png'),
  describing_pet: require('../../../../../assets/Level2/Topic_selection/describe_pet.png'),
  draw_yourself: require('../../../../../assets/Level2/Topic_selection/draw_yourself.png'),
};

// status: 'available' | 'locked'
const TOPICS = [
  { key: 'self_introduction', label: 'Self-Introduction', icon: 'person-outline', status: 'available', from: '#FF9A73', to: '#FF6B45' },
  { key: 'describing_friend', label: 'Describing a Friend', icon: 'people-outline', status: 'available' },
  { key: 'describing_pet', label: 'Describing a Pet', icon: 'paw-outline', status: 'available' },
  { key: 'draw_yourself', label: 'Draw Yourself', icon: 'color-palette-outline', status: 'available' },
];

// Positions as % of the path area, matching the winding SVG road below.
const POSITIONS = {
  self_introduction: { left: '4%', top: '17%' },
  describing_friend: { left: '26%', top: '52%' },
  describing_pet: { left: '52%', top: '15%' },
  draw_yourself: { left: '77%', top: '50%' },
};

const ROAD_PATH = 'M 128,330 C 200,430 280,510 353,530 C 450,550 550,430 619,322 C 700,210 800,400 875,522';

function StatusBadge({ status, theme }) {
  if (status === 'locked') {
    return (
      <View style={[styles.statusBadge, { backgroundColor: 'rgba(20,20,20,0.4)' }]}>
        <Ionicons name="lock-closed" size={13} color="#FFF" />
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: '#F59E0B' }]}>
      <Ionicons name="play" size={13} color="#FFF" />
    </View>
  );
}

function TopicCard({ topic, pos, cardW, cardH, theme, onPress, extraBadge, fontsLoaded }) {
  const locked = topic.status === 'locked';
  const image = COVER_IMAGES[topic.key];

  return (
    <TouchableOpacity
      style={[
        styles.node,
        { left: pos.left, top: pos.top, width: cardW, height: cardH },
      ]}
      activeOpacity={locked ? 1 : 0.85}
      onPress={() => !locked && onPress(topic.key)}
      disabled={locked}
      accessibilityLabel={locked ? `${topic.label}, locked, coming soon` : topic.label}
    >
      <View
        style={[
          styles.card,
          { borderColor: '#F59E0B', backgroundColor: theme.cardSurface },
          !locked && topic.status === 'available' && { borderWidth: 3 },
        ]}
      >
        <View style={styles.thumb}>
          {image ? (
            <Image source={image} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[topic.from ?? '#CBD5E1', topic.to ?? '#94A3B8']}
              style={styles.thumbGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={topic.icon} size={34} color="#FFF" />
            </LinearGradient>
          )}
          {locked && <View style={styles.lockedOverlay} />}
          <StatusBadge status={topic.status} theme={theme} />
          {extraBadge}
        </View>

        <View style={[styles.labelWrap, { backgroundColor: locked ? '#E8EAED' : '#FFFFFF' }]}>
          <Text
            style={[
              styles.topicLabel,
              { color: locked ? '#A0AAB4' : '#1E1B4B' },
              fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', },
            ]}
            numberOfLines={2}
          >
            {topic.label}
          </Text>
          {/* locked: Coming soon label — currently all topics are available */}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function L2TopicSelectionScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const toast = useToast();
  const { width, height } = useWindowDimensions();

  const [loading, setLoading] = useState(false);
  const [portraitStrokes, setPortraitStrokes] = useState(null);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [petModalVisible,    setPetModalVisible]    = useState(false);

  const [fontsLoaded] = useFonts({
    Colora: require('../../../../../assets/fonts/COLORA.ttf'),
    DMSans_800ExtraBold,
    DMSans_600SemiBold,
  });

  useEffect(() => {
    level2Api.getQuestionnaire(student.sid)
      .then((resp) => {
        setPortraitStrokes(resp?.data?.portrait_strokes ?? null);
        setQuestionnaire(resp?.data ?? null);
      })
      .catch(() => { setPortraitStrokes(null); setQuestionnaire(null); });
  }, []);

  async function handleTopicSelect(topicKey) {
    if (topicKey === 'draw_yourself') {
      navigation.navigate('L2Portrait', { student });
      return;
    }

    setLoading(true);
    try {
      const resp = await level2Api.getQuestionnaire(student.sid);
      const q = resp?.data ?? null;
      // Keep local copy in sync so modals always have the latest data
      setQuestionnaire(q);

      if (topicKey === 'self_introduction') {
        if (q) {
          navigation.navigate('L2Loading', { student, questionnaire: q, topic: 'self_introduction' });
        } else {
          navigation.navigate('L2Questionnaire', { student });
        }
        return;
      }

      if (topicKey === 'describing_friend') {
        if (q?.friend_name && q?.friend_gender) {
          // Friend data already saved → start session directly
          navigation.navigate('L2Loading', { student, questionnaire: q, topic: 'describe_friend' });
        } else {
          // Collect friend data first
          setFriendModalVisible(true);
        }
        return;
      }

      if (topicKey === 'describing_pet') {
        if (q?.pet_type) {
          // Pet data already saved → start session directly
          navigation.navigate('L2Loading', { student, questionnaire: q, topic: 'describe_pet' });
        } else {
          // Collect pet data first
          setPetModalVisible(true);
        }
      }
    } catch (err) {
      if (topicKey === 'self_introduction') {
        if (err?.response?.status === 404 || !err?.response) {
          navigation.navigate('L2Questionnaire', { student });
        } else {
          toast.show('Could not load questionnaire. Please try again.', 'error');
        }
      } else {
        // For friend/pet: questionnaire row may not exist yet — open modal anyway
        setQuestionnaire(null);
        if (topicKey === 'describing_friend') setFriendModalVisible(true);
        else if (topicKey === 'describing_pet')  setPetModalVisible(true);
      }
    } finally {
      setLoading(false);
    }
  }

  const cardW = Math.min(width * 0.19, 200);
  const cardH = cardW * 1.12;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Top bar: back | title ── same icon circle + 34pt heading as the
            other module landing pages (LetterPractice / LetterHome / DialogueLanding). */}
        <View style={styles.topBar}>
          <View style={styles.sideGroup}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('DialogueLanding', { student })}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={theme.headingText} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="chatbubbles" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Choose a Topic</Text>
          </View>

          <View style={styles.sideGroup} />
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]} numberOfLines={1}>
          Level 2 · Sentence Construction
        </Text>

        <View style={styles.pathArea}>
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 1024 768"
            preserveAspectRatio="xMidYMid slice"
          >
            <Path d={ROAD_PATH} stroke="#C8A030" strokeWidth={66} fill="none" strokeLinecap="round" opacity={0.28} />
            <Path d={ROAD_PATH} stroke="#F2D980" strokeWidth={58} fill="none" strokeLinecap="round" />
            <Path
              d={ROAD_PATH}
              stroke="#D4B038"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="22 13"
              opacity={0.65}
            />
          </Svg>

          {TOPICS.map((topic) => (
            <TopicCard
              key={topic.key}
              topic={topic}
              pos={POSITIONS[topic.key]}
              cardW={cardW}
              cardH={cardH}
              theme={theme}
              onPress={handleTopicSelect}
              fontsLoaded={fontsLoaded}
              extraBadge={
                topic.key === 'draw_yourself' && portraitStrokes ? (
                  <View style={styles.portraitPreview}>
                    <PortraitView strokes={portraitStrokes} size={26} />
                  </View>
                ) : null
              }
            />
          ))}
        </View>

        {loading && <ActivityIndicator color={theme.button} size="large" style={styles.loadingSpinner} />}

        {/* describe_friend data capture */}
        <FriendNameStep
          visible={friendModalVisible}
          student={student}
          existing={questionnaire}
          onSaved={(fields) => {
            setFriendModalVisible(false);
            navigation.navigate('L2Loading', {
              student,
              questionnaire: { ...questionnaire, ...fields },
              topic: 'describe_friend',
            });
          }}
          onCancel={() => setFriendModalVisible(false)}
        />

        {/* describe_pet data capture */}
        <PetPicker
          visible={petModalVisible}
          student={student}
          existing={questionnaire}
          onSaved={(fields) => {
            setPetModalVisible(false);
            navigation.navigate('L2Loading', {
              student,
              questionnaire: { ...questionnaire, ...fields },
              topic: 'describe_pet',
            });
          }}
          onCancel={() => setPetModalVisible(false)}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, overflow: 'hidden' },
  // Decorative background shapes (same as the other module screens).
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.08 },
  blobTopRight:   { width: 220, height: 220, top: -60, right: -60 },
  blobBottomLeft: { width: 260, height: 260, bottom: -80, left: -80 },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',   // back button stays in the corner while the title sits lower
  },
  // Concept's round translucent header button.
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
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
    marginTop: 36,
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
    marginTop: 2,
    paddingHorizontal: Layout.spacing.lg,
  },

  pathArea: { flex: 1, position: 'relative', marginTop: 28 },

  node: { position: 'absolute' },
  card: {
    flex: 1, borderRadius: 20, borderWidth: 2, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 5,
  },
  thumb: { height: '62%', position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  thumbGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(120,120,120,0.35)' },

  statusBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
  },
  portraitPreview: {
    position: 'absolute', bottom: 8, left: 8,
    width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
    borderWidth: 2, borderColor: '#FFF', backgroundColor: '#FFF',
  },

  labelWrap: { flex: 1, padding: 8, justifyContent: 'center', alignItems: 'center' },
  topicLabel: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', lineHeight: 16, textAlign: 'center' },
  topicSub: { fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_600SemiBold', marginTop: 2, textAlign: 'center' },

  loadingSpinner: { position: 'absolute', bottom: 24, alignSelf: 'center' },
});