import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/common/Avatar';
import { Layout } from '../../constants/layout';
import { ageFrom } from '../../utils/formatters';
import { teacherApi } from '../../api/teacher';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

const TEAL      = '#3A9BA8';
// Matches the delete icon on the principal side's teacher table, so "delete" reads
// the same wherever it shows up.
const CORAL     = '#D95F50';
const CORAL_L   = '#FDECEA';

// Tinted pairs reused by the overview tiles and the session strip, so a green tile
// and a green row mean the same thing in both places.
const TINTS = {
  purple: { bg: '#EFEBFA', fg: '#6C5CE0' },
  green:  { bg: '#E3F7EC', fg: '#3FAE6F' },
  blue:   { bg: '#E6F1FC', fg: '#3B82C4' },
  amber:  { bg: '#FDF1DC', fg: '#E89A2E' },
};

// Each dashboard section gets its own accent so the panels read as distinct
// areas on the plain white background rather than one undifferentiated stack.
const SECTION = {
  students:     { icon: 'people-outline',      ...TINTS.purple },
  notes:        { icon: 'document-text-outline', ...TINTS.amber },
  calendar:     { icon: 'calendar-outline',    ...TINTS.blue },
  daySessions:  { icon: 'time-outline',        ...TINTS.green },
};

const PANEL_PAD    = 20;
const PANEL_BORDER = 1;
const GRID_GAP     = 14;
// Below this the two columns stack; the calendar needs ~330pt before its day cells
// start crowding, and the student cards want the rest.
const TWO_COL_MIN = 900;

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Local calendar-day identity. Bucketing on this rather than the ISO string is
 *  what keeps an evening session on the right day for a teacher offset from UTC. */
function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Sunday-first cells covering `monthDate`'s month, padded out to whole weeks.
 *
 * The row count is derived rather than fixed at six so a month that fits in five
 * doesn't leave a blank row hanging under the grid.
 */
function buildMonthGrid(monthDate) {
  const year  = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const leading  = new Date(year, month, 1).getDay();
  const daysIn   = new Date(year, month + 1, 0).getDate();
  const weeks    = Math.ceil((leading + daysIn) / 7);

  return Array.from({ length: weeks * 7 }, (_, i) =>
    new Date(year, month, 1 - leading + i));
}

// ── Student cards ────────────────────────────────────────────────────────────

// Soft rings behind the avatar so a row of cards reads as distinct children at a
// glance. Picked by name the same way Avatar picks its own fill, so a child keeps
// the same pairing everywhere the card appears.
const AVATAR_HALOS = ['#D6F0F4', '#FCE0E9', '#DCF5E8', '#FCEFD2', '#E6E2F8'];

function haloFor(name) {
  if (!name) return AVATAR_HALOS[0];
  return AVATAR_HALOS[name.charCodeAt(0) % AVATAR_HALOS.length];
}

