import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Card } from '../../../components/common/Card';
import { MasteryRing } from '../../../components/charts/MasteryRing';
import { GroupGrid } from '../../../components/charts/GroupGrid';
import { ConceptThumb } from '../../../components/charts/ConceptThumb';
import { CategoryConceptsModal } from '../../../components/concept/CategoryConceptsModal';
// The sign-in screen's gradient, top to bottom: sky blue → green → cream.
import { Colors, LOGIN_BACKDROP } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../constants/backButton';
import { teacherApi } from '../../../api/teacher';
import { dialogueApi } from '../../../api/dialogue';
import { level2Api } from '../../../api/level2';
import { formatDate, ageFrom } from '../../../utils/formatters';
import { ROUND, ACTION, sinceWords } from '../../../constants/teacherWording';
// Proposal FR-16, Phase 7B — compact "Live Handwriting Session" card, only
// rendered while the Writing tab is open.
import LiveSessionCard from '../../../components/teacher/LiveSessionCard';
import { StrokeFamilyModal } from '../../../components/teacher/StrokeFamilyModal';
import { PronunciationCategoryModal } from '../../../components/teacher/PronunciationCategoryModal';
import ReportPreviewModal from '../../../components/handwriting/reports/ReportPreviewModal';
import {
  generatePronunciationReportPdf, sharePronunciationReportPdf, downloadPronunciationReportPdf,
} from '../../../utils/pronunciationReportPdf';
import { SESSION_CATEGORIES } from '../pronunciation/sessionCategories';
import { WORD_BANK } from '../pronunciation/wordBank';
import {
  buildPronunciationSummary, RECENT_LIMIT as PRON_RECENT_LIMIT, ALPHABET_KEY,
} from '../../../utils/pronunciationModuleSummary';
import {
  fetchWritingSummary, buildWritingSummary,
  TOTAL_LOWERCASE as TOTAL_LOWERCASE_FORMS,
  TOTAL_UPPERCASE as TOTAL_UPPERCASE_FORMS,
} from '../../../utils/writingModuleSummary';
import { fetchStrokeBreakdown } from '../../../utils/writingStrokeBreakdown';


// Same tinted pairs the teacher dashboard uses for its section panels, so a
// profile opened from a dashboard card keeps the same visual language.
const TINTS = {
  purple: { bg: '#EFEBFA', fg: '#6C5CE0' },
  green:  { bg: '#E3F7EC', fg: '#3FAE6F' },
  blue:   { bg: '#E6F1FC', fg: '#3B82C4' },
  amber:  { bg: '#FDF1DC', fg: '#E89A2E' },
  // The sign-in button's own green, in the deepened form that carries text. The
  // module panel takes it so the page reads as one surface with the identity card
  // above it rather than a green header with a purple panel under it.
  brand:  { bg: '#E4F4EC', fg: Colors.brandDeep },
};

const SECTION = {
  contact:  { icon: 'call-outline',        ...TINTS.green },
  progress: { icon: 'stats-chart-outline', ...TINTS.brand },
};

const PANEL_PAD = 16;
// The module panel's own rhythm. Everything inside it — header, tab bar, cards,
// the gaps between them — is a multiple of this, which is most of what makes the
// section read as laid out rather than assembled.
const PANEL_PAD_LG = 24;
const CARD_GAP     = 16;

// Four thumbnails fit one row at the narrowest width this panel reaches, and the
// overflow count carries the rest. A teacher acting on this opens the group; they
// do not work through nineteen pictures on a summary card.
const REVISIT_SHOWN = 4;

// ── Panel shell ──────────────────────────────────────────────────────────────

/**
 * `size="lg"` is the spacious variant, used for the one panel that carries a
 * whole workspace rather than a list of fields.
 *
 * The difference is not only scale. The small panel wears its accent as a tinted
 * header band, which is what tells a short list of contact details apart from the
 * card above it. At the module panel's size that band became a coloured stripe
 * across the widest thing on the screen and started competing with the content
 * under it, so the large variant keeps the accent to the icon plate and the
 * action, and lets the title carry the weight in plain ink.
 */
