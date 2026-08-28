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

// Page chrome — the full-page spinner and the pull-to-refresh tint. This used to be
// the digest panel's accent as well, which is why it is teal; the digest is rose now
// and teal is no longer any section's colour, so it reads as neutral app furniture
// rather than pointing at one panel. That is the reason to keep the hue, not inertia.
const CHROME    = '#3A9BA8';
// Matches the delete icon on the principal side's teacher table, so "delete" reads
// the same wherever it shows up.
const CORAL     = '#D95F50';
const CORAL_L   = '#FDECEA';

// The page backdrop, in the same blue → sage → cream progression WorkspaceSelectScreen
// and StudentPickerScreen use. The dashboard was the one flat screen in the teacher
// workspace ('#F6F8F6'), so arriving here from the workspace picker dropped the app's
// colour language for a grey the rest of the product never uses.
//
// Paler than those two screens on purpose, and that is the whole design decision:
// they are sparse, so they can carry the saturated version, while this screen is a
// dense grid of pure-white panels each wearing its own accent tint (purple, green,
// blue, amber, teal below). At WorkspaceSelect's saturation the backdrop competes
// with those accents and the panels stop reading as cards. This follows the same
// rule the avatar themes state explicitly — a background that sits *behind* white
// cards resolves toward near-white, so the cards keep their edges.
//
// Diagonal rather than straight down: the paired row above PAIR_MIN is wide enough
// that a vertical ramp bands visibly across it.
const BACKDROP = ['#DCEFF5', '#E4F0E6', '#EFF3E4', '#FAF8F1'];
const BACKDROP_START = { x: 0, y: 0 };
const BACKDROP_END   = { x: 0.6, y: 1 };

// Tinted pairs reused by the overview tiles and the session strip, so a green tile
// and a green row mean the same thing in both places.
//
// `fg` carries two jobs and has to satisfy both, which the previous set did not:
//   - panel title text, sitting on its own `bg`
//   - a solid fill with WHITE text on it (calDayToday, notesChipActive, notesAddBtn)
// The second is the harsh one. The old amber #E89A2E scored 2.31:1 against white —
// a teacher reading today's date or an active note chip was reading pale orange on
// white. Every one of the five failed both tests; the best was purple at 4.22/4.95.
// All five now clear 4.5:1 in both roles, measured, with amber the tightest at 4.86.
//
// Hue spacing was the other problem. green(146) teal(187) blue(209) crowded three of
// the five sections into 63 degrees, so at a glance the calendar, the sessions strip
// and the digest all read as "the blue-green one" — while amber sat 111 degrees away
// on its own. Teal is retired and the digest takes rose instead: five hues, minimum
// gap now 48 degrees rather than 22, so the sections are told apart by colour alone.
//
// Kept deliberately desaturated. These sit on the BACKDROP gradient above, which is
// itself blue-to-sage-to-cream — saturated accents fought it and the panels stopped
// reading as cards.
const TINTS = {
  purple: { bg: '#EDE9FA', fg: '#6438BE' },
  green:  { bg: '#E6F4EA', fg: '#2A7146' },
  blue:   { bg: '#E5EEF9', fg: '#27609F' },
  amber:  { bg: '#FAF0DF', fg: '#945D08' },
  rose:   { bg: '#FAE9F0', fg: '#A5366A' },
};

// Each dashboard section gets its own accent so the panels read as distinct
// areas on the plain white background rather than one undifferentiated stack.
const SECTION = {
  students:     { icon: 'people-outline',      ...TINTS.purple },
  notes:        { icon: 'document-text-outline', ...TINTS.amber },
  calendar:     { icon: 'calendar-outline',    ...TINTS.blue },
  daySessions:  { icon: 'time-outline',        ...TINTS.green },
  digest:       { icon: 'sparkles-outline',    ...TINTS.rose },
};

