import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { principalApi } from '../../../api/principal';
import { formatDate } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';

// ── palette ───────────────────────────────────────────────────────────────────
const DARK     = '#0F2F3E';
const GREEN    = '#3EBF78';
const GREEN_L  = '#E0F7EC';
const BLUE     = '#4A8FD8';
const BLUE_L   = '#DEEAF8';
const PURPLE   = '#7B68C8';
const PURPLE_L = '#EEEBF8';
const AMBER    = '#F0A940';
const AMBER_L  = '#FDF0D6';
const CORAL    = '#D95F50';
const CORAL_L  = '#FDECEA';
const BODY_BG  = '#F2F5F8';
const SURFACE  = '#FFFFFF';
const TEXT     = '#1A2E3B';
const MUTED    = '#8A93A8';
const BORDER   = '#E8EEF4';

// ── helpers ───────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, accent = BLUE, last = false }) {
  if (!value) return null;
  return (
    <>
      <View style={styles.infoRow}>
        <View style={[styles.infoIconBox, { backgroundColor: accent + '18' }]}>
          <Ionicons name={icon} size={15} color={accent} />
        </View>
        <View style={styles.infoText}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

function SectionCard({ title, icon, accent = BLUE, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardHeaderIcon, { backgroundColor: accent + '18' }]}>
          <Ionicons name={icon} size={15} color={accent} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardDivider} />
      {children}
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────
export default function TeacherDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initialTeacher = route.params?.teacher;
  const toast = useToast();

  const [teacher,        setTeacher]        = useState(initialTeacher);
  const [deleting,       setDeleting]       = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await principalApi.getTeacher(initialTeacher.tid);
      setTeacher(data);
    } catch {
      // use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialTeacher.tid]);

  useEffect(() => {
    fetch();
    const unsub = navigation.addListener('focus', fetch);
    return unsub;
  }, [fetch, navigation]);

  async function confirmDelete() {
    setConfirmVisible(false);
    setDeleting(true);
    try {
      await principalApi.deleteTeacher(teacher.tid);
      navigation.popToTop();
    } catch (err) {
      toast.show(err.message, 'error');
      setDeleting(false);
    }
  }

  if (!teacher) return null;

  const isActive     = !teacher.is_first_login;
  const studentCount = teacher.students?.length ?? 0;
  const capacityPct  = Math.round((studentCount / 5) * 100);
  const dotColor     = studentCount >= 5 ? CORAL : studentCount >= 3 ? AMBER : GREEN;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>Faculty</Text>
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
          <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{teacher.full_name}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetch(); }}
            tintColor={GREEN}
          />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* top-right action buttons */}
          <View style={styles.heroBtnRow}>
            <TouchableOpacity
              style={styles.heroEditBtn}
              onPress={() => navigation.navigate('EditTeacher', { teacher })}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={15} color={SURFACE} />
              <Text style={styles.heroBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroDeleteBtn}
              onPress={() => setConfirmVisible(true)}
              disabled={deleting}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={15} color={SURFACE} />
              <Text style={styles.heroBtnText}>{deleting ? '…' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroInner}>
            <Avatar name={teacher.full_name} uri={teacher.profile_photo_url} size={84} />
            <Text style={styles.heroName}>{teacher.full_name}</Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.codeTag}>
                <Text style={styles.codeTagText}>{teacher.teacher_code}</Text>
              </View>
              <View style={[styles.statusTag, { backgroundColor: isActive ? GREEN + '28' : AMBER + '28', borderColor: isActive ? GREEN + '50' : AMBER + '50' }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? GREEN : AMBER }]} />
                <Text style={[styles.statusTagText, { color: isActive ? GREEN : AMBER }]}>
                  {isActive ? 'Active' : 'Pending Setup'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Two column layout ── */}
        <View style={styles.twoCol}>

          {/* Left: Account details */}
          <View style={{ flex: 1 }}>
            <SectionCard title="Account Details" icon="person-circle-outline" accent={BLUE}>
              <InfoRow icon="mail-outline"             label="Email Address"   value={teacher.email}                             accent={BLUE} />
              <InfoRow icon="calendar-outline"         label="Joined"          value={formatDate(teacher.created_at)}            accent={PURPLE} />
              <InfoRow icon="shield-checkmark-outline" label="Account Status"  value={isActive ? 'Fully active' : 'Awaiting first login'} accent={isActive ? GREEN : AMBER} last />

              {/* Capacity bar */}
              <View style={styles.cardDivider} />
              <View style={styles.capacitySection}>
                <View style={styles.capacityLabelRow}>
                  <Text style={styles.capacityLabel}>Class Capacity</Text>
                  <View style={styles.capacityCountRow}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <View key={i} style={[styles.capDot, { backgroundColor: i < studentCount ? dotColor : BORDER }]} />
                    ))}
                    <Text style={[styles.capacityCount, { color: dotColor }]}>{studentCount}/5</Text>
                  </View>
                </View>
                <View style={styles.capacityTrack}>
                  <View style={[styles.capacityFill, { width: `${capacityPct}%`, backgroundColor: dotColor }]} />
                </View>
              </View>
            </SectionCard>
          </View>

          {/* Right: Assigned students */}
          <View style={{ flex: 1 }}>
            <SectionCard title="Assigned Students" icon="people-outline" accent={PURPLE}>
              {studentCount > 0 ? (
                <View style={styles.studentsList}>
                  {teacher.students.map((s, i) => (
                    <React.Fragment key={s.sid}>
                      <View style={styles.studentRow}>
                        <Avatar name={s.full_name} size={40} />
                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>{s.full_name}</Text>
                          <View style={styles.studentMeta}>
                            <View style={styles.studentCodePill}>
                              <Text style={styles.studentCodeText}>{s.student_code}</Text>
                            </View>
                            <View style={styles.studentStatusBadge}>
                              <View style={[styles.studentStatusDot, { backgroundColor: GREEN }]} />
                              <Text style={[styles.studentStatusText, { color: GREEN }]}>In Class</Text>
                            </View>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={BORDER} />
                      </View>
                      {i < teacher.students.length - 1 && <View style={styles.studentDivider} />}
                    </React.Fragment>
                  ))}

                  {/* Empty slots */}
                  {Array.from({ length: 5 - studentCount }).map((_, i) => (
                    <React.Fragment key={`empty-${i}`}>
                      <View style={styles.studentDivider} />
                      <View style={[styles.studentRow, styles.studentRowEmpty]}>
                        <View style={styles.emptySlotIcon}>
                          <Ionicons name="person-add-outline" size={16} color={MUTED} />
                        </View>
                        <Text style={styles.emptySlotText}>Empty slot</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyStudents}>
                  <View style={styles.emptyStudentsIcon}>
                    <Ionicons name="people-outline" size={28} color={MUTED} />
                  </View>
                  <Text style={styles.emptyStudentsTitle}>No students assigned</Text>
                  <Text style={styles.emptyStudentsSub}>Assign students from the Students list</Text>
                </View>
              )}
            </SectionCard>
          </View>

        </View>

      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        danger
        icon="trash-outline"
        title="Delete Teacher"
        message={`Remove ${teacher.full_name} from the system?\nThis action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BODY_BG },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: BODY_BG,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  breadcrumb: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  breadcrumbParent: {
    fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: MUTED,
  },
  breadcrumbCurrent: {
    flex: 1, fontSize: 15, fontFamily: 'DMSans_800ExtraBold', color: TEXT,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { padding: 16, gap: 14, paddingBottom: 24 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: DARK,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroBtnRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    top: 14, right: 14,
    zIndex: 10,
  },
  heroEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1E88E5',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  heroDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E53935',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  heroBtnText: {
    fontSize: 13, fontFamily: 'DMSans_700Bold', color: SURFACE,
  },
  heroInner: {
    alignItems: 'center',
    paddingTop: 32, paddingBottom: 28, paddingHorizontal: 24,
    gap: 10,
  },
  heroName: {
    fontSize: 22, fontFamily: 'DMSans_800ExtraBold', color: SURFACE,
    textAlign: 'center', marginTop: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    flexWrap: 'wrap', justifyContent: 'center',
  },
  codeTag: {
    backgroundColor: BLUE,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  codeTagText: {
    fontSize: 12, fontFamily: 'DMSans_700Bold', color: SURFACE, letterSpacing: 0.5,
  },
  statusTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { fontSize: 12, fontFamily: 'DMSans_700Bold' },

  // ── Two column ────────────────────────────────────────────────────────────
  twoCol: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardHeaderIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: TEXT },
  cardDivider: { height: 1, backgroundColor: BORDER },

  // ── Info rows ─────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  infoIconBox: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: 10, fontFamily: 'DMSans_600SemiBold', color: MUTED,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2,
  },
  infoValue: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: TEXT },
  rowDivider: { height: 1, backgroundColor: BORDER, marginLeft: 60 },

  // ── Capacity ──────────────────────────────────────────────────────────────
  capacitySection: { padding: 16 },
  capacityLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  capacityLabel: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 },
  capacityCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  capDot: { width: 8, height: 8, borderRadius: 4 },
  capacityCount: { fontSize: 12, fontFamily: 'DMSans_800ExtraBold', marginLeft: 2 },
  capacityTrack: {
    height: 8, backgroundColor: BORDER, borderRadius: 4, overflow: 'hidden',
  },
  capacityFill: { height: '100%', borderRadius: 4 },

  // ── Students list ─────────────────────────────────────────────────────────
  studentsList: { paddingHorizontal: 16, paddingVertical: 8 },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  studentRowEmpty: { opacity: 0.45 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: TEXT },
  studentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  studentCodePill: {
    backgroundColor: PURPLE_L, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  studentCodeText: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: PURPLE },
  studentStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GREEN_L, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  studentStatusDot: { width: 5, height: 5, borderRadius: 3 },
  studentStatusText: { fontSize: 10, fontFamily: 'DMSans_700Bold' },
  studentDivider: { height: 1, backgroundColor: BORDER },
  emptySlotIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: BODY_BG, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed',
  },
  emptySlotText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: MUTED, fontStyle: 'italic' },

  emptyStudents: {
    alignItems: 'center', gap: 6, padding: 28,
  },
  emptyStudentsIcon: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: BODY_BG, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyStudentsTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: TEXT },
  emptyStudentsSub: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: MUTED, textAlign: 'center' },
});
