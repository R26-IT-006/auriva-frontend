import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';
import { useToast } from '../../../../context/ToastContext';
import PortraitView from '../../../../components/level2/PortraitView';

const TOPICS = [
  { key: 'self_introduction', label: 'Self-Introduction', icon: 'person-outline', active: true },
  { key: 'describing_friend', label: 'Describing a Friend', icon: 'people-outline', active: false },
  { key: 'describing_pet',    label: 'Describing a Pet',   icon: 'paw-outline',    active: false },
];

export default function L2TopicSelectionScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme       = getAvatarTheme(student?.avatar_key);
  const toast       = useToast();
  const { width }   = useWindowDimensions();
  const cardWidth   = Math.min(width * 0.82, 440);

  const [loading, setLoading] = useState(false);
  const [portraitStrokes, setPortraitStrokes] = useState(null);

  useEffect(() => {
    level2Api.getQuestionnaire(student.sid)
      .then((resp) => setPortraitStrokes(resp?.data?.portrait_strokes ?? null))
      .catch(() => setPortraitStrokes(null));
  }, []);

  async function handleTopicSelect(topicKey) {
    if (topicKey !== 'self_introduction') return;
    setLoading(true);
    try {
      const resp = await level2Api.getQuestionnaire(student.sid);
      // Questionnaire exists – go to loading/session start
      if (resp?.data) {
        navigation.navigate('L2Loading', { student, questionnaire: resp.data });
      } else {
        navigation.navigate('L2Questionnaire', { student });
      }
    } catch (err) {
      if (err?.response?.status === 404 || !err?.response) {
        // No questionnaire yet
        navigation.navigate('L2Questionnaire', { student });
      } else {
        toast.show('Could not load questionnaire. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.iconBtn, { borderColor: theme.cardOutline }]} onPress={() => navigation.navigate('DialogueLanding', { student })} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={[styles.heading, { color: theme.headingText }]}>Choose a Topic</Text>
          <Text style={[styles.headingSinhala, { color: theme.headingText }]}>මාතෘකාවක් තෝරන්න</Text>
          <Text style={[styles.sub, { color: theme.headingText }]}>Level 2 · Sentence Construction  ·  මට්ටම 2 · වාක්‍ය ගොඩනැගීම</Text>

          <View style={styles.topicList}>
            {TOPICS.map((topic) => (
              <TouchableOpacity
                key={topic.key}
                style={[
                  styles.topicCard,
                  { width: cardWidth, borderColor: theme.cardOutline, backgroundColor: theme.cardSurface },
                  !topic.active && styles.topicCardLocked,
                ]}
                activeOpacity={topic.active ? 0.82 : 1}
                onPress={() => topic.active && handleTopicSelect(topic.key)}
              >
                <View style={[styles.iconWrap, { backgroundColor: topic.active ? theme.button : '#CCC' }]}>
                  <Ionicons name={topic.icon} size={26} color="#FFF" />
                </View>
                <View style={styles.topicTextWrap}>
                  <Text style={[styles.topicLabel, { color: topic.active ? theme.headingText : '#999' }]}>
                    {topic.label}
                  </Text>
                  {!topic.active && (
                    <View style={styles.lockedBadge}>
                      <Ionicons name="lock-closed" size={12} color="#999" />
                      <Text style={styles.lockedText}>Coming Soon</Text>
                    </View>
                  )}
                </View>
                {topic.active && <Ionicons name="chevron-forward" size={20} color={theme.cardOutline} />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.topicCard, { width: cardWidth, borderColor: theme.cardOutline, backgroundColor: theme.cardSurface }]}
            activeOpacity={0.82}
            onPress={() => navigation.navigate('L2Portrait', { student })}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.button }]}>
              {portraitStrokes ? (
                <PortraitView strokes={portraitStrokes} size={48} />
              ) : (
                <Ionicons name="color-palette-outline" size={26} color="#FFF" />
              )}
            </View>
            <View style={styles.topicTextWrap}>
              <Text style={[styles.topicLabel, { color: theme.headingText }]}>Draw yourself</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.cardOutline} />
          </TouchableOpacity>

          {loading && <ActivityIndicator color={theme.button} size="large" style={{ marginTop: 16 }} />}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: { paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Layout.spacing.lg, gap: Layout.spacing.md },
  heading: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headingSinhala: { fontSize: Layout.fontSize.md, fontWeight: '600', opacity: 0.65, marginTop: -4 },
  sub: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.55, marginBottom: Layout.spacing.sm },
  topicList: { width: '100%', alignItems: 'center', gap: Layout.spacing.md },
  topicCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 2, padding: Layout.spacing.lg, gap: Layout.spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  topicCardLocked: { opacity: 0.55 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  topicTextWrap: { flex: 1 },
  topicLabel: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  lockedText: { fontSize: Layout.fontSize.xs, color: '#999', fontWeight: '600' },
});
