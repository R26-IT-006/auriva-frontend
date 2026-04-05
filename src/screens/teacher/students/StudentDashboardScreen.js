import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { formatDate } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { useState, useCallback, useEffect } from 'react';

// ── Dot-grid background (shared aesthetic with student workspace) ──────────────
function DotGrid() {
  const { width, height } = useWindowDimensions();
  const GAP  = 28;
  const COLS = Math.ceil(width  / GAP);
  const ROWS = Math.ceil(height / GAP);
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            top:  r * GAP + 6,
            left: c * GAP + 6,
            width: 3, height: 3, borderRadius: 2,
            backgroundColor: 'rgba(160,160,180,0.22)',
          }}
        />,
      );
    }
  }
  return <>{dots}</>;
}

// ── Quick-info tile ────────────────────────────────────────────────────────────
function InfoTile({ icon, label, value, color, bg }) {
  return (
    <View style={[styles.tile, { borderLeftColor: color }]}>
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.tileText}>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileValue} numberOfLines={2}>{value || '—'}</Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function StudentDashboardScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const toast = useToast();

  const [student,          setStudent]          = useState(initialStudent);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [sessionLoading,   setSessionLoading]   = useState(false);
  const [refreshing,       setRefreshing]       = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await teacherApi.getStudent(initialStudent.sid);
      setStudent(data);
    } catch {
      // use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialStudent.sid]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleSessionToggle() {
    setSessionLoading(true);
    try {
      if (hasActiveSession) {
        await teacherApi.endSession(student.sid);
        setHasActiveSession(false);
        toast.show(`Session with ${student.full_name} has been recorded.`);
      } else {
        await teacherApi.startSession(student.sid);
        setHasActiveSession(true);
        toast.show(`Session with ${student.full_name} is now active.`);
      }
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setSessionLoading(false);
    }
  }

  if (!student) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Dot-pattern background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DotGrid />
      </View>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>Student Dashboard</Text>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetch(); }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroAvatar}>
            <Avatar name={student.full_name} uri={student.profile_photo_url} size={96} />
            {/* Session live indicator */}
            {hasActiveSession && (
              <View style={styles.liveRing}>
                <View style={styles.liveDot} />
              </View>
            )}
          </View>
          <Text style={styles.heroName}>{student.full_name}</Text>
          <Text style={styles.heroCode}>{student.student_code}</Text>
          <Badge label={student.disability} variant="info" style={{ marginTop: 6 }} />
        </View>

        {/* ── Session control ───────────────────────────────────── */}
        <View style={[styles.sessionCard, hasActiveSession && styles.sessionCardActive]}>
          <View style={styles.sessionLeft}>
            <View style={styles.sessionIndicatorRow}>
              <View style={[styles.dot, hasActiveSession && styles.dotActive]} />
              <Text style={[styles.sessionStatus, hasActiveSession && styles.sessionStatusActive]}>
                {hasActiveSession ? 'Session Active' : 'No Active Session'}
              </Text>
            </View>
            {hasActiveSession && (
              <Text style={styles.sessionHint}>Session is currently in progress</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.sessionBtn, hasActiveSession && styles.sessionBtnEnd]}
            onPress={handleSessionToggle}
            disabled={sessionLoading}
            activeOpacity={0.8}
          >
            <Ionicons
              name={hasActiveSession ? 'stop-circle-outline' : 'play-circle-outline'}
              size={17}
              color="#FFF"
            />
            <Text style={styles.sessionBtnText}>
              {sessionLoading ? '...' : hasActiveSession ? 'End' : 'Start'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick info tiles ──────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Student Info</Text>
        <View style={styles.tilesGrid}>
          <InfoTile
            icon="calendar-outline"
            label="Date of Birth"
            value={formatDate(student.date_of_birth)}
            color={Colors.primary}
            bg={Colors.status.infoLight}
          />
          <InfoTile
            icon="medical-outline"
            label="Disability"
            value={student.disability}
            color="#C9973A"
            bg="#FBF4E6"
          />
          {student.father_name ? (
            <InfoTile
              icon="person-outline"
              label="Father's Name"
              value={student.father_name}
              color="#4AADA3"
              bg="#E8F6F5"
            />
          ) : null}
          {student.mobile_number ? (
            <InfoTile
              icon="call-outline"
              label="Contact"
              value={student.mobile_number}
              color="#5BAF85"
              bg="#EAF6F1"
            />
          ) : null}
        </View>

        {/* ── View full profile ─────────────────────────────────── */}
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('StudentSession', { student })}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.profileBtnText}>View Full Profile</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: {
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.md,
  },

  // ── Top bar ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    gap: Layout.spacing.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  topBarRight: { width: 38 }, // balances the back button

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.lg,
    gap: 4,
  },
  heroAvatar: { position: 'relative', marginBottom: 4 },
  liveRing: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  liveDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.status.success,
  },
  heroName: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: Layout.fontWeight.extrabold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: 4,
  },
  heroCode: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontWeight: Layout.fontWeight.medium,
  },

  // ── Session card ───────────────────────────────────────────────────────────
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionCardActive: {
    borderColor: Colors.status.success,
    backgroundColor: Colors.status.successLight,
  },
  sessionLeft: { flex: 1, marginRight: Layout.spacing.md },
  sessionIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.icon.muted,
  },
  dotActive: { backgroundColor: Colors.status.success },
  sessionStatus: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary,
  },
  sessionStatusActive: { color: Colors.status.success },
  sessionHint: {
    fontSize: Layout.fontSize.xs,
    color: Colors.status.success,
    marginTop: 4,
  },
  sessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.md,
  },
  sessionBtnEnd: { backgroundColor: Colors.status.error },
  sessionBtnText: {
    color: '#FFF',
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },

  // ── Tiles ──────────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  tilesGrid: {
    gap: Layout.spacing.sm,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderLeftWidth: 4,
    gap: Layout.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  tileIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  tileText: { flex: 1 },
  tileLabel: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontWeight: Layout.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tileValue: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary,
  },

  // ── View full profile button ───────────────────────────────────────────────
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  profileBtnText: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.primary,
  },
});
