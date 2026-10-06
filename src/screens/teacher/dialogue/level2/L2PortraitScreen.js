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
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';

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

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Same icon circle + 34pt heading as the other module landing pages. */}
        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.iconBtn, BACK_BUTTON]} onPress={() => navigation.goBack()} activeOpacity={0.7} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="color-palette" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Draw Yourself</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.button} size="large" />
          </View>
        ) : (
          <View style={styles.body}>
            <DrawingCanvas
              initialStrokes={initialStrokes}
              onChange={setStrokesJson}
              disabled={saving}
              toolbarFooter={
                // Save sits at the bottom of the Colours / Brush panel.
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.button }]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color={theme.buttonText} /> : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={theme.buttonText} />
                      <Text style={[styles.saveBtnText, { color: theme.buttonText }]}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              }
            />
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
  // Concept's round translucent header button.
  iconBtn: {
    width: rs(44), height: rs(44), borderRadius: rs(22), alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',   // stays in the corner while the title sits lower
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: rs(10), marginTop: rs(16) },
  titleIconCircle: {
    width: rs(30), height: rs(30), borderRadius: rs(15), alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 3,
  },
  title: { fontSize: rf(28), fontFamily: 'DMSans_800ExtraBold', letterSpacing: -0.3 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Extra side / top / bottom room keeps the canvas a little smaller and centred.
  body: { flex: 1, paddingHorizontal: rs(64), paddingTop: rs(12), paddingBottom: rs(28), gap: Layout.spacing.sm },
  // Raised 3D button, like the ones used in the other modules.
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8),
    height: rs(52), borderRadius: rs(16),
    borderBottomWidth: 5, borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
  },
  saveBtnText: { fontSize: rf(18), fontFamily: 'DMSans_800ExtraBold' },
});
