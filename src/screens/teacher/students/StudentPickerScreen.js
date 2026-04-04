import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/common/Avatar';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { useToast } from '../../../context/ToastContext';

function StudentPill({ student, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.pill}
    >
      <View style={styles.pillAvatar}>
        <Avatar name={student.full_name} uri={student.profile_photo_url} size={44} />
      </View>
      <Text style={styles.pillName}>{student.full_name}</Text>
    </TouchableOpacity>
  );
}

export default function StudentPickerScreen({ navigation }) {
  const { width }         = useWindowDimensions();
  const toast             = useToast();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const fetch = useCallback(async () => {
    try {
      const data = await teacherApi.getStudents();
      setStudents(data);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const pillWidth = Math.min(width - Layout.spacing.lg * 2, 440);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Dot-pattern background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DotGrid />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose your student</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : students.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🎒</Text>
          <Text style={styles.emptyTitle}>No students yet</Text>
          <Text style={styles.emptySub}>
            Ask your principal to assign students to your account.
          </Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(s) => String(s.sid)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Layout.spacing.md }} />}
          renderItem={({ item }) => (
            <View style={{ alignItems: 'center' }}>
              <StudentPill
                student={item}
                onPress={() => navigation.navigate('StudentSession', { student: item })}
                style={{ width: pillWidth }}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

/* Shared dot-grid (same as WorkspaceSelectScreen) */
function DotGrid() {
  const { width, height } = useWindowDimensions();
  const GAP  = 28;
  const COLS = Math.ceil(width  / GAP);
  const ROWS = Math.ceil(height / GAP);
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            top:  r * GAP + 6,
            left: c * GAP + 6,
            width: 3, height: 3, borderRadius: 2,
            backgroundColor: 'rgba(160,160,180,0.22)',
          }}
        />,
      );
    }
  }
  return <>{dots}</>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.lg,
  },
  backBtn: {
    position: 'absolute',
    left: Layout.spacing.lg,
    top: Layout.spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: Colors.text.primary,
    lineHeight: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  list: {
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    alignItems: 'center',
  },
  pill: {
    width: 420,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#1A1A2E',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: Layout.spacing.md,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pillAvatar: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  pillName: {
    flex: 1,
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
    gap: Layout.spacing.sm,
  },
  emptyEmoji:  { fontSize: 48 },
  emptyTitle:  { fontSize: Layout.fontSize.lg, fontWeight: Layout.fontWeight.bold, color: Colors.text.secondary },
  emptySub:    { fontSize: Layout.fontSize.sm, color: Colors.text.muted, textAlign: 'center', lineHeight: 20 },
});
