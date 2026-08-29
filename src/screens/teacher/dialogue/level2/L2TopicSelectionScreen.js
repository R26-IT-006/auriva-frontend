import { useEffect, useState } from 'react';
import FriendNameStep from './FriendNameStep';
import PetPicker from './PetPicker';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Ellipse, Circle, Rect, G } from 'react-native-svg';
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
              fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', fontWeight: 'normal' },
            ]}
            numberOfLines={2}
          >
            {topic.label}
          </Text>
          {locked && (
            <Text
              style={[
                styles.topicSub,
                { color: '#C8D0D8' },
                fontsLoaded && { fontFamily: 'DMSans_600SemiBold', fontWeight: 'normal' },
              ]}
            >
              Coming soon
            </Text>
          )}
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
      colors={['#b2e8ff', '#c5f0d8', '#8acc8a']}
      locations={[0, 0.48, 1]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('DialogueLanding', { student })}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#1a3880" />
          </TouchableOpacity>
        </View>

        <View style={styles.titleArea}>
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 1024 260"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Sun */}
            <Circle cx="932" cy="78" r="40" fill="#FFE44D" opacity={0.9} />
            <Circle cx="932" cy="78" r="58" fill="#FFE44D" opacity={0.18} />

            {/* Clouds */}
            <G opacity={0.9}>
              <Ellipse cx="128" cy="68" rx="56" ry="27" fill="white" />
              <Ellipse cx="164" cy="58" rx="40" ry="24" fill="white" />
              <Ellipse cx="98" cy="61" rx="34" ry="21" fill="white" />
            </G>
            <G opacity={0.85}>
              <Ellipse cx="532" cy="80" rx="50" ry="23" fill="white" />
              <Ellipse cx="564" cy="70" rx="36" ry="20" fill="white" />
              <Ellipse cx="506" cy="73" rx="32" ry="19" fill="white" />
            </G>
            <G opacity={0.55}>
              <Ellipse cx="340" cy="105" rx="36" ry="17" fill="white" />
              <Ellipse cx="364" cy="97" rx="26" ry="15" fill="white" />
            </G>
          </Svg>

          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>LEVEL 2</Text>
          </View>
          <Text
            style={[
              styles.heading,
              { color: '#1a3880' },
              fontsLoaded && { fontFamily: 'Colora', fontWeight: 'normal' },
            ]}
          >
            Choose a Topic
          </Text>
          <Text
            style={[
              styles.sub,
              fontsLoaded && { fontFamily: 'Colora', fontWeight: 'normal' },
            ]}
          >
            Sentence Construction
          </Text>
        </View>

        <View style={styles.pathArea}>
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 1024 768"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Rolling hills */}
            <Ellipse cx="160" cy="780" rx="380" ry="230" fill="#52a852" opacity={0.3} />
            <Ellipse cx="530" cy="780" rx="450" ry="210" fill="#47a047" opacity={0.25} />
            <Ellipse cx="900" cy="780" rx="340" ry="200" fill="#52a852" opacity={0.3} />
            <Ellipse cx="512" cy="775" rx="680" ry="110" fill="#6abf6a" opacity={0.28} />

            {/* Sun */}
            <Circle cx="932" cy="78" r="40" fill="#FFE44D" opacity={0.9} />
            <Circle cx="932" cy="78" r="58" fill="#FFE44D" opacity={0.18} />

            {/* Clouds */}
            <G opacity={0.9}>
              <Ellipse cx="128" cy="68" rx="56" ry="27" fill="white" />
              <Ellipse cx="164" cy="58" rx="40" ry="24" fill="white" />
              <Ellipse cx="98" cy="61" rx="34" ry="21" fill="white" />
            </G>
            <G opacity={0.85}>
              <Ellipse cx="532" cy="80" rx="50" ry="23" fill="white" />
              <Ellipse cx="564" cy="70" rx="36" ry="20" fill="white" />
              <Ellipse cx="506" cy="73" rx="32" ry="19" fill="white" />
            </G>
            <G opacity={0.55}>
              <Ellipse cx="340" cy="105" rx="36" ry="17" fill="white" />
              <Ellipse cx="364" cy="97" rx="26" ry="15" fill="white" />
            </G>

            {/* Trees */}
            <Rect x="30" y="570" width="13" height="55" fill="#7B4010" rx="3" />
            <Circle cx="36" cy="558" r="34" fill="#2a7a2a" />
            <Circle cx="36" cy="542" r="24" fill="#3a9a3a" />

            <Rect x="200" y="582" width="11" height="46" fill="#7B4010" rx="3" />
            <Circle cx="205" cy="572" r="27" fill="#2a7a2a" />
            <Circle cx="205" cy="558" r="19" fill="#3a9a3a" />

            <Rect x="740" y="578" width="11" height="44" fill="#7B4010" rx="3" />
            <Circle cx="745" cy="568" r="26" fill="#2a7a2a" />
            <Circle cx="745" cy="554" r="18" fill="#3a9a3a" />

            <Rect x="964" y="565" width="13" height="54" fill="#7B4010" rx="3" />
            <Circle cx="970" cy="554" r="32" fill="#2a7a2a" />
            <Circle cx="970" cy="540" r="22" fill="#3a9a3a" />

            {/* Mushroom */}
            <Rect x="490" y="580" width="10" height="22" fill="#E8D5A8" rx="2" />
            <Ellipse cx="495" cy="577" rx="18" ry="13" fill="#CC2222" />
            <Circle cx="490" cy="572" r="3.2" fill="white" opacity={0.85} />
            <Circle cx="501" cy="574" r="2.6" fill="white" opacity={0.85} />
            <Circle cx="495" cy="580" r="2" fill="white" opacity={0.85} />

            {/* Flowers */}
            <G transform="translate(290,572)">
              <Circle cx="0" cy="-8" r="5.5" fill="#FF69B4" />
              <Circle cx="8" cy="0" r="5.5" fill="#FF69B4" />
              <Circle cx="0" cy="8" r="5.5" fill="#FF69B4" />
              <Circle cx="-8" cy="0" r="5.5" fill="#FF69B4" />
              <Circle cx="0" cy="0" r="5" fill="#FFD700" />
            </G>
            <G transform="translate(650,566)">
              <Circle cx="0" cy="-7" r="5" fill="#FF7F50" />
              <Circle cx="7" cy="0" r="5" fill="#FF7F50" />
              <Circle cx="0" cy="7" r="5" fill="#FF7F50" />
              <Circle cx="-7" cy="0" r="5" fill="#FF7F50" />
              <Circle cx="0" cy="0" r="4.5" fill="#FFD700" />
            </G>
            <G transform="translate(820,578)">
              <Circle cx="0" cy="-6" r="4.5" fill="#DA70D6" />
              <Circle cx="6" cy="0" r="4.5" fill="#DA70D6" />
              <Circle cx="0" cy="6" r="4.5" fill="#DA70D6" />
              <Circle cx="-6" cy="0" r="4.5" fill="#DA70D6" />
              <Circle cx="0" cy="0" r="4" fill="#FFD700" />
            </G>

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
  gradient: { flex: 1 },
  safe: { flex: 1 },

  topBar: { paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(26,56,128,0.25)',
    backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center',
  },

  titleArea: { alignItems: 'center', paddingHorizontal: Layout.spacing.lg, gap: 6 },
  levelBadge: {
    backgroundColor: '#F59E0B', paddingHorizontal: 22, paddingVertical: 7,
    borderRadius: 100,
  },
  levelBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  heading: { fontSize: 40, fontWeight: '900', letterSpacing: -0.5 },
  sub: { fontSize: 22, fontWeight: '500', color: '#1a3880', opacity: 0.65 },

  pathArea: { flex: 1, position: 'relative', marginTop: -Layout.spacing.xs },

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
  topicLabel: { fontSize: Layout.fontSize.sm, fontWeight: '700', lineHeight: 16, textAlign: 'center' },
  topicSub: { fontSize: Layout.fontSize.xs, fontWeight: '600', marginTop: 2, textAlign: 'center' },

  loadingSpinner: { position: 'absolute', bottom: 24, alignSelf: 'center' },
});