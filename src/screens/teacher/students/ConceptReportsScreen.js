import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/common/Card';
import { Colors, BACKDROP } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { shareReportPdf, downloadReportPdf } from '../../../utils/reportPdf';
import { duration, firstNameOf } from '../../../constants/teacherWording';

// This screen's greens. Deeper than Colors.brandDeep because the button is a
// large solid field rather than a line of text — white on it clears 5.8:1, and
// the same green then carries the section heading and the two PDF actions so the
// page reads as one colour rather than three near-misses.
const GREEN_DEEP = '#146B49';
const GREEN_TINT = '#E1EFE7';
// Muted enough to sit under the delete glyph without competing with the green
// actions beside it. Colors.status.error is a pink built for error banners.
const RED = '#D64545';

/**
 * The four figures on a report row, each with its own tint.
 *
 * The bg/fg pairs are the ones GROUP_FACE already uses on the group charts, so a
 * teacher meets the same four colours meaning the same four kinds of thing
 * wherever they are in the app rather than learning a second scheme here.
 */
const CHIP = {
  learned: { icon: 'school-outline',   bg: '#E6F4EA', fg: '#2A7146' },
  days:    { icon: 'calendar-outline', bg: '#E5EEF9', fg: '#27609F' },
  time:    { icon: 'time-outline',     bg: '#EDE9FA', fg: '#6438BE' },
  // A swap arrow rather than the wand the mockup shows: a wand reads as "the app
  // did something clever here", when what this counts is two things the child
  // picked for one another.
  muddled: { icon: 'swap-horizontal',  bg: '#FAF0DF', fg: '#945D08' },
};

/**
 * A child's saved reports, newest period first.
 *
 * The concept report a teacher opens from the profile is a live rolling window:
 * it answers "how are they doing now". This screen answers a different question —
 * "how was August" — which the live view structurally cannot, because its figures
 * move every time it is opened.
 *
 * Reports are grouped under month headings. A child worked with for a year has
 * fifty-odd weekly reports, and a flat list of fifty rows all shaped alike is not
 * something anyone finds a date in.
 */
