import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export default function ProgressReportScreen({ route, navigation }) {
  const {
    student,
    theme,
    lowercaseProgress: initLow = 0,
    uppercaseProgress: initUp  = 0,
  } = route.params;

  const [report, setReport] = useState(null);

  useEffect(() => {
    client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
      .then(res => setReport(res.data))
      .catch(() => setReport({
        lowercase_completed:   initLow,
        uppercase_completed:   initUp,
        next_lowercase_letter: LETTERS[initLow] ?? null,
        reason:                'Continue regular letter practice.',
      }));
  }, [student.sid]);

  const lowercase  = report?.lowercase_completed   ?? initLow;
  const uppercase  = report?.uppercase_completed   ?? initUp;
  const nextLetter = report?.next_lowercase_letter ?? (lowercase < 26 ? LETTERS[lowercase] : null);
  const reason     = report?.reason                ?? 'Continue regular letter practice.';

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>
            View Progress Report
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Terminal-style card ── */}
          <View style={styles.terminalCard}>

            {/* Lowercase section */}
            <Text style={styles.sectionHeading}>Lowercase Letters</Text>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Next Letter</Text>
            <Text style={styles.fieldValue}>{nextLetter ?? '—'}</Text>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{reason}</Text>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Progress</Text>
            <Text style={styles.fieldValue}>{lowercase} / 26 letters completed</Text>

            {/* Uppercase section — only show if lowercase done */}
            {lowercase >= 26 && (
              <>
                <View style={[styles.divider, { marginTop: 20 }]} />

                <Text style={[styles.sectionHeading, { marginTop: 4 }]}>
                  Uppercase Letters
                </Text>

                <View style={styles.divider} />

                <Text style={styles.fieldLabel}>Progress</Text>
                <Text style={styles.fieldValue}>{uppercase} / 26 letters completed</Text>
              </>
            )}

          </View>

          {/* ── Student name ── */}
          <Text style={[styles.studentName, { color: theme.button }]}>
            {student?.full_name}
          </Text>

        </ScrollView>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },

  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },

  terminalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    padding: 28,
    marginTop: 8,
  },

  sectionHeading: {
    fontSize: 13,
    color: '#888888',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#2E2E2E',
    marginVertical: 14,
  },

  fieldLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reasonText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },

  studentName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 28,
    textAlign: 'center',
  },
});
