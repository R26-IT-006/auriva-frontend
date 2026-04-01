import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { principalApi } from '../../../api/principal';

function StudentRow({ student, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.row}>
      <Avatar name={student.full_name} uri={student.profile_photo_url} size={48} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{student.full_name}</Text>
        <Text style={styles.rowCode}>{student.student_code}</Text>
        <Text style={styles.rowDisability} numberOfLines={1}>{student.disability}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Badge
          label={student.teacher ? 'Assigned' : 'Unassigned'}
          variant={student.teacher ? 'success' : 'muted'}
        />
        {student.teacher && (
          <Text style={styles.teacherName} numberOfLines={1}>
            {student.teacher.full_name}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.icon.muted} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

export default function StudentListScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = isLandscape ? 2 : 1;

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
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
    fetch();
    const unsubscribe = navigation.addListener('focus', fetch);
    return unsubscribe;
  }, [fetch, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        key={numColumns}
        data={students}
        keyExtractor={(s) => String(s.sid)}
        numColumns={numColumns}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={() => { setRefreshing(true); fetch(); }}
          />
        }
        contentContainerStyle={[styles.list, isLandscape && styles.listLandscape]}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          <View style={numColumns > 1 ? styles.columnItem : { width: '100%' }}>
            <StudentRow
              student={item}
              onPress={() => navigation.navigate('StudentDetail', { student: item })}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="school-outline"
              title="No students yet"
              message="Add your first student to get started."
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateStudent')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Layout.spacing.md, flexGrow: 1 },
  listLandscape: { paddingHorizontal: Layout.spacing.lg },
  columnWrapper: { gap: Layout.spacing.sm },
  columnItem: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  rowInfo: { flex: 1, marginLeft: Layout.spacing.md },
  rowName: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  rowCode: { fontSize: Layout.fontSize.xs, color: Colors.text.link, marginTop: 2 },
  rowDisability: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2 },
  rowMeta: { alignItems: 'flex-end', gap: 4, maxWidth: 90 },
  teacherName: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, textAlign: 'right' },
  separator: { height: Layout.spacing.sm },
  fab: {
    position: 'absolute',
    bottom: Layout.spacing.xl,
    right: Layout.spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F4845F',
    alignItems: 'center', justifyContent: 'center',
    ...Layout.shadow.lg,
  },
});
