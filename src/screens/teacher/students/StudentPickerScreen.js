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
const H_PAD    = 32;
const CARD_GAP = 20;

function StudentCard({ student, cardSize, onPress }) {
  const theme      = getAvatarTheme(student.avatar_key);
  const initial    = (student.full_name || '?')[0].toUpperCase();
  const circleSize = cardSize * 0.52;
  const scale      = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
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
            width:           cardSize,
            height:          cardSize * 1.18,
            backgroundColor: '#FFFFFF',
            borderColor:     theme.cardOutline,
          },
        ]}
      >
        {/* Avatar circle — photo or initial */}
        <View
          style={[
            styles.circle,
            {
              width:        circleSize,
              height:       circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: theme.cardOutline,
              borderColor:  'rgba(255,255,255,0.85)',
            },
          ]}
        >
          {student.profile_photo_url ? (
            <Image
              source={{ uri: student.profile_photo_url }}
              style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.initial, { fontSize: circleSize * 0.42, color: '#fff' }]}>
              {initial}
            </Text>
          )}
        </View>

        {/* Name */}
        <Text
          style={[styles.name, { color: '#1A1A1A', fontSize: cardSize * 0.11 }]}
          numberOfLines={1}
        >
          {student.full_name}
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

  const cardSize = ((width - H_PAD * 2 - CARD_GAP * (COLS - 1)) / COLS) * 0.65;

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
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#2A5A48" />
          </TouchableOpacity>
          <Text style={styles.title}>My Students</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2A5A48" />
          </View>
        ) : students.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="people-outline" size={52} color="#2A5A48" style={{ opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>No students yet</Text>
            <Text style={styles.emptySub}>
              Ask your principal to assign students to your account.
            </Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(s) => String(s.sid)}
            numColumns={COLS}
            key={COLS}
            columnWrapperStyle={{ gap: CARD_GAP, justifyContent: 'center' }}
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

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: H_PAD,
    paddingVertical:   16,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize:   22,
    color:      '#1A3D2E',
  },

  list: {
    paddingTop:    8,
    paddingBottom: 32,
  },

  card: {
    borderRadius:   28,
    borderWidth:    5,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.08,
    shadowRadius:   12,
    elevation:      4,
  },

  circle: {
    borderWidth:    3,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.12,
    shadowRadius:   6,
    elevation:      3,
  },

  initial: {
    fontFamily: 'Nunito_900Black',
  },

  name: {
    fontFamily:        'Nunito_800ExtraBold',
    textAlign:         'center',
    paddingHorizontal: 8,
  },

  centered: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    gap:               12,
  },
  emptyTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize:   18,
    color:      '#1A3D2E',
  },
  emptySub: {
    fontFamily: 'Nunito_700Bold',
    fontSize:   14,
    color:      '#2A5A48',
    textAlign:  'center',
    opacity:    0.7,
    lineHeight: 22,
  },
});
