import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';
import { useToast } from '../../../../context/ToastContext';
import BadgeNameInput, { NameBadge } from '../../../../components/level2/BadgeNameInput';
import AgePicker from '../../../../components/level2/AgePicker';
import HometownPicker from '../../../../components/level2/HometownPicker';
import SinhalaNameInput from '../../../../components/level2/SinhalaNameInput';

const ALL_ACTIVITIES = ['Singing', 'Dancing', 'Art', 'Cricket', 'Games', 'Reading'];
const ACTIVITY_ICONS = { Singing: 'musical-notes-outline', Dancing: 'body-outline', Art: 'color-palette-outline', Cricket: 'baseball-outline', Games: 'game-controller-outline', Reading: 'book-outline' };

const STEPS = ['badge', 'age', 'hometown', 'gender', 'activities', 'review'];

const STEP_COPY = [
  { child: "What's your name?",          teacher: "Child's First Name" },
  { child: 'How old are you?',           teacher: 'Age' },
  { child: 'Where do you live?',         teacher: 'Hometown' },
  { child: 'Boy or girl?',               teacher: 'Gender' },
  { child: 'What do you like to do?',    teacher: 'Favourite Activities  (choose up to 3)' },
  { child: "Let's see your badge!",      teacher: 'Review together, then save.' },
];

/**
 * TASK-07's shared instruction-audio player isn't wired up yet.
 * Local stub — logs the instruction id it would have played.
 * New instruction ids introduced here (record for the TASK-07 manifest):
 *   - l2_quest_badge, l2_quest_age, l2_quest_hometown, l2_quest_gender,
 *     l2_quest_activities, l2_quest_review, l2_quest_review_replay
 *   - l2_age_5 .. l2_age_12 (played from AgePicker on tap)
 */
async function playInstruction(id) {
  console.log(`[instruction] ${id}`);
}