const PANEL_PAD    = 20;
const PANEL_BORDER = 1;
const GRID_GAP     = 14;
// Notes and the calendar share a row above this and stack below it. The calendar
// needs ~330pt before its day cells start crowding and the notes list wants about
// as much for its chips and composer, so two of them plus the gap is the floor.
const PAIR_MIN = 640;

// Below this the header's greeting and its controls stack instead of sharing a
// row. The Workspaces button and the profile chip need roughly 385pt side by
// side — more than a portrait phone has in total — and because neither shrinks,
// a single row squeezed the greeting down to nothing rather than wrapping.
const HEADER_ROW_MIN = 700;

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
// The avatar tile carries the colour itself now — Avatar picks a saturated hue
// from the child's name and prints white initials on it — so the pale halo ring
// that used to sit behind it has no job left. Its palette is gone with it.
const AVATAR_TILE = 84;

function StudentCard({ student, width, onPress }) {
  const age = ageFrom(student.dateOfBirth);

  return (
    <TouchableOpacity
      style={[styles.studentCardShadowWrap, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${student.fullName}${age != null ? `, age ${age}` : ''}`}
    >
      {/* Avatar-forward: a rounded-square tile, the name, then the age.
          The card used to be a gradient wash behind a circle behind a chevron —
          three decorations around one 72px avatar. Stripping it back to the tile
          lets a teacher pick a child out of the row by colour and initials, which
          is how they scan it, and the card gets shorter at the same time. */}
      <View style={styles.studentCard}>
        <View style={styles.studentAvatarWrap}>
          {/* The tile IS the avatar. It used to be an Avatar nested inside a
              separately tinted square — and Avatar hard-codes borderRadius to
              size/2, so that rendered as a saturated circle sitting inside a pale
              square. The `style` override squares it off; Avatar applies `style`
              last, so this wins over its own radius without touching the shared
              component, which the header chip and the profile still want round. */}
          <Avatar
            name={student.fullName}
            uri={student.profilePhotoUrl}
            size={AVATAR_TILE}
            style={styles.studentAvatarTile}
          />
          {/* On the tile's corner rather than in the card's flow, so it reads as
              belonging to this child rather than as a bullet before their name. */}
          <View style={[styles.studentDot, { backgroundColor: student.lastSessionAt ? '#3FAE6F' : '#E0A030' }]} />
        </View>

        {/* First name only. Full names ran to two lines, so every card reserved the
            height for two whether it used it or not — and "Dinuja Sasanjana" over
            two cramped lines is harder to pick out of a row than "Dinuja". The
            teacher knows these five children; the surname is on the profile. */}
        <Text style={styles.studentName} numberOfLines={1}>
          {student.fullName?.trim().split(/\s+/)[0] || student.fullName}
        </Text>
        <Text style={styles.studentAge}>{age != null ? `AGE ${age}` : 'AGE NOT SET'}</Text>
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
      <View style={[
        styles.panel,
        accent && { borderColor: accent.fg + '33' },
        // A solid edge in the section's own colour. The tinted header alone left
        // the panels reading as one undifferentiated stack once they were on a
        // coloured page; a spine down the side is visible from the scroll
        // position rather than only when the header is on screen.
        accent && { borderLeftWidth: 4, borderLeftColor: accent.fg },
      ]}>
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

/**
 * Weekly class digest. Uses the dashboard's own Panel rather than the report
 * screen's AiSummaryCard — the two screens are different visual systems, and a
 * card styled for one reads as foreign in the other.
 *
 * Returns null whenever there is nothing to show: feature off, model call failed,
 * or no students yet. A summary of numbers shown elsewhere on the page does not
 * warrant an error state when it is missing.
 */
function DigestPanel({ data, loading, onRefresh, refreshing, width }) {
  if (loading) {
    return (
      <Panel title="This week" section="digest" style={{ width }}>
        <View style={styles.digestLoading}>
          <ActivityIndicator size="small" color={TINTS.rose.fg} />
          <Text style={styles.digestLoadingText}>Writing summary…</Text>
        </View>
      </Panel>
    );
  }

  if (!data?.available || !data.summary) return null;

  const { headline, highlights, watch_areas: watchAreas, caveat } = data.summary;

  return (
    <Panel
      title="This week"
      section="digest"
      style={{ width }}
      right={
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Regenerate weekly summary"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.digestRefresh}
        >
          {refreshing
            ? <ActivityIndicator size="small" color={TINTS.rose.fg} />
            : <Ionicons name="refresh" size={15} color={TINTS.rose.fg} />}
        </TouchableOpacity>
      }
    >
      {headline ? <Text style={styles.digestHeadline}>{headline}</Text> : null}

      {highlights?.length ? (
        <View style={styles.digestGroup}>
          {highlights.map((h, i) => (
            <View key={`hl-${i}`} style={styles.digestRow}>
              <Ionicons name="ellipse" size={5} color={TINTS.green.fg} style={styles.digestDot} />
              <Text style={styles.digestText}>{h}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {watchAreas?.length ? (
        <View style={styles.digestGroup}>
          <Text style={styles.digestGroupTitle}>Worth a look</Text>
          {watchAreas.map((w, i) => (
            <View key={`wa-${i}`} style={styles.digestRow}>
              <Ionicons name="ellipse" size={5} color={TINTS.amber.fg} style={styles.digestDot} />
              <Text style={styles.digestText}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {caveat ? <Text style={styles.digestCaveat}>{caveat}</Text> : null}
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

  // Kept out of `data` on purpose: a model call that may be slow, disabled or
  // failing must not hold up or break the dashboard it decorates.
  const [digest,           setDigest]           = useState(null);
  const [digestLoading,    setDigestLoading]    = useState(false);
  const [digestRefreshing, setDigestRefreshing] = useState(false);

  const logout = useAuthStore((s) => s.logout);
  const toast  = useToast();

  const { width } = useWindowDimensions();
  const contentWidth = width - Layout.spacing.lg * 2;
  const pairRow      = contentWidth >= PAIR_MIN;
  const wideHeader   = contentWidth >= HEADER_ROW_MIN;

  // Explicit column widths rather than flex, so the student grid below can do its
  // own column maths against a number it knows before layout. Widths are floored
  // throughout: fractional ones round up during layout and overrun the row.
  //
  // Notes and the calendar take an even half each. Neither is the subordinate of
  // the other — one is what the teacher writes, the other is what they look up —
  // so there is nothing to justify the 62/38 split the old two-column body used.
  const COL_GAP = Layout.spacing.lg;
  const pairW   = pairRow ? Math.floor((contentWidth - COL_GAP) / 2) : contentWidth;
  // Panels are border-box, so the 1px border eats the same width the padding does.
  // Measuring against padding alone overruns the pane by 2px — enough to wrap the
  // last card onto its own row. The trailing pixel is slack against fractional
  // device-pixel rounding, which would do the same thing on a half-pixel screen.
  const mainPane = contentWidth - (PANEL_PAD + PANEL_BORDER) * 2 - 1;

  // Column counts come from a target width rather than fixed breakpoints, so the
  // grid keeps filling its row at any pane width. Capped at four to hold the
  // one-row-of-four shape the design is built around.
  const fit = (min, max) =>
    Math.max(2, Math.min(max, Math.floor((mainPane + GRID_GAP) / (min + GRID_GAP))));

  // Keep the whole class on one row where it fits.
  //
  // This was fit(150, 4): a hard cap at four columns, so a class of five put one
  // child alone on a second row — the row stopped reading as "my class" and the
  // fifth looked like an afterthought. The cap is now six, and the count is
  // clamped to the class size so five students make five columns rather than four
  // and a straggler.
  //
  // 120 rather than 150 as the target width: the card lost the gradient wash and
  // the 88px ring, so it needs about 84pt for the avatar tile and its padding.
  //
  // Read off `data` rather than `proficiency`, which is not declared until further
  // down this component — referencing it here would compile to `undefined` rather
  // than an error, which is exactly how the report screen broke earlier.
  const classSize = data?.proficiency?.length ?? 0;
  const cardCols = Math.max(2, Math.min(classSize || 4, fit(120, 6)));
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

  // Errors are swallowed rather than toasted: unlike the notes and dashboard
  // calls, a failed summary is not something the teacher needs to know about or
  // act on — the panel simply does not appear.
  const loadDigest = useCallback(async (refresh = false) => {
    if (refresh) setDigestRefreshing(true); else setDigestLoading(true);
    try {
      setDigest(await teacherApi.getClassDigest(refresh));
    } catch {
      setDigest({ available: false });
    } finally {
      setDigestLoading(false);
      setDigestRefreshing(false);
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

  // Chained off the dashboard load so the digest never competes with the data it
  // summarises. Skipped entirely for a teacher with no students — there is
  // nothing for the model to say, and the endpoint would only answer as much.
  useEffect(() => {
    if (data?.stats?.totalStudents > 0) loadDigest(false);
  }, [data, loadDigest]);

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

  // Fallback only — the header shows the full name when the profile has loaded.
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Teacher';

  const shiftMonth = (delta) =>
    setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  if (!data) {
    return (
      <LinearGradient colors={BACKDROP} style={styles.root} start={BACKDROP_START} end={BACKDROP_END}>
        <SafeAreaView style={[styles.safe, styles.loadingCenter]} edges={['top', 'bottom']}>
          <ActivityIndicator color={CHROME} size="large" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Full-width band: the week's summary, then the class ───────────────────
  const topBand = (
    <View style={[styles.column, { width: contentWidth }]}>
      {/* Absent whenever the summary is unavailable — the column closes up. */}
      <DigestPanel
        data={digest}
        loading={digestLoading}
        refreshing={digestRefreshing}
        onRefresh={() => loadDigest(true)}
        width={contentWidth}
      />

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
    </View>
  );

  // ── Paired below it: what the teacher writes, beside what they look up ────
  const notesColumn = (
    <View style={[styles.column, { width: pairW }]}>
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

  // The day's sessions travel with the calendar: the panel is the answer to the
  // date the grid above it has selected, so splitting them would leave a heading
  // naming a day the reader can no longer see chosen.
  const calendarColumn = (
    <View style={[styles.column, { width: pairW }]}>
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
    <LinearGradient colors={BACKDROP} style={styles.root} start={BACKDROP_START} end={BACKDROP_END}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={CHROME}
            />
          }
        >
          {/* ── Header ── */}
          <View style={[styles.header, wideHeader ? styles.headerRow : styles.headerStack]}>
            <View style={[styles.headerLeft, wideHeader && styles.headerLeftGrow]}>
              {/* Allowed a second line once stacked: the greeting has the full
                  width to itself there, and clipping a teacher's own name to fit
                  a row that no longer exists is the wrong trade. */}
              {/* The teacher's own name, not a greeting.
                  "Good morning, Hansi! 👋" plus "Here's what's happening in your
                  classroom today" spent the widest, boldest line on the screen
                  saying nothing — the same words every visit, carrying no fact.
                  The name and code identify whose workspace this is, which is the
                  one thing a header on a shared staff tablet has to answer. */}
              <Text style={styles.headerName} numberOfLines={wideHeader ? 1 : 2}>
                {profile?.full_name ?? firstName}
              </Text>
              <Text style={styles.headerSub}>
                Teacher{profile?.teacher_code ? ` · ${profile.teacher_code}` : ''}
              </Text>
            </View>

            <View style={[styles.headerRight, !wideHeader && styles.headerRightStacked]}>
              <TouchableOpacity
                style={styles.workspaceBtn}
                onPress={() => navigation.getParent()?.navigate('WorkspaceSelect')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Switch workspace"
              >
                {/* Filled icon to match the filled button — the outline version
                    reads as thin and washed out reversed on solid ink. */}
                <Ionicons name="grid" size={17} color="#FFFFFF" />
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
          <View style={[styles.body, { gap: COL_GAP }]}>
            {topBand}
            <View style={[styles.pair, pairRow && styles.pairRow, { gap: COL_GAP }]}>
              {notesColumn}
              {calendarColumn}
            </View>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Colour comes from the BACKDROP gradient this is applied to, not from here.
  root: { flex: 1 },
  safe: { flex: 1 },
  loadingCenter: { alignItems: 'center', justifyContent: 'center' },
  scroll: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    gap: Layout.spacing.md,
    marginBottom: Layout.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerStack: { flexDirection: 'column', alignItems: 'stretch' },
  headerLeft: { gap: 2 },
  // Only in row mode. In a column this would make the greeting eat the leftover
  // vertical space and push the controls to the bottom of the screen.
  headerLeftGrow: { flex: 1 },
  headerName: {
    fontSize: 26,
    fontFamily: 'DMSans_900Black',
    color: '#16281F',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#4A7A60',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Stacked, the controls own the full width: the one navigation action goes to
  // one end and the account menu to the other, rather than huddling on the left.
  headerRightStacked: { justifyContent: 'space-between' },
  // Filled, not outlined. This is the only way out of the workspace and it used to
  // be a white pill with a #EDF1EF border sitting beside the profile chip, which is
  // also a white pill — two identical-looking chips, so the one navigation action in
  // the header carried no more weight than the account menu. Solid ink reverses that
  // and leaves the profile chip as the quiet one.
  //
  // #2A5A48 is the colour the button's own label already used, so this adds weight
  // without adding a hue: it stays the header's green, and at 7.91:1 against white
  // it is safe to reverse the text out of.
  workspaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: '#2A5A48',
    shadowColor: '#1A3D2E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  workspaceBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
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
    // The chip is the one part of the header that can give ground on a narrow
    // screen — the avatar and chevron hold their size and the name truncates,
    // rather than the whole chip pushing the row wider than the screen.
    flexShrink: 1,
  },
  profileChipText: { flexShrink: 1, maxWidth: 140 },
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
  pair:    { flexDirection: 'column' },
  // flex-start, not stretch: the two panels are different heights and the shorter
  // one should end where its content does rather than growing to match.
  pairRow: { flexDirection: 'row', alignItems: 'flex-start' },
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

  // ── Weekly digest ──
  digestHeadline: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1A3D2E',
    lineHeight: 22,
  },
  digestGroup: { marginTop: Layout.spacing.md },
  digestGroupTitle: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#8AA79D',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  digestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  digestDot: { marginTop: 7, marginRight: 8 },
  digestText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#3F5C52',
    lineHeight: 19,
  },
  // Shown, not hidden: the teacher should see what the summary does not know.
  digestCaveat: {
    marginTop: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E4EFEB',
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#8AA79D',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  digestRefresh: { marginLeft: Layout.spacing.sm },
  digestLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm,
  },
  digestLoadingText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CHROME,
  },
  pillBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: CHROME,
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
    // 30 at the top made room for a gradient wash that is no longer there.
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    overflow: 'hidden',
  },
  // Soft tinted wash behind the avatar, fading into the card's white body — gives
  // each card its own bit of color without the halo ring having to carry it alone.
  studentAvatarWrap: { marginBottom: 12 },
  // A rounded square, not a circle. Squares of the same size tile a row evenly and
  // read as a set; the radius is a little under a third of the side, which is what
  // keeps it a square with soft corners rather than drifting back toward a circle.
  studentAvatarTile: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  // Big enough to read as a status light across a row of five, and overlapping the
  // tile's corner so it belongs to the avatar. The white ring is what separates it
  // from the tile underneath at any avatar colour.
  studentDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  studentName: {
    fontSize: 15,
    lineHeight: 20,
    // One line now that it is a first name, so the card no longer reserves height
    // for a second that most children never used.
    height: 20,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A3D2E',
    textAlign: 'center',
  },
  studentAge: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#9AAFA7',
    letterSpacing: 0.8,
    marginTop: 2,
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