export default function ConceptReportsScreen({ route, navigation }) {
  const student = route.params?.student;
  const name = firstNameOf(student?.full_name);

  const [reports, setReports] = useState(null);
  const [periods, setPeriods] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('week');
  // The period currently being generated, so only its own row shows a spinner
  // rather than the whole sheet locking up.
  const [busyPeriod, setBusyPeriod] = useState(null);
  // Which row is producing a PDF, and for which action. Keyed together so
  // pressing Share does not put a spinner on Download beside it.
  const [busyExport, setBusyExport] = useState(null);

  const load = useCallback(async () => {
    if (!student?.sid) return;
    try {
      setError(null);
      // Both together: the list is what is saved, the periods are what could be.
      // A teacher opening an empty archive needs the second to do anything at all.
      const [list, avail] = await Promise.all([
        teacherApi.listConceptReports(student.sid),
        teacherApi.getConceptPeriods(student.sid),
      ]);
      setReports(list);
      setPeriods(avail);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRefreshing(false);
    }
  }, [student?.sid]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: `${name} · Reports` });
  }, [navigation, name]);

  async function generate(type, start) {
    setBusyPeriod(`${type}/${start}`);
    try {
      await teacherApi.createConceptReport(student.sid, type, start);
      await load();
      setPickerOpen(false);
    } catch (err) {
      // The 422 message is written for the teacher — "Nothing was recorded in
      // week of 7 Jan" — so it is shown as it arrives rather than replaced with
      // a generic failure.
      Alert.alert('No report made', err.response?.data?.error || err.message);
    } finally {
      setBusyPeriod(null);
    }
  }

  /**
   * Both PDF actions. `action` is 'share' to hand the file to another app, or
   * 'download' to put it in a folder the teacher chooses.
   */
  async function exportPdf(row, action) {
    setBusyExport(`${row.id}/${action}`);
    try {
      // The list rows carry no payload, so fetch the one being printed.
      const full = await teacherApi.getSavedConceptReport(student.sid, row.id);
      const result = action === 'download'
        ? await downloadReportPdf(full, student)
        : await shareReportPdf(full, student);

      // Only the save path gets a confirmation. The share sheet is its own
      // feedback — the teacher watched it open and chose where the file went —
      // whereas a file written into a folder they picked leaves nothing on
      // screen to say it worked.
      if (result.method === 'saved') {
        Alert.alert(
          'Report saved',
          result.folder
            ? `${result.name} was saved to ${result.folder}.`
            : `${result.name} was saved to the folder you chose.`,
        );
      }
    } catch (err) {
      Alert.alert('Could not make the PDF', err.message);
    } finally {
      setBusyExport(null);
    }
  }

  function confirmDelete(row) {
    Alert.alert(
      'Delete this report?',
      `${row.label} will be removed. You can make it again later, but the wording of the written summary may come out differently.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await teacherApi.deleteConceptReport(student.sid, row.id);
              await load();
            } catch (err) {
              Alert.alert('Could not delete', err.response?.data?.error || err.message);
            }
          },
        },
      ],
    );
  }

  if (reports === null && !error) {
    return (
      <LinearGradient colors={BACKDROP.colors} start={BACKDROP.start} end={BACKDROP.end} style={styles.safe}>
        <SafeAreaView style={[styles.safeInner, styles.centered]} edges={['bottom']}>
          <ActivityIndicator size="large" color={Colors.icon.active} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const groups = groupByMonth(reports || []);
  const canMake = (periods?.weeks?.length || 0) + (periods?.months?.length || 0) > 0;

  return (
    <LinearGradient colors={BACKDROP.colors} start={BACKDROP.start} end={BACKDROP.end} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
        >
          {/* What a report IS, before any are listed. "Report" is the system's
              word rather than a teacher's, and the thing it names here — a record
              that deliberately does not change — is not what the word implies on
              its own. Worth two lines at the top of an otherwise empty screen. */}
          <View style={styles.explain}>
            <View style={styles.explainIcon}>
              <Ionicons name="clipboard-outline" size={22} color={GREEN_DEEP} />
            </View>
            <View style={styles.explainText}>
              <Text style={styles.explainTitle}>What is a report?</Text>
              <Text style={styles.explainBody}>
                A report is a record of one week or month that never changes, so it
                can be revisited, printed, or shared with a parent.
              </Text>
            </View>
            {/* Decoration, and marked as such: it carries no information, so it is
                hidden from screen readers and takes no touches. */}
            <View style={styles.explainArt} pointerEvents="none" accessible={false}>
              <Ionicons name="library" size={40} color="#CBE2D5" />
              <Ionicons name="leaf" size={24} color="#B4D6C2" style={styles.explainLeaf} />
            </View>
          </View>

          {groups.length > 0 ? <Text style={styles.pageHead}>Reports</Text> : null}

          {error ? (
            <Card style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={20} color={Colors.text.muted} />
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          ) : null}

          {groups.length === 0 && !error ? (
            <Card style={styles.empty}>
              <Ionicons name="document-text-outline" size={30} color={Colors.icon.muted} />
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptyBody}>
                {canMake
                  ? `Make one for a week or a month and it will be kept here.`
                  : `Once ${name} has had a session, you will be able to make a report of it.`}
              </Text>
            </Card>
          ) : null}

          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <Text style={styles.groupHead}>{g.label}</Text>
              {g.rows.map((row) => (
                <ReportRow
                  key={row.id}
                  row={row}
                  busy={busyExport}
                  onOpen={() => navigation.navigate('ConceptReport', { student, reportId: row.id })}
                  onShare={() => exportPdf(row, 'share')}
                  onDownload={() => exportPdf(row, 'download')}
                  onDelete={() => confirmDelete(row)}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        {/* Fixed to the bottom rather than sitting at the end of the list: with a
            year of reports above it, the one control that adds a new one would
            otherwise be a scroll away. */}
        <View style={styles.bar}>
          <TouchableOpacity
            style={[styles.newBtn, !canMake && styles.newBtnOff]}
            activeOpacity={0.85}
            disabled={!canMake}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
          >
            {/* The plus sits in its own ring so it reads as a symbol on the button
                rather than a stray glyph leaning against the label. */}
            <View style={styles.newBtnPlus}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.newBtnText}>New report</Text>
          </TouchableOpacity>
        </View>

        <PeriodPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          periods={periods}
          tab={pickerTab}
          onTab={setPickerTab}
          busy={busyPeriod}
          onPick={generate}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * One saved report.
 *
 * The headline figures are on the row itself. A teacher looking for "the week
 * they did a lot" should not have to open four reports to find it.
 */
function ReportRow({ row, busy, onOpen, onShare, onDownload, onDelete }) {
  const h = row.headline || {};
  const saving  = busy === `${row.id}/download`;
  const sending = busy === `${row.id}/share`;
  return (
    <Card style={styles.row}>
      <TouchableOpacity
        style={styles.rowMain}
        activeOpacity={0.75}
        onPress={onOpen}
        onLongPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`${row.label}, ${h.session_days || 0} days worked. Opens the report.`}
      >
        <View style={styles.rowIcon}>
          <Ionicons
            name={row.period_type === 'month' ? 'calendar-outline' : 'today-outline'}
            size={18}
            color={GREEN_DEEP}
          />
        </View>

        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>{row.label}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{row.range_label}</Text>

          <View style={styles.chips}>
            <Chip tone="learned" text={`${h.learned_in_period ?? 0} learned`} />
            <Chip tone="days" text={`${h.session_days ?? 0} days`} />
            {h.time_spent_ms ? <Chip tone="time" text={duration(h.time_spent_ms)} /> : null}
            {h.mix_up_count ? <Chip tone="muddled" text={`${h.mix_up_count} muddled`} /> : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={Colors.icon.muted} />
      </TouchableOpacity>

      {/* Download first. Keeping a copy is the thing a teacher does for their own
          records; sharing is the thing they do for someone else, and the more
          common action reads first. */}
      <View style={styles.rowFoot}>
        <FootAction
          icon="download-outline"
          label="Download"
          working={saving}
          disabled={!!busy}
          onPress={onDownload}
          hint={`Save ${row.label} as a PDF`}
        />

        <View style={styles.footDivider} />

        <FootAction
          icon="share-outline"
          label="Share as PDF"
          working={sending}
          disabled={!!busy}
          onPress={onShare}
          hint={`Send ${row.label} as a PDF`}
        />

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={styles.footBtn}
          onPress={onDelete}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${row.label}`}
        >
          <Ionicons name="trash-outline" size={16} color={RED} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

/**
 * One action in a report's footer.
 *
 * The label is kept while working rather than being swapped for "Preparing…":
 * the two buttons sit next to each other, and a label that changes width makes
 * the other one move under the finger that is about to press it.
 */
function FootAction({ icon, label, working, disabled, onPress, hint }) {
  return (
    <TouchableOpacity
      style={[styles.footBtn, disabled && !working && styles.footBtnOff]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ busy: working, disabled: !!disabled }}
    >
      {working
        ? <ActivityIndicator size="small" color={GREEN_DEEP} />
        : <Ionicons name={icon} size={16} color={GREEN_DEEP} />}
      <Text style={styles.footBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ tone, text }) {
  const face = CHIP[tone];
  return (
    <View style={[styles.chip, { backgroundColor: face.bg }]}>
      <Ionicons name={face.icon} size={11} color={face.fg} />
      <Text style={[styles.chipText, { color: face.fg }]}>{text}</Text>
    </View>
  );
}

/**
 * Which period to report on.
 *
 * Only offers periods that actually hold something, so a teacher is never given a
 * week that would come back with "nothing was recorded". Periods already saved
 * are marked rather than hidden — regenerating is legitimate after a late-logged
 * session, and silently hiding them would look like the archive had lost one.
 */
function PeriodPicker({ visible, onClose, periods, tab, onTab, busy, onPick }) {
  const list = (tab === 'week' ? periods?.weeks : periods?.months) || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Make a report</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.icon.default} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {[['week', 'By week'], ['month', 'By month']].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.tab, tab === key && styles.tabOn]}
                onPress={() => onTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListInner}>
            {list.length === 0 ? (
              <Text style={styles.sheetEmpty}>No {tab === 'week' ? 'weeks' : 'months'} with sessions yet.</Text>
            ) : list.map((p) => {
              const key = `${p.type}/${p.period_start}`;
              const working = busy === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.period}
                  activeOpacity={0.75}
                  disabled={!!busy}
                  onPress={() => onPick(p.type, p.period_start)}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.periodTitle}>{p.label}</Text>
                    <Text style={styles.periodSub}>
                      {p.range_label} · {p.active_days} {p.active_days === 1 ? 'day' : 'days'} worked
                      {p.saved ? ' · already saved' : ''}
                    </Text>
                  </View>
                  {working
                    ? <ActivityIndicator size="small" color={GREEN_DEEP} />
                    : <Ionicons
                        name={p.saved ? 'refresh' : 'add-circle-outline'}
                        size={19}
                        color={p.saved ? Colors.icon.muted : GREEN_DEEP}
                      />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sheetNote}>
            Making a report takes a moment — it reads back every session in the period
            and writes a short summary.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Reports under month headings, newest first.
 *
 * The server already sorts; this only splits. Re-sorting here would risk the two
 * disagreeing, and a teacher reading the wrong week's report is the exact failure
 * this whole screen exists to prevent.
 */
function groupByMonth(rows) {
  const out = [];
  for (const row of rows) {
    const key = String(row.period_start).slice(0, 7);
    let group = out.find((g) => g.key === key);
    if (!group) {
      const [y, m] = key.split('-').map(Number);
      group = {
        key,
        label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        rows: [],
      };
      out.push(group);
    }
    group.rows.push(row);
  }
  return out;
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1 },
  centered:  { alignItems: 'center', justifyContent: 'center' },

  scroll: {
    padding: Layout.spacing.lg,
    // Clears the fixed bar at the bottom, so the last report is not sitting
    // underneath the button that makes new ones.
    paddingBottom: 96,
    gap: Layout.spacing.lg,
  },
  explain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.xl,
    backgroundColor: GREEN_TINT,
    // Clips the decoration to the card, so the leaf and books fade off its edge
    // instead of overhanging the page.
    overflow: 'hidden',
  },
  explainIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  // Stops short of the decoration rather than running under it.
  explainText:  { flex: 1, paddingRight: 52, gap: 3 },
  explainTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  explainBody:  { fontSize: 12, lineHeight: 17, color: Colors.text.secondary },
  explainArt: {
    position: 'absolute',
    right: Layout.spacing.md,
    bottom: Layout.spacing.sm,
  },
  explainLeaf: { position: 'absolute', left: -14, bottom: 16 },

  pageHead: {
    fontSize: 19,
    fontFamily: 'DMSans_800ExtraBold',
    color: GREEN_DEEP,
    letterSpacing: -0.3,
    marginBottom: -Layout.spacing.sm,
  },

  group:     { gap: Layout.spacing.sm },
  groupHead: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },

  row:     { padding: 0, overflow: 'hidden' },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    padding: Layout.spacing.md,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN_TINT,
  },
  rowText:  { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  // secondary, not muted. This line carries the dates the whole report covers,
  // and the muted token measures 2.63:1 on white — under the 3:1 floor even for
  // large text, let alone at 12px.
  rowSub:   { fontSize: 12, color: Colors.text.secondary },

  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Layout.radius.full,
  },
  chipText: { fontSize: 11, fontFamily: 'DMSans_600SemiBold' },

  // On its own rule, so the two actions read as belonging to the card rather than
  // floating over the figures above them.
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  footBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  // Dimmed only while the OTHER action is working. The one being pressed keeps
  // its full weight and shows a spinner, so it stays obvious which was tapped.
  footBtnOff:  { opacity: 0.4 },
  footBtnText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: GREEN_DEEP },
  footDivider: {
    width: 1,
    height: 14,
    marginHorizontal: Layout.spacing.md,
    backgroundColor: Colors.borderLight,
  },

  empty:      { alignItems: 'center', gap: 6, paddingVertical: Layout.spacing.xl },
  emptyTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  emptyBody:  { fontSize: 12, color: Colors.text.secondary, textAlign: 'center', maxWidth: 280 },

  errorCard: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  errorText: { flex: 1, fontSize: 12, color: Colors.text.secondary },

  bar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: Layout.spacing.md + 2,
    borderRadius: Layout.radius.full,
    backgroundColor: GREEN_DEEP,
    ...Layout.shadow.md,
  },
  newBtnPlus: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  newBtnOff:  { opacity: 0.4 },
  newBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,20,34,0.4)' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Layout.radius.xl,
    borderTopRightRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    gap: Layout.spacing.md,
  },
  sheetHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },

  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.full,
  },
  tabOn:     { backgroundColor: GREEN_DEEP },
  tabText:   { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.text.secondary },
  tabTextOn: { color: '#FFFFFF' },

  sheetList:      { flexGrow: 0 },
  sheetListInner: { gap: 6, paddingVertical: 2 },
  sheetEmpty:     { fontSize: 12, color: Colors.text.muted, paddingVertical: Layout.spacing.md },

  period: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  periodTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  periodSub:   { fontSize: 11, color: Colors.text.muted, marginTop: 1 },

  sheetNote: { fontSize: 11, color: Colors.text.muted, lineHeight: 16 },
});