export default function L2QuestionnaireScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const toast = useToast();

  const [step,        setStep]       = useState(0);
  const [name,       setName]       = useState('');
  const [nameSinhala, setNameSinhala] = useState('');
  const [age,        setAge]        = useState(null);
  const [hometown,   setHometown]   = useState('');
  const [gender,     setGender]     = useState(null); // 'boy' | 'girl'
  const [activities, setActivities] = useState([]);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    playInstruction(`l2_quest_${STEPS[step]}`);
  }, [step]);

  function toggleActivity(act) {
    setActivities(prev => prev.includes(act) ? prev.filter(a => a !== act) : prev.length < 3 ? [...prev, act] : prev);
  }

  async function handleSave() {
    if (!name.trim())        return toast.show("Please enter the child's name.", 'error');
    if (!age || isNaN(Number(age)) || Number(age) < 1 || Number(age) > 18)
      return toast.show('Please enter a valid age (1–18).', 'error');
    if (!hometown.trim())    return toast.show("Please enter the child's hometown.", 'error');
    if (!gender)             return toast.show('Please select a gender.', 'error');
    if (activities.length < 1) return toast.show('Please select at least one activity.', 'error');

    setSaving(true);
    try {
      await level2Api.saveQuestionnaire(student.sid, {
        child_first_name:    name.trim(),
        child_first_name_sinhala: nameSinhala.trim() || null,
        child_age:           Number(age),
        child_hometown:      hometown.trim(),
        child_gender:        gender,
        favourite_activities: activities,
      });
      const resp = await level2Api.getQuestionnaire(student.sid);
      navigation.replace('L2Loading', { student, questionnaire: resp.data });
    } catch (err) {
      toast.show('Could not save questionnaire. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const stepValid = [
    name.trim().length > 0,
    age != null,
    hometown.trim().length > 0,
    !!gender,
    activities.length >= 1,
    true,
  ][step];

  function handleBack() {
    if (step === 0) return navigation.goBack();
    setStep(s => s - 1);
  }

  function handleNext() {
    if (!stepValid) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  const btn = { backgroundColor: theme.button };
  const outline = { borderColor: theme.cardOutline };
  const copy = STEP_COPY[step];
  const isReview = step === STEPS.length - 1;

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleBack} activeOpacity={0.7} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          {/* Step progress: the current step is a wider filled pill. */}
          <View style={styles.stepPill}>
            <View style={styles.dots}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    { backgroundColor: i <= step ? theme.button : theme.cardOutline + '55' },
                    i === step && styles.dotActive,
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.stepText, { color: theme.headingText }]}>
              {`Step ${step + 1} of ${STEPS.length}`}
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* White question card framed in the theme outline, like the other modules. */}
          <View style={[styles.card, { borderColor: theme.cardOutline }]}>
            <Text style={[styles.childText, { color: theme.headingText }]}>{copy.child}</Text>
            <Text style={[styles.teacherCaption, { color: theme.headingText }]}>{copy.teacher}</Text>

            <View style={styles.cardBody}>
              {step === 0 && (
                <>
                  <BadgeNameInput name={name} onChangeName={setName} theme={theme} />
                  <SinhalaNameInput
                    label="Sinhala Spelling"
                    englishValue={name}
                    sinhalaValue={nameSinhala}
                    onSinhalaChange={setNameSinhala}
                    theme={theme}
                  />
                </>
              )}

              {step === 1 && (
                <AgePicker age={age} onSelect={setAge} theme={theme} playInstruction={playInstruction} />
              )}

              {step === 2 && (
                <HometownPicker hometown={hometown} onSelect={setHometown} theme={theme} />
              )}

              {step === 3 && (
                <View style={styles.genderRow}>
                  {['boy', 'girl'].map(g => {
                    const sel = gender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[styles.choiceBtn, styles.genderBtn, outline, sel && { backgroundColor: theme.button, borderColor: theme.button }]}
                        onPress={() => setGender(g)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={g === 'boy' ? 'male' : 'female'} size={30} color={sel ? '#FFF' : theme.button} />
                        <Text style={[styles.genderLabel, { color: sel ? '#FFF' : theme.headingText }]}>{g === 'boy' ? 'Boy' : 'Girl'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {step === 4 && (
                <View style={styles.actGrid}>
                  {ALL_ACTIVITIES.map(act => {
                    const sel = activities.includes(act);
                    return (
                      <TouchableOpacity
                        key={act}
                        style={[styles.choiceBtn, styles.actCard, outline, sel && { backgroundColor: theme.button, borderColor: theme.button }]}
                        onPress={() => toggleActivity(act)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={ACTIVITY_ICONS[act]} size={26} color={sel ? '#FFF' : theme.button} />
                        <Text style={[styles.actLabel, { color: sel ? '#FFF' : theme.headingText }]}>{act}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {isReview && (
                <View style={styles.review}>
                  <NameBadge name={name} theme={theme} />
                  <Text style={[styles.summary, { color: theme.headingText }]}>
                    {`Hello! I'm ${name}. I'm ${age}. I live in ${hometown}.`}
                  </Text>
                  <Text style={[styles.reviewMeta, { color: theme.headingText }]}>
                    {(gender === 'boy' ? 'Boy' : gender === 'girl' ? 'Girl' : '')}{activities.length ? `  ·  ${activities.join(', ')}` : ''}
                  </Text>
                  <TouchableOpacity
                    style={[styles.replayBtn, outline]}
                    onPress={() => playInstruction('l2_quest_review_replay')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="volume-high" size={18} color={theme.button} />
                    <Text style={[styles.replayText, { color: theme.headingText }]}>Play again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footerRow}>
          {isReview ? (
            <TouchableOpacity style={[styles.footerBtn, btn]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
              {saving ? <ActivityIndicator color={theme.buttonText} /> : <Text style={[styles.footerBtnText, { color: theme.buttonText }]}>Save & Continue</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.footerBtn, btn, !stepValid && styles.disabledBtn]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!stepValid}
            >
              <Text style={[styles.footerBtnText, { color: theme.buttonText }]}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.buttonText} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1 },

  // Decorative background shapes (same as the other module screens).
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.08 },
  blobTopRight:   { width: 220, height: 220, top: -60, right: -60 },
  blobBottomLeft: { width: 260, height: 260, bottom: -80, left: -80 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm },
  // Concept's round translucent header button.
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  stepPill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotActive: { width: 26 },
  stepText: { fontSize: 13, fontFamily: 'DMSans_700Bold', opacity: 0.7 },

  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md },
  card: {
    width: '100%', maxWidth: 620, alignSelf: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 3,
    paddingHorizontal: 32, paddingTop: 28, paddingBottom: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  childText: { fontSize: 30, fontFamily: 'DMSans_800ExtraBold', textAlign: 'center', letterSpacing: -0.3 },
  teacherCaption: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', opacity: 0.55, textAlign: 'center', marginTop: 4 },
  cardBody: { marginTop: 24, gap: Layout.spacing.lg },

  // Raised 3D choice tiles, like the buttons used in the other modules.
  choiceBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 2, borderBottomWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  genderRow: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  genderBtn: { flex: 1, maxWidth: 190, gap: 8, paddingVertical: 22 },
  genderLabel: { fontSize: 20, fontFamily: 'DMSans_800ExtraBold' },
  actGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  actCard: { gap: 6, paddingVertical: 14, width: 150 },
  actLabel: { fontSize: 16, fontFamily: 'DMSans_800ExtraBold' },

  review: { alignItems: 'center', gap: Layout.spacing.md },
  summary: { fontSize: 20, fontFamily: 'DMSans_700Bold', textAlign: 'center', lineHeight: 28 },
  reviewMeta: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', opacity: 0.6, textAlign: 'center' },
  replayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 2, borderBottomWidth: 4,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  replayText: { fontSize: 15, fontFamily: 'DMSans_800ExtraBold' },

  footerRow: { alignItems: 'center', paddingHorizontal: Layout.spacing.lg, paddingBottom: Layout.spacing.lg, paddingTop: Layout.spacing.sm },
  // Raised 3D button, like the ones used in the other modules.
  footerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minWidth: 280, paddingHorizontal: 40, paddingVertical: 16,
    borderRadius: 16, borderBottomWidth: 5, borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
  },
  footerBtnText: { fontSize: 19, fontFamily: 'DMSans_800ExtraBold' },
  disabledBtn: { opacity: 0.4 },
});
