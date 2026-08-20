import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { LETTER_CATEGORIES } from '../../constants/letterCategories';
import { getLetterPrimitiveGroup, selectPreWritingActivities } from '../../constants/preWritingActivities';
import {
  createPreWritingInteractionId, markWarmupHandled, buildPreWritingNavigationParams, PRE_WRITING_REASON,
} from '../../utils/preWritingSessionGuard';

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function LetterPracticeScreen({ route, navigation }) {
  const { student, theme, letterSequence = [], motorProfile = null } = route.params;
  const { width } = useWindowDimensions();

  const [lowercaseProgress, setLowercaseProgress] = useState(0);
  const [uppercaseProgress, setUppercaseProgress] = useState(0);
  const [pickerCase, setPickerCase] = useState(null);
  const [pickerCategory, setPickerCategory] = useState(null);

  const closePicker = () => { setPickerCase(null); setPickerCategory(null); };

  // Before entering LetterWriting/UppercaseWriting, check whether the first
  // letter the child is about to write shares a motor primitive (curved,
  // diagonal, vertical/horizontal) with a pre-writing warm-up group — if so,
  // detour through a short warm-up first. Falls straight through to the
  // letter screen unchanged when there's nothing to warm up for (mixed
  // letters, or an unrecognised/empty sequence), so a disabled/failed
  // pre-writing feature never blocks normal practice.
  const goToLetterScreen = (caseType, params, seq) => {
    const screen = caseType === 'lowercase' ? 'LetterWriting' : 'UppercaseWriting';

    // Feature 4 Step 3: a fresh interaction id per "start writing" action —
    // never per letter, never per render. Folded into `params` so it
    // reaches the letter screen whether or not a warm-up detour happens.
    const interactionId = createPreWritingInteractionId();
    const paramsWithInteraction = { ...params, interactionId };

    const firstLetter = seq?.[0]?.letter
      ?? LETTER_CATEGORIES[caseType]?.[params.motorProfile?.categoryOrder?.[0] ?? 'straight']?.[0]?.letter
      ?? null;
    const group = firstLetter ? getLetterPrimitiveGroup(firstLetter) : null;
    const activities = group ? selectPreWritingActivities(group) : [];

    if (activities.length > 0) {
      // Mark BEFORE navigating (not on completion/skip/save-success) — see
      // preWritingSessionGuard.js's markWarmupHandled doc comment for why.
      markWarmupHandled({
        studentId: student?.sid, caseType, letter: firstLetter, interactionId,
        reason: PRE_WRITING_REASON.SESSION_START,
      });
      navigation.navigate('PreWritingActivity', buildPreWritingNavigationParams({
        student, theme, activities,
        targetLetter: firstLetter, targetCaseType: caseType, interactionId,
        reason: PRE_WRITING_REASON.SESSION_START,
        nextRoute: screen, nextParams: paramsWithInteraction,
      }));
    } else {
      navigation.navigate(screen, paramsWithInteraction);
    }
  };

  const navigateToWriting = (ct, seq) => {
    closePicker();
    const params = ct === 'lowercase'
      ? { student, theme, caseType: 'lowercase', letterSequence: seq }
      : { student, theme, letterSequence: seq };
    goToLetterScreen(ct, params, seq);
  };

  const handleCategoryPick = (category) => {
    if (category === 'all') {
      const ct = pickerCase;
      closePicker();
      const params = ct === 'lowercase'
        ? { student, theme, caseType: 'lowercase', letterSequence, motorProfile }
        : { student, theme, letterSequence, motorProfile };
      goToLetterScreen(ct, params, letterSequence);
    } else {
      setPickerCategory(category);
    }
  };

  const pickerLetters = (pickerCase && pickerCategory)
    ? LETTER_CATEGORIES[pickerCase][pickerCategory] ?? []
    : [];

  useFocusEffect(
    useCallback(() => {
      client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
        .then(res => {
          setLowercaseProgress(res.data.lowercase_completed ?? 0);
          setUppercaseProgress(res.data.uppercase_completed ?? 0);
        })
        .catch(() => {});
    }, [student.sid])
  );

  // Uppercase progression fix — previously hardcoded `true`, meaning
  // uppercase was never actually gated regardless of lowercase progress.
  // lowercaseProgress is itself already the authoritative backend count
  // (LETTER_PROGRESS's lowercase_completed = LetterProgress.count({case_type:
  // 'lowercase'}) — see handwritingController.getProgress) — never derived
  // from frontend AsyncStorage. Mirrors ProgressReportScreen.js's own
  // identical `lowercase >= 26` gate, so both screens agree on what "done"
  // means. LetterProgress's own unique(student_id, letter, case_type) index
  // guarantees this count can never exceed 26, so >= and === are equivalent
  // here; >= is used defensively, matching the sibling screen's convention.
  const lowercaseDone    = lowercaseProgress >= 26;
  const lowercasePercent = Math.min(100, Math.round((lowercaseProgress / 26) * 100));

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative background bubbles */}
      <View style={[styles.bgBubbleLarge, {
        backgroundColor: theme.button + '0E',
        width: width * 0.45, height: width * 0.45, borderRadius: width * 0.225,
      }]} />
      <View style={[styles.bgBubbleMedium, {
        backgroundColor: theme.button + '09',
        width: width * 0.28, height: width * 0.28, borderRadius: width * 0.14,
      }]} />
      <View style={[styles.bgBubbleSmall, {
        backgroundColor: theme.button + '07',
        width: width * 0.16, height: width * 0.16, borderRadius: width * 0.08,
      }]} />

      <SafeAreaView style={styles.safe}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View style={styles.nameRow}>
            <View style={[styles.avatarRing, { borderColor: theme.button + '40' }]}>
              <Image
                source={AVATAR_MAP[student?.avatar_key]}
                style={styles.avatarImg}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={[styles.studentName, { color: theme.headingText }]}>
                {student?.full_name}
              </Text>
              <Text style={styles.studentSubLabel}>Letter Practice</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.navigate('ProgressReport', {
              student,
              theme,
              lowercaseProgress,
              uppercaseProgress,
            })}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={14} color={theme.buttonText} />
            <Text style={[styles.reportBtnText, { color: theme.buttonText }]}>
              View Progress Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Main content ── */}
        <View style={styles.content}>

          {/* Hero section */}
          <View style={styles.heroSection}>
            <Image
              source={AVATAR_MAP[student?.avatar_key]}
              style={styles.heroAvatar}
              resizeMode="contain"
            />
            <Text style={[styles.heroGreeting, { color: theme.headingText }]}>
              Choose your practice!
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.button }]}>
              What would you like to write today?
            </Text>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>

            {/* Progress section */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <View style={styles.progressHeaderLeft}>
                  <Ionicons name="trophy-outline" size={18} color="#F57F17" />
                  <Text style={styles.progressHeaderText}>
                    Lowercase: {lowercaseProgress} / 26 completed
                  </Text>
                </View>
                <Text style={styles.progressPercent}>{lowercasePercent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${lowercasePercent}%` }]} />
              </View>
            </View>

            {/* ── Pills row ── */}
            <View style={styles.pillsRow}>

              {/* Lowercase — always unlocked */}
              <TouchableOpacity
                style={styles.lowercasePill}
                onPress={() => goToLetterScreen('lowercase',
                  { student, theme, caseType: 'lowercase', letterSequence, motorProfile },
                  letterSequence,
                )}
                onLongPress={() => setPickerCase('lowercase')}
                activeOpacity={0.85}
              >
                <View style={styles.pillIconCircle}>
                  <Ionicons name="text-outline" size={32} color="#1B5E20" />
                </View>
                <Text style={styles.lowercaseTitle}>Lowercase</Text>
                <Text style={styles.pillSubLabel}>{lowercaseProgress} / 26 done</Text>
              </TouchableOpacity>

              {/* Uppercase — locked until lowercase done */}
              <TouchableOpacity
                style={[styles.uppercasePill, !lowercaseDone && styles.uppercaseLocked]}
                onPress={() => lowercaseDone && goToLetterScreen('uppercase',
                  { student, theme, letterSequence, motorProfile },
                  letterSequence,
                )}
                onLongPress={() => setPickerCase('uppercase')}
                activeOpacity={0.85}
              >
                <View style={[
                  styles.pillIconCircle,
                  { backgroundColor: lowercaseDone ? '#CE93D8' : '#E0E0E0' },
                ]}>
                  <Ionicons
                    name={lowercaseDone ? 'arrow-up-circle-outline' : 'lock-closed'}
                    size={32}
                    color={lowercaseDone ? '#4A148C' : '#9E9E9E'}
                  />
                </View>
                <Text style={[styles.uppercaseTitle, !lowercaseDone && styles.lockedText]}>
                  Uppercase
                </Text>
                {lowercaseDone ? (
                  <Text style={styles.pillSubLabel}>Ready to go!</Text>
                ) : (
                  <Text style={[styles.pillSubLabel, styles.lockedSubLabel]}>
                    Finish all lowercase{'\n'}letters to unlock
                  </Text>
                )}
              </TouchableOpacity>

            </View>

          </View>

        </View>

        {/* ── Category picker modal (testing convenience) ── */}
        <Modal
          visible={pickerCase !== null}
          transparent
          animationType="fade"
          onRequestClose={closePicker}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              {/* ── Step 1: category list ── */}
              {!pickerCategory && (
                <>
                  <Text style={styles.pickerTitle}>
                    Choose category ({pickerCase})
                  </Text>
                  {[
                    { key: 'straight', label: 'Straight', icon: 'remove-outline',    color: '#1565C0' },
                    { key: 'curved',   label: 'Curved',   icon: 'ellipse-outline',   color: '#6A1B9A' },
                    { key: 'mixed',    label: 'Mixed',    icon: 'git-merge-outline', color: '#E65100' },
                    { key: 'all',      label: 'All (Normal)', icon: 'grid-outline',  color: '#2E7D32' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.pickerBtn, { borderColor: opt.color + '40' }]}
                      onPress={() => handleCategoryPick(opt.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={opt.icon} size={22} color={opt.color} />
                      <Text style={[styles.pickerBtnText, { color: opt.color }]}>
                        {opt.label}
                      </Text>
                      {opt.key !== 'all' && pickerCase && (
                        <Text style={styles.pickerCount}>
                          {LETTER_CATEGORIES[pickerCase]?.[opt.key]?.length ?? 0} letters
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.pickerCancel}
                    onPress={closePicker}
                  >
                    <Text style={styles.pickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Step 2: letter grid ── */}
              {pickerCategory && (
                <>
                  <Text style={styles.pickerTitle}>
                    {pickerCategory.charAt(0).toUpperCase() + pickerCategory.slice(1)} — pick a letter
                  </Text>
                  <View style={styles.letterGrid}>
                    {pickerLetters.map(obj => (
                      <TouchableOpacity
                        key={obj.letter}
                        style={styles.letterTile}
                        onPress={() => navigateToWriting(pickerCase, [obj])}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.letterTileText}>{obj.letter}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.pickerBtn, { borderColor: '#2E7D3240' }]}
                    onPress={() => navigateToWriting(pickerCase, pickerLetters)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play-outline" size={20} color="#2E7D32" />
                    <Text style={[styles.pickerBtnText, { color: '#2E7D32' }]}>
                      Trace all ({pickerLetters.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pickerCancel}
                    onPress={() => setPickerCategory(null)}
                  >
                    <Text style={styles.pickerCancelText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // Decorative background bubbles
  bgBubbleLarge: {
    position: 'absolute',
    top: '-6%',
    right: '-14%',
  },
  bgBubbleMedium: {
    position: 'absolute',
    bottom: '4%',
    left: '-10%',
  },
  bgBubbleSmall: {
    position: 'absolute',
    top: '42%',
    right: '-5%',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '800',
  },
  studentSubLabel: {
    fontSize: 12,
    color: '#888888',
    marginTop: 1,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Main content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 20,
  },

  // Hero section
  heroSection: {
    alignItems: 'center',
    gap: 6,
  },
  heroAvatar: {
    width: 100,
    height: 100,
    marginBottom: 4,
  },
  heroGreeting: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    gap: 18,
  },

  // Progress section
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444444',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4CAF50',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#EEEEEE',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },

  // Pills row
  pillsRow: {
    flexDirection: 'row',
    gap: 14,
  },

  // Lowercase pill
  lowercasePill: {
    flex: 1,
    backgroundColor: '#F1F8E9',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 16,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#A5D6A7',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  pillIconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#DCEDC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowercaseTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2E7D32',
  },
  pillSubLabel: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Uppercase pill
  uppercasePill: {
    flex: 1,
    backgroundColor: '#F3E5F5',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 16,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#CE93D8',
    shadowColor: '#7B1FA2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  uppercaseLocked: {
    backgroundColor: '#F8F8F8',
    borderColor: '#DDDDDD',
    shadowOpacity: 0,
    elevation: 0,
  },
  uppercaseTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#4A148C',
  },
  lockedText: {
    color: '#AAAAAA',
  },
  lockedSubLabel: {
    color: '#BBBBBB',
  },

  // Category picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    gap: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: '#FAFAFA',
  },
  pickerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  pickerCount: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
  },
  pickerCancel: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 2,
  },
  pickerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  letterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginVertical: 4,
  },
  letterTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#B0BEC5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterTileText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333333',
  },
});