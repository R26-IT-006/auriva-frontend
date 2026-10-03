import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLockLandscape } from '../../../utils/useOrientationLock';
import useGatedBack from '../../../utils/useGatedBack';
import { goBackToOrigin } from '../../../utils/backToOrigin';
import LetterProgressPanel from '../../../components/handwriting/LetterProgressPanel';

/**
 * Full-screen Letter Progress.
 *
 * The content — banner, both sections, the next-letter rule and its data
 * reads — now lives in components/handwriting/LetterProgressPanel.js, which
 * LetterPracticeScreen shows in its Progress pop-up. Nothing navigates here
 * any more; the route stays registered and renders that same panel, so an
 * old deep link still lands somewhere sensible.
 */
export default function ProgressReportScreen({ route, navigation }) {
  // This child-facing completion/progress surface remains part of the
  // handwriting flow. Only the main teacher Progress Report is portrait.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  // Returns to the screen this report was OPENED FROM (route param
  // `originRoute`), not to whatever sits directly below it in the stack —
  // see utils/backToOrigin.js. Falls back to goBack() when no origin was
  // passed, so an older navigation behaves exactly as before.
  const { requestBack, gateModal } = useGatedBack(
    () => goBackToOrigin(navigation, route.params?.originRoute)
  );

  const {
    student,
    theme,
    lowercaseProgress: initLow = 0,
    uppercaseProgress: initUp  = 0,
    letterSequence = [],
  } = route.params;

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
            style={[styles.backBtn, { backgroundColor: theme.button + '18' }]}
            onPress={requestBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>
            Letter Progress
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Main card ── */}
        <View style={styles.content}>
          <View style={styles.card}>
            <LetterProgressPanel
              student={student}
              theme={theme}
              letterSequence={letterSequence}
              initLow={initLow}
              initUp={initUp}
            />
          </View>
        </View>

      </SafeAreaView>

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_800ExtraBold',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 30,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 5,
  },
});
