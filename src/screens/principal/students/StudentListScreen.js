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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { principalApi } from '../../../api/principal';

const K = {
  green:      '#27A96C',
  greenLight: '#E3F7EE',
  amber:      '#C9973A',
  amberLight: '#FBF4E6',
  teal:       '#2E9CBB',
  tealLight:  '#E4F4FA',
  coral:      '#E05C48',
  headerBg:   '#0F3D2E',
  bg:         '#EFF3F8',
};

const ASSIGN_FILTERS = ['All Students', 'Assigned', 'Unassigned'];

const COLS = [
  { key: 'photo',   label: 'Profile',   flex: 0.7 },
  { key: 'code',    label: 'ID',        flex: 1.1 },
  { key: 'name',    label: 'Full Name', flex: 1.8 },
  { key: 'contact', label: 'Contact',   flex: 1.5 },
  { key: 'teacher', label: 'Teacher',   flex: 1.8 },
  { key: 'status',  label: 'Status',    flex: 0.9 },
  { key: 'action',  label: '',          flex: 0.4 },
];

function TableHeader() {
  const leftAligned = ['name', 'contact', 'teacher'];
  return (
    <View style={styles.tableHeader}>
      {COLS.map((col) => (
        <Text
          key={col.key}
          style={[
            styles.headerCell,
            { flex: col.flex },
            leftAligned.includes(col.key) && { textAlign: 'left' },
          ]}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

function TableRow({ student, onPress }) {
  const isAssigned = !!student.teacher;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tableRow}
    >
      {/* Profile */}
      <View style={[styles.cell, { flex: COLS[0].flex, justifyContent: 'center' }]}>
        <Avatar name={student.full_name} uri={student.profile_photo_url} size={44} />
      </View>

      {/* ID */}
      <View style={[styles.cell, { flex: COLS[1].flex, justifyContent: 'center' }]}>
        <Text style={styles.codeText}>{student.student_code}</Text>
      </View>

      {/* Full Name */}
      <View style={[styles.cell, { flex: COLS[2].flex, flexDirection: 'column', alignItems: 'flex-start' }]}>
        <Text style={styles.nameText} numberOfLines={1}>{student.full_name}</Text>
      </View>

      {/* Contact */}
      <View style={[styles.cell, { flex: COLS[3].flex }]}>
        <Text style={styles.mutedText} numberOfLines={1}>{student.mobile_number || '—'}</Text>
      </View>

      {/* Teacher */}
      <View style={[styles.cell, { flex: COLS[4].flex, gap: 8 }]}>
        {student.teacher ? (
          <>
            <Avatar
              name={student.teacher.full_name}
              uri={student.teacher.profile_photo_url}
              size={28}
            />
            <Text style={styles.mutedText} numberOfLines={1}>{student.teacher.full_name}</Text>
          </>
        ) : (
          <Text style={styles.mutedText}>—</Text>
        )}
      </View>

      {/* Status badge */}
      <View style={[styles.cell, { flex: COLS[5].flex, justifyContent: 'center' }]}>
        <View style={[styles.statusBadge, { backgroundColor: isAssigned ? K.green : K.amber }]}>
          <Text style={styles.statusLabel}>{isAssigned ? 'Assigned' : 'Pending'}</Text>
        </View>
      </View>

      {/* Arrow */}
      <View style={[styles.cell, { flex: COLS[6].flex, justifyContent: 'center' }]}>
        <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
      </View>
    </TouchableOpacity>
  );
}

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

export default function StudentListScreen({ navigation }) {
  const [students,     setStudents]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [assignFilter, setAssignFilter] = useState('All Students');
  const [page,         setPage]         = useState(1);
  const PAGE_SIZE = 6;

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
    return students.filter((s) => {
      const q = search.trim().toLowerCase();
      if (q && ![s.full_name, s.student_code, s.mobile_number]
        .some((v) => v?.toLowerCase().includes(q))) return false;
      if (assignFilter === 'Assigned'   && !s.teacher) return false;
      if (assignFilter === 'Unassigned' &&  s.teacher) return false;
      return true;
    });
  }, [students, search, assignFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Students</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{students.length}</Text>
          </View>
        </View>
      </View>

      {/* ── Search + Filter row ── */}
      <View style={styles.filterBar}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, ID, or contact…"
            placeholderTextColor={Colors.text.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={15} color={Colors.icon.muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabRow}>
          {ASSIGN_FILTERS.map((f) => (
            <FilterChip
              key={f}
              label={f}
              active={assignFilter === f}
              onPress={() => setAssignFilter(f)}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateStudent')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add a student</Text>
        </TouchableOpacity>
      </View>

      {/* ── Table ── */}
      <View style={styles.tableContainer}>
        <TableHeader />

        <FlatList
          data={paginated}
          keyExtractor={(s) => String(s.sid)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loading}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={K.teal}
            />
          }
          renderItem={({ item }) => (
            <TableRow
              student={item}
              onPress={() => navigation.navigate('StudentDetail', { student: item })}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="school-outline"
                title="No students found"
                message={
                  search || assignFilter !== 'All Students'
                    ? 'Try adjusting your search or filters.'
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
            <Text style={styles.paginationInfo}>
              SHOWING {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} OF {filtered.length} STUDENT{filtered.length !== 1 ? 'S' : ''}
            </Text>
            <View style={styles.pageControls}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[styles.pageArrow, page === 1 && styles.pageArrowDisabled]}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={14} color={page === 1 ? '#CCC' : K.headerBg} />
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
                    <Text key={`ellipsis-${idx}`} style={styles.pageEllipsis}>…</Text>
                  ) : (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPage(p)}
                      style={[styles.pageBtn, page === p && styles.pageBtnActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pageBtnText, page === p && styles.pageBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  )
                )}

              <TouchableOpacity
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={[styles.pageArrow, page === totalPages && styles.pageArrowDisabled]}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={14} color={page === totalPages ? '#CCC' : K.headerBg} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },

  // ── Top bar ──────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { fontSize: Layout.fontSize.xl, fontFamily: 'Nunito_900Black', color: Colors.text.primary },
  countBadge: {
    backgroundColor: K.teal,
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#FFF' },

  // ── Filter bar ───────────────────────────────────────────────
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E8F0',
    borderRadius: Layout.radius.full,
    padding: 3,
    gap: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Layout.radius.full,
    backgroundColor: 'transparent',
  },
  chipActive:     { backgroundColor: '#FFF' },
  chipText:       { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: Colors.text.secondary },
  chipTextActive: { color: Colors.text.primary, fontFamily: 'Nunito_700Bold' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: K.headerBg,
    borderRadius: 10,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 9,
  },
  addBtnText: { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: '#FFF' },

  // ── Table ────────────────────────────────────────────────────
  tableContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    margin: Layout.spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: K.headerBg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
  },
  headerCell: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },

  codeText: { fontSize: 11, fontFamily: 'Nunito_700Bold', color: K.teal, letterSpacing: 0.3 },
  nameText: { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  mutedText: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary },

  statusBadge: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#FFF' },

  // ── Pagination ───────────────────────────────────────────────
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  paginationInfo: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: Colors.text.muted, letterSpacing: 0.5 },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageArrow: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  pageArrowDisabled: { opacity: 0.4 },
  pageBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  pageBtnActive:     { backgroundColor: K.headerBg, borderColor: K.headerBg },
  pageBtnText:       { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: Colors.text.secondary },
  pageBtnTextActive: { color: '#FFF' },
  pageEllipsis:      { fontSize: 12, color: Colors.text.muted, paddingHorizontal: 2 },
});