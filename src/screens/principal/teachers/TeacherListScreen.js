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

function TeacherRow({ teacher, onPress, isWide }) {
  const studentCount = teacher.students?.length ?? 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.row, isWide && styles.rowWide]}
    >
      <Avatar name={teacher.full_name} uri={teacher.profile_photo_url} size={48} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{teacher.full_name}</Text>
        <Text style={styles.rowCode}>{teacher.teacher_code}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{teacher.email}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Badge
          label={teacher.is_first_login ? 'Pending' : 'Active'}
          variant={teacher.is_first_login ? 'warning' : 'success'}
        />
        <Text style={styles.studentCount}>{studentCount}/3 students</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.icon.muted} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

export default function TeacherListScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = isLandscape ? 2 : 1;

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
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
    fetch();
    const unsubscribe = navigation.addListener('focus', fetch);
    return unsubscribe;
  }, [fetch, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        key={numColumns}
        data={teachers}
        keyExtractor={(t) => String(t.tid)}
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
            <TeacherRow
              teacher={item}
              isWide={isLandscape}
              onPress={() => navigation.navigate('TeacherDetail', { teacher: item })}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="people-outline"
              title="No teachers yet"
              message="Add your first teacher to get started."
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  rowWide: { padding: Layout.spacing.md },
  rowInfo: { flex: 1, marginLeft: Layout.spacing.md },
  rowName: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  rowCode: { fontSize: Layout.fontSize.xs, color: Colors.text.link, marginTop: 2 },
  rowEmail: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2 },
  rowMeta: { alignItems: 'flex-end', gap: 4 },
  studentCount: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 4 },
  separator: { height: Layout.spacing.sm },
  fab: {
    position: 'absolute',
    bottom: Layout.spacing.xl,
    right: Layout.spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Layout.shadow.lg,
  },
});
