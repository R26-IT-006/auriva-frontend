import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACTIVITIES = ['A', 'B', 'C', 'D', 'E'];

export default function WordPracticeResultCard({ word, statuses, theme, onContinue }) {
  const independentCount = ACTIVITIES.filter(key => statuses?.[key] === 'correct').length;

  return (
    <View style={styles.shell} accessibilityLabel="Word practice result">
      <View style={[styles.iconCircle, { backgroundColor: theme.button + '1F' }]}>
        <Ionicons name="checkmark" size={44} color={theme.button} />
      </View>
      <Text style={[styles.heading, { color: theme.headingText }]}>Well done!</Text>
      <Text style={[styles.word, { color: theme.headingText }]}>{word.toUpperCase()}</Text>

      <View style={styles.activityRow}>
        {ACTIVITIES.map(key => {
          const independent = statuses?.[key] === 'correct';
          return (
            <View
              key={key}
              style={[styles.activityPill, independent ? styles.independent : styles.withHelp]}
              accessibilityLabel={`Activity ${key}: ${independent ? 'completed independently' : 'completed with help'}`}
            >
              <Text style={[styles.activityText, independent ? styles.independentText : styles.withHelpText]}>{key}</Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.summary, { color: theme.headingText }]}>
        {independentCount} / 5 completed independently
      </Text>
      <Text style={[styles.support, { color: theme.headingText }]}>You finished all 5 activities.</Text>

      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: theme.button }]}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel="Keep Going"
        activeOpacity={0.8}
      >
        <Text style={[styles.continueText, { color: theme.buttonText }]}>Keep Going</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '72%', maxWidth: 620, alignSelf: 'center', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 28, paddingHorizontal: 42, paddingVertical: 28,
    shadowColor: '#000', shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  iconCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  heading: { marginTop: 12, fontSize: 30, fontFamily: 'Nunito_900Black', fontWeight: '900' },
  word: { marginTop: 4, fontSize: 40, letterSpacing: 4, fontFamily: 'Nunito_900Black', fontWeight: '900' },
  activityRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  activityPill: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  independent: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  withHelp: { backgroundColor: '#FFF3E0', borderColor: '#F59E0B' },
  activityText: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', fontWeight: '800' },
  independentText: { color: '#1B5E20' },
  withHelpText: { color: '#8A4B00' },
  summary: { marginTop: 18, fontSize: 20, fontFamily: 'Nunito_800ExtraBold', fontWeight: '800' },
  support: { marginTop: 5, fontSize: 16, fontFamily: 'Nunito_600SemiBold', opacity: 0.75 },
  continueButton: { minWidth: 210, minHeight: 52, marginTop: 22, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  continueText: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', fontWeight: '800' },
});