function StudentCard({ student, width, onPress }) {
  const age = ageFrom(student.dateOfBirth);
  const halo = haloFor(student.fullName);

  return (
    <TouchableOpacity
      style={[styles.studentCardShadowWrap, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${student.fullName}${age != null ? `, age ${age}` : ''}`}
    >
      <View style={styles.studentCard}>
        <LinearGradient
          colors={[halo, '#FFFFFF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.7 }}
          style={styles.studentCardTop}
        />

        <View style={[styles.studentHalo, { backgroundColor: halo }]}>
          <Avatar name={student.fullName} uri={student.profilePhotoUrl} size={72} />
        </View>

        {/* Two lines, with the height reserved either way: full names run long enough
            that one line truncates most of them, and letting the box grow only when a
            name wraps leaves the cards in a row at different heights. */}
        <Text style={styles.studentName} numberOfLines={2}>{student.fullName}</Text>
        <Text style={styles.studentAge}>{age != null ? `Age ${age}` : 'Age not set'}</Text>

        <View style={styles.studentChevron}>
          <Ionicons name="chevron-forward" size={14} color="#B7C6BF" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Panel shell ──────────────────────────────────────────────────────────────

function Panel({ title, section, action, onAction, right, children, style }) {
  const accent = section ? SECTION[section] : null;
  return (
    // The shadow lives on this outer view; the inner one clips the tinted header
    // to the rounded corners. Overflow:hidden clips a view's own shadow on iOS,
    // so the two can't be the same view or the shadow silently disappears.
    <View style={[styles.panelShadowWrap, style]}>
      <View style={[styles.panel, accent && { borderColor: accent.fg + '33' }]}>
        {(title || right) && (
          <View style={[
            styles.panelHeader,
            accent && { backgroundColor: accent.bg, borderBottomColor: accent.fg + '26' },
          ]}>
            {accent ? (
              <View style={[styles.panelIcon, { backgroundColor: '#FFFFFF' }]}>
                <Ionicons name={accent.icon} size={17} color={accent.fg} />
              </View>
            ) : null}
            <Text
              style={[styles.panelTitle, accent && { color: accent.fg }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {right}
            {action ? (
              <TouchableOpacity
                style={[styles.pillBtn, accent && { borderColor: accent.fg }]}
                onPress={onAction}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.pillBtnText, accent && { color: accent.fg }]}>{action}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        <View style={styles.panelBody}>
          {children}
        </View>
      </View>
    </View>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarGrid({ monthDate, activeDays, selectedKey, onSelectDay }) {
  const cells      = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const todayKey   = dayKey(new Date());
  const thisMonth  = monthDate.getMonth();

  return (
    <View>
      <View style={styles.calRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.calWeekday}>{d}</Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.calRow}>
          {cells.slice(w * 7, w * 7 + 7).map((d) => {
            const key      = dayKey(d);
            const outside  = d.getMonth() !== thisMonth;
            const isToday  = key === todayKey;
            const active   = activeDays.has(key);
            const selected = key === selectedKey;

            return (
              <TouchableOpacity
                key={key}
                style={styles.calCell}
                activeOpacity={0.7}
                onPress={() => onSelectDay(d)}
                accessibilityRole="button"
                accessibilityLabel={d.toDateString()}
              >
                <View style={[
                  styles.calDay,
                  isToday && styles.calDayToday,
                  selected && !isToday && styles.calDaySelected,
                ]}>
                  <Text
                    style={[
                      styles.calDayText,
                      outside && styles.calDayOutsideText,
                      isToday && styles.calDayTodayText,
                      selected && !isToday && styles.calDaySelectedText,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                {/* Dot marks a day the class ran a session. Hidden on today's and the
                    selected cell, where the filled circle already carries the emphasis. */}
                <View style={styles.calDotSlot}>
                  {active && !isToday && !selected ? <View style={styles.calDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Selected-day sessions ────────────────────────────────────────────────────

function dayHeading(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function sessionTimeLabel(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function DaySessionsPanel({ date, sessions }) {
  return (
    <Panel title={dayHeading(date)} section="daySessions">
      {sessions.length > 0 ? (
        sessions.map((s, i) => {
          const tint = TINTS[['purple', 'amber', 'green', 'blue'][i % 4]];
          return (
            <View key={`${s.startedAt}-${i}`} style={[styles.slot, { backgroundColor: tint.bg }]}>
              <Text style={styles.slotTime}>{sessionTimeLabel(s.startedAt)}</Text>
              <View style={styles.slotBody}>
                <Text style={styles.slotTitle} numberOfLines={1}>{s.studentName}</Text>
                <Text style={styles.slotSub}>{s.isActive ? 'In progress' : 'Completed'}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.panelEmptyText}>No sessions recorded on this day.</Text>
      )}
    </Panel>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────

function noteTimeLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function NotesPanel({ students, selectedId, onSelect, notes, loading, draft, onDraftChange, onAdd, onDelete, saving }) {
  return (
    <Panel title="Notes" section="notes">
      {students.length > 0 ? (
        <>
          <View style={styles.notesChipRow}>
            {students.map((s) => (
              <TouchableOpacity
                key={s.studentId}
                style={[styles.notesChip, selectedId === s.studentId && styles.notesChipActive]}
                onPress={() => onSelect(s.studentId)}
                activeOpacity={0.8}
              >
                <Text style={[styles.notesChipText, selectedId === s.studentId && styles.notesChipTextActive]} numberOfLines={1}>
                  {s.fullName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.notesComposer}>
            <TextInput
              style={styles.notesInput}
              placeholder="Add a reminder about this student..."
              placeholderTextColor="#9BB0A8"
              value={draft}
              onChangeText={onDraftChange}
              multiline
            />
            <TouchableOpacity
              style={[styles.notesAddBtn, (!draft.trim() || saving) && styles.notesAddBtnDisabled]}
              onPress={onAdd}
              disabled={!draft.trim() || saving}
              activeOpacity={0.75}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Ionicons name="add" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={SECTION.notes.fg} style={{ marginTop: 12 }} />
          ) : notes.length > 0 ? (
            notes.map((n) => (
              <View key={n.id} style={styles.noteRow}>
                <View style={styles.noteBody}>
                  <Text style={styles.noteText}>{n.body}</Text>
                  <Text style={styles.noteMeta}>{noteTimeLabel(n.created_at)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => onDelete(n.id)}
                  activeOpacity={0.75}
                  style={styles.noteDeleteBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Delete note"
                >
                  <Ionicons name="trash-outline" size={14} color={CORAL} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.panelEmptyText}>No notes yet for this student.</Text>
          )}
        </>
      ) : (
        <Text style={styles.panelEmptyText}>
          Once students are assigned to you, you can jot reminders about them here.
        </Text>
      )}
    </Panel>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function TeacherDashboardScreen({ navigation }) {
  const [data,          setData]          = useState(null);
  const [refreshing,    setRefreshing]    = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [monthDate,     setMonthDate]     = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const [selectedDate,      setSelectedDate]      = useState(() => new Date());
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [notes,             setNotes]             = useState([]);
  const [notesLoading,      setNotesLoading]      = useState(false);
  const [noteDraft,         setNoteDraft]         = useState('');
  const [noteSaving,        setNoteSaving]        = useState(false);

  const logout = useAuthStore((s) => s.logout);
  const toast  = useToast();

  const { width } = useWindowDimensions();
  const contentWidth = width - Layout.spacing.lg * 2;
  const twoCol       = contentWidth >= TWO_COL_MIN;

  // Explicit column widths rather than flex, so the student grid below can do its
  // own column maths against a number it knows before layout. Widths are floored
  // throughout: fractional ones round up during layout and overrun the row.
  const COL_GAP  = Layout.spacing.lg;
  const mainW    = twoCol ? Math.floor((contentWidth - COL_GAP) * 0.62) : contentWidth;
  const sideW    = twoCol ? contentWidth - COL_GAP - mainW : contentWidth;
  // Panels are border-box, so the 1px border eats the same width the padding does.
  // Measuring against padding alone overruns the pane by 2px — enough to wrap the
  // last card onto its own row. The trailing pixel is slack against fractional
  // device-pixel rounding, which would do the same thing on a half-pixel screen.
  const mainPane = mainW - (PANEL_PAD + PANEL_BORDER) * 2 - 1;

  // Column counts come from a target width rather than fixed breakpoints, so the
  // grid keeps filling its row at any pane width. Capped at four to hold the
  // one-row-of-four shape the design is built around.
  const fit = (min, max) =>
    Math.max(2, Math.min(max, Math.floor((mainPane + GRID_GAP) / (min + GRID_GAP))));

  const cardCols = fit(150, 4);
  const cardW    = Math.floor((mainPane - GRID_GAP * (cardCols - 1)) / cardCols);

  const load = useCallback(async () => {
    try {
      const res = await teacherApi.getDashboard();
      setData(res);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const profile        = data?.profile;
  const proficiency    = data?.proficiency ?? [];

  const activeDays = useMemo(() => {
    const set = new Set();
    for (const iso of data?.sessionDates ?? []) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) set.add(dayKey(d));
    }
    return set;
  }, [data?.sessionDates]);

  const sessions = data?.sessions ?? [];

  const selectedDayKey = dayKey(selectedDate);
  const sessionsForSelectedDay = useMemo(() => {
    return sessions
      .filter((s) => s.startedAt && dayKey(new Date(s.startedAt)) === selectedDayKey)
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  }, [sessions, selectedDayKey]);

  // Defaults to the first student once the roster loads, so the Notes panel
  // isn't blank on first paint.
  useEffect(() => {
    if (selectedStudentId == null && proficiency.length > 0) {
      setSelectedStudentId(proficiency[0].studentId);
    }
  }, [proficiency, selectedStudentId]);

  const loadNotes = useCallback(async (studentId) => {
    if (studentId == null) return;
    setNotesLoading(true);
    try {
      const res = await teacherApi.getStudentNotes(studentId);
      setNotes(res);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setNotesLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadNotes(selectedStudentId); }, [selectedStudentId, loadNotes]);

  const handleAddNote = async () => {
    const body = noteDraft.trim();
    if (!body || selectedStudentId == null) return;
    setNoteSaving(true);
    try {
      const note = await teacherApi.addStudentNote(selectedStudentId, body);
      setNotes((prev) => [note, ...prev]);
      setNoteDraft('');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await teacherApi.deleteStudentNote(selectedStudentId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      toast.show(err.message, 'error');
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Teacher';

  const shiftMonth = (delta) =>
    setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  if (!data) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={[styles.safe, styles.loadingCenter]} edges={['top', 'bottom']}>
          <ActivityIndicator color={TEAL} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  // ── Left column ──────────────────────────────────────────────────────────
  const mainColumn = (
    <View style={[styles.column, { width: mainW }]}>
      <Panel
        title={`My Students${proficiency.length > 0 ? ` (${proficiency.length})` : ''}`}
        section="students"
      >
        {proficiency.length > 0 ? (
          <View style={styles.studentGrid}>
            {proficiency.map((s) => (
              <StudentCard
                key={s.studentId}
                student={s}
                width={cardW}
                onPress={() => navigation.navigate('TeacherStudentDetail', {
                  student: {
                    sid:               s.studentId,
                    full_name:         s.fullName,
                    profile_photo_url: s.profilePhotoUrl,
                    // Seeds the profile hero so the age chip is there on the
                    // first frame, before getStudent resolves.
                    date_of_birth:     s.dateOfBirth,
                  },
                })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: SECTION.students.bg }]}>
              <Ionicons name="people-outline" size={24} color={SECTION.students.fg} />
            </View>
            <Text style={styles.emptyTitle}>No students yet</Text>
            <Text style={styles.emptySub}>
              Once students are assigned to you, their progress will show up here.
            </Text>
          </View>
        )}
      </Panel>

      <NotesPanel
        students={proficiency}
        selectedId={selectedStudentId}
        onSelect={setSelectedStudentId}
        notes={notes}
        loading={notesLoading}
        draft={noteDraft}
        onDraftChange={setNoteDraft}
        onAdd={handleAddNote}
        onDelete={handleDeleteNote}
        saving={noteSaving}
      />
    </View>
  );

  // ── Right column ─────────────────────────────────────────────────────────
  const sideColumn = (
    <View style={[styles.column, { width: sideW }]}>
      <Panel
        title="Calendar"
        section="calendar"
        right={
          <View style={styles.calNav}>
            <Text style={styles.calMonth}>
              {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              style={styles.calArrow}
              onPress={() => shiftMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={16} color="#6B8A80" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calArrow}
              onPress={() => shiftMonth(1)}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={16} color="#6B8A80" />
            </TouchableOpacity>
          </View>
        }
      >
        <CalendarGrid
          monthDate={monthDate}
          activeDays={activeDays}
          selectedKey={selectedDayKey}
          onSelectDay={setSelectedDate}
        />
      </Panel>

      <DaySessionsPanel date={selectedDate} sessions={sessionsForSelectedDay} />
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={TEAL}
            />
          }
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerGreeting} numberOfLines={1}>
                {greeting}, {firstName}! 👋
              </Text>
              <Text style={styles.headerSub}>
                Here's what's happening in your classroom today.
              </Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.workspaceBtn}
                onPress={() => navigation.getParent()?.navigate('WorkspaceSelect')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Switch workspace"
              >
                <Ionicons name="grid-outline" size={16} color="#2A5A48" />
                <Text style={styles.workspaceBtnText}>Workspaces</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileChip}
                onPress={() => setLogoutVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${profile?.full_name ?? 'Account'} — sign out`}
              >
                <Avatar name={profile?.full_name} uri={profile?.profile_photo_url} size={34} />
                <View style={styles.profileChipText}>
                  <Text style={styles.profileChipName} numberOfLines={1}>
                    {profile?.full_name ?? '...'}
                  </Text>
                  <Text style={styles.profileChipCode} numberOfLines={1}>
                    {profile?.teacher_code ?? 'Teacher'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={15} color="#6B8A80" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Body ── */}
          <View style={[styles.body, twoCol && styles.bodyRow, { gap: COL_GAP }]}>
            {mainColumn}
            {sideColumn}
          </View>
        </ScrollView>
      </SafeAreaView>

      <ConfirmDialog
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to end your session?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        icon="log-out-outline"
        onConfirm={logout}
        onCancel={() => setLogoutVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A soft, warm off-white rather than pure white — panels (which stay pure
  // white) still read as distinct cards sitting on the page instead of
  // blending into it.
  root: { flex: 1, backgroundColor: '#F6F8F6' },
  safe: { flex: 1 },
  loadingCenter: { alignItems: 'center', justifyContent: 'center' },
  scroll: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.spacing.md,
    marginBottom: Layout.spacing.xl,
  },
  headerLeft: { flex: 1, gap: 2 },
  headerGreeting: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A3D2E',
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#4A7A60',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workspaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF1EF',
  },
  workspaceBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#2A5A48',
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF1EF',
  },
  profileChipText: { maxWidth: 140 },
  profileChipName: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A3D2E',
  },
  profileChipCode: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
  },

  // ── Layout ────────────────────────────────────────────────────────────────
  body:    { flexDirection: 'column' },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start' },
  column:  { gap: Layout.spacing.lg },

  // ── Panels ────────────────────────────────────────────────────────────────
  // Shadow here, not on `panel` — a view with overflow:hidden clips its own
  // shadow on iOS, so the shadow has to live one level up from the clipping view.
  panelShadowWrap: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#EDF1EF',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: PANEL_PAD,
    paddingVertical: PANEL_PAD,
    backgroundColor: '#F9FBFA',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1EF',
  },
  panelBody: {
    padding: PANEL_PAD,
  },
  panelIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  panelTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A3D2E',
  },
  panelEmptyText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
    lineHeight: 20,
    paddingVertical: Layout.spacing.sm,
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TEAL,
  },
  pillBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEAL,
  },

  // ── Student cards ─────────────────────────────────────────────────────────
  studentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  // Shadow here, not on `studentCard` — see the matching note on panelShadowWrap.
  studentCardShadowWrap: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A3D2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 30,
    paddingBottom: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    overflow: 'hidden',
  },
  // Soft tinted wash behind the avatar, fading into the card's white body — gives
  // each card its own bit of color without the halo ring having to carry it alone.
  studentCardTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 78,
    opacity: 0.55,
  },
  studentHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  studentName: {
    fontSize: 15,
    lineHeight: 20,
    height: 40,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A3D2E',
    textAlign: 'center',
  },
  studentAge: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
  },
  studentChevron: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  calNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calMonth: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1A3D2E',
  },
  calArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F5',
  },
  calRow: { flexDirection: 'row' },
  calWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#6B8A80',
    paddingBottom: 6,
  },
  calCell: { flex: 1, alignItems: 'center' },
  calDay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayToday: { backgroundColor: SECTION.calendar.fg },
  calDaySelected: { backgroundColor: SECTION.calendar.bg, borderWidth: 1.5, borderColor: SECTION.calendar.fg },
  calDaySelectedText: { color: '#1A3D2E', fontFamily: 'DMSans_700Bold' },
  calDayText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1A3D2E',
  },
  calDayOutsideText: { color: '#C6D2CC' },
  calDayTodayText: { color: '#FFFFFF', fontFamily: 'DMSans_700Bold' },
  // Fixed-height slot so a dot appearing never nudges the row below it.
  calDotSlot: { height: 8, justifyContent: 'center' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#52C07C' },

  // ── Selected-day sessions ─────────────────────────────────────────────────
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  slotTime: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#6B8A80',
    width: 62,
  },
  slotBody: { flex: 1, gap: 1 },
  slotTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#1A3D2E',
  },
  slotSub: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
  },

  // ── Notes ─────────────────────────────────────────────────────────────────
  notesChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  notesChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F4F7F5',
    borderWidth: 1,
    borderColor: '#EDF1EF',
    maxWidth: 140,
  },
  notesChipActive: { backgroundColor: SECTION.notes.fg, borderColor: SECTION.notes.fg },
  notesChipText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#4A7A60',
  },
  notesChipTextActive: { color: '#FFFFFF' },
  notesComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
  },
  notesInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    backgroundColor: '#F9FBFA',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#1A3D2E',
  },
  notesAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SECTION.notes.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesAddBtnDisabled: { backgroundColor: '#B9D4CF' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#F9FBFA',
    borderWidth: 1,
    borderColor: '#EDF1EF',
  },
  noteBody: { flex: 1, gap: 3 },
  noteDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORAL_L,
  },
  noteText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#1A3D2E',
    lineHeight: 19,
  },
  noteMeta: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16 },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D6F0F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A3D2E',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
    textAlign: 'center',
    lineHeight: 18,
  },

});