function Panel({ title, section, action, onAction, children, flush, size = 'md', style }) {
  const accent = SECTION[section];
  const lg = size === 'lg';

  return (
    // Shadow on the outer view, clipping on the inner one: a view with
    // overflow:hidden clips its own shadow on iOS, so the two can't be the same.
    <View style={[styles.panelShadowWrap, lg && styles.panelShadowWrapLg, style]}>
      <View style={[
        styles.panel,
        lg ? styles.panelLg : { borderColor: accent.fg + '33' },
      ]}>
        <View style={[
          styles.panelHeader,
          lg
            ? styles.panelHeaderLg
            : { backgroundColor: accent.bg, borderBottomColor: accent.fg + '26' },
        ]}>
          <View style={[
            styles.panelIcon,
            lg && [styles.panelIconLg, { backgroundColor: accent.bg }],
          ]}>
            <Ionicons name={accent.icon} size={lg ? 22 : 16} color={accent.fg} />
          </View>

          <Text
            style={[styles.panelTitle, lg ? styles.panelTitleLg : { color: accent.fg }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {/* On the large panel this is a pill rather than a word. Bare text next
              to a 52px icon plate and a 24px title read as a caption on the
              header, not as the way out of it — and it is the only control up
              there, so it has to look like one. Tinted rather than filled: the
              panel already ends in a solid gradient button to the same place, and
              two identical fills would leave neither looking primary. */}
          {action ? (
            <TouchableOpacity
              onPress={onAction}
              activeOpacity={0.75}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={`${action}, opens everything this child has done`}
              style={lg ? [
                styles.panelActionBtn,
                { backgroundColor: accent.bg, borderColor: accent.fg + '3D' },
              ] : null}
            >
              <Text style={[
                styles.panelAction,
                lg && styles.panelActionLg,
                { color: accent.fg },
              ]}>
                {action}
              </Text>
              {lg ? <Ionicons name="arrow-forward" size={15} color={accent.fg} /> : null}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={flush ? null : styles.panelBody}>{children}</View>
      </View>
    </View>
  );
}

// ── Info rows ────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, accent }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: accent.bg }]}>
        <Ionicons name={icon} size={15} color={accent.fg} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * Renders only the rows that have a value, with dividers *between* them.
 *
 * Interleaving here rather than at each call site is what stops a missing
 * optional field (no father's name, say) from leaving a divider stranded at the
 * top of the card with nothing above it.
 */
function InfoList({ rows, section }) {
  const accent  = SECTION[section];
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;

  return (
    <View>
      {visible.map((r, i) => (
        <React.Fragment key={r.label}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <InfoRow icon={r.icon} label={r.label} value={r.value} accent={accent} />
        </React.Fragment>
      ))}
    </View>
  );
}

/** One figure on the progress panel: a small-caps label over a large number. */
/**
 * The one Module Progress action button: the green gradient pill every tab's
 * footer uses, so all of them share one colour and one shape. `icon` sits
 * before the label; `trailing` (an arrow) after it.
 */
function ModuleActionButton({
  label, icon, trailing, onPress, disabled = false, busy = false, accessibilityLabel,
}) {
  return (
    <TouchableOpacity
      style={[styles.reportBtn, disabled && styles.reportBtnDisabled]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
    >
      <LinearGradient
        colors={Colors.brandGradientDeep}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.reportBtnFill}
      />
      {busy
        ? <ActivityIndicator size="small" color="#FFFFFF" />
        : icon ? <Ionicons name={icon} size={15} color="#FFFFFF" /> : null}
      <Text style={styles.reportBtnText}>{label}</Text>
      {trailing ? <Ionicons name={trailing} size={15} color="#FFFFFF" /> : null}
    </TouchableOpacity>
  );
}

function ProgressStat({ label, value, of, tint, style }) {
  return (
    <View style={[styles.progressStat, style]}>
      <Text style={styles.progressStatLabel} numberOfLines={2}>{label}</Text>
      <View style={styles.progressStatRow}>
        <Text style={[styles.progressStatValue, tint ? { color: tint } : null]}>{value}</Text>
        {of ? <Text style={styles.progressStatOf}>/ {of}</Text> : null}
      </View>
    </View>
  );
}

/** One fact on the identity card: an icon plate, a small-caps label, the value. */
function IdFact({ icon, label, value }) {
  return (
    <View style={styles.idFact}>
      <View style={styles.idFactIcon}>
        <Ionicons name={icon} size={17} color="rgba(255,255,255,0.95)" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.idFactLabel}>{label}</Text>
        <Text style={styles.idFactValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

// Only Concept Learning reports progress today; the rest render an unavailable
// panel until those modules ship, so the selector stays honest about coverage.
// The three Level 1 word categories, in the order the child meets them. Used to
// filter the overview payload — it can carry words from categories this panel
// does not summarise, and counting those would inflate every figure below.
const DIALOGUE_CATEGORIES = [
  { key: 'greetings',   label: 'Greetings' },
  { key: 'magic_words', label: 'Magic words' },
  { key: 'abilities',   label: 'Abilities' },
];

const MODULES = [
  { key: 'concept',       tab: 'Concepts',      title: 'Concept Module',       icon: 'school-outline' },
  { key: 'writing',       tab: 'Writing',       title: 'Writing Module',       icon: 'create-outline' },
  { key: 'pronunciation', tab: 'Pronunciation', title: 'Pronunciation Module', icon: 'mic-outline' },
  { key: 'dialogue',      tab: 'Dialogue',      title: 'Dialogue Module',      icon: 'chatbubbles-outline' },
];

// One colour and icon per stroke family, as the Concept breakdown gives each
// category its own face.
const STROKE_FACE = {
  curved:              { icon: 'refresh',     bg: '#E5EEF9', fg: '#27609F' },
  diagonal:            { icon: 'trending-up', bg: '#EDE9FA', fg: '#6438BE' },
  vertical_horizontal: { icon: 'add',         bg: '#E6F4EA', fg: '#2A7146' },
  mixed:               { icon: 'shuffle',     bg: '#FAF0DF', fg: '#945D08' },
};

/**
 * WRITING stroke-family breakdown — the handwriting counterpart of the Concept
 * tab's category breakdown. A glance only: each card and the heading open the
 * Writing Progress Report, where the per-letter detail lives.
 */
function StrokeBreakdown({ state, onOpenReport, onSelect }) {
  // Four across only while each card keeps ~200pt; otherwise two, so a long
  // family name is not cut off.
  const [gridW, setGridW] = useState(0);
  const cols = gridW >= 4 * 200 + 3 * 8 ? 4 : 2;

  return (
    <View style={styles.strokeWrap}>
      <TouchableOpacity
        style={styles.breakdownHead}
        activeOpacity={0.7}
        onPress={onOpenReport}
        accessibilityRole="button"
        accessibilityLabel="Stroke families. Opens the Writing Progress Report"
      >
        <View style={styles.breakdownIcon}>
          <Ionicons name="grid" size={14} color={Colors.brandDeep} />
        </View>
        <Text style={styles.breakdownTitle}>Stroke families</Text>
        <Text style={styles.breakdownHint}>Tap a family to see its letters</Text>
      </TouchableOpacity>

      {state.status === 'loading' ? (
        <View style={styles.wsLoading}><ActivityIndicator color={Colors.icon.active} /></View>
      ) : state.status === 'unavailable' ? (
        <Text style={styles.strokeEmpty}>Stroke breakdown isn&apos;t available right now.</Text>
      ) : (
        <View style={styles.strokeGrid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
          {state.families.map((fam) => {
            const face = STROKE_FACE[fam.key] || STROKE_FACE.mixed;
            const started = fam.practised > 0 && fam.current != null;
            return (
              <TouchableOpacity
                key={fam.key}
                style={[styles.strokeCard, { flexBasis: cols === 4 ? '22%' : '46%' }]}
                activeOpacity={0.75}
                onPress={() => onSelect(fam)}
                accessibilityRole="button"
                accessibilityLabel={
                  `${fam.label}, ${fam.practised} of ${fam.total} letters practised` +
                  (started ? `, now ${fam.current} percent` : '') +
                  '. Opens its letters'
                }
              >
                <View style={styles.strokeHead}>
                  <View style={[styles.strokeFace, { backgroundColor: face.bg }]}>
                    <Ionicons name={face.icon} size={18} color={face.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.strokeLabel} numberOfLines={2}>{fam.label}</Text>
                    <Text style={styles.strokeSample} numberOfLines={1}>{fam.sample}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={Colors.text.muted} />
                </View>

                <View style={styles.strokeTrack}>
                  <View style={[styles.strokeFill, { width: `${started ? fam.current : 0}%`, backgroundColor: face.fg }]} />
                </View>

                <View style={styles.strokeFoot}>
                  <Text style={styles.strokeCount}>
                    <Text style={styles.strokeCountNum}>{fam.practised}</Text>
                    <Text style={styles.strokeCountOf}> of {fam.total} practised</Text>
                  </Text>
                  {started ? (
                    <View style={[styles.strokePill, { backgroundColor: face.bg }]}>
                      <Text style={[styles.strokePillText, { color: face.fg }]}>{fam.current}%</Text>
                    </View>
                  ) : null}
                </View>

                {started && fam.delta != null ? (
                  <View style={styles.strokeDelta}>
                    <Ionicons
                      name={fam.delta > 0 ? 'arrow-up' : fam.delta < 0 ? 'arrow-down' : 'remove'}
                      size={11}
                      color={fam.delta > 0 ? '#2A7146' : fam.delta < 0 ? '#B86E12' : Colors.text.muted}
                    />
                    <Text style={styles.strokeDeltaText}>
                      {fam.delta === 0 ? 'Same as first try' : `${Math.abs(fam.delta)} since first try`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.strokeDeltaText}>{started ? ' ' : 'Not practised yet'}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// One colour and icon per pronunciation category — Animals, Fruits and
// Classroom in the same colours the Concept breakdown gives those groups.
const PRON_FACE = {
  animals:         { icon: 'paw',         bg: '#FAE9F0', fg: '#A5366A' },
  classroom:       { icon: 'school',      bg: '#EDE9FA', fg: '#6438BE' },
  fruits:          { icon: 'nutrition',   bg: '#FAF0DF', fg: '#945D08' },
  'daily-actions': { icon: 'walk',        bg: '#E5EEF9', fg: '#27609F' },
  [ALPHABET_KEY]:  { icon: 'text',        bg: '#E6F4EA', fg: '#2A7146' },
};
const PRON_FALLBACK_FACE = { icon: 'mic', bg: '#F1F4F7', fg: '#5B6672' };

// Words per category, as the word selection screen offers them (Animals
// includes its "more animals" page). Alphabet is the 26 letters.
const PRON_TOTALS = {
  ...Object.fromEntries(SESSION_CATEGORIES.map((c) => [c.id, (WORD_BANK[c.id] || []).length])),
  animals: (WORD_BANK.animals || []).length + (WORD_BANK.moreAnimals || []).length,
  [ALPHABET_KEY]: 26,
};

// Every word each category offers, so the category pop-up can list the ones
// not tried yet. Same sources as PRON_TOTALS.
const toCatalogueEntry = (w) => ({ id: w.id, label: w.word ?? w.id });
const PRON_CATALOGUE = {
  ...Object.fromEntries(SESSION_CATEGORIES.map((c) => [c.id, (WORD_BANK[c.id] || []).map(toCatalogueEntry)])),
  animals: [...(WORD_BANK.animals || []), ...(WORD_BANK.moreAnimals || [])].map(toCatalogueEntry),
  [ALPHABET_KEY]: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => ({ id: l.toLowerCase(), label: l })),
};

/**
 * PRONUNCIATION category breakdown — the counterpart of the Concept tab's.
 * Same card as the stroke families; each opens the sessions screen.
 */
function PronunciationBreakdown({ groups, onSelect }) {
  // Each card opens that category's summary pop-up (onSelect(group)).
  const [gridW, setGridW] = useState(0);
  const cols = gridW >= 3 * 200 + 2 * 8 ? 3 : 2;

  return (
    <View style={styles.strokeGrid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
      {groups.map((g) => {
        const face = PRON_FACE[g.key] || PRON_FALLBACK_FACE;
        return (
          <TouchableOpacity
            key={g.key}
            style={[styles.strokeCard, { flexBasis: cols === 3 ? '31%' : '46%' }]}
            activeOpacity={0.75}
            onPress={() => onSelect(g)}
            accessibilityRole="button"
            accessibilityLabel={
              `${g.label}, ${g.practised}${g.total ? ` of ${g.total}` : ''} practised` +
              (g.average != null ? `, average ${g.average} percent` : '') +
              '. Opens its summary'
            }
          >
            <View style={styles.strokeHead}>
              <View style={[styles.strokeFace, { backgroundColor: face.bg }]}>
                <Ionicons name={face.icon} size={18} color={face.fg} />
              </View>
              <Text style={[styles.strokeLabel, { flex: 1 }]} numberOfLines={2}>{g.label}</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.text.muted} />
            </View>

            <View style={styles.strokeTrack}>
              <View style={[styles.strokeFill, { width: `${g.average ?? 0}%`, backgroundColor: face.fg }]} />
            </View>

            <View style={styles.strokeFoot}>
              <Text style={styles.strokeCount}>
                <Text style={styles.strokeCountNum}>{g.practised}</Text>
                <Text style={styles.strokeCountOf}>
                  {g.total ? ` of ${g.total}` : ''} {g.key === ALPHABET_KEY ? 'letters' : 'words'}
                </Text>
              </Text>
              {g.average != null ? (
                <View style={[styles.strokePill, { backgroundColor: face.bg }]}>
                  <Text style={[styles.strokePillText, { color: face.fg }]}>{g.average}%</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.strokeDeltaText}>
              {g.attempts} {g.attempts === 1 ? 'try' : 'tries'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * WRITING PROGRESS summary, laid out like the Concept tab: a ring beside a 2x2
 * of figures, then a ruled strip for the statuses that are not counts.
 *
 * Every value comes from utils/writingModuleSummary.js, which reads only
 * backend-authoritative counts. Nothing here is derived from a demo/preview
 * flag, and nothing shows raw DTW, motor features, thresholds, cycle counts
 * or clustering terminology. The report action lives in the panel footer.
 */
function WritingSummaryCard({ state, onRetry }) {
  const s = state.summary;
  // The ring is a touch smaller on a phone, where the tiles wrap under it.
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  if (state.status === 'loading') {
    return (
      <View style={styles.wsLoading}>
        <ActivityIndicator color={Colors.icon.active} />
      </View>
    );
  }

  if (state.status === 'partial') {
    // Core letter progress did not load. Secondary items degrade on their
    // own (a missing Writing Check simply reads "Not checked yet"), but
    // without the letter counts there is no summary to show — and a made-up
    // 0/52 would read as real. Never a status code, never "read_failed".
    return (
      <View style={styles.wsUnavailable}>
        <Ionicons name="cloud-offline-outline" size={20} color={Colors.text.muted} />
        <Text style={styles.wsUnavailableText}>
          Writing progress isn&apos;t available right now.
        </Text>
        <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
          <Text style={styles.wsRetryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {/* 52 letter FORMS (26 lowercase + 26 uppercase); words are a separate
          module and never counted into this figure. */}
      <View style={styles.statRow}>
        <View style={styles.ringCard}>
          <MasteryRing
            value={s.totalMastered / s.totalLetterForms}
            size={wide ? 168 : 140}
            label="mastered"
            color={Colors.brandDeep}
          />
        </View>

        <View style={styles.statGrid}>
          <ProgressStat label="Letters mastered" value={String(s.totalMastered)} of={s.totalLetterForms} />
          {/* Words are locked until BOTH cases are complete — the same rule
              the child-facing gate uses. */}
          <ProgressStat
            label="Word practice"
            value={s.wordsUnlocked ? 'Available' : 'Locked'}
            tint={s.wordsUnlocked ? Colors.brandDeep : Colors.text.secondary}
          />
          <ProgressStat label="Lowercase letters" value={String(s.lowercaseMastered)} of={TOTAL_LOWERCASE_FORMS} />
          <ProgressStat label="Uppercase letters" value={String(s.uppercaseMastered)} of={TOTAL_UPPERCASE_FORMS} />
        </View>
      </View>

      <View style={styles.context}>
        {/* Latest Writing Check status only. Never a cluster id, never a
            chart, never framed as good or bad. */}
        <View style={styles.lastWorked}>
          <Ionicons name="pulse-outline" size={15} color={Colors.text.secondary} />
          <Text style={styles.lastWorkedLabel}>Writing pattern</Text>
          <Text style={styles.lastWorkedValue}>{s.writingPatternLabel}</Text>
        </View>

        {/* Home practice, counted rather than listed. */}
        {s.homePracticeCount != null && s.homePracticeCount > 0 ? (
          <View style={styles.lastWorked}>
            <Ionicons name="home-outline" size={15} color={Colors.text.secondary} />
            <Text style={styles.lastWorkedLabel}>Home practice</Text>
            <Text style={styles.lastWorkedValue}>
              {s.homePracticeCount === 1 && s.homePracticeLetters.length === 1
                ? `${s.homePracticeLetters[0]} needs additional practice`
                : `${s.homePracticeCount} letters recommended`}
            </Text>
          </View>
        ) : null}

        {!s.wordsUnlocked ? (
          <View style={styles.revisit}>
            <Text style={styles.revisitLabel}>Word practice</Text>
            <Text style={styles.revisitEmpty}>
              Complete all lowercase and uppercase letters first.
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

export default function TeacherStudentDetailScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  // Opened from the principal's Reports. Every progress endpoint behind this
  // page is teacher-only (and checks the student is the caller's own), so a
  // principal sees the profile from the record they already have, and the
  // progress panel says where progress lives instead of failing request by
  // request. No teacher endpoint is called in this mode.
  const asPrincipal = route.params?.viewer === 'principal';
  const [student, setStudent] = useState(initialStudent);
  const [refreshing, setRefreshing] = useState(false);
  const [concepts, setConcepts] = useState(null);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  // Dialogue Level 1 word progress and the Level 2 report's totals. Both null
  // until they load and null if they fail — the tab shows an inline message
  // rather than blanking, matching how `concepts` behaves above.
  const [dialogue, setDialogue] = useState(null);
  const [dialogueLoading, setDialogueLoading] = useState(true);
  const [level2, setLevel2] = useState(null);
  const [activeModule, setActiveModule] = useState('concept');
  // The group whose contents are open, or null. Holds the category itself rather
  // than a boolean so the sheet's title stays right while it animates out.
  const [openCategory, setOpenCategory] = useState(null);
  // The newest note a teacher has written about this child, for the identity card.
  // Null until it loads and null if it fails — the card simply shows the address
  // instead, rather than an empty quote box.
  const [latestNote, setLatestNote] = useState(null);

  // Writing tab summary. Lazy — fetched only once the Writing tab is actually
  // open. Seeded with the neutral empty summary so a brand-new child reads
  // 0/52 and "Locked" rather than blank or an error.
  const [writingSummary, setWritingSummary] = useState({
    status: 'loading', summary: buildWritingSummary({}),
  });

  const fetch = useCallback(async () => {
    if (!initialStudent?.sid || asPrincipal) { setRefreshing(false); return; }
    try {
      const s = await teacherApi.getStudent(initialStudent.sid);
      setStudent(s);
    } catch {
      // Use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialStudent?.sid, asPrincipal]);

  useEffect(() => { fetch(); }, [fetch]);

  const fetchConcepts = useCallback(async () => {
    if (!initialStudent?.sid || asPrincipal) return;
    try {
      setConcepts(await teacherApi.getConceptSummary(initialStudent.sid));
    } catch {
      setConcepts(null); // section renders an inline error rather than blanking
    } finally {
      setConceptsLoading(false);
    }
  }, [initialStudent?.sid, asPrincipal]);

  // Reads word *progress*, not the trajectory model. Deriving trajectory counts
  // here would run a prediction — and possibly SHAP — for every word on every
  // visit to this screen; that work belongs in the report the link opens.
  const fetchDialogue = useCallback(async () => {
    if (!initialStudent?.sid || asPrincipal) return;
    try {
      setDialogue(await dialogueApi.getLevel1Overview(initialStudent.sid));
    } catch {
      setDialogue(null);
    } finally {
      setDialogueLoading(false);
    }
  }, [initialStudent?.sid, asPrincipal]);

  // Level 2's summary comes from its own report endpoint's `totals`. Unlike
  // Level 1 there is no cheaper per-topic call covering all three topics at
  // once, and this report is plain database reads with no model behind it.
  const fetchLevel2 = useCallback(async () => {
    if (!initialStudent?.sid || asPrincipal) return;
    try {
      const resp = await level2Api.getReport(initialStudent.sid);
      setLevel2(resp?.data ?? resp ?? null);
    } catch {
      setLevel2(null);
    }
  }, [initialStudent?.sid, asPrincipal]);

  const fetchNote = useCallback(async () => {
    if (!initialStudent?.sid || asPrincipal) return;
    try {
      const notes = await teacherApi.getStudentNotes(initialStudent.sid);
      const newest = Array.isArray(notes) ? notes[0] : null;
      setLatestNote(newest?.body ?? null);
    } catch {
      setLatestNote(null);
    }
  }, [initialStudent?.sid, asPrincipal]);

  // openHandwritingReport is declared as a plain function further down — it
  // needs `route.name` as the report's back target, and a second copy here
  // would be a redeclaration.

  const [strokes, setStrokes] = useState({ status: 'loading', families: [] });
  // The stroke family whose letters are open, or null.
  const [openStroke, setOpenStroke] = useState(null);

  // Pronunciation: the most recent attempts, summarised. null until loaded.
  const [pron, setPron] = useState({ status: 'loading', summary: null });

  const loadPronunciation = useCallback(async () => {
    if (!initialStudent?.sid || asPrincipal) return;
    setPron((prev) => ({ ...prev, status: prev.summary ? 'ok' : 'loading' }));
    try {
      const rows = await teacherApi.getPronunciationResults(initialStudent.sid, PRON_RECENT_LIMIT);
      setPron({
        status: 'ok',
        summary: buildPronunciationSummary(rows, {
          categories: SESSION_CATEGORIES, totals: PRON_TOTALS, catalogue: PRON_CATALOGUE,
        }),
      });
    } catch {
      setPron({ status: 'error', summary: null });
    }
  }, [initialStudent?.sid, asPrincipal]);

  // The category whose summary pop-up is open, or null.
  const [openPronGroup, setOpenPronGroup] = useState(null);

  // Pronunciation report: GENERATE (PDF on this device + preview), then the
  // teacher chooses Download or Share for that same file.
  const [pronReport, setPronReport] = useState(null); // { html, filename, fileUri }
  const [pronReportBusy, setPronReportBusy] = useState(null); // 'generating' | 'sharing' | 'downloading' | null
  const [pronReportMessage, setPronReportMessage] = useState(null);
  const [pronReportNotice, setPronReportNotice] = useState(null);

  const openPronunciationReport = useCallback(async () => {
    if (!pron.summary || pronReportBusy) return;
    setPronReportBusy('generating');
    setPronReportMessage(null);
    setPronReportNotice(null);
    const result = await generatePronunciationReportPdf({
      summary: pron.summary,
      studentName: initialStudent?.full_name ?? 'Student',
    });
    setPronReportBusy(null);
    if (result.status === 'generated') {
      setPronReport({ html: result.html, filename: result.filename, fileUri: result.fileUri });
    } else {
      setPronReportMessage('Could not create the report. Please try again.');
    }
  }, [pron.summary, pronReportBusy, initialStudent?.full_name]);

  const sharePronunciationReport = useCallback(async () => {
    if (!pronReport?.fileUri) return;
    setPronReportBusy('sharing');
    setPronReportMessage(null);
    setPronReportNotice(null);
    const result = await sharePronunciationReportPdf({
      fileUri: pronReport.fileUri,
      studentName: initialStudent?.full_name ?? 'Student',
    });
    setPronReportBusy(null);
    if (result.status === 'shared') setPronReport(null);
    else if (result.status === 'sharing_unavailable') setPronReportMessage('Sharing is not available on this device. Use Download instead.');
    else if (result.status === 'failed') setPronReportMessage('Could not share the report. Please try again.');
  }, [pronReport, initialStudent?.full_name]);

  const downloadPronunciationReport = useCallback(async () => {
    if (!pronReport?.fileUri) return;
    setPronReportBusy('downloading');
    setPronReportMessage(null);
    setPronReportNotice(null);
    const result = await downloadPronunciationReportPdf({
      fileUri: pronReport.fileUri,
      filename: pronReport.filename,
    });
    setPronReportBusy(null);
    if (result.status === 'saved') setPronReportNotice('Report downloaded to the folder you chose.');
    else if (result.status === 'failed') setPronReportMessage('Could not download the report. Please try again.');
  }, [pronReport]);

  const closePronunciationReport = useCallback(() => {
    setPronReport(null);
    setPronReportBusy(null);
    setPronReportMessage(null);
    setPronReportNotice(null);
  }, []);

  // On opening the tab, and again on returning to the profile with it open,
  // so a session just finished is counted.
  useFocusEffect(useCallback(() => {
    if (activeModule === 'pronunciation') loadPronunciation();
  }, [activeModule, loadPronunciation]));

  const loadWritingSummary = useCallback(async () => {
    if (!initialStudent?.sid || asPrincipal) return;
    setWritingSummary((prev) => ({ ...prev, status: 'loading' }));
    setStrokes((prev) => ({ ...prev, status: 'loading' }));
    // Independent: one failing never blanks the other.
    const [summary, strokeState] = await Promise.all([
      fetchWritingSummary(initialStudent.sid),
      fetchStrokeBreakdown(initialStudent.sid),
    ]);
    setWritingSummary(summary);
    setStrokes(strokeState);
  }, [initialStudent?.sid, asPrincipal]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { fetchNote(); }, [fetchNote]);

  // Refetch on focus so returning from the report reflects a session just played.
  useFocusEffect(useCallback(() => {
    fetchConcepts();
    fetchDialogue();
    fetchLevel2();
  }, [fetchConcepts, fetchDialogue, fetchLevel2]));

  // Lazy-load only when the Writing tab is actually selected (mirrors
  // getConceptReport's own "expensive, lazy-load from the report screen"
  // convention) — fetched once per (student, module-becomes-writing), not
  // on every render or every tab switch back to Writing.
  useEffect(() => {
    if (activeModule === 'writing') loadWritingSummary();
  }, [activeModule, loadWritingSummary]);

  if (!student) return null;

  // Categories the child has actually touched — showing all nine when eight are
  // empty buries the signal.
  const activeCategories = (concepts?.categories || []).filter((c) => c.started > 0);

  // The concepts themselves, not a count of them. `needs_attention` has always
  // carried the keys and the panel only ever measured the array — which meant the
  // most actionable thing on the screen was the one thing it withheld.
  const revisit = (concepts?.categories || []).flatMap((c) =>
    (c.needs_attention || []).map((k) => ({
      category_key: c.category_key,
      concept_key:  k,
    })),
  );

  // Older clients can reach a backend that has not been restarted; a missing
  // field reads as nothing learned this week rather than as NaN on the tile.
  const learnedThisWeek = concepts?.totals?.learned_last_7_days ?? 0;

  // Dialogue Level 1. `status` here is the mastery state, not the trajectory
  // label — the report's 'struggling' is a prediction about where a word is
  // heading, this one is a record of what has already happened, so it is
  // surfaced as "Needs work" to keep the two readable side by side.
  const dialogueWords = (Array.isArray(dialogue) ? dialogue : [])
    .filter((w) => DIALOGUE_CATEGORIES.some((c) => c.key === w.category));
  const dialogueTotals = {
    total:      dialogueWords.length,
    mastered:   dialogueWords.filter((w) => w.status === 'mastered').length,
    inProgress: dialogueWords.filter((w) => w.status === 'in_progress').length,
    needsWork:  dialogueWords.filter((w) => w.status === 'struggling').length,
  };
  const dialogueStarted = dialogueWords.filter((w) => w.status !== 'not_started').length;
  // A FRACTION, not a percentage: MasteryRing clamps to 0..1 and does its own
  // ×100 for the label. Passing 18 here rendered "1800%" on a ring clamped full.
  // Null when there is nothing to divide — the ring draws grey with an em dash
  // rather than a definite-looking 0%.
  const dialogueMastery = dialogueTotals.total > 0
    ? dialogueTotals.mastered / dialogueTotals.total
    : null;

  // Level 2 lives in this same tab, below Level 1.
  const level2Totals  = level2?.totals ?? null;
  const level2Started = level2Totals?.topics_started ?? 0;

  const age = ageFrom(student.date_of_birth);
  const activeMeta = MODULES.find((m) => m.key === activeModule) ?? MODULES[0];
  const firstName  = student.full_name.split(' ')[0];
  const hasProgress = concepts && concepts.totals.started > 0;


  // The card itself is the brand teal now, so the child's avatar theme survives
  // as the badge on the photo — the deep end of their own pair. It is still the
  // mark a teacher who knows Lily from Boba reads before the name, and it is
  // still the colour the child sees in the concept activities.
  const avatarPair = getAvatarTheme(student.avatar_key).heroGradient;
  const avatarDeep = avatarPair[avatarPair.length - 1];

  // The header's "Report" shortcut points at whichever module is on screen —
  // Concept only once there is something to report on, Writing always, since
  // the handwriting report renders its own empty state.
  const reportAction =
    activeModule === 'writing' ? 'Report'
      : activeModule === 'concept' && concepts && concepts.totals.started > 0 ? 'Report'
        : null;

  function openHandwritingReport() {
    navigation.navigate('StudentHandwritingReport', {
      student,
      theme: getAvatarTheme(student.avatar_key),
      // Where the report's back button returns to. Without it the report
      // fell through to a bare goBack(), which lands wherever the stack
      // happens to point rather than on the profile the teacher opened it
      // from — see utils/backToOrigin.js. `activeModule` is preserved for
      // free: this screen is not unmounted, so Writing is still selected.
      originRoute: route.name,
    });
  }

  function openActiveReport() {
    if (activeModule === 'writing') openHandwritingReport();
    else if (activeModule === 'concept') navigation.navigate('ConceptReport', { student });
  }

  useEffect(() => {
    // The header is drawn inside the page (see `topBar`), with the same round
    // back button and heading style as the report screens and the student side.
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const topBar = (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={BACK_BUTTON}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={Colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.topTitle} numberOfLines={1}>Student Profile</Text>
    </View>
  );

  return (
    // The sign-in screen's gradient — the same one the concept report uses — so
    // the profile and the report it leads to share one surface.
    <LinearGradient
      colors={LOGIN_BACKDROP.colors}
      start={LOGIN_BACKDROP.start}
      end={LOGIN_BACKDROP.end}
      style={styles.safe}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
      {topBar}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* The identity card, in the sign-in button's teal → green, on the same
            diagonal as that button so it reads as the same surface rather than a
            coincidence of hue. */}
        <LinearGradient
          colors={Colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.idCard}
        >
          {/* Measured, not taste. The brand pair is a button colour: white on it
              is 2.69:1 at the teal end and 2.29:1 at the green, which is fine for
              four words on a control and fails everything on a card carrying a
              name, two dates and an address. The scrim deepens the same two hues
              to 5.16:1 and 4.56:1 — so the card keeps the brand colour and the
              text on it can actually be read. */}
          <View style={styles.idScrim} pointerEvents="none" />

          <View style={styles.idBody}>
            {/* Left: who they are. */}
            <View style={styles.idLeft}>
              <View style={styles.idAvatarWrap}>
                <Avatar
                  name={student.full_name}
                  uri={student.profile_photo_url}
                  size={104}
                  style={styles.idAvatar}
                />
                {/* The child's own avatar colour, kept as a badge on the photo.
                    It is the one thing a teacher recognises before reading, and
                    it had nowhere left to live once the card went dark. */}
                <View style={[styles.idAvatarBadge, { backgroundColor: avatarDeep }]}>
                  <Ionicons name="school" size={14} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.idName} numberOfLines={2}>{student.full_name}</Text>

              <View style={styles.idChips}>
                {student.student_code ? (
                  <View style={styles.idChip}>
                    <Text style={styles.idChipText}>{student.student_code}</Text>
                  </View>
                ) : null}
                {age != null ? (
                  <>
                    <View style={styles.idDot} />
                    <Text style={styles.idAge}>{age} years old</Text>
                  </>
                ) : null}
              </View>
            </View>

            {/* Right: the facts, as tiles on the dark. */}
            <View style={styles.idRight}>
              <View style={styles.idFactRow}>
                {student.date_of_birth ? (
                  <IdFact icon="gift-outline" label="Date of birth" value={formatDate(student.date_of_birth)} />
                ) : null}
                {student.disability ? (
                  <IdFact icon="pulse-outline" label="Diagnosis" value={student.disability} />
                ) : null}
              </View>

              {/* The most recent note a teacher wrote about this child. Real, not a
                  placeholder — an invented line here would read as clinical record.
                  Absent until one exists, and absent if the fetch fails. */}
              {latestNote ? (
                <View style={styles.idNote}>
                  <View style={styles.idNoteBadge}>
                    <Text style={styles.idNoteQuote}>“</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.idFactLabel}>Teacher's note</Text>
                    <Text style={styles.idNoteText} numberOfLines={3}>{latestNote}</Text>
                  </View>
                </View>
              ) : student.address ? (
                <View style={styles.idNote}>
                  <View style={styles.idNoteBadge}>
                    <Ionicons name="home-outline" size={16} color="rgba(255,255,255,0.95)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.idFactLabel}>Address</Text>
                    <Text style={styles.idNoteText} numberOfLines={2}>{student.address}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {/* Contact */}
        {(student.father_name || student.mother_name || student.mobile_number || student.home_number) && (
          <Panel title="Contact Information" section="contact" flush>
            <InfoList
              section="contact"
              rows={[
                { icon: 'person-outline',          label: "Father's Name", value: student.father_name },
                { icon: 'person-outline',          label: "Mother's Name", value: student.mother_name },
                { icon: 'phone-portrait-outline',  label: 'Mobile',        value: student.mobile_number },
                { icon: 'call-outline',            label: 'Home',          value: student.home_number },
              ]}
            />
          </Panel>
        )}

        {/* Module progress */}
        <Panel
          title="Module Progress"
          section="progress"
          size="lg"
          flush
          style={styles.progressLift}
        >
          {asPrincipal ? (
            <View style={styles.principalNote}>
              <View style={styles.principalNoteIcon}>
                <Ionicons name="lock-closed" size={18} color={Colors.brandDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.principalNoteTitle}>Progress is kept with {firstName}&apos;s teacher</Text>
                <Text style={styles.principalNoteText}>
                  Concept, writing, pronunciation and dialogue progress can be opened from
                  the teacher&apos;s workspace. This view shows {firstName}&apos;s profile.
                </Text>
              </View>
            </View>
          ) : (<>
          {/* One track holding four equal tabs, rather than a scrolling row of
              chips. There are exactly four modules and there always will be until
              one ships, so the set is small enough to show whole — and a fixed
              set shown whole is a segmented control, which says "these are the
              four choices" where a scroller says "there may be more offscreen". */}
          <View style={styles.tabBar} accessibilityRole="tablist">
            {MODULES.map((m) => {
              const active = m.key === activeModule;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setActiveModule(m.key)}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  {/* The selected tab is the sign-in button in miniature — same
                      two hues on the same diagonal — so "the thing you pressed"
                      looks the same here as it does at the front door. Deepened,
                      because the raw pair puts white at 2.3:1 and a tab label has
                      to be read, not just recognised. */}
                  {active ? (
                    <LinearGradient
                      colors={Colors.brandGradientDeep}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tabFill}
                    />
                  ) : null}

                  {/* `secondary`, not `muted`: muted on the track is 2.48:1, under
                      the 3:1 floor for a control's icon, and these sit next to a
                      selected tab that is now considerably stronger. */}
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={active ? '#FFFFFF' : Colors.text.secondary}
                  />
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                    numberOfLines={1}
                  >
                    {m.tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeModule === 'writing' ? (
            <>
              <View style={styles.conceptBody}>
                {/* WRITING PROGRESS — a compact OVERVIEW only, following the
                    Concepts pattern: a small summary here, the detail behind the
                    footer button.
                    Deliberately NOT here: the motor performance chart, initial
                    shape assessment, difficulty analysis, Writing Check history,
                    per-letter history, worksheet history and periodic charts —
                    all of which live in the Writing Progress Report. */}
                <WritingSummaryCard
                  state={writingSummary}
                  onRetry={loadWritingSummary}
                />

                {/* Proposal FR-16, Phase 7B — near-real-time (not sub-second,
                    not biometric) live handwriting-session monitoring. Polls on
                    its own focus-gated interval. */}
                <LiveSessionCard studentId={initialStudent?.sid} compactWhenInactive />

                <StrokeBreakdown state={strokes} onOpenReport={openHandwritingReport} onSelect={setOpenStroke} />
              </View>

              {/* The panel's one primary action, in the same ruled footer and
                  green as the Concept tab's history button. */}
              <View style={[styles.reportFooter, styles.reportFooterEnd]}>
                <ModuleActionButton
                  label={`See ${firstName}'s writing history`}
                  trailing="arrow-forward"
                  onPress={openHandwritingReport}
                  accessibilityLabel="View Writing Progress Report"
                />
              </View>
            </>
          ) : activeModule === 'pronunciation' ? (
            /* Laid out like the Concept and Writing tabs: a summary of the most
               recent attempts, then the three ways into the module as footer
               buttons — start a session, read earlier ones, or check the
               review queue. */
            <>
              <View style={styles.conceptBody}>
                {pron.status === 'loading' ? (
                  <View style={styles.wsLoading}><ActivityIndicator color={Colors.icon.active} /></View>
                ) : pron.status === 'error' ? (
                  <View style={styles.wsUnavailable}>
                    <Ionicons name="cloud-offline-outline" size={20} color={Colors.text.muted} />
                    <Text style={styles.wsUnavailableText}>
                      Pronunciation progress isn&apos;t available right now.
                    </Text>
                    <TouchableOpacity onPress={loadPronunciation} activeOpacity={0.7}>
                      <Text style={styles.wsRetryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : !pron.summary || pron.summary.attempts === 0 ? (
                  <Text style={styles.revisitEmpty}>
                    No pronunciation practice yet. Progress appears here once {firstName} has a session.
                  </Text>
                ) : (
                  <>
                    <View style={styles.statRow}>
                      <View style={styles.ringCard}>
                        <MasteryRing
                          value={(pron.summary.averageScore ?? 0) / 100}
                          size={168}
                          label="average score"
                          color={Colors.brandDeep}
                        />
                      </View>
                      <View style={styles.statGrid}>
                        <ProgressStat label="Attempts" value={String(pron.summary.attempts)} />
                        <ProgressStat label="Words practised" value={String(pron.summary.wordsPractised)} />
                        <ProgressStat
                          label="Latest score"
                          value={pron.summary.latestScore != null ? `${pron.summary.latestScore}%` : '—'}
                        />
                        <ProgressStat
                          label="Flagged for review"
                          value={String(pron.summary.flagged)}
                          tint={pron.summary.flagged > 0 ? '#B86E12' : undefined}
                        />
                      </View>
                    </View>

                    <View style={styles.context}>
                      <View style={styles.lastWorked}>
                        <Ionicons name="time-outline" size={15} color={Colors.text.secondary} />
                        <Text style={styles.lastWorkedLabel}>Last practised</Text>
                        <Text style={styles.lastWorkedValue}>{sinceWords(pron.summary.latestAt)}</Text>
                      </View>

                      <View style={styles.revisit}>
                        <Text style={styles.revisitLabel}>Worth another look</Text>
                        {pron.summary.lookAgain.length === 0 ? (
                          <Text style={styles.revisitEmpty}>Nothing needs another look right now.</Text>
                        ) : (
                          <View style={styles.pronChips}>
                            {pron.summary.lookAgain.slice(0, 8).map((w) => (
                              <View key={w.label} style={styles.pronChip}>
                                <Text style={styles.pronChipText}>{w.label}</Text>
                                <Text style={styles.pronChipScore}>{w.score}%</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.breakdownHead}>
                      <View style={styles.breakdownIcon}>
                        <Ionicons name="grid" size={14} color={Colors.brandDeep} />
                      </View>
                      <Text style={styles.breakdownTitle}>Category breakdown</Text>
                      <Text style={styles.breakdownHint}>
                        {pron.summary.capped ? `Last ${PRON_RECENT_LIMIT} attempts` : 'All attempts'}
                        {' · Tap a category for its summary'}
                      </Text>
                    </View>
                    <PronunciationBreakdown
                      groups={pron.summary.groups}
                      onSelect={setOpenPronGroup}
                    />
                  </>
                )}
              </View>

              {/* The module's three ways in, kept as three buttons. The queue
                  lists only {firstName}'s attempts when opened from here. */}
              <View style={[styles.reportFooter, styles.reportFooterEnd, styles.footerWrap]}>
                <ModuleActionButton
                  label="Sessions"
                  icon="list-outline"
                  onPress={() => navigation.navigate('PronunciationResultsHistory', { student })}
                  accessibilityLabel="Pronunciation sessions. Review saved session scores and sound breakdowns"
                />
                <ModuleActionButton
                  label="Review queue"
                  icon="checkmark-done-outline"
                  onPress={() => navigation.navigate('PronunciationReviewQueue', { student })}
                  accessibilityLabel={`Review queue. Check the scores the AI was least sure about in ${firstName}'s attempts today`}
                />
                {/* The tab's summary as a PDF: preview, then Download or Share. */}
                <ModuleActionButton
                  label="Report"
                  icon="document-text-outline"
                  onPress={openPronunciationReport}
                  disabled={!pron.summary || pron.summary.attempts === 0}
                  busy={pronReportBusy === 'generating'}
                  accessibilityLabel={`Pronunciation report. Preview ${firstName}'s report, then download or share it`}
                />
              </View>
              {/* A report that could not be generated never opens its preview,
                  so the message is shown here instead. */}
              {!pronReport && pronReportMessage ? (
                <Text style={styles.pronReportError}>{pronReportMessage}</Text>
              ) : null}
            </>
          ) : activeModule === 'dialogue' ? (
            dialogueLoading ? (
              <View style={styles.conceptLoading}>
                <ActivityIndicator color={SECTION.progress.fg} />
              </View>
            ) : !dialogue ? (
              <View style={styles.conceptEmpty}>
                <Ionicons name="cloud-offline-outline" size={22} color={Colors.text.muted} />
                <Text style={styles.conceptEmptyText}>Couldn't load dialogue progress.</Text>
                <TouchableOpacity onPress={() => { setDialogueLoading(true); fetchDialogue(); }}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.conceptBody}>
                  {/* The module has two levels, shown as two labelled blocks in
                      one tab — matching how the child-facing DialogueLanding
                      presents them as two cards under one module rather than as
                      two separate modules. */}
                  <Text style={styles.levelHeading}>Level 1 · Word learning</Text>

                  {dialogueStarted === 0 ? (
                    <View style={styles.conceptEmpty}>
                      <Ionicons name="chatbubbles-outline" size={22} color={Colors.text.muted} />
                      <Text style={styles.conceptEmptyText}>
                        No Level 1 activity yet. Progress appears here once {firstName} starts a session.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {/* Same ring-beside-tiles shape as the concept panel above,
                          and the same brand green rather than the ramp — this is
                          coverage, not a grade, so the ramp's alarm red would be
                          a verdict the number does not support. */}
                      <View style={styles.statRow}>
                        <View style={styles.ringCard}>
                          <MasteryRing
                            value={dialogueMastery}
                            size={168}
                            label="mastered"
                            color={Colors.brandDeep}
                          />
                        </View>

                        <View style={styles.statGrid}>
                          <ProgressStat
                            label="Mastered"
                            value={String(dialogueTotals.mastered)}
                            of={dialogueTotals.total}
                          />
                          <ProgressStat label="Started"     value={String(dialogueStarted)} />
                          <ProgressStat label="In progress" value={String(dialogueTotals.inProgress)} />
                          <ProgressStat label="Needs work"  value={String(dialogueTotals.needsWork)} />
                        </View>
                      </View>

                      {/* No category breakdown here by request — the per-category
                          detail lives in the Level 1 report. */}
                    </>
                  )}

                  {/* Always shown once the report has loaded, so the level is
                      visible — and its report reachable — even before the child
                      has started it. An untouched Level 2 gets a plain
                      not-started line rather than a block of zeroes. */}
                  {level2Totals ? (
                    <>
                      <Text style={styles.levelHeading}>Level 2 · Sentence construction</Text>

                      {level2Started === 0 ? (
                        <View style={styles.conceptEmpty}>
                          <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.text.muted} />
                          <Text style={styles.conceptEmptyText}>
                            Not started yet — all {level2Totals.topics_total} topics are
                            waiting for {firstName}'s first session.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.statGridWide}>
                          <ProgressStat
                            label="Mastered"
                            value={String(level2Totals.mastered)}
                            of={level2Totals.topics_total}
                            style={styles.progressStatQuarter}
                          />
                          <ProgressStat label="Started"       value={String(level2Totals.topics_started)} style={styles.progressStatQuarter} />
                          <ProgressStat label="In progress"   value={String(level2Totals.in_progress)}    style={styles.progressStatQuarter} />
                          <ProgressStat label="Needs support" value={String(level2Totals.struggling)}     style={styles.progressStatQuarter} />
                        </View>
                      )}
                    </>
                  ) : null}
                </View>

                {/* Same ruled footer as the concept panel. Two reports of equal
                    weight, so both use the module's outlined pill button (as in
                    the Pronunciation tab) rather than one filled gradient. */}
                <View style={[styles.reportFooter, styles.reportFooterEnd, styles.footerWrap]}>
                  <ModuleActionButton
                    label="Level 1 report"
                    icon="trending-up-outline"
                    onPress={() => navigation.navigate('TrajectoryReport', { student })}
                    accessibilityLabel="Level 1 word trajectory report"
                  />
                  <ModuleActionButton
                    label="Level 2 report"
                    icon="document-text-outline"
                    onPress={() => navigation.navigate('Level2Report', { student })}
                    accessibilityLabel="Level 2 sentence construction report"
                  />
                </View>
              </>
            )
          ) : activeModule !== 'concept' ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name={activeMeta.icon} size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>
                {activeMeta.title} isn't available yet. {firstName}'s progress will
                appear here once the module is released.
              </Text>
            </View>
          ) : conceptsLoading ? (
            <View style={styles.conceptLoading}>
              <ActivityIndicator color={SECTION.progress.fg} />
            </View>
          ) : !concepts ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="cloud-offline-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>Couldn't load concept progress.</Text>
              <TouchableOpacity onPress={() => { setConceptsLoading(true); fetchConcepts(); }}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !hasProgress ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="school-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>
                No concept activity yet. Progress appears here once {firstName} starts a session.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.conceptBody}>
              {/* The ring beside a 2x2 of figures. It stays here — unlike the
                  full report, where it restated the Learned tile — because this
                  panel has no headline sentence, so the ring IS the summary. */}
              <View style={styles.statRow}>
                <View style={styles.ringCard}>
                  {/* Explicit colour, not scoreColor's good/fair/poor ramp.
                      That ramp grades accuracy — did the child get it right —
                      and this figure is coverage: 11 of 93 concepts in the whole
                      catalogue. Left to the ramp, anything under 45% draws in
                      alarm red, so a child three weeks in gets a red ring for
                      having worked through eleven things, which is not a verdict
                      the number supports. The panel's own green says "this is
                      how far along we are" without passing judgement on it. */}
                  <MasteryRing
                    value={concepts.totals.mastery_pct}
                    size={168}
                    label="learned"
                    color={Colors.brandDeep}
                  />
                </View>

                <View style={styles.statGrid}>
                  <ProgressStat
                    label="Learned"
                    value={String(concepts.totals.mastered)}
                    of={concepts.totals.catalogue_concepts}
                  />
                  {/* The only figure on the panel with a time bound. Without it
                      every number here is a lifetime total, and a child who
                      learned twenty things last month reads the same as one who
                      learned them last month and stopped. */}
                  <ProgressStat label="This week" value={`+${learnedThisWeek}`} />
                  {/* The two rounds side by side. Mastery needs both, so the gap
                      between them is where the child is actually stuck — knowing
                      forty pictures and seventeen words says the naming is the
                      problem, which neither number says alone. */}
                  <ProgressStat label={ROUND.tier1.label} value={String(concepts.totals.tier1_passed)} />
                  <ProgressStat label={ROUND.tier2.label} value={String(concepts.totals.tier2_passed)} />
                </View>
              </View>

              {/* Two things that are not counts, so they are not tiles. A date and
                  a row of pictures never sat well in a box built for a big number,
                  and the four tiles above have to stay a 2x2 anyway to keep their
                  height matched to the ring. */}
              <View style={styles.context}>
                <View style={styles.lastWorked}>
                  <Ionicons name="time-outline" size={15} color={Colors.text.secondary} />
                  <Text style={styles.lastWorkedLabel}>Last worked</Text>
                  <Text style={styles.lastWorkedValue}>
                    {sinceWords(concepts.last_activity_at)}
                  </Text>
                </View>

                <View style={styles.revisit}>
                  <Text style={styles.revisitLabel}>Worth another look</Text>

                  {revisit.length === 0 ? (
                    <Text style={styles.revisitEmpty}>
                      Nothing needs revisiting right now.
                    </Text>
                  ) : (
                    <View style={styles.revisitRow}>
                      {revisit.slice(0, REVISIT_SHOWN).map((r) => (
                        <TouchableOpacity
                          key={`${r.category_key}/${r.concept_key}`}
                          activeOpacity={0.75}
                          onPress={() => setOpenCategory(
                            (concepts.categories || [])
                              .find((c) => c.category_key === r.category_key) ?? null,
                          )}
                          accessibilityRole="button"
                        >
                          <ConceptThumb
                            categoryKey={r.category_key}
                            conceptKey={r.concept_key}
                            size={44}
                            showLabel
                          />
                        </TouchableOpacity>
                      ))}
                      {revisit.length > REVISIT_SHOWN ? (
                        <Text style={styles.revisitMore}>
                          +{revisit.length - REVISIT_SHOWN} more
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.breakdownHead}>
                <View style={styles.breakdownIcon}>
                  <Ionicons name="grid" size={14} color={Colors.brandDeep} />
                </View>
                <Text style={styles.breakdownTitle}>Category breakdown</Text>
                <Text style={styles.breakdownHint}>Tap a group to see its concepts</Text>
              </View>

              {/* Cards two to a row rather than the report's full-width rows.
                  Nothing opens here, so the row's horizontal space bought nothing
                  and nine of them made this the tallest panel on the screen. Same
                  faces and same three bands as the report, so it still reads as
                  one chart across the two screens. */}
              <GroupGrid
                categories={concepts.categories || []}
                showLegend
                initialCount={6}
                onSelect={setOpenCategory}
              />

              </View>

              {/* On its own ruled footer. Floating at the end of the last bar it
                  read as belonging to that category rather than to the panel. */}
              <View style={[styles.reportFooter, styles.reportFooterEnd, styles.footerWrap]}>
                {/* Saved weekly/monthly reports, and the live history. Same
                    button as every other Module Progress action. */}
                <ModuleActionButton
                  label="Reports"
                  icon="document-text-outline"
                  onPress={() => navigation.navigate('ConceptReports', { student })}
                  accessibilityLabel="Saved reports for each week and month"
                />
                <ModuleActionButton
                  label={ACTION.historyFor(firstName)}
                  trailing="arrow-forward"
                  onPress={() => navigation.navigate('ConceptReport', { student })}
                />
              </View>
            </>
          )}
          </>)}
        </Panel>

      </ScrollView>

      {/* Outside the ScrollView: a Modal nested in a scroller inherits its
          clipping on Android and comes up cropped. */}
      <StrokeFamilyModal
        family={openStroke}
        face={openStroke ? STROKE_FACE[openStroke.key] : null}
        onClose={() => setOpenStroke(null)}
        onOpenReport={openHandwritingReport}
      />
      <PronunciationCategoryModal
        group={openPronGroup}
        face={openPronGroup ? (PRON_FACE[openPronGroup.key] || PRON_FALLBACK_FACE) : null}
        unit={openPronGroup?.key === ALPHABET_KEY ? 'letters' : 'words'}
        onClose={() => setOpenPronGroup(null)}
        onOpenSessions={() => navigation.navigate('PronunciationResultsHistory', { student })}
      />
      <ReportPreviewModal
        title="Pronunciation report"
        visible={!!pronReport}
        html={pronReport?.html ?? null}
        filename={pronReport?.filename ?? null}
        sharing={pronReportBusy === 'sharing'}
        downloading={pronReportBusy === 'downloading'}
        message={pronReportMessage}
        notice={pronReportNotice}
        onShare={sharePronunciationReport}
        onDownload={downloadPronunciationReport}
        onClose={closePronunciationReport}
      />
      <CategoryConceptsModal
        visible={!!openCategory}
        category={openCategory}
        studentId={student.sid}
        accent={Colors.brandDeep}
        onClose={() => setOpenCategory(null)}
      />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // ── Module progress ────────────────────────────────────────────────────────
  // The panel is `flush`, so the body supplies its own padding. Without it the
  // progress bars ran to the card's edges and the whole section read as though it
  // had been pasted in rather than laid out.
  conceptBody: {
    padding: PANEL_PAD_LG,
    paddingTop: Layout.spacing.lg,
    gap: Layout.spacing.lg,
  },

  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.spacing.md,
    paddingHorizontal: PANEL_PAD_LG,
    paddingBottom: PANEL_PAD_LG,
    paddingTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  // No fill and no border. The ring is already a closed shape on a plain white
  // panel, so a plate behind it drew a second boundary around something that had
  // one; the tiles beside it need their surfaces because a bare number has no
  // edge of its own. Keeps its sizing so the row still squares off against the
  // grid's two 108pt rows.
  ringCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 220,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStat: {
    // Just under half, so two sit per row with the gap between them. Fixed height
    // rather than content-sized: "Worth another look" wraps to two lines and used
    // to make its row taller than the one above it. Two of these plus the gap is
    // what sets the height the ring card stretches to.
    flexGrow: 1,
    flexBasis: '46%',
    // 130, not 140. On a portrait phone the grid is ~292 wide, so two cards plus
    // the 16 gap have 138 each — a 140 floor tipped them onto separate rows and
    // turned the 2x2 into a stack of four.
    minWidth: 130,
    height: 108,
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  // `secondary`, not `muted`. Muted on the tile fill is 2.48:1 — these are 11px
  // uppercase, the smallest type on the panel, and they were the faintest too.
  // At `secondary` they reach 5.90:1 and still read as captions, because size and
  // case were doing that work already.
  progressStatLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressStatRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  progressStatValue: { fontSize: 30, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  progressStatOf:    { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_700Bold', color: Colors.text.secondary },

  // Margins rather than relying on conceptBody's gap alone: the breakdown is a
  // second subject under the same tab, so it wants a wider gap above it than the
  // one holding the stat row and the tabs together.
  breakdownHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Layout.spacing.md,
    marginBottom: 0,
  },
  breakdownTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_800ExtraBold',
    color: Colors.text.primary,
  },

  // Filled, not a text link. It leaves this screen for another, which is a bigger
  // move than anything else on the panel and should look like one. Fill comes
  // from the gradient child; overflow clips it to the pill.
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },
  reportBtnFill: { ...StyleSheet.absoluteFillObject },
  reportBtnDisabled: { opacity: 0.45 },
  reportBtnText: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },

  // ── Identity card ──────────────────────────────────────────────────────────
  // Colour comes from the gradient at the call site; the shadow takes the brand
  // teal so the card does not cast the app's default blue over a green surface.
  idCard: {
    borderRadius: 28,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    ...Layout.shadow.md,
    shadowColor: Colors.brand,
  },
  // Radius repeated rather than clipping the gradient with overflow:hidden — a
  // clipping view swallows its own shadow on iOS, and the card wants its lift.
  // Near-black teal rather than neutral black, so it deepens the hue instead of
  // greying it.
  idScrim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: 'rgba(11,42,40,0.40)',
  },
  idBody: { flexDirection: 'row', gap: Layout.spacing.lg, flexWrap: 'wrap' },

  idLeft:  { minWidth: 200, justifyContent: 'flex-start' },
  idRight: { flex: 1, minWidth: 260, gap: 12 },

  idAvatarWrap: { alignSelf: 'flex-start' },
  idAvatar: {
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  // On the photo's corner, carrying the child's own avatar hue — the one thing a
  // teacher recognises before reading, which the card's own colour would lose.
  //
  // Ringed in white rather than in the card's colour: the card is a gradient now,
  // so no single value matches it at the badge's position, and two of the five
  // avatar hues are greens that would sink into it without a break.
  idAvatarBadge: {
    position: 'absolute',
    right: -4, bottom: -4,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  idName: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: Layout.spacing.md,
  },
  idChips: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  idChip: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: Layout.radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  idChipText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.5,
  },
  idDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  idAge: { fontSize: Layout.fontSize.sm, color: 'rgba(255,255,255,0.90)' },

  // Wraps, and the tiles are allowed to be narrow. Two 160px minimums in a
  // non-wrapping row needed 328pt in a column that is 294 on a portrait phone,
  // so the second tile ran off the card.
  idFactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  idFact: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    // 0.06 was calibrated against the charcoal card it used to sit on. On a
    // mid-tone teal it lifts the surface by 1.05x — invisible — so the tiles had
    // stopped reading as tiles. 0.14 plus a hairline gives them their edge back.
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  idFactIcon: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  idFactLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(255,255,255,0.90)',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  idFactValue: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    marginTop: 3,
  },

  // Same surface as the fact tiles either side of it, for the same reason.
  idNote: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  idNoteBadge: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  idNoteQuote: { fontSize: 20, lineHeight: 26, color: 'rgba(255,255,255,0.9)', fontFamily: 'DMSans_800ExtraBold' },
  idNoteText: {
    fontSize: Layout.fontSize.sm,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 20,
    marginTop: 3,
  },


  // Colour comes from the BACKDROP gradient this is applied to.
  safe:      { flex: 1 },
  safeInner: { flex: 1 },
  // Principal (read-only) view: the note in place of Module Progress.
  principalNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    margin: PANEL_PAD_LG, padding: 18, borderRadius: 16,
    backgroundColor: '#E4F4EC',
  },
  principalNoteIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  principalNoteTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  principalNoteText:  { fontSize: 13, lineHeight: 19, color: Colors.text.secondary, marginTop: 3 },
  // Dialogue breakdown: two layered fills (in progress behind, mastered over it).
  pronChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pronChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 5, paddingLeft: 10, paddingRight: 6,
    borderRadius: 14, backgroundColor: '#FDF4E3',
  },
  pronChipText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.text.primary },
  pronChipScore: {
    fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#8A5D06',
    backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
  },
  pronReportError: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#DC2626', textAlign: 'right', marginTop: 6 },
  reportFooterEnd: { justifyContent: 'flex-end' },
  // Several actions in one footer: right-aligned, wrapping onto a second line
  // on a narrow screen rather than squeezing.
  footerWrap: { flexWrap: 'wrap', gap: 10 },
  strokeWrap: { gap: 10, marginBottom: 12 },
  strokeEmpty: { fontSize: 12, color: Colors.text.muted },
  strokeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  strokeCard: {
    flexGrow: 1,
    gap: 9,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  strokeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strokeFace: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  strokeLabel: { fontSize: 13, lineHeight: 17, fontFamily: 'DMSans_600SemiBold', color: Colors.text.primary },
  strokeSample: { fontSize: 11, color: Colors.text.muted, letterSpacing: 1, marginTop: 1 },
  strokeTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceAlt, overflow: 'hidden' },
  strokeFill: { height: '100%', borderRadius: 3 },
  strokeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strokeCount: { fontSize: 12 },
  strokeCountNum: { fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  strokeCountOf: { fontFamily: 'DMSans_400Regular', color: Colors.text.secondary },
  strokePill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  strokePillText: { fontSize: 11, fontFamily: 'DMSans_700Bold' },
  strokeDelta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strokeDeltaText: { fontSize: 11, color: Colors.text.secondary },
  breakdownIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E4F4EC',
  },
  breakdownHint: {
    marginLeft: 'auto',
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: Colors.text.muted,
  },
  // Pulls Module Progress closer to the card above it, without moving the rest.
  progressLift: { marginTop: -Layout.spacing.md },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: 28,
    paddingBottom: 8,
  },
  topTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'DMSans_800ExtraBold',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  scroll: {
    padding: Layout.spacing.lg,
    // The in-page top bar already carries its own clearance, so the identity
    // card only needs a small gap under it — which lifts the cards below
    // (Module Progress included) up the page.
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.lg,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  // backgroundColor and shadowColor are both supplied at the call site from the
  // student's avatar theme; everything else about the card is fixed.
  panelShadowWrap: {
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    ...Layout.shadow.sm,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: PANEL_PAD,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
  },
  panelIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_800ExtraBold',
  },
  panelAction: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'DMSans_700Bold',
  },
  panelBody: { padding: PANEL_PAD },

  // ── Panel, large variant ──────────────────────────────────────────────────
  panelShadowWrapLg: { borderRadius: Layout.radius.xl, ...Layout.shadow.md },
  panelLg: { borderRadius: Layout.radius.xl, borderWidth: 1, borderColor: Colors.borderLight },
  // No tinted fill and no rule under it. At this width a coloured band read as a
  // stripe across the panel; the space below the title is what separates the
  // header from the tabs instead.
  panelHeaderLg: {
    gap: Layout.spacing.md,
    paddingHorizontal: PANEL_PAD_LG,
    paddingTop: PANEL_PAD_LG,
    paddingBottom: Layout.spacing.lg,
    borderBottomWidth: 0,
  },
  panelIconLg: { width: 52, height: 52, borderRadius: 16 },
  panelTitleLg: {
    fontSize: Layout.fontSize.xxl,
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  panelActionLg: { fontSize: Layout.fontSize.md },
  // ~38pt tall, which reads as a peer of the 52pt icon plate across the header
  // rather than as something floating beside the title.
  panelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Layout.radius.full,
    borderWidth: 1,
  },

  // ── Info rows ─────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: PANEL_PAD,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'DMSans_600SemiBold' },
  // Indented to clear the icon column (pad 16 + icon 32 + gap 16), so the rule
  // separates the text, not the whole row.
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 64 },

  // ── Module selector ───────────────────────────────────────────────────────
  // A single recessed track with the four tabs inside it. The track is what makes
  // the unselected tabs read as available rather than as disabled text — they
  // have no fill or border of their own, so the group has to supply the edge.
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 5,
    marginHorizontal: PANEL_PAD_LG,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  tab: {
    // Equal shares of the track, so the four sit on a regular rhythm rather than
    // each taking the width of its own label.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: Layout.radius.md,
  },
  // Fill comes from the gradient child; this carries only the lift that separates
  // the selected tab from the track it sits in.
  tabActive: {
    ...Layout.shadow.sm,
    shadowColor: Colors.brandDeep,
    shadowOpacity: 0.30,
  },
  tabFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Layout.radius.md,
  },
  tabText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
  },
  tabTextActive: { color: '#FFFFFF' },

  // ── Concept Learning ──────────────────────────────────────────────────────
  // Both sit in the same box the stat row would occupy, so switching to a module
  // that has not shipped does not collapse the panel to a third of its height.
  conceptLoading: {
    minHeight: 232,
    margin: PANEL_PAD_LG,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surfaceAlt,
  },
  conceptEmpty: {
    minHeight: 232,
    margin: PANEL_PAD_LG,
    paddingHorizontal: Layout.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.md,
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surfaceAlt,
  },
  conceptEmptyText: {
    fontSize: Layout.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Layout.fontSize.md * 1.55,
    maxWidth: 380,
  },
  retryText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontFamily: 'DMSans_700Bold',
  },
  // `stretch` is what squares the two sides off against each other: the grid's
  // two fixed-height rows set the row's height, and the ring card grows to match
  // rather than ending short and leaving a notch beside it.
  //
  // Wrapping, not a hard breakpoint. On a portrait tablet the two bases fit side
  // by side; on a phone the grid drops below the ring and both go full width,
  // without either needing to know which device it is on.
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: CARD_GAP,
  },
  statGrid: {
    flexGrow: 1.5,
    flexBasis: 340,
    minWidth: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },

  // ── Dialogue module ───────────────────────────────────────────────────────
  // Separates the module's two levels inside one tab. Small caps rather than a
  // heading weight: these divide a panel that already has a title, so competing
  // with `panelTitleLg` would give the section two headings of equal rank.
  levelHeading: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
  },
  // Level 2 has no ring beside it, so its tiles take the full panel width
  // instead of sharing the row with one.
  statGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  // Level 2's four tiles on one line. With no ring beside them they have the
  // full panel width; minWidth lets them fall back to two per row on a phone
  // rather than squeezing four unreadably narrow tiles.
  progressStatQuarter: { flexBasis: '22%', minWidth: 120 },
  // Label left, figure right — a three-row list of counts, which reads faster as
  // rows than as three more tiles competing with the four above.

  // ── Context strip ─────────────────────────────────────────────────────────
  // Ruled off rather than tiled. These two are context for the figures above,
  // not more figures, and giving them tile surfaces would have made six cards of
  // which two were not counts.
  context: {
    gap: Layout.spacing.md,
    paddingTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  lastWorked: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lastWorkedLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  lastWorkedValue: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
  },

  revisit: { gap: Layout.spacing.sm },
  revisitLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  revisitEmpty: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
  },
  // Wraps, so a narrow panel stacks the thumbnails rather than squeezing them.
  revisitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: Layout.spacing.md,
  },
  revisitMore: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.muted,
    alignSelf: 'center',
  },
  // ── Writing Progress summary ─────────────────────────────────────────
  // Compact by design: the whole card sits inside the Module Progress area
  // without turning it into the full report. No fixed heights and no nested
  // ScrollView — the Student Profile already owns scrolling.
  wsCard: { marginBottom: 12, overflow: 'hidden' },
  wsLoading: { paddingVertical: 28, alignItems: 'center' },
  wsUnavailable: { paddingVertical: 24, paddingHorizontal: 18, alignItems: 'center', gap: 7 },
  wsUnavailableText: { fontSize: 12.5, color: Colors.text.muted, textAlign: 'center' },
  wsRetryText: { fontSize: 12.5, fontWeight: '600', color: Colors.text.link },
  wsReportText: { fontSize: 13.5, fontWeight: '600', color: Colors.text.link },

  wsHeadline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
  },
  wsHeadlineLabel: { fontSize: 12, color: Colors.text.muted, marginBottom: 2 },
  wsHeadlineValue: { fontSize: 26, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  wsHeadlineTotal: { fontSize: 15, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: Colors.text.muted },
  wsPercentPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(99,102,241,0.10)',
  },
  wsPercentText: { fontSize: 15, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#6366F1' },

  wsBody: {},
  wsBodyWide: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: 14 },
  wsHeadlineWide: { paddingRight: 0, flexShrink: 0, minWidth: 190 },
  wsRows: { paddingHorizontal: 14, gap: 10 },
  wsRowsWide: { flex: 1, paddingLeft: 0 },
  wsRow: { gap: 5 },
  wsRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  wsRowLabel: { fontSize: 12.5, color: Colors.text.secondary },
  wsRowValue: { fontSize: 12.5, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: Colors.text.primary },
  wsBarTrack: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(99,102,241,0.12)', overflow: 'hidden',
  },
  wsBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#6366F1' },

  wsDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.border ?? 'rgba(0,0,0,0.08)',
    marginTop: 14, marginHorizontal: 14,
  },
  wsStatusGrid: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  wsStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  wsStatusText: { flex: 1 },
  wsStatusLabel: { fontSize: 11.5, color: Colors.text.muted },
  wsStatusValue: { fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: Colors.text.primary, marginTop: 1 },
  wsStatusValueMuted: { color: Colors.text.secondary, fontWeight: '500', fontFamily: 'Nunito_600SemiBold' },
  wsLockedHint: {
    fontSize: 11.5, color: Colors.text.muted, marginTop: -4, marginLeft: 23, lineHeight: 16,
  },

  wsReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border ?? 'rgba(0,0,0,0.08)',
  },
});
