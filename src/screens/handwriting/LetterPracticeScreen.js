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
import {
  createPreWritingInteractionId, markWarmupHandled, buildPreWritingNavigationParams, PRE_WRITING_REASON,
} from '../../utils/preWritingSessionGuard';
import { useLockLandscape } from '../../utils/useOrientationLock';
// Demo preview switch - see constants/demoAccess.js. Does NOT change the
// lowercaseDone rule below; it only decides whether a not-yet-earned card can
// be opened, and makes that state visible rather than silent.
import {
  canOpen, isPreview, PREVIEW_BADGE, UPPERCASE_ORDER_CAPTION,
} from '../../constants/demoAccess';
import ScreenBackButton from '../../components/handwriting/ScreenBackButton';
import useGatedBack from '../../utils/useGatedBack';

const AVATAR_MAP = {
  boba:     require('../../../assets/handwriting-avatars/Boba.png'),
  glitter:  require('../../../assets/handwriting-avatars/Glitter.png'),
  lily:     require('../../../assets/handwriting-avatars/Lily.png'),
  megatron: require('../../../assets/handwriting-avatars/Megatron.png'),
};

export default function LetterPracticeScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  const { requestBack, gateModal } = useGatedBack(() => (
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('LetterHome', { student, theme })
  ));

  const { student, theme, letterSequence = [], motorProfile = null } = route.params;
  const { width } = useWindowDimensions();

  const [lowercaseProgress, setLowercaseProgress] = useState(0);
  const [uppercaseProgress, setUppercaseProgress] = useState(0);
  const [pickerCase, setPickerCase] = useState(null);
  const [pickerCategory, setPickerCategory] = useState(null);

  const closePicker = () => { setPickerCase(null); setPickerCategory(null); };

  // Straight into the letter screen. A warm-up marks a CHANGE of motor
  // primitive, and the first letter of a sequence changes from nothing — so
  // index 0 never warms up, whatever category it happens to be.
  //
  // This used to detour unconditionally for sequence[0], and when the
  // sequence was missing it invented a first letter from
  // `categoryOrder?.[0] ?? 'straight'` — which is why a straight warm-up
  // appeared at the start regardless of the real first category. A previous
  // group is never inferred now; see utils/preWritingTransition.js. The
  // mid-sequence transitions the writing screens detect are unaffected.
  const goToLetterScreen = (caseType, params) => {
    const screen = caseType === 'lowercase' ? 'LetterWriting' : 'UppercaseWriting';

    // Feature 4 Step 3: a fresh interaction id per "start writing" action —
    // never per letter, never per render.
    const interactionId = createPreWritingInteractionId();
    // Names this screen as where Back should return to, so a flow that
    // detours through warm-ups still comes back HERE rather than to whatever
    // stale frame the detours left behind. See utils/backToOrigin.js.
    navigation.navigate(screen, { ...params, interactionId, originRoute: 'LetterPractice' });
  };

  const navigateToWriting = (ct, seq) => {
    closePicker();
    const params = ct === 'lowercase'
      ? { student, theme, caseType: 'lowercase', letterSequence: seq }
      : { student, theme, letterSequence: seq };
    goToLetterScreen(ct, params);
  };

  const handleCategoryPick = (category) => {
    if (category === 'all') {
      const ct = pickerCase;
      closePicker();
      const params = ct === 'lowercase'
        ? { student, theme, caseType: 'lowercase', letterSequence, motorProfile }
        : { student, theme, letterSequence, motorProfile };
      goToLetterScreen(ct, params);
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
  // `lowercaseDone` still means EARNED, and still drives how the pill looks.
  // These two only decide whether it opens, and whether it says so.
  const uppercaseOpen    = canOpen(lowercaseDone);
  const uppercasePreview = isPreview(lowercaseDone);
  const lowercasePercent = Math.min(100, Math.round((lowercaseProgress / 26) * 100));
  const uppercasePercent = Math.min(100, Math.round((uppercaseProgress / 26) * 100));
  const avatarSource = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;

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
          {/* Gated: leaving is an adult decision, so the tap opens the parent
              gate rather than navigating. See utils/useGatedBack.js. */}
          <View style={styles.nameRow}>
            <ScreenBackButton
              onPress={requestBack}
              gated
              tint={theme.button}
              color={theme.button}
              style={{ marginRight: 2 }}
            />
            <View style={styles.headerTextBlock}>
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
              letterSequence,
              originRoute: 'LetterPractice',
            })}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={14} color={theme.buttonText} />
            <Text style={[styles.reportBtnText, { color: theme.buttonText }]}>View Letter Progress</Text>
          </TouchableOpacity>
        </View>

        {/* ── Main content ── */}
        <View style={styles.content}>

          {/* Hero section */}
          <View style={styles.heroSection}>
            <View style={styles.heroTextBlock}>
              <Text style={[styles.heroGreeting, { color: theme.headingText }]}>Choose your practice!</Text>
              <Text style={[styles.heroSubtitle, { color: theme.button }]}>What would you like to write today?</Text>
            </View>
            <View style={styles.heroAvatarCard}>
              <Image
                source={avatarSource}
                style={styles.heroAvatar}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>

            {/* Progress section */}
            <View style={styles.progressSection}>
              <View style={styles.progressCaseBlock}>
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

              <View style={styles.progressCaseBlock}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressHeaderLeft}>
                    <Ionicons name="arrow-up-circle-outline" size={18} color="#9575CD" />
                    <Text style={styles.progressHeaderText}>
                      Uppercase: {uppercaseProgress} / 26 completed
                    </Text>
                  </View>
                  <Text style={[styles.progressPercent, styles.uppercaseProgressPercent]}>
                    {uppercasePercent}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[
                    styles.progressFill,
                    styles.uppercaseProgressFill,
                    { width: `${uppercasePercent}%` },
                  ]} />
                </View>
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

              {/* Uppercase - earned once all 26 lowercase letters are done.
                  In a demo build it can also be opened early, and then it
                  wears its own calm "Preview" state: not dressed up as
                  earned, not left looking dead. */}
              <TouchableOpacity
                style={[
                  styles.uppercasePill,
                  !lowercaseDone && !uppercasePreview && styles.uppercaseLocked,
                  uppercasePreview && styles.previewPill,
                ]}
                onPress={() => uppercaseOpen && goToLetterScreen('uppercase',
                  { student, theme, letterSequence, motorProfile },
                  letterSequence,
                )}
                onLongPress={() => setPickerCase('uppercase')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  lowercaseDone ? 'Uppercase'
                    : `Uppercase, preview. ${UPPERCASE_ORDER_CAPTION}`
                }
              >
                <View style={[
                  styles.pillIconCircle,
                  { backgroundColor: lowercaseDone ? '#CE93D8' : (uppercasePreview ? '#EDE0F3' : '#E0E0E0') },
                ]}>
                  <Ionicons
                    name={uppercaseOpen ? 'arrow-up-circle-outline' : 'lock-closed'}
                    size={32}
                    color={lowercaseDone ? '#4A148C' : (uppercasePreview ? '#9575CD' : '#9E9E9E')}
                  />
                </View>
                <Text style={[
                  styles.uppercaseTitle,
                  !lowercaseDone && !uppercasePreview && styles.lockedText,
                  uppercasePreview && styles.previewTitle,
                ]}>
                  Uppercase
                </Text>
                {lowercaseDone ? (
                  <Text style={styles.pillSubLabel}>Ready to go!</Text>
                ) : uppercasePreview ? (
                  <>
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewBadgeText}>{PREVIEW_BADGE}</Text>
                    </View>
                    {/* One short line, present tense, says what comes first
                        rather than what is forbidden. */}
                    <Text style={styles.previewCaption}>{UPPERCASE_ORDER_CAPTION}</Text>
                  </>
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

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
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
    paddingVertical: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextBlock: {
    justifyContent: 'center',
  },
  studentName: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  // Main content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 14,
  },

  // Hero section
  heroSection: {
    width: '100%',
    maxWidth: 680,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  heroTextBlock: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 28,
  },
  heroAvatarCard: {
    width: 260,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
  },
  heroGreeting: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    textAlign: 'left',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    textAlign: 'left',
    opacity: 0.85,
    marginTop: 6,
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 680,
    minHeight: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    gap: 22,
  },

  // Progress section
  progressSection: {
    gap: 14,
  },
  progressCaseBlock: {
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
    fontFamily: 'Nunito_700Bold',
    color: '#444444',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
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
  uppercaseProgressPercent: {
    color: '#9575CD',
  },
  uppercaseProgressFill: {
    backgroundColor: '#9575CD',
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
    paddingVertical: 28,
    paddingHorizontal: 22,
    minHeight: 220,
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
    fontFamily: 'Nunito_900Black',
    color: '#2E7D32',
  },
  pillSubLabel: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
    fontFamily: 'Nunito_600SemiBold',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Uppercase pill
  uppercasePill: {
    flex: 1,
    backgroundColor: '#F3E5F5',
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 22,
    minHeight: 220,
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
  // Preview state: a soft, unalarming middle ground between earned and
  // locked. Same size and position as both, so the layout never shifts.
  previewPill: {
    backgroundColor: '#FAF6FD',
    borderWidth: 1.5,
    borderColor: '#D9C7E8',
    borderStyle: 'dashed',
  },
  previewTitle:  { color: '#7E57C2' },
  previewBadge:  {
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#EDE0F3',
  },
  previewBadgeText: { fontSize: 11, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold', color: '#7E57C2', letterSpacing: 0.3 },
  previewCaption: {
    fontSize: 11,
    color: '#8A7B96',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
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
    fontFamily: 'Nunito_900Black',
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
    fontFamily: 'Nunito_800ExtraBold',
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
    fontFamily: 'Nunito_700Bold',
    flex: 1,
  },
  pickerCount: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
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
    fontFamily: 'Nunito_600SemiBold',
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
    fontFamily: 'Nunito_800ExtraBold',
    color: '#333333',
  },
});
