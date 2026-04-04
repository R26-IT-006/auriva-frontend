import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { EmptyState } from '../../../components/common/EmptyState';
import { Breadcrumb } from '../../../components/common/Breadcrumb';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { principalApi } from '../../../api/principal';

const K = {
  purple:     '#8A80BC',
  purpleLight:'#EFEDF8',
  teal:       '#4AADA3',
  tealLight:  '#E8F6F5',
  amber:      '#C9973A',
  amberLight: '#FBF4E6',
  green:      '#5BAF85',
  greenLight: '#EAF6F1',
  bg:         '#F2F1F8',
};

const ACCENT_ACTIVE  = { bg: K.tealLight,  color: K.teal  };
const ACCENT_PENDING = { bg: K.amberLight, color: K.amber };

// Filter definitions
const STATUS_FILTERS   = ['All', 'Active', 'Pending'];
const CAPACITY_FILTERS = ['All', 'Available', 'Full'];

function FilterChip({ label, active, color, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        active && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TeacherCard({ teacher, onPress }) {
  const studentCount = teacher.students?.length ?? 0;
  const isActive     = !teacher.is_first_login;
  const accent       = isActive ? ACCENT_ACTIVE : ACCENT_PENDING;
  const fillCount    = Math.min(studentCount, 3);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={styles.card}>
      <View style={[styles.cardStrip, { backgroundColor: accent.color }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardAvatarRow}>
          <View style={[styles.cardAvatarWrap, { borderColor: accent.color }]}>
            <Avatar name={teacher.full_name} uri={teacher.profile_photo_url} size={52} />
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? K.tealLight : K.amberLight }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? K.teal : K.amber }]} />
            <Text style={[styles.statusText, { color: isActive ? K.teal : K.amber }]}>
              {isActive ? 'Active' : 'Pending'}
            </Text>
          </View>
        </View>

        <Text style={styles.cardName} numberOfLines={1}>{teacher.full_name}</Text>
        <View style={styles.cardCodeRow}>
          <View style={[styles.codePill, { backgroundColor: accent.bg }]}>
            <Text style={[styles.codeText, { color: accent.color }]}>{teacher.teacher_code}</Text>
          </View>
        </View>
        <Text style={styles.cardEmail} numberOfLines={1}>{teacher.email}</Text>

        <View style={styles.capacityRow}>
          <Text style={styles.capacityLabel}>Students</Text>
          <Text style={[styles.capacityCount, { color: accent.color }]}>{studentCount}/3</Text>
        </View>
        <View style={styles.capacityBar}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.capacitySegment,
                { backgroundColor: i < fillCount ? accent.color : Colors.borderLight },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: Colors.borderLight }]}>
        <Text style={[styles.cardFooterText, { color: accent.color }]}>View Profile</Text>
        <Ionicons name="arrow-forward" size={14} color={accent.color} />
      </View>
    </TouchableOpacity>
  );
}

export default function TeacherListScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns  = isLandscape ? 3 : 2;

  const [teachers, setTeachers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter]     = useState('All');
  const [capacityFilter, setCapacityFilter] = useState('All');

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
    return teachers.filter((t) => {
      // Search: name, code, email
      const q = search.trim().toLowerCase();
      if (q && ![t.full_name, t.teacher_code, t.email].some((v) => v?.toLowerCase().includes(q))) {
        return false;
      }
      // Status filter
      if (statusFilter === 'Active'  &&  t.is_first_login) return false;
      if (statusFilter === 'Pending' && !t.is_first_login) return false;
      // Capacity filter
      const count = t.students?.length ?? 0;
      if (capacityFilter === 'Full'      && count < 3) return false;
      if (capacityFilter === 'Available' && count >= 3) return false;

      return true;
    });
  }, [teachers, search, statusFilter, capacityFilter]);

  const ListHeader = (
    <View style={styles.listHeader}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.icon.default} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, code or email…"
          placeholderTextColor={Colors.text.muted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={17} color={Colors.icon.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filters */}
      <View style={styles.filterRow}>
        <Ionicons name="person-outline" size={14} color={Colors.text.muted} style={styles.filterIcon} />
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f}
            label={f}
            active={statusFilter === f}
            color={f === 'Active' ? K.teal : f === 'Pending' ? K.amber : K.purple}
            onPress={() => setStatusFilter(f)}
          />
        ))}
      </View>

      {/* Capacity filters */}
      <View style={styles.filterRow}>
        <Ionicons name="people-outline" size={14} color={Colors.text.muted} style={styles.filterIcon} />
        {CAPACITY_FILTERS.map((f) => (
          <FilterChip
            key={f}
            label={f === 'Available' ? 'Slots Available' : f === 'Full' ? 'Slots Full' : f}
            active={capacityFilter === f}
            color={f === 'Available' ? K.green : f === 'Full' ? K.amber : K.purple}
            onPress={() => setCapacityFilter(f)}
          />
        ))}
      </View>

      {/* Result count */}
      {(search || statusFilter !== 'All' || capacityFilter !== 'All') && (
        <Text style={styles.resultCount}>
          {filtered.length} teacher{filtered.length !== 1 ? 's' : ''} found
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Breadcrumb crumbs={[{ label: 'Teachers' }]} title="Teachers" />
      <FlatList
        key={numColumns}
        data={filtered}
        keyExtractor={(t) => String(t.tid)}
        numColumns={numColumns}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={K.purple}
          />
        }
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <View style={styles.columnItem}>
            <TeacherCard
              teacher={item}
              onPress={() => navigation.navigate('TeacherDetail', { teacher: item })}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="people-outline"
              title="No teachers found"
              message={
                search || statusFilter !== 'All' || capacityFilter !== 'All'
                  ? 'Try adjusting your search or filters.'
                  : 'Add your first teacher to get started.'
              }
            />
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateTeacher')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: K.bg },
  list: { padding: Layout.spacing.md, paddingBottom: 90, flexGrow: 1 },
  columnWrapper: { gap: Layout.spacing.sm, marginBottom: Layout.spacing.sm },
  columnItem: { flex: 1 },

  // List header
  listHeader: {
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.md,
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    gap: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.primary,
    paddingVertical: 2,
  },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    flexWrap: 'wrap',
  },
  filterIcon: {
    marginRight: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipText: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Result count
  resultCount: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontWeight: Layout.fontWeight.medium,
    marginLeft: 2,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  cardStrip: { height: 6, width: '100%' },
  cardBody: { padding: Layout.spacing.md, gap: 6 },
  cardAvatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardAvatarWrap: { borderRadius: 30, borderWidth: 2.5, padding: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: Layout.fontWeight.bold },
  cardName: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.bold, color: Colors.text.primary },
  cardCodeRow: { flexDirection: 'row' },
  codePill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  codeText: { fontSize: Layout.fontSize.xs, fontWeight: Layout.fontWeight.bold, letterSpacing: 0.4 },
  cardEmail: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
  capacityRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 4,
  },
  capacityLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, fontWeight: Layout.fontWeight.medium },
  capacityCount: { fontSize: Layout.fontSize.xs, fontWeight: Layout.fontWeight.bold },
  capacityBar: { flexDirection: 'row', gap: 4 },
  capacitySegment: { flex: 1, height: 5, borderRadius: 3 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', gap: 4,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderTopWidth: 1,
  },
  cardFooterText: { fontSize: Layout.fontSize.xs, fontWeight: Layout.fontWeight.semibold },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Layout.spacing.xl,
    right: Layout.spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: K.purple,
    alignItems: 'center', justifyContent: 'center',
    ...Layout.shadow.lg,
  },
});
