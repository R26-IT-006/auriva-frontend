import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../constants/layout';
import client from '../../../api/client';
import { ENDPOINTS } from '../../../constants/api';
import { LETTER_CATEGORIES } from '../../../data/letterCategories';
import {
  createPreWritingInteractionId, markWarmupHandled, buildPreWritingNavigationParams, PRE_WRITING_REASON,
} from '../../../utils/preWritingSessionGuard';
import { useLockLandscape } from '../../../utils/useOrientationLock';
// Demo preview switch - see constants/demoAccess.js. Does NOT change the
// lowercaseDone rule below; it only decides whether a not-yet-earned card can
// be opened, and makes that state visible rather than silent.
import {
  canOpen, isPreview, PREVIEW_BADGE, UPPERCASE_ORDER_CAPTION,
} from '../../../constants/demoAccess';
import ScreenBackButton from '../../../components/handwriting/ScreenBackButton';
import HeaderPillButton from '../../../components/common/HeaderPillButton';
import LetterProgressPanel from '../../../components/handwriting/LetterProgressPanel';
import useGatedBack from '../../../utils/useGatedBack';

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

  const [lowercaseProgress, setLowercaseProgress] = useState(0);
  const [uppercaseProgress, setUppercaseProgress] = useState(0);
  // The two progress bars live in a small pop-up (Progress button), as on
  // LetterHomeScreen, so the two cards have the screen to themselves.
  const [showProgress, setShowProgress] = useState(false);
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

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative shapes — same treatment as the Concept / Dialogue landing pages */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe}>

        {/* ── Top bar: back | title | Progress ── */}
        <View style={styles.topBar}>
          {/* Gated: leaving is an adult decision, so the tap opens the parent
              gate rather than navigating. See utils/useGatedBack.js. */}
          <View style={styles.sideGroup}>
            <ScreenBackButton
              onPress={requestBack}
              gated
              tint={theme.button}
              color={theme.headingText}
              style={styles.iconBtn}
            />
          </View>

          {/* Module title — same icon circle + 34pt heading as the landing
              pages (ConceptCategoriesScreen / DialogueLandingScreen / LetterHome). */}
          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="text" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Letter Practice</Text>
          </View>

          <View style={[styles.sideGroup, styles.sideGroupRight]}>
            {/* Shared header pill (HeaderPillButton). */}
            <HeaderPillButton
              variant="primary"
              icon="trophy"
              label="Progress"
              theme={theme}
              onPress={() => setShowProgress(true)}
            />
          </View>
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]} numberOfLines={1}>
          Choose lowercase or uppercase
        </Text>

        {/* ── Main content: the two cards, centred under the subtitle ── */}
        <View style={styles.content}>

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

        {/* ── Progress pop-up (Progress button) ──
            The full Letter Progress content — name banner (Done / Next /
            Total), then the Lowercase and Uppercase sections with their
            Next Letter badges — in place of the separate Letter Progress
            screen. The panel loads fresh numbers each time it opens.
            Tapping the dimmed backdrop or Close dismisses it. */}
        <Modal
          visible={showProgress}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProgress(false)}
        >
          <TouchableOpacity
            style={styles.popupOverlay}
            activeOpacity={1}
            onPress={() => setShowProgress(false)}
          >
            {/* Inner touchable swallows taps so only the backdrop closes it. */}
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.progressCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}
            >
              {/* Header — same icon circle + round close as the Assessment
                  Summary pop-up on LetterHome. */}
              <View style={styles.popupHeader}>
                <View style={styles.popupTitleRow}>
                  <View style={[styles.popupTitleIcon, { backgroundColor: theme.cardOutline }]}>
                    <Ionicons name="trophy" size={18} color="#FFF" />
                  </View>
                  <Text style={[styles.popupTitle, { color: theme.headingText }]}>Your Progress</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowProgress(false)}
                  style={[styles.popupCloseBtn, { backgroundColor: theme.cardOutline + '1F' }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={theme.headingText} />
                </TouchableOpacity>
              </View>

              <LetterProgressPanel
                student={student}
                theme={theme}
                letterSequence={letterSequence}
                initLow={lowercaseProgress}
                initUp={uppercaseProgress}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

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

  // ── Decorative background shapes (Concept / Dialogue landing pages) ──────
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  blobTopRight: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  blobBottomLeft: {
    width: 260,
    height: 260,
    bottom: -80,
    left: -80,
  },

  // ── Top bar: back | title | Progress ──────────────────────────────────────
  // The two side groups share the leftover width equally (flex: 1) so the
  // title stays centred even though Progress is wider than Back.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideGroupRight: {
    justifyContent: 'flex-end',
  },
  // Overrides ScreenBackButton's tinted look with the landing pages' round,
  // translucent white button (its 40px size comes from ScreenBackButton).
  iconBtn: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  // marginTop matches the other landing pages, so the title sits at the
  // same height on every one of them.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 70,
  },
  titleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: Layout.spacing.lg,
  },

  // ── Main content ──────────────────────────────────────────────────────────
  // The two cards, centred both ways in the space under the subtitle; the
  // extra bottom padding lifts the block a little, as the landing pages do.
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 44,
    paddingBottom: 48,
  },

  // ── Progress pop-up ───────────────────────────────────────────────────────
  // Dimmed backdrop, card centred on it (tapping the backdrop closes).
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Landing-page card frame; surface and outline come from the avatar theme.
  progressCard: {
    width: '90%',
    maxWidth: 820,
    maxHeight: '94%',
    borderRadius: 28,
    borderWidth: 3,
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 30,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  // Pop-up header: icon circle + title on the left, round close on the right.
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  popupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Same icon circle as the landing pages' titles (titleIconCircle).
  popupTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  popupTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  popupCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Lowercase / Uppercase cards ───────────────────────────────────────────
  pillsRow: {
    width: '100%',
    maxWidth: 680,
    flexDirection: 'row',
    gap: 24,
  },

  // Lowercase card — white, landing-page frame (28 radius, 3px outline),
  // green kept in the outline, icon circle and title.
  lowercasePill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 22,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 3,
    borderColor: '#A5D6A7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  pillIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DCEDC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowercaseTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#2E7D32',
  },
  pillSubLabel: {
    fontSize: 14,
    color: '#555555',
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Uppercase card — same frame as Lowercase, purple when earned.
  uppercasePill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 22,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 3,
    borderColor: '#CE93D8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  // Preview state: a soft, unalarming middle ground between earned and
  // locked. Same size and position as both, so the layout never shifts.
  previewPill: {
    backgroundColor: '#FAF6FD',
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
  previewBadgeText: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: '#7E57C2', letterSpacing: 0.3 },
  previewCaption: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#8A7B96',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
  },

  // Locked: soft grey, no shadow — clearly "not yet" without looking broken.
  uppercaseLocked: {
    backgroundColor: '#F8F8F8',
    borderColor: '#DDDDDD',
    shadowOpacity: 0,
    elevation: 0,
  },
  uppercaseTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
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
    fontFamily: 'DMSans_800ExtraBold',
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
    fontFamily: 'DMSans_700Bold',
    flex: 1,
  },
  pickerCount: {
    fontSize: 12,
    color: '#888888',
    fontFamily: 'DMSans_600SemiBold',
  },
  pickerCancel: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 2,
  },
  pickerCancelText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
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
    fontFamily: 'DMSans_800ExtraBold',
    color: '#333333',
  },
});
