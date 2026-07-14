import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { principalApi } from '../../../api/principal';

// ── palette (matches dashboard + teacher list) ────────────────────────────────
const DARK      = '#0F2F3E';
const GREEN     = '#3EBF78';
const GREEN_L   = '#E0F7EC';
const PURPLE    = '#7B68C8';
const PURPLE_L  = '#EEEBF8';
const AMBER     = '#F0A940';
const CORAL     = '#D95F50';
const CORAL_L   = '#FDECEA';
const BODY_BG   = '#F2F5F8';
const SURFACE   = '#FFFFFF';
const TEXT      = '#1A2E3B';
const MUTED     = '#8A93A8';
const BORDER    = '#E8EEF4';
const TABLE_HDR = '#1A3A4A';

const COLS = [
  { key: 'photo',   label: '',            flex: 0.55 },
  { key: 'code',    label: 'ID',          flex: 1.1  },
  { key: 'name',    label: 'Full Name',   flex: 2.0  },
  { key: 'contact', label: 'Contact',     flex: 1.5  },
  { key: 'teacher', label: 'Assigned To', flex: 1.8  },
  { key: 'actions', label: 'Actions',     flex: 1.4  },
];

// ── Subcomponents ─────────────────────────────────────────────────────────────

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TableHeader() {
  return (
    <View style={styles.tableHeader}>
      {COLS.map((col) => (
        <Text
          key={col.key}
          style={[
            styles.headerCell,
            { flex: col.flex },
            (col.key === 'name' || col.key === 'contact' || col.key === 'dob') && { textAlign: 'left' },
            col.key === 'actions' && { textAlign: 'center' },
          ]}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

function ActionBtn({ icon, color, bg, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.actionBtn, { backgroundColor: bg }]}
    >
      <Ionicons name={icon} size={14} color={color} />
    </TouchableOpacity>
  );
}

function TableRow({ student, index, onView, onEdit, onDelete }) {
  return (
    <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
      {/* Avatar */}
      <View style={[styles.cell, { flex: COLS[0].flex, justifyContent: 'center' }]}>
        <Avatar name={student.full_name} uri={student.profile_photo_url} size={36} />
      </View>

      {/* ID */}
      <View style={[styles.cell, { flex: COLS[1].flex, justifyContent: 'center' }]}>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{student.student_code}</Text>
        </View>
      </View>

      {/* Name */}
      <View style={[styles.cell, { flex: COLS[2].flex }]}>
        <Text style={styles.nameText} numberOfLines={1}>{student.full_name}</Text>
      </View>

      {/* Contact */}
      <View style={[styles.cell, { flex: COLS[3].flex }]}>
        <Text style={styles.mutedText} numberOfLines={1}>
          {student.mobile_number || '—'}
        </Text>
      </View>

      {/* Assigned To */}
      <View style={[styles.cell, { flex: COLS[4].flex }]}>
        {student.teacher ? (
          <Text style={styles.mutedText} numberOfLines={1}>{student.teacher.full_name}</Text>
        ) : (
          <Text style={styles.unassignedText}>Unassigned</Text>
        )}
      </View>

      {/* Actions */}
      <View style={[styles.cell, { flex: COLS[5].flex, justifyContent: 'center', gap: 6 }]}>
        <ActionBtn
          icon="eye-outline"
          color={PURPLE}
          bg={PURPLE_L}
          onPress={onView}
        />
        <ActionBtn
          icon="create-outline"
          color="#4A8FD8"
          bg="#DEEAF8"
          onPress={onEdit}
        />
        <ActionBtn
          icon="trash-outline"
          color={CORAL}
          bg={CORAL_L}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function StudentListScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const PAGE_SIZE = 8;

  const load = useCallback(async () => {
    try {
      const data = await principalApi.getStudents();
      setStudents(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const filtered = useMemo(() => {
    setPage(1);
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.full_name, s.student_code, s.mobile_number].some((v) => v?.toLowerCase().includes(q))
    );
  }, [students, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await principalApi.deleteStudent(deleteTarget.sid);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteTarget(null);
      Alert.alert('Error', err.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <View style={styles.titleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.pageTitle}>Students</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{students.length}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateStudent')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color={SURFACE} />
          <Text style={styles.addBtnText}>Add Student</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter bar ── */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={MUTED} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, ID or contact…"
            placeholderTextColor={MUTED}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={15} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Table ── */}
      <View style={styles.tableWrap}>
        <TableHeader />

        <FlatList
          data={paginated}
          keyExtractor={(s) => String(s.sid)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loading}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={GREEN}
            />
          }
          renderItem={({ item, index }) => (
            <TableRow
              student={item}
              index={index}
              onView={() => navigation.navigate('StudentDetail', { student: item })}
              onEdit={() => navigation.navigate('EditStudent', { student: item })}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="school-outline"
                title="No students found"
                message={
                  search
                    ? 'Try adjusting your search.'
                    : 'Add your first student to get started.'
                }
              />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />

        {/* ── Pagination ── */}
        {filtered.length > 0 && (
          <View style={styles.pagination}>
            <Text style={styles.pageInfo}>
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} students
            </Text>
            <View style={styles.pageControls}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[styles.pageArrow, page === 1 && { opacity: 0.35 }]}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={14} color={TEXT} />
              </TouchableOpacity>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '…' ? (
                    <Text key={`el-${idx}`} style={styles.pageEllipsis}>…</Text>
                  ) : (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPage(p)}
                      style={[styles.pageBtn, page === p && styles.pageBtnActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pageBtnTxt, page === p && styles.pageBtnTxtActive]}>{p}</Text>
                    </TouchableOpacity>
                  )
                )}

              <TouchableOpacity
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={[styles.pageArrow, page === totalPages && { opacity: 0.35 }]}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={14} color={TEXT} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <ConfirmDialog
        visible={!!deleteTarget}
        danger
        icon="trash-outline"
        title="Delete Student"
        message={`Remove ${deleteTarget?.full_name} from the system?\nThis action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
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
    justifyContent: 'space-between',
    backgroundColor: SURFACE,
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionBar: {
    width: 3, height: 20, borderRadius: 2,
    backgroundColor: PURPLE,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: TEXT,
  },
  countBadge: {
    backgroundColor: PURPLE_L,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: PURPLE,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DARK,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: SURFACE,
  },

  // ── Filter bar ────────────────────────────────────────────────────────────
  filterBar: {
    backgroundColor: SURFACE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BODY_BG,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: TEXT,
    paddingVertical: 0,
  },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableWrap: {
    flex: 1,
    backgroundColor: SURFACE,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TABLE_HDR,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  headerCell: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE,
  },
  tableRowAlt: { backgroundColor: '#FAFBFC' },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },

  // ── Cell content ──────────────────────────────────────────────────────────
  codePill: {
    backgroundColor: PURPLE_L,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: PURPLE,
    letterSpacing: 0.3,
  },
  nameText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  mutedText: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: MUTED,
  },

  // ── Action buttons ────────────────────────────────────────────────────────
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Pagination ────────────────────────────────────────────────────────────
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  pageInfo: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: MUTED,
  },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageArrow: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BODY_BG,
    borderWidth: 1, borderColor: BORDER,
  },
  pageBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BODY_BG,
    borderWidth: 1, borderColor: BORDER,
  },
  pageBtnActive:    { backgroundColor: DARK, borderColor: DARK },
  pageBtnTxt:       { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: MUTED },
  pageBtnTxtActive: { color: SURFACE },
  pageEllipsis:     { fontSize: 12, color: MUTED, paddingHorizontal: 2 },
});
