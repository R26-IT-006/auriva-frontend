import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { useLockLandscape } from '../../utils/useOrientationLock';

const RATING_DIMENSIONS = [
  { key: 'teacher_straight_rating', label: 'Straight lines' },
  { key: 'teacher_curve_rating',    label: 'Curves' },
  { key: 'teacher_complex_rating',  label: 'Complex shapes' },
  { key: 'teacher_speed_rating',    label: 'Speed' },
  { key: 'teacher_fatigue_rating',  label: 'Fatigue' },
  { key: 'teacher_overall_rating',  label: 'Overall' },
];
const RATING_LABELS = { 1: 'Weak', 2: 'Moderate', 3: 'Good' };

export default function DataCollectionDoneScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  const { student, theme, collectionSessionId = null } = route.params;

  const [warnings, setWarnings] = useState([]);
  const [ratings, setRatings] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!collectionSessionId) return;
    // Best-effort — a failed "complete" ping never blocks the teacher from
    // finishing the session; it just means the readiness script won't see
    // this session's warnings until it's re-checked from the DB directly.
    client.patch(ENDPOINTS.COLLECTION_SESSION_COMPLETE(collectionSessionId))
      .then(res => setWarnings(res.data?.warnings ?? []))
      .catch(err => console.warn('Collection session complete failed (non-fatal):', err?.message));
  }, [collectionSessionId]);

  const setRating = (key, value) => setRatings(prev => ({ ...prev, [key]: value }));

  const submitValidation = async () => {
    if (!collectionSessionId || submitting) return;
    setSubmitting(true);
    try {
      await client.post(ENDPOINTS.TEACHER_VALIDATION, {
        student_id: student.sid,
        collection_session_id: collectionSessionId,
        ...ratings,
        teacher_notes: notes,
      });
      setSubmitted(true);
    } catch (err) {
      console.warn('Teacher validation submit failed:', err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: theme.button + '20' }]}>
            <Ionicons name="checkmark-circle" size={64} color={theme.button} />
          </View>

          <Text style={[styles.title, { color: theme.headingText }]}>
            Data Collection Complete
          </Text>
          <Text style={styles.subtitle}>
            All shapes and letters for{'\n'}
            <Text style={{ fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' }}>{student?.full_name}</Text> have been recorded.
          </Text>

          <View style={[styles.infoBox, { borderColor: theme.button + '30', backgroundColor: theme.button + '0A' }]}>
            <Ionicons name="analytics-outline" size={18} color={theme.button} />
            <Text style={[styles.infoText, { color: theme.button }]}>
              6 shapes · 10 lowercase · 10 uppercase{'\n'}3 attempts per letter · collection_mode = true
            </Text>
          </View>

          {warnings.length > 0 && (
            <View style={[styles.warningBox, { borderColor: '#E0A100' }]}>
              <View style={styles.warningHeader}>
                <Ionicons name="warning-outline" size={18} color="#8A6100" />
                <Text style={styles.warningTitle}>Check this session</Text>
              </View>
              {warnings.map((w, i) => (
                <Text key={i} style={styles.warningLine}>• {w}</Text>
              ))}
            </View>
          )}

          {collectionSessionId && !submitted && (
            <View style={styles.ratingBlock}>
              <Text style={[styles.ratingTitle, { color: theme.headingText }]}>
                Rate this session (optional)
              </Text>
              {RATING_DIMENSIONS.map(({ key, label }) => (
                <View key={key} style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>{label}</Text>
                  <View style={styles.ratingButtons}>
                    {[1, 2, 3].map(value => {
                      const selected = ratings[key] === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          onPress={() => setRating(key, value)}
                          style={[
                            styles.ratingPill,
                            selected && { backgroundColor: theme.button, borderColor: theme.button },
                          ]}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.ratingPillText, selected && { color: theme.buttonText }]}>
                            {RATING_LABELS[value]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              <TextInput
                style={styles.notesInput}
                placeholder="Notes (optional)"
                placeholderTextColor="#9AA0A6"
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.button, opacity: submitting ? 0.6 : 1 }]}
                onPress={submitValidation}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={[styles.submitBtnText, { color: theme.buttonText }]}>
                  {submitting ? 'Submitting…' : 'Submit Validation'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {submitted && (
            <View style={styles.submittedBox}>
              <Ionicons name="checkmark-done-outline" size={16} color="#2F7D5C" />
              <Text style={styles.submittedText}>Validation submitted</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.navigate('StudentPicker')}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={18} color={theme.buttonText} />
            <Text style={[styles.doneBtnText, { color: theme.buttonText }]}>
              Choose Next Student
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },

  card: {
    width: '88%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    gap: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },

  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 24,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    lineHeight: 20,
  },

  warningBox: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFF8E6',
    gap: 6,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    color: '#8A6100',
  },
  warningLine: {
    fontSize: 12.5,
    color: '#8A6100',
    lineHeight: 18,
  },

  ratingBlock: {
    width: '100%',
    gap: 12,
  },
  ratingTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'left',
  },
  ratingRow: {
    gap: 6,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    color: '#555555',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D8DCDC',
    alignItems: 'center',
  },
  ratingPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    color: '#555555',
  },

  notesInput: {
    width: '100%',
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: '#D8DCDC',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
  },

  submitBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },

  submittedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submittedText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    color: '#2F7D5C',
  },

  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 4,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },
});
