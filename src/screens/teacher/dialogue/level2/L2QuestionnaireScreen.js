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

const ALL_ACTIVITIES = ['Singing', 'Dancing', 'Art', 'Cricket', 'Games', 'Reading'];
const ACTIVITY_ICONS = { Singing: 'musical-notes-outline', Dancing: 'body-outline', Art: 'color-palette-outline', Cricket: 'baseball-outline', Games: 'game-controller-outline', Reading: 'book-outline' };

const STEPS = ['badge', 'age', 'hometown', 'gender', 'activities', 'review'];

const STEP_COPY = [
  { child: "What's your name?",          teacher: "Child's First Name  ·  දරුවාගේ නම" },
  { child: 'How old are you?',           teacher: 'Age  ·  වයස' },
  { child: 'Where do you live?',         teacher: 'Hometown  ·  නිවසේ ප්‍රදේශය' },
  { child: 'Boy or girl?',               teacher: 'Gender  ·  ස්ත්‍රී/පුරුෂ' },
  { child: 'What do you like to do?',    teacher: 'Favourite Activities  ·  ප්‍රිය ක්‍රීයා  (choose up to 3)' },
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.iconBtn, outline]} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.dot,
                  { borderColor: theme.button },
                  i === step && { backgroundColor: theme.button },
                ]}
              />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.childText, { color: theme.headingText }]}>{copy.child}</Text>
          <Text style={[styles.teacherCaption, { color: theme.headingText }]}>{copy.teacher}</Text>

          {step === 0 && (
            <BadgeNameInput name={name} onChangeName={setName} theme={theme} />
          )}

          {step === 1 && (
            <AgePicker age={age} onSelect={setAge} theme={theme} playInstruction={playInstruction} />
          )}

          {step === 2 && (
            <HometownPicker hometown={hometown} onSelect={setHometown} theme={theme} />
          )}

          {step === 3 && (
            <View style={styles.genderRow}>
              {['boy', 'girl'].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBtn, outline, gender === g && { backgroundColor: theme.button, borderColor: theme.button }]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={g === 'boy' ? 'male-outline' : 'female-outline'} size={22} color={gender === g ? '#FFF' : theme.headingText} />
                  <Text style={[styles.genderLabel, { color: gender === g ? '#FFF' : theme.headingText }]}>{g === 'boy' ? 'Boy' : 'Girl'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 4 && (
            <View style={styles.actGrid}>
              {ALL_ACTIVITIES.map(act => {
                const sel = activities.includes(act);
                return (
                  <TouchableOpacity
                    key={act}
                    style={[styles.actCard, outline, sel && { backgroundColor: theme.button, borderColor: theme.button }]}
                    onPress={() => toggleActivity(act)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={ACTIVITY_ICONS[act]} size={22} color={sel ? '#FFF' : theme.headingText} />
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
                <Ionicons name="volume-high-outline" size={18} color={theme.headingText} />
                <Text style={[styles.replayText, { color: theme.headingText }]}>Play again</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: Layout.spacing.md }} />
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
              <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.md, gap: Layout.spacing.md, flexGrow: 1 },
  childText: { fontSize: Layout.fontSize.xxl, fontWeight: '800', textAlign: 'center' },
  teacherCaption: { fontSize: Layout.fontSize.xs, fontWeight: '500', opacity: 0.55, textAlign: 'center', marginTop: -4 },
  genderRow: { flexDirection: 'row', gap: Layout.spacing.md, justifyContent: 'center' },
  genderBtn: { flex: 1, maxWidth: 160, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Layout.radius.md, borderWidth: 1.5, paddingVertical: Layout.spacing.md, backgroundColor: 'rgba(255,255,255,0.85)' },
  genderLabel: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  actGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.sm, justifyContent: 'center' },
  actCard: { alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Layout.radius.md, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: Layout.spacing.md, backgroundColor: 'rgba(255,255,255,0.85)', minWidth: 90 },
  actLabel: { fontSize: Layout.fontSize.xs, fontWeight: '700' },
  review: { alignItems: 'center', gap: Layout.spacing.md },
  summary: { fontSize: Layout.fontSize.lg, fontWeight: '600', textAlign: 'center', lineHeight: 26 },
  reviewMeta: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.6, textAlign: 'center' },
  replayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Layout.radius.full, borderWidth: 1.5, paddingHorizontal: Layout.spacing.md, paddingVertical: Layout.spacing.sm, backgroundColor: 'rgba(255,255,255,0.7)' },
  replayText: { fontSize: Layout.fontSize.sm, fontWeight: '700' },
  footerRow: { paddingHorizontal: Layout.spacing.lg, paddingBottom: Layout.spacing.md, paddingTop: Layout.spacing.sm },
  footerBtn: { flexDirection: 'row', borderRadius: Layout.radius.full, paddingVertical: Layout.spacing.md, alignItems: 'center', justifyContent: 'center' },
  footerBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
  disabledBtn: { opacity: 0.4 },
});
