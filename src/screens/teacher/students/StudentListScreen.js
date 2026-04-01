import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';

function StudentCard({ student, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      <Avatar name={student.full_name} uri={student.profile_photo_url} size={56} />
      <View style={styles.info}>
        <Text style={styles.name}>{student.full_name}</Text>
        <Text style={styles.code}>{student.student_code}</Text>
        <Badge label={student.disability} variant="info" style={{ marginTop: 4 }} />
      </View>
      <View style={styles.action}>
        <Ionicons name="chevron-forward" size={18} color={Colors.icon.muted} />
      </View>
    </TouchableOpacity>
  );
}

export default function TeacherStudentListScreen({ navigation }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await teacherApi.getStudents();
      setStudents(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={students}
        keyExtractor={(s) => String(s.sid)}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <StudentCard
            student={item}
            onPress={() => navigation.navigate('TeacherStudentDetail', { student: item })}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="people-outline"
              title="No students assigned"
              message="The principal will assign students to your account."
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: Layout.spacing.sm }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Layout.spacing.md, flexGrow: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md, borderWidth: 1, borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  info: { flex: 1, marginLeft: Layout.spacing.md },
  name: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  code: { fontSize: Layout.fontSize.xs, color: Colors.text.link, marginTop: 2 },
  action: { paddingLeft: Layout.spacing.sm },
});
