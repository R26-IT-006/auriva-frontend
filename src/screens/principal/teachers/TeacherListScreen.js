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
  navy:       '#1B3A5C',
  teal:       '#2E9CBB',
  tealLight:  '#E4F4FA',
  amber:      '#C9973A',
  amberLight: '#FBF4E6',
  green:      '#27A96C',
  greenLight: '#E3F7EE',
  coral:      '#E05C48',
  coralLight: '#FDF0EE',
  headerBg:   '#0F3D2E',
  rowAlt:     '#F5F8FC',
  bg:         '#EFF3F8',
};

const STATUS_FILTERS = ['All Teachers', 'Active', 'Pending'];

const COLS = [
  { key: 'photo',    label: 'Profile',    flex: 0.7 },
  { key: 'code',     label: 'ID',         flex: 1.1 },
  { key: 'name',     label: 'Full Name',  flex: 1.8 },
  { key: 'email',    label: 'Email',      flex: 2.0 },
  { key: 'students', label: 'Students',   flex: 0.9 },
  { key: 'status',   label: 'Status',     flex: 0.9 },
  { key: 'action',   label: '',           flex: 0.4 },
];

function TableHeader() {
  const leftAligned = ['name', 'email'];
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

function TableRow({ teacher, onPress }) {
  const isActive = !teacher.is_first_login;
  const count    = teacher.students?.length ?? 0;
  const isFull   = count >= 3;
  const capColor = isFull ? K.coral : count > 0 ? K.amber : K.green;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tableRow}
    >
      {/* Avatar */}
      <View style={[styles.cell, { flex: COLS[0].flex, justifyContent: 'center' }]}>
        <Avatar name={teacher.full_name} uri={teacher.profile_photo_url} size={44} />
      </View>

      {/* ID */}
      <View style={[styles.cell, { flex: COLS[1].flex, justifyContent: 'center' }]}>
        <Text style={styles.codeText}>{teacher.teacher_code}</Text>
      </View>

      {/* Full Name */}
      <View style={[styles.cell, { flex: COLS[2].flex }]}>
        <Text style={styles.nameText} numberOfLines={1}>{teacher.full_name}</Text>
      </View>

      {/* Email */}
      <View style={[styles.cell, { flex: COLS[3].flex }]}>
        <Text style={styles.nameSubText} numberOfLines={1}>{teacher.email || '—'}</Text>
      </View>

      {/* Students capacity */}
      <View style={[styles.cell, { flex: COLS[4].flex, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }]}>
        <Text style={[styles.capacityCount, { color: capColor }]}>{count}/3</Text>
        <View style={styles.capacityDots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.capacityDot,
                { backgroundColor: i < count ? capColor : '#E0E0E0' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Status badge */}
      <View style={[styles.cell, { flex: COLS[5].flex, justifyContent: 'center' }]}>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? K.green : K.amber }]}>
          <Text style={styles.statusLabel}>
            {isActive ? 'Active' : 'Pending'}
          </Text>
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

export default function TeacherListScreen({ navigation }) {
  const [teachers,      setTeachers]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [statusFilter,   setStatusFilter]   = useState('All Teachers');
  const [capacityFilter, setCapacityFilter] = useState('All');
  const [page,          setPage]          = useState(1);
  const PAGE_SIZE = 6;

  const load = useCallback(async () => {
    try {
      const data = await principalApi.getTeachers();
      setTeachers(data);
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
    return teachers.filter((t) => {
      const q = search.trim().toLowerCase();
      if (q && ![t.full_name, t.teacher_code, t.email].some((v) => v?.toLowerCase().includes(q))) return false;
      if (statusFilter === 'Active'   &&  t.is_first_login) return false;
      if (statusFilter === 'Pending'  && !t.is_first_login) return false;
      if (statusFilter === 'Archived' && !t.is_archived)    return false;
      const count = t.students?.length ?? 0;
      if (capacityFilter === 'Available' && count >= 3) return false;
      if (capacityFilter === 'Full'      && count < 3)  return false;
      return true;
    });
  }, [teachers, search, statusFilter, capacityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Teachers</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{teachers.length}</Text>
          </View>
        </View>
      </View>

      {/* ── Search + Filter row ── */}
      <View style={styles.filterBar}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, ID, or subject…"
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

        {/* Tab chips */}
        <View style={styles.tabRow}>
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f}
              label={f}
              active={statusFilter === f}
              onPress={() => setStatusFilter(f)}
            />
          ))}
        </View>

        {/* Capacity filter tabs */}
        <View style={styles.tabRow}>
          {['All', 'Available', 'Full'].map((f) => (
            <FilterChip
              key={f}
              label={f === 'All' ? 'All Slots' : f === 'Available' ? 'Slots Available' : 'Slots Full'}
              active={capacityFilter === f}
              onPress={() => setCapacityFilter(f)}
            />
          ))}
        </View>

        {/* Add button — right-aligned */}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateTeacher')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add a teacher</Text>
        </TouchableOpacity>
      </View>

      {/* ── Table ── */}
      <View style={styles.tableContainer}>
        <TableHeader />

        <FlatList
          data={paginated}
          keyExtractor={(t) => String(t.tid)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loading}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={K.teal}
            />
          }
          renderItem={({ item }) => (
            <TableRow
              teacher={item}
              onPress={() => navigation.navigate('TeacherDetail', { teacher: item })}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="people-outline"
                title="No teachers found"
                message={
                  search || statusFilter !== 'All Teachers'
                    ? 'Try adjusting your search or filters.'
                    : 'Add your first teacher to get started.'
                }
              />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />

        {/* ── Pagination footer ── */}
        {filtered.length > 0 && (
          <View style={styles.pagination}>
            <Text style={styles.paginationInfo}>
              SHOWING {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} OF {filtered.length} TEACHER{filtered.length !== 1 ? 'S' : ''}
            </Text>
            <View style={styles.pageControls}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[styles.pageArrow, page === 1 && styles.pageArrowDisabled]}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={14} color={page === 1 ? '#CCC' : K.navy} />
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
                <Ionicons name="chevron-forward" size={14} color={page === totalPages ? '#CCC' : K.navy} />
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

  // ── Top bar ────────────────────────────────────────────────
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
  pageTitle: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_900Black',
    color: Colors.text.primary,
  },
  countBadge: {
    backgroundColor: K.teal,
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#FFF' },

  // ── Filter bar ─────────────────────────────────────────────
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
  chipActive: {
    backgroundColor: '#FFF',
  },
  chipText:       { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: Colors.text.secondary },
  chipTextActive: { color: Colors.text.primary, fontFamily: 'Nunito_700Bold' },
  resultCount:    { fontSize: 11, color: Colors.text.muted, marginLeft: 4 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F3D2E',
    borderRadius: 10,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 9,
  },
  addBtnText: { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: '#FFF' },

  // ── Table ──────────────────────────────────────────────────
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
  tableRowAlt: { backgroundColor: '#FFF' },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },

  avatarWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E8EDF2',
  },

  codePill: {
    backgroundColor: K.tealLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: K.teal,
    letterSpacing: 0.3,
  },
  nameText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
  },
  nameSubText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    marginTop: 2,
  },
  mutedText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
  },

  // Capacity
  capacityCount: { fontSize: 13, fontFamily: 'Nunito_800ExtraBold' },
  capacityDots: { flexDirection: 'row', gap: 5 },
  capacityDot: { width: 12, height: 12, borderRadius: 6 },

  // Status badge
  statusBadge: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  statusLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#FFF', paddingVertical: 5 },

  // ── Pagination ─────────────────────────────────────────────
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  paginationInfo: {
    fontSize: 10,
    fontFamily: 'Nunito_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
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
  pageBtnActive: {
    backgroundColor: K.navy,
    borderColor: K.navy,
  },
  pageBtnText:       { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: Colors.text.secondary },
  pageBtnTextActive: { color: '#FFF' },
  pageEllipsis: { fontSize: 12, color: Colors.text.muted, paddingHorizontal: 2 },
});