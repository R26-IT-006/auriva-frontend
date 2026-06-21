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

// ── palette (matches dashboard) ──────────────────────────────────────────────
const DARK      = '#0F2F3E';
const GREEN     = '#3EBF78';
const GREEN_L   = '#E0F7EC';
const BLUE      = '#4A8FD8';
const BLUE_L    = '#DEEAF8';
const PURPLE    = '#7B68C8';
const PURPLE_L  = '#EEEBF8';
const AMBER     = '#F0A940';
const AMBER_L   = '#FDF0D6';
const CORAL     = '#D95F50';
const CORAL_L   = '#FDECEA';
const BODY_BG   = '#F2F5F8';
const SURFACE   = '#FFFFFF';
const TEXT      = '#1A2E3B';
const MUTED     = '#8A93A8';
const BORDER    = '#E8EEF4';
const TABLE_HDR = '#1A3A4A';

const COLS = [
  { key: 'photo',    label: '',          flex: 0.55 },
  { key: 'code',     label: 'ID',        flex: 1.1  },
  { key: 'name',     label: 'Full Name', flex: 2.0  },
  { key: 'email',    label: 'Email',     flex: 2.2  },
  { key: 'students', label: 'Students',  flex: 1.0  },
  { key: 'status',   label: 'Status',    flex: 1.0  },
  { key: 'actions',  label: 'Actions',   flex: 1.4  },
];

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TableHeader() {
  return (
    <View style={styles.tableHeader}>
      {COLS.map((col) => (
        <Text
          key={col.key}
          style={[
            styles.headerCell,
            { flex: col.flex },
            (col.key === 'name' || col.key === 'email') && { textAlign: 'left' },
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

function TableRow({ teacher, index, onView, onEdit, onDelete }) {
  const isActive = !teacher.is_first_login;
  const count    = teacher.students?.length ?? 0;
  const isFull   = count >= 3;
  const dotColor = isFull ? CORAL : count > 0 ? AMBER : GREEN;

  return (
    <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
      {/* Avatar */}
      <View style={[styles.cell, { flex: COLS[0].flex, justifyContent: 'center' }]}>
        <Avatar name={teacher.full_name} uri={teacher.profile_photo_url} size={36} />
      </View>

      {/* ID */}
      <View style={[styles.cell, { flex: COLS[1].flex, justifyContent: 'center' }]}>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{teacher.teacher_code}</Text>
        </View>
      </View>

      {/* Name */}
      <View style={[styles.cell, { flex: COLS[2].flex }]}>
        <Text style={styles.nameText} numberOfLines={1}>{teacher.full_name}</Text>
      </View>

      {/* Email */}
      <View style={[styles.cell, { flex: COLS[3].flex }]}>
        <Text style={styles.emailText} numberOfLines={1}>{teacher.email || '—'}</Text>
      </View>

      {/* Students */}
      <View style={[styles.cell, { flex: COLS[4].flex, flexDirection: 'column', alignItems: 'center', gap: 3 }]}>
        <Text style={[styles.capCount, { color: dotColor }]}>{count}/3</Text>
        <View style={styles.dotRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < count ? dotColor : BORDER }]} />
          ))}
        </View>
      </View>

      {/* Status */}
      <View style={[styles.cell, { flex: COLS[5].flex, justifyContent: 'center' }]}>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? GREEN_L : AMBER_L }]}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? GREEN : AMBER }]} />
          <Text style={[styles.statusText, { color: isActive ? GREEN : AMBER }]}>
            {isActive ? 'Active' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={[styles.cell, { flex: COLS[6].flex, justifyContent: 'center', gap: 6 }]}>
        <ActionBtn
          icon="eye-outline"
          color={PURPLE}
          bg={PURPLE_L}
          onPress={onView}
        />
        <ActionBtn
          icon="create-outline"
          color={BLUE}
          bg={BLUE_L}
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
export default function TeacherListScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [teachers,     setTeachers]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const PAGE_SIZE = 8;

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
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      [t.full_name, t.teacher_code, t.email].some((v) => v?.toLowerCase().includes(q))
    );
  }, [teachers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await principalApi.deleteTeacher(deleteTarget.tid);
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
          <Text style={styles.pageTitle}>Faculty</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{teachers.length}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateTeacher')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color={SURFACE} />
          <Text style={styles.addBtnText}>Add Teacher</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter bar ── */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={MUTED} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, ID or email…"
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
          keyExtractor={(t) => String(t.tid)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loading}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={GREEN}
            />
          }
          renderItem={({ item, index }) => (
            <TableRow
              teacher={item}
              index={index}
              onView={() => navigation.navigate('TeacherDetail', { teacher: item })}
              onEdit={() => navigation.navigate('EditTeacher', { teacher: item })}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="people-outline"
                title="No teachers found"
                message={
                  search
                    ? 'Try adjusting your search.'
                    : 'Add your first teacher to get started.'
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
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} teachers
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
        title="Delete Teacher"
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
    backgroundColor: GREEN,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: TEXT,
  },
  countBadge: {
    backgroundColor: BLUE_L,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: BLUE,
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
    backgroundColor: BLUE_L,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: BLUE,
    letterSpacing: 0.3,
  },
  nameText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: TEXT,
  },
  emailText: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: MUTED,
  },
  capCount: {
    fontSize: 13,
    fontFamily: 'Nunito_800ExtraBold',
  },
  dotRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Nunito_700Bold' },

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
