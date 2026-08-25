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
const TEAL_GRAD = ['#4AABB8', '#52C07C'];

// Tinted pairs reused by the overview tiles and the session strip, so a green tile
// and a green row mean the same thing in both places.
const TINTS = {
  purple: { bg: '#EFEBFA', fg: '#6C5CE0' },
  green:  { bg: '#E3F7EC', fg: '#3FAE6F' },
  blue:   { bg: '#E6F1FC', fg: '#3B82C4' },
  amber:  { bg: '#FDF1DC', fg: '#E89A2E' },
};

const PANEL_PAD    = 16;
const PANEL_BORDER = 1;
const GRID_GAP     = 12;
// Below this the two columns stack; the calendar needs ~330pt before its day cells
// start crowding, and the student cards want the rest.
const TWO_COL_MIN = 900;

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Local calendar-day identity. Bucketing on this rather than the ISO string is
 *  what keeps an evening session on the right day for a teacher offset from UTC. */
function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function timeLabel(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

  return (
    <TouchableOpacity
      style={[styles.studentCard, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${student.fullName}${age != null ? `, age ${age}` : ''}`}
    >
      <View style={[styles.studentHalo, { backgroundColor: haloFor(student.fullName) }]}>
        <Avatar name={student.fullName} uri={student.profilePhotoUrl} size={72} />
      </View>

      {/* Two lines, with the height reserved either way: full names run long enough
          that one line truncates most of them, and letting the box grow only when a
          name wraps leaves the cards in a row at different heights. */}
      <Text style={styles.studentName} numberOfLines={2}>{student.fullName}</Text>
      <Text style={styles.studentAge}>{age != null ? `Age ${age}` : 'Age not set'}</Text>
    </TouchableOpacity>
  );
}

// ── Panel shell ──────────────────────────────────────────────────────────────

function Panel({ title, action, onAction, right, children, style }) {
  return (
    <View style={[styles.panel, style]}>
      {(title || right) && (
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
          {right}
          {action ? (
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={onAction}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.pillBtnText}>{action}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

function StatTile({ icon, tint, value, label, sub, width }) {
  const t = TINTS[tint];
  return (
    <View style={[styles.statTile, { width, backgroundColor: t.bg }]}>
      <View style={styles.statTileTop}>
        <View style={[styles.statTileIcon, { backgroundColor: '#FFFFFF' }]}>
          <Ionicons name={icon} size={16} color={t.fg} />
        </View>
        <Text style={[styles.statTileValue, { color: t.fg }]}>{value}</Text>
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={styles.statTileSub}>{sub}</Text>
    </View>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarGrid({ monthDate, activeDays }) {
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
            const key     = dayKey(d);
            const outside = d.getMonth() !== thisMonth;
            const isToday = key === todayKey;
            const active  = activeDays.has(key);

            return (
              <View key={key} style={styles.calCell}>
                <View style={[styles.calDay, isToday && styles.calDayToday]}>
                  <Text
                    style={[
                      styles.calDayText,
                      outside && styles.calDayOutsideText,
                      isToday && styles.calDayTodayText,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                {/* Dot marks a day the class ran a session. Hidden on today's cell,
                    where the filled circle already carries the emphasis. */}
                <View style={styles.calDotSlot}>
                  {active && !isToday ? <View style={styles.calDot} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
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

  const logout = useAuthStore((s) => s.logout);
  const toast  = useToast();

  const { width } = useWindowDimensions();
  const contentWidth = width - Layout.spacing.lg * 2;
  const twoCol       = contentWidth >= TWO_COL_MIN;

  // Explicit column widths rather than flex, so the student grid below can do its
  // own column maths against a number it knows before layout. Widths are floored
  // throughout: fractional ones round up during layout and overrun the row.
  const COL_GAP  = Layout.spacing.md;
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
  const tileCols = fit(140, 4);
  const tileW    = Math.floor((mainPane - GRID_GAP * (tileCols - 1)) / tileCols);

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
  const stats          = data?.stats;
  const weekStats      = data?.weekStats;
  const proficiency    = data?.proficiency ?? [];
  const recentSessions = data?.recentSessions ?? [];

  const activeDays = useMemo(() => {
    const set = new Set();
    for (const iso of data?.sessionDates ?? []) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) set.add(dayKey(d));
    }
    return set;
  }, [data?.sessionDates]);

  const todaySessions = useMemo(() => {
    const today = dayKey(new Date());
    return recentSessions
      .filter((s) => s.startedAt && dayKey(new Date(s.startedAt)) === today)
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  }, [recentSessions]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Teacher';

  const engagementDisplay = stats?.avgEngagement != null
    ? `${Math.round(stats.avgEngagement * 100)}%`
    : null;
  const progressDisplay = weekStats?.avgProgress != null
    ? `${Math.round(weekStats.avgProgress * 100)}%`
    : '—';

  const shiftMonth = (delta) =>
    setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  if (!data) {
    return (
      <LinearGradient
        colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']}
        style={styles.root}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={[styles.safe, styles.loadingCenter]} edges={['top', 'bottom']}>
          <ActivityIndicator color={TEAL} size="large" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Left column ──────────────────────────────────────────────────────────
  const mainColumn = (
    <View style={[styles.column, { width: mainW }]}>
      <Panel
        title={`My Students${proficiency.length > 0 ? ` (${proficiency.length})` : ''}`}
        action={proficiency.length > 0 ? 'View all' : null}
        onAction={() => navigation.navigate('TeacherStudentList')}
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
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={24} color={TEAL} />
            </View>
            <Text style={styles.emptyTitle}>No students yet</Text>
            <Text style={styles.emptySub}>
              Once students are assigned to you, their progress will show up here.
            </Text>
          </View>
        )}
      </Panel>

      <Panel title="Class Overview">
        <View style={styles.tileGrid}>
          <StatTile
            width={tileW}
            tint="purple"
            icon="albums-outline"
            value={weekStats?.activitiesAssigned ?? '—'}
            label="Activities Assigned"
            sub="This week"
          />
          <StatTile
            width={tileW}
            tint="green"
            icon="checkmark-circle-outline"
            value={weekStats?.activitiesCompleted ?? '—'}
            label="Activities Completed"
            sub="This week"
          />
          <StatTile
            width={tileW}
            tint="blue"
            icon="stats-chart-outline"
            value={progressDisplay}
            label="Average Progress"
            sub="This week"
          />
          <StatTile
            width={tileW}
            tint="amber"
            icon="ribbon-outline"
            value={weekStats?.milestones ?? '—'}
            label="Milestones"
            sub="This week"
          />
        </View>

        {/* The tiles are all week-scoped; these two are lifetime figures and say so
            rather than sitting in a tile that reads "this week". */}
        <View style={styles.allTime}>
          <Text style={styles.allTimeText}>
            All time · {stats?.conceptsMastered ?? 0} concepts mastered
            {engagementDisplay ? ` · ${engagementDisplay} engagement` : ''}
          </Text>
        </View>
      </Panel>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.bannerWrap}
        onPress={() => navigation.navigate('TeacherStudentList')}
      >
        <LinearGradient
          colors={TEAL_GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.banner}
        >
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerTitle}>Ready to teach?</Text>
            <Text style={styles.bannerSub}>
              Select a student and start today's learning session.
            </Text>
          </View>
          <View style={styles.bannerIcon}>
            <Ionicons name="school-outline" size={30} color="rgba(255,255,255,0.9)" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ── Right column ─────────────────────────────────────────────────────────
  const sideColumn = (
    <View style={[styles.column, { width: sideW }]}>
      <Panel
        title="Calendar"
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
        <CalendarGrid monthDate={monthDate} activeDays={activeDays} />
      </Panel>

      <Panel title="Today's Sessions">
        {todaySessions.length > 0 ? (
          todaySessions.map((s, i) => {
            const tint = TINTS[['purple', 'amber', 'green', 'blue'][i % 4]];
            return (
              <View key={`${s.startedAt}-${i}`} style={[styles.slot, { backgroundColor: tint.bg }]}>
                <Text style={styles.slotTime}>{timeLabel(s.startedAt)}</Text>
                <View style={styles.slotBody}>
                  <Text style={styles.slotTitle} numberOfLines={1}>{s.studentName}</Text>
                  <Text style={styles.slotSub}>{s.isActive ? 'In progress' : 'Completed'}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.panelEmptyText}>
            No sessions yet today. Pick a student to begin.
          </Text>
        )}

        <TouchableOpacity
          style={styles.wideBtn}
          onPress={() => navigation.navigate('TeacherStudentList')}
          activeOpacity={0.75}
        >
          <Text style={styles.wideBtnText}>Start a session</Text>
        </TouchableOpacity>
      </Panel>
    </View>
  );

  return (
    <LinearGradient
      colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
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
                style={styles.iconBtn}
                onPress={() => navigation.getParent()?.navigate('WorkspaceSelect')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Switch workspace"
              >
                <Ionicons name="grid-outline" size={20} color="#2A5A48" />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    marginBottom: Layout.spacing.md,
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
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
  column:  { gap: Layout.spacing.md },

  // ── Panels ────────────────────────────────────────────────────────────────
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: PANEL_PAD,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.md,
  },
  panelTitle: {
    flex: 1,
    fontSize: 16,
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
  wideBtn: {
    marginTop: Layout.spacing.md,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: 'center',
  },
  wideBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEAL,
  },

  // ── Student cards ─────────────────────────────────────────────────────────
  studentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#EDF1EF',
  },
  studentHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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

  // ── Class overview tiles ──────────────────────────────────────────────────
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  statTile: {
    borderRadius: 16,
    padding: 14,
    gap: 3,
  },
  statTileTop: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 5 },
  statTileIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTileValue: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
  },
  statTileLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#1A3D2E',
  },
  statTileSub: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
  },
  allTime: {
    marginTop: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#EDF1EF',
  },
  allTimeText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B8A80',
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
  calDayToday: { backgroundColor: TEAL },
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

  // ── Today's sessions ──────────────────────────────────────────────────────
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
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

  // ── Banner ────────────────────────────────────────────────────────────────
  bannerWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  bannerLeft: { flex: 1, gap: 5 },
  bannerTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFF',
  },
  bannerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
