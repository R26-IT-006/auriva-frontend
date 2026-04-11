import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar } from '../../../components/common/Avatar';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { useToast } from '../../../context/ToastContext';

const ACCENTS = [
  { bg: '#E8F5F0', border: '#A8D8CC', text: '#0F6E56' },
  { bg: '#EAF0FB', border: '#A8BCE8', text: '#2A4FAD' },
  { bg: '#FDF3E7', border: '#F0C98A', text: '#9A5F10' },
  { bg: '#F3EAF8', border: '#C9A8E0', text: '#6A2F9A' },
];

function StudentCard({ student, index, size, onPress }) {
  const accent = ACCENTS[index % ACCENTS.length];
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 1.06, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[
          styles.card,
          {
            width: size,
            height: size,
            backgroundColor: accent.bg,
            borderColor: accent.border,
          },
        ]}
      >
        <Avatar name={student.full_name} uri={student.profile_photo_url} size={size * 0.62} />
        <Text style={[styles.cardName, { color: accent.text }]} numberOfLines={2}>
          {student.full_name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function StudentPickerScreen({ navigation }) {
  const { width, height }       = useWindowDimensions();
  const toast                   = useToast();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await teacherApi.getStudents();
      setStudents(data);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const GAP      = Layout.spacing.lg;
  const PADDING  = Layout.spacing.lg;
  const cardSize = Math.min(
    (width - PADDING * 2 - GAP) / 2,
    Math.min(height * 0.38, 300),
  );

  return (
    <LinearGradient colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']} style={styles.safe}>
      <SafeAreaView style={styles.safeInner}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>My Students</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : students.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="people-outline" size={48} color={Colors.icon.muted} />
            </View>
            <Text style={styles.emptyTitle}>No students yet</Text>
            <Text style={styles.emptySub}>
              Ask your principal to assign students to your account.
            </Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(s) => String(s.sid)}
            numColumns={2}
            columnWrapperStyle={{ gap: GAP, justifyContent: 'center' }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <StudentCard
                student={item}
                index={index}
                size={cardSize}
                onPress={async () => {
                  // avatar_key comes from API; fall back to local cache if missing
                  const avatarKey = item.avatar_key
                    ?? await AsyncStorage.getItem(`student_avatar_${item.sid}`);
                  if (!avatarKey) {
                    navigation.navigate('AvatarSelection', { student: item });
                  } else {
                    navigation.navigate('StudentDashboard', { student: { ...item, avatar_key: avatarKey } });
                  }
                }}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          />
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeInner: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
    gap: Layout.spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: 'sans-serif-rounded',
  },
  subtitle: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    marginTop: 2,
  },

  list: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    paddingTop: Layout.spacing.sm,
  },

  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardName: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.sm,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },
  emptyIconBox: {
    width: 90, height: 90, borderRadius: 24,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Layout.spacing.sm,
  },
  emptyTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.secondary,
  },
  emptySub: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});