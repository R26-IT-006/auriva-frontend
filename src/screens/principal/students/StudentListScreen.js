import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, RefreshControl, StyleSheet, Alert, useWindowDimensions } from "react-native";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
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
  coral:      '#D97B6C',
  coralLight: '#FAF0EE',
  amber:      '#C9973A',
  amberLight: '#FBF4E6',
  green:      '#5BAF85',
  greenLight: '#EAF6F1',
  sky:        '#6AAFD4',
  skyLight:   '#EAF5FB',
  bg:         '#F2F1F8',
};

const ACCENT_ASSIGNED   = { bg: K.tealLight,  color: K.teal   };
const ACCENT_UNASSIGNED = { bg: K.coralLight, color: K.coral  };

const ASSIGN_FILTERS = ['All', 'Assigned', 'Unassigned'];

function FilterChip({ label, active, color, onPress }) {
  return (
    <ButtonFeedback
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </ButtonFeedback>
  );
}

function StudentCard({ student, onPress }) {
  const isAssigned = !!student.teacher;
  const accent     = isAssigned ? ACCENT_ASSIGNED : ACCENT_UNASSIGNED;

  return (
    <ButtonFeedback onPress={onPress} activeOpacity={0.82} style={styles.card}>
      <View style={[styles.cardStrip, { backgroundColor: accent.color }]} />

      <View style={styles.cardBody}>
        {/* Avatar + assignment badge */}
        <View style={styles.cardAvatarRow}>
          <View style={[styles.cardAvatarWrap, { borderColor: accent.color }]}>
            <Avatar name={student.full_name} uri={student.profile_photo_url} size={52} />
          </View>
          <View style={[styles.statusBadge, { backgroundColor: accent.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: accent.color }]} />
            <Text style={[styles.statusText, { color: accent.color }]}>
              {isAssigned ? 'Assigned' : 'Unassigned'}
            </Text>
          </View>
        </View>

        {/* Name & code */}
        <Text style={styles.cardName} numberOfLines={1}>{student.full_name}</Text>
        <View style={styles.cardCodeRow}>
          <View style={[styles.codePill, { backgroundColor: accent.bg }]}>
            <Text style={[styles.codeText, { color: accent.color }]}>{student.student_code}</Text>
          </View>
        </View>

        {/* Disability */}
        <View style={styles.disabilityRow}>
          <Ionicons name="medical-outline" size={11} color={Colors.text.muted} />
          <Text style={styles.disabilityText} numberOfLines={1}>{student.disability || '—'}</Text>
        </View>

        {/* Assigned teacher */}
        <View style={styles.teacherRow}>
          <Ionicons name="person-outline" size={11} color={Colors.text.muted} />
          <Text style={styles.teacherText} numberOfLines={1}>
            {student.teacher ? student.teacher.full_name : 'No teacher assigned'}
          </Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: Colors.borderLight }]}>
        <Text style={[styles.cardFooterText, { color: accent.color }]}>View Profile</Text>
        <Ionicons name="arrow-forward" size={14} color={accent.color} />
      </View>
    </ButtonFeedback>
  );
}

export default function StudentListScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns  = isLandscape ? 3 : 2;

  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [assignFilter, setAssignFilter] = useState('All');

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
    return students.filter((s) => {
      const q = search.trim().toLowerCase();
      if (q && ![s.full_name, s.student_code, s.disability].some((v) => v?.toLowerCase().includes(q))) {
        return false;
      }
      if (assignFilter === 'Assigned'   && !s.teacher) return false;
      if (assignFilter === 'Unassigned' &&  s.teacher) return false;
      return true;
    });
  }, [students, search, assignFilter]);

  const ListHeader = (
    <View style={styles.listHeader}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.icon.default} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, code or disability…"
          placeholderTextColor={Colors.text.muted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <ButtonFeedback onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={17} color={Colors.icon.muted} />
          </ButtonFeedback>
        )}
      </View>

      {/* Assignment filters */}
      <View style={styles.filterRow}>
        <Ionicons name="person-outline" size={14} color={Colors.text.muted} style={styles.filterIcon} />
        {ASSIGN_FILTERS.map((f) => (
          <FilterChip
            key={f}
            label={f}
            active={assignFilter === f}
            color={f === 'Assigned' ? K.teal : f === 'Unassigned' ? K.coral : K.purple}
            onPress={() => setAssignFilter(f)}
          />
        ))}
      </View>

      {/* Result count */}
      {(search || assignFilter !== 'All') && (
        <Text style={styles.resultCount}>
          {filtered.length} student{filtered.length !== 1 ? 's' : ''} found
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Breadcrumb crumbs={[{ label: 'Students' }]} title="Students" />
      <FlatList
        key={numColumns}
        data={filtered}
        keyExtractor={(s) => String(s.sid)}
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
            <StudentCard
              student={item}
              onPress={() => navigation.navigate('StudentDetail', { student: item })}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="school-outline"
              title="No students found"
              message={
                search || assignFilter !== 'All'
                  ? 'Try adjusting your search or filters.'
                  : 'Add your first student to get started.'
              }
            />
          ) : null
        }
      />

      <ButtonFeedback
        style={styles.fab}
        onPress={() => navigation.navigate('CreateStudent')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </ButtonFeedback>
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

  // Filters
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    flexWrap: 'wrap',
  },
  filterIcon: { marginRight: 2 },
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
  chipTextActive: { color: '#FFFFFF' },
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
  cardName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  cardCodeRow: { flexDirection: 'row' },
  codePill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  codeText: { fontSize: Layout.fontSize.xs, fontWeight: Layout.fontWeight.bold, letterSpacing: 0.4 },
  disabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  disabilityText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    flex: 1,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teacherText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    flex: 1,
    fontStyle: 'italic',
  },
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
    backgroundColor: K.coral,
    alignItems: 'center', justifyContent: 'center',
    ...Layout.shadow.lg,
  },
});
