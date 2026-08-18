import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
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
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { useToast } from '../../../context/ToastContext';
import { getAvatarTheme } from '../../../constants/avatarThemes';

const COLS     = 3;
const H_PAD    = 40;
const CARD_GAP = 24;
// Upper bound so a one- or two-student roster doesn't stretch cards across the tablet.
const MAX_CARD = 260;

function StudentCard({ student, cardSize, onPress }) {
  const theme      = getAvatarTheme(student.avatar_key);
  const initial    = (student.full_name || '?')[0].toUpperCase();
  const circleSize = cardSize * 0.54;
  const nameSize   = cardSize * 0.1;
  const ring       = Math.round(circleSize * 0.05);   // white ring around the avatar
  const innerSize  = circleSize - ring * 2;           // photo sits inside the ring
  // Cards show only the first two names; longer full names wrap past two lines
  // and ellipsize mid-word.
  const displayName = (student.full_name || '').trim().split(/\s+/).slice(0, 2).join(' ');
  const scale      = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
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
        style={[styles.card, {
          width: cardSize,
          height: cardSize * 1.1,
          borderColor: theme.cardOutline + '33',
        }]}
      >
        {/* Themed gradient header. The flat 13%-alpha wash this replaces read as
            unfinished; a soft gradient gives each child a colour identity they can
            recognise at a glance. */}
        <LinearGradient
          colors={theme.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardAccent}
        />

        {/* Avatar — the white ring lifts it off the gradient it sits against */}
        <View style={[styles.circle, {
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderWidth: ring,
          borderColor: '#FFFFFF',
          backgroundColor: theme.cardOutline + '26',
        }]}>
          {student.profile_photo_url ? (
            <Image
              source={{ uri: student.profile_photo_url }}
              // Inset by the ring, so the photo fills the opening instead of being
              // clipped by the border box.
              style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.initial, { fontSize: circleSize * 0.4, color: theme.button }]}>
              {initial}
            </Text>
          )}
        </View>

        {/* Name */}
        <Text
          style={[styles.name, { fontSize: nameSize, lineHeight: nameSize * 1.3 }]}
          numberOfLines={2}
        >
          {displayName}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function StudentPickerScreen({ navigation }) {
  const { width }               = useWindowDimensions();
  const toast                   = useToast();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // A teacher carries at most a handful of students, so match the column count to
  // the roster rather than always laying out three — one or two students otherwise
  // sit off-centre in a 3-wide grid. Cards fill their column (no arbitrary shrink)
  // up to MAX_CARD, which also keeps the tap targets generous.
  const cols     = Math.min(Math.max(students.length, 1), COLS);
  const cardSize = Math.min((width - H_PAD * 2 - CARD_GAP * (cols - 1)) / cols, MAX_CARD);

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

  return (
    <LinearGradient
      colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('WorkspaceSelect')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#2A5A48" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>My Students</Text>
            <Text style={styles.subtitle}>Tap a student to begin their session</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2A5A48" />
          </View>
        ) : students.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={40} color="#2A5A48" />
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
            numColumns={cols}
            key={cols}
            // React Native throws if columnWrapperStyle is set while numColumns is 1.
            columnWrapperStyle={cols > 1 ? { gap: CARD_GAP, justifyContent: 'center' } : undefined}
            contentContainerStyle={[styles.list, { paddingHorizontal: H_PAD, flexGrow: 1, justifyContent: 'center' }]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: CARD_GAP }} />}
            renderItem={({ item }) => (
              <StudentCard
                student={item}
                cardSize={cardSize}
                onPress={async () => {
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
          />
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerText: {
    gap: 2,
  },
  title: {
    fontFamily: 'Nunito_900Black',
    fontSize: 24,
    color: '#1A3D2E',
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#4A7A60',
  },

  // ── List ──────────────────────────────────────────────────────────────────
  list: {
    paddingTop: 16,
    paddingBottom: 36,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    // Hairline in the student's own colour: enough definition to separate the card
    // from the gradient background without competing with the avatar.
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 5,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    // Was 21 against a 24 card radius, which left a visible seam at the top
    // corners. overflow:'hidden' on the card clips the rest.
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  circle: {
    // borderWidth/borderColor are set at render time — the ring scales with the card.
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  initial: {
    fontFamily: 'Nunito_900Black',
  },

  // ── Name ──────────────────────────────────────────────────────────────────
  name: {
    fontFamily: 'Nunito_700Bold',
    color: '#1A2E26',
    textAlign: 'center',
    paddingHorizontal: 10,
    // lineHeight is set alongside fontSize at render time — both scale with the
    // card, and a fixed value here clipped the glyphs once the card grew.
    marginTop: 10,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: '#1A3D2E',
  },
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#2A5A48',
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
});
