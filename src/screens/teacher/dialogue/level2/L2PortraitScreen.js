import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';
import { useToast } from '../../../../context/ToastContext';
import DrawingCanvas from '../../../../components/level2/DrawingCanvas';

/**
 * TASK-07's shared instruction-audio player isn't wired up yet.
 * Local stub — logs the instruction id it would have played.
 * New instruction ids introduced here (record for the TASK-07 manifest):
 *   - l2_portrait_intro
 */
async function playInstruction(id) {
  console.log(`[instruction] ${id}`);
}

export default function L2PortraitScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const toast = useToast();

  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [initialStrokes, setInitialStrokes] = useState(null);
  const [strokesJson, setStrokesJson]   = useState(null);

  useEffect(() => {
    playInstruction('l2_portrait_intro');
    loadQuestionnaire();
  }, []);

  async function loadQuestionnaire() {
    setLoading(true);
    try {
      const resp = await level2Api.getQuestionnaire(student.sid);
      setQuestionnaire(resp.data);
      setInitialStrokes(resp.data?.portrait_strokes ?? null);
    } catch (err) {
      // No questionnaire yet, or fetch failed — the portrait never blocks progress.
      setQuestionnaire(null);
      setInitialStrokes(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await level2Api.savePortrait(student.sid, strokesJson);
      navigation.goBack();
    } catch (err) {
      toast.show('Could not save the picture. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    navigation.goBack();
  }

  const name = questionnaire?.child_first_name;
  const greeting = name ? `Hello! I'm ${name}` : 'Hello!';

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.iconBtn, { borderColor: theme.cardOutline }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.headingText }]}>Draw yourself</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.button} size="large" />
          </View>
        ) : (
          <View style={styles.body}>
            <View style={[styles.speechBubble, { borderColor: theme.cardOutline, backgroundColor: theme.cardSurface }]}>
              <Text style={[styles.speechText, { color: theme.headingText }]}>{greeting}</Text>
            </View>

            <DrawingCanvas
              initialStrokes={initialStrokes}
              onChange={setStrokesJson}
              disabled={saving}
            />

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.footerBtn, styles.skipBtn, { borderColor: theme.cardOutline }]}
                onPress={handleSkip}
                activeOpacity={0.8}
                disabled={saving}
              >
                <Text style={[styles.skipBtnText, { color: theme.headingText }]}>Skip / Done later</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: theme.button }]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={theme.buttonText} /> : (
                  <Text style={[styles.saveBtnText, { color: theme.buttonText }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Layout.fontSize.xl, fontWeight: '800' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: Layout.spacing.lg, paddingBottom: Layout.spacing.md, gap: Layout.spacing.sm },
  speechBubble: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: Layout.radius.lg, paddingHorizontal: Layout.spacing.md, paddingVertical: Layout.spacing.sm },
  speechText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  footerRow: { flexDirection: 'row', gap: Layout.spacing.md },
  footerBtn: { flex: 1, borderRadius: Layout.radius.full, paddingVertical: Layout.spacing.md, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)' },
  skipBtnText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  saveBtnText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
});
