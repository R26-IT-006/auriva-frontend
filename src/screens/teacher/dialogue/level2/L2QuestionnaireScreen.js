import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';
import { useToast } from '../../../../context/ToastContext';

const ALL_ACTIVITIES = ['Singing', 'Dancing', 'Art', 'Cricket', 'Games', 'Reading'];
const ACTIVITY_ICONS = { Singing: 'musical-notes-outline', Dancing: 'body-outline', Art: 'color-palette-outline', Cricket: 'baseball-outline', Games: 'game-controller-outline', Reading: 'book-outline' };

export default function L2QuestionnaireScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const toast = useToast();

  const [name,       setName]       = useState('');
  const [age,        setAge]        = useState('');
  const [hometown,   setHometown]   = useState('');
  const [gender,     setGender]     = useState(null); // 'boy' | 'girl'
  const [activities, setActivities] = useState([]);
  const [saving,     setSaving]     = useState(false);

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

  const btn = { backgroundColor: theme.button };
  const outline = { borderColor: theme.cardOutline };

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.iconBtn, outline]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.headingText }]}>Child Information  ·  දරුවාගේ තොරතුරු</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: theme.headingText }]}>Child's First Name  ·  දරුවාගේ නම</Text>
          <TextInput style={[styles.input, outline]} value={name} onChangeText={setName} placeholder="e.g. Saman" placeholderTextColor="#999" />

          <Text style={[styles.label, { color: theme.headingText }]}>Age  ·  වයස</Text>
          <TextInput style={[styles.input, outline]} value={age} onChangeText={setAge} placeholder="e.g. 8" placeholderTextColor="#999" keyboardType="numeric" maxLength={2} />

          <Text style={[styles.label, { color: theme.headingText }]}>Hometown  ·  නිවසේ ප්‍රදේශය</Text>
          <TextInput style={[styles.input, outline]} value={hometown} onChangeText={setHometown} placeholder="e.g. Colombo" placeholderTextColor="#999" />

          <Text style={[styles.label, { color: theme.headingText }]}>Gender  ·  ස්ත්‍රී/පුරුෂ</Text>
          <View style={styles.genderRow}>
            {['boy', 'girl'].map(g => (
              <TouchableOpacity key={g} style={[styles.genderBtn, outline, gender === g && { backgroundColor: theme.button, borderColor: theme.button }]} onPress={() => setGender(g)} activeOpacity={0.8}>
                <Ionicons name={g === 'boy' ? 'male-outline' : 'female-outline'} size={18} color={gender === g ? '#FFF' : theme.headingText} />
                <Text style={[styles.genderLabel, { color: gender === g ? '#FFF' : theme.headingText }]}>{g === 'boy' ? 'Boy' : 'Girl'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.headingText }]}>Favourite Activities  ·  ප්‍රිය ක්‍රීයා <Text style={styles.hint}>(choose up to 3  ·  3 දක්වා)</Text></Text>
          <View style={styles.actGrid}>
            {ALL_ACTIVITIES.map(act => {
              const sel = activities.includes(act);
              return (
                <TouchableOpacity key={act} style={[styles.actCard, outline, sel && { backgroundColor: theme.button, borderColor: theme.button }]} onPress={() => toggleActivity(act)} activeOpacity={0.8}>
                  <Ionicons name={ACTIVITY_ICONS[act]} size={22} color={sel ? '#FFF' : theme.headingText} />
                  <Text style={[styles.actLabel, { color: sel ? '#FFF' : theme.headingText }]}>{act}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.saveBtn, btn]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveBtnText, { color: theme.buttonText }]}>Save & Continue</Text>}
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Layout.fontSize.lg, fontWeight: '800' },
  scroll: { paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.sm, gap: Layout.spacing.sm },
  label: { fontSize: Layout.fontSize.sm, fontWeight: '700', marginTop: Layout.spacing.sm },
  hint: { fontWeight: '400', opacity: 0.6 },
  input: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: Layout.radius.md, borderWidth: 1.5, paddingHorizontal: Layout.spacing.md, paddingVertical: 12, fontSize: Layout.fontSize.md, color: '#1A1A1A' },
  genderRow: { flexDirection: 'row', gap: Layout.spacing.md },
  genderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Layout.radius.md, borderWidth: 1.5, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.85)' },
  genderLabel: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  actGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.sm },
  actCard: { alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Layout.radius.md, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: Layout.spacing.md, backgroundColor: 'rgba(255,255,255,0.85)', minWidth: 90 },
  actLabel: { fontSize: Layout.fontSize.xs, fontWeight: '700' },
  saveBtn: { marginTop: Layout.spacing.lg, borderRadius: Layout.radius.full, paddingVertical: Layout.spacing.md, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
