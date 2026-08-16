import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
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
const DARK2    = '#1A3A4A';
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

// ── small helpers ─────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, accent = PURPLE, last = false }) {
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

function SectionCard({ title, icon, accent = PURPLE, children }) {
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

// ── main screen ───────────────────────────────────────────────────────────────
export default function StudentDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initialStudent = route.params?.student;
  const toast = useToast();

  const [student,            setStudent]            = useState(initialStudent);
  const [teachers,           setTeachers]           = useState([]);
  const [deleting,           setDeleting]           = useState(false);
  const [assigning,          setAssigning]          = useState(false);
  const [refreshing,         setRefreshing]         = useState(false);
  const [confirmVisible,     setConfirmVisible]     = useState(false);
  const [unassignVisible,    setUnassignVisible]    = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [modalSearch,        setModalSearch]        = useState('');

  const fetch = useCallback(async () => {
    try {
      const [s, ts] = await Promise.all([
        principalApi.getStudent(initialStudent.sid),
        principalApi.getTeachers(),
      ]);
      setStudent(s);
      setTeachers(ts);
    } catch {
      // use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialStudent.sid]);

  useEffect(() => {
    fetch();
    const unsub = navigation.addListener('focus', fetch);
    return unsub;
  }, [fetch, navigation]);

  const availableTeachers = teachers.filter((t) => (t.students?.length ?? 0) < 5);

  const filteredModalTeachers = availableTeachers.filter((t) => {
    const q = modalSearch.trim().toLowerCase();
    if (!q) return true;
    return [t.full_name, t.teacher_code].some((v) => v?.toLowerCase().includes(q));
  });

  async function doAssign(teacherId) {
    setAssigning(true);
    try {
      const updated = await principalApi.assignStudent(student.sid, teacherId);
      setStudent(updated);
      toast.show(teacherId ? 'Student assigned successfully!' : 'Student unassigned.');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setAssigning(false);
    }
  }

  async function confirmDelete() {
    setConfirmVisible(false);
    setDeleting(true);
    try {
      await principalApi.deleteStudent(student.sid);
      navigation.popToTop();
    } catch (err) {
      toast.show(err.message, 'error');
      setDeleting(false);
    }
  }

  if (!student) return null;

  const isAssigned = !!student.teacher_id;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.breadcrumbParent}>Students</Text>
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
          <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{student.full_name}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={GREEN} />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile hero ── */}
        <View style={styles.hero}>
          {/* top-right action buttons */}
          <View style={styles.heroBtnRow}>
            <TouchableOpacity
              style={styles.heroEditBtn}
              onPress={() => navigation.navigate('EditStudent', { student })}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={15} color={SURFACE} />
              <Text style={styles.heroEditBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroDeleteBtn}
              onPress={() => setConfirmVisible(true)}
              disabled={deleting}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={15} color={SURFACE} />
              <Text style={styles.heroDeleteBtnText}>{deleting ? '…' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroInner}>
            <Avatar name={student.full_name} uri={student.profile_photo_url} size={84} />
            <Text style={styles.heroName}>{student.full_name}</Text>

            {/* code + disability row */}
            <View style={styles.heroBadgeRow}>
              <View style={styles.codeTag}>
                <Text style={styles.codeTagText}>{student.student_code}</Text>
              </View>
              {student.disability ? (
                <View style={styles.disabilityTag}>
                  <Text style={styles.disabilityTagText}>{student.disability}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Teacher assignment card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: isAssigned ? GREEN_L : AMBER_L }]}>
              <Ionicons name="person-circle-outline" size={15} color={isAssigned ? GREEN : AMBER} />
            </View>
            <Text style={styles.cardTitle}>Assigned Teacher</Text>
            {isAssigned && (
              <View style={styles.assignedBadge}>
                <View style={[styles.assignedDot, { backgroundColor: GREEN }]} />
                <Text style={[styles.assignedBadgeText, { color: GREEN }]}>Assigned</Text>
              </View>
            )}
          </View>
          <View style={styles.cardDivider} />

          {isAssigned ? (
            <View style={styles.teacherRow}>
              <Avatar
                name={student.teacher?.full_name}
                uri={student.teacher?.profile_photo_url}
                size={46}
              />
              <View style={styles.teacherInfo}>
                <Text style={styles.teacherName}>{student.teacher?.full_name}</Text>
                <Text style={styles.teacherCode}>{student.teacher?.teacher_code}</Text>
              </View>
              <TouchableOpacity
                style={styles.unassignBtn}
                onPress={() => setUnassignVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="person-remove-outline" size={15} color={CORAL} />
                <Text style={styles.unassignBtnText}>Unassign</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noTeacherRow}>
              <View style={styles.noTeacherIcon}>
                <Ionicons name="person-add-outline" size={22} color={MUTED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noTeacherTitle}>No teacher assigned</Text>
                <Text style={styles.noTeacherSub}>Assign a teacher to start tracking progress</Text>
              </View>
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => {
                  if (availableTeachers.length === 0) {
                    Alert.alert('No Available Teachers', 'All teachers are at full capacity.');
                    return;
                  }
                  setAssignModalVisible(true);
                }}
                disabled={assigning}
                activeOpacity={0.85}
              >
                <Text style={styles.assignBtnText}>{assigning ? 'Assigning…' : 'Assign'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Personal + Contact side by side ── */}
        <View style={styles.infoRow2Col}>
          <View style={{ flex: 1 }}>
            <SectionCard title="Personal Information" icon="person-outline" accent={PURPLE}>
              <InfoRow icon="calendar-outline" label="Date of Birth"  value={formatDate(student.date_of_birth)} accent={PURPLE} />
              <InfoRow icon="medical-outline"  label="Disability"     value={student.disability}      accent={AMBER} />
              <InfoRow icon="home-outline"     label="Address"        value={student.address}         accent={BLUE} />
              <InfoRow icon="heart-outline"    label="Marital Status" value={student.marital_status}  accent={CORAL} last />
            </SectionCard>
          </View>
          <View style={{ flex: 1 }}>
            <SectionCard title="Contact Information" icon="call-outline" accent={BLUE}>
              <InfoRow icon="person-outline"         label="Father's Name" value={student.father_name}   accent={BLUE} />
              <InfoRow icon="person-outline"         label="Mother's Name" value={student.mother_name}   accent={BLUE} />
              <InfoRow icon="phone-portrait-outline" label="Mobile"        value={student.mobile_number} accent={GREEN} />
              <InfoRow icon="call-outline"           label="Home"          value={student.home_number}   accent={PURPLE} last />
            </SectionCard>
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Unassign confirmation ── */}
      <ConfirmDialog
        visible={unassignVisible}
        danger
        icon="person-remove-outline"
        title="Unassign Teacher"
        message={`Remove ${student.teacher?.full_name} from ${student.full_name}?\nThe student will become unassigned.`}
        confirmLabel="Unassign"
        cancelLabel="Cancel"
        onConfirm={() => { setUnassignVisible(false); doAssign(null); }}
        onCancel={() => setUnassignVisible(false)}
      />

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        visible={confirmVisible}
        danger
        icon="trash-outline"
        title="Delete Student"
        message={`Remove ${student.full_name} from the system?\nThis action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />

      {/* ── Assign teacher dialog ── */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setAssignModalVisible(false); setModalSearch(''); }}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => { setAssignModalVisible(false); setModalSearch(''); }}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>

            {/* ── Dialog header strip ── */}
            <View style={styles.modalTopStrip}>
              <View style={styles.modalIconBox}>
                <Ionicons name="person-add-outline" size={20} color={SURFACE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Assign Teacher</Text>
                <Text style={styles.modalSub} numberOfLines={1}>
                  Selecting for <Text style={styles.modalSubBold}>{student.full_name}</Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setAssignModalVisible(false); setModalSearch(''); }}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* ── Body ── */}
            <View style={styles.modalBody}>

              {/* search */}
              <View style={styles.modalSearchWrap}>
                <Ionicons name="search-outline" size={15} color={MUTED} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search teachers…"
                  placeholderTextColor={MUTED}
                  value={modalSearch}
                  onChangeText={setModalSearch}
                  autoCapitalize="none"
                />
                {modalSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setModalSearch('')} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={15} color={MUTED} />
                  </TouchableOpacity>
                )}
              </View>

              {/* count */}
              <Text style={styles.modalCountLabel}>
                {filteredModalTeachers.length} teacher{filteredModalTeachers.length !== 1 ? 's' : ''} available
              </Text>

              <FlatList
                data={filteredModalTeachers}
                keyExtractor={(t) => String(t.tid)}
                style={styles.teacherList}
                contentContainerStyle={{ paddingBottom: 4 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item: t }) => {
                  const count = t.students?.length ?? 0;
                  const dotColor = count >= 4 ? AMBER : GREEN;
                  return (
                    <View style={styles.teacherPickRow}>
                      <Avatar name={t.full_name} uri={t.profile_photo_url} size={44} />
                      <View style={styles.teacherPickInfo}>
                        <Text style={styles.teacherPickName}>{t.full_name}</Text>
                        <Text style={styles.teacherPickCode}>{t.teacher_code}</Text>
                        <View style={styles.slotDotRow}>
                          {[0, 1, 2, 3, 4].map((i) => (
                            <View key={i} style={[styles.slotDot, { backgroundColor: i < count ? dotColor : BORDER }]} />
                          ))}
                          <Text style={[styles.slotLabel, { color: dotColor }]}>{count}/5 slots used</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.selectBtn}
                        activeOpacity={0.85}
                        onPress={() => { setAssignModalVisible(false); setModalSearch(''); doAssign(t.tid); }}
                      >
                        <Text style={styles.selectBtnText}>Select</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyPick}>
                    <View style={styles.emptyPickIcon}>
                      <Ionicons name="people-outline" size={28} color={MUTED} />
                    </View>
                    <Text style={styles.emptyPickTitle}>No teachers found</Text>
                    <Text style={styles.emptyPickSub}>
                      {modalSearch ? 'Try a different search term.' : 'All teachers are at full capacity.'}
                    </Text>
                  </View>
                }
              />
            </View>

          </View>
        </TouchableOpacity>
      </Modal>

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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbParent: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: MUTED,
  },
  breadcrumbCurrent: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: TEXT,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    padding: 16,
    gap: 12,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: DARK,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroInner: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 10,
  },
  heroName: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: SURFACE,
    textAlign: 'center',
    marginTop: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  codeTag: {
    backgroundColor: PURPLE,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  codeTagText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: SURFACE,
    letterSpacing: 0.5,
  },
  disabilityTag: {
    backgroundColor: 'rgba(240,169,64,0.20)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(240,169,64,0.35)',
  },
  disabilityTagText: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: AMBER,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeaderIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  cardDivider: {
    height: 1,
    backgroundColor: BORDER,
  },

  // ── Teacher assignment ────────────────────────────────────────────────────
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN_L,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  assignedDot: { width: 6, height: 6, borderRadius: 3 },
  assignedBadgeText: { fontSize: 11, fontFamily: 'Nunito_700Bold' },

  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  teacherInfo: { flex: 1 },
  teacherName: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  teacherCode: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: MUTED,
    marginTop: 2,
  },
  unassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CORAL_L,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unassignBtnText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: CORAL,
  },

  noTeacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  noTeacherIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: BODY_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  noTeacherTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  noTeacherSub: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: MUTED,
    marginTop: 2,
  },
  assignBtn: {
    backgroundColor: DARK,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  assignBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: SURFACE,
  },

  // ── Two-column info layout ────────────────────────────────────────────────
  infoRow2Col: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },

  // ── Info rows ─────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoIconBox: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: 10,
    fontFamily: 'Nunito_600SemiBold',
    color: MUTED,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  rowDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 60,
  },

  // ── Hero action buttons ───────────────────────────────────────────────────
  heroBtnRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
  },
  heroEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E88E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroEditBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: SURFACE,
  },
  heroDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E53935',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroDeleteBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: SURFACE,
  },

  // ── Assign dialog ─────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalSheet: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.20,
    shadowRadius: 48,
    elevation: 20,
    overflow: 'hidden',
  },
  modalTopStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DARK,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
    color: SURFACE,
  },
  modalSub: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  modalSubBold: {
    fontFamily: 'Nunito_700Bold',
    color: 'rgba(255,255,255,0.90)',
  },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: BODY_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: TEXT,
    paddingVertical: 0,
  },
  modalCountLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: MUTED,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  teacherList: { flexGrow: 0 },
  teacherPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  teacherPickInfo: { flex: 1 },
  teacherPickName: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  teacherPickCode: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: MUTED,
    marginTop: 2,
  },
  slotDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  slotDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  slotLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    marginLeft: 2,
  },
  selectBtn: {
    backgroundColor: DARK,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexShrink: 0,
  },
  selectBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: SURFACE,
  },
  emptyPick: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 40,
  },
  emptyPickIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: BODY_BG,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyPickTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  emptyPickSub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: MUTED,
  },
});
