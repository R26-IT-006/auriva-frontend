import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../constants/layout';
import { useAuthStore } from '../../store/authStore';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

const WORKSPACES = [
  {
    key:    'teacher',
    label:  'Teacher Workspace',
    sub:    'Manage classes & resources',
    image:  require('../../../assets/teacher.png'),
    route:  'TeacherMain',
    iconBg: '#C8E8DF',
  },
  {
    key:    'student',
    label:  'Student Workspace',
    sub:    'Access lessons & assignments',
    image:  require('../../../assets/students.png'),
    route:  'StudentPicker',
    iconBg: '#C8E8DF',
  },
];

export default function WorkspaceSelectScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - Layout.spacing.lg * 2, 420);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  return (
    <LinearGradient colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']} style={styles.safe}>
      <SafeAreaView style={styles.safeInner}>

        {/* Top-right logout button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setLogoutVisible(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={18} color="#4A6B62" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.container}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Choose Your Workspace</Text>
            <Text style={styles.subtitle}>Select the space that's right for you</Text>
          </View>

          <View style={{ gap: Layout.spacing.md, width: cardWidth }}>
            {WORKSPACES.map((ws) => (
              <TouchableOpacity
                key={ws.key}
                activeOpacity={0.85}
                onPress={() => navigation.navigate(ws.route)}
                style={styles.card}
              >
                <View style={[styles.iconBox, { backgroundColor: ws.iconBg }]}>
                  <Image source={ws.image} style={styles.iconImage} resizeMode="contain" />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.cardLabel}>{ws.label}</Text>
                  <Text style={styles.cardSub}>{ws.sub}</Text>
                </View>
                <View style={styles.chevronCircle}>
                  <Ionicons name="chevron-forward" size={18} color="#7AADA6" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomIndicator} />

        <ConfirmDialog
          visible={logoutVisible}
          title="Sign Out"
          message="Are you sure you want to sign out?"
          confirmLabel="Sign Out"
          cancelLabel="Cancel"
          icon="log-out-outline"
          onConfirm={() => { setLogoutVisible(false); logout(); }}
          onCancel={() => setLogoutVisible(false)}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeInner: { flex: 1 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Layout.spacing.lg,
    // SafeAreaView already pads the notch, so this is clearance below it.
    paddingTop: Layout.spacing.xl,
    zIndex: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,          // 44dp is the smallest comfortable tap target
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 10,
    shadowColor: '#0F6E56',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_600SemiBold',
    color: '#3D5C54',
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    gap: Layout.spacing.xl,
  },
  titleWrap: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontFamily: 'DMSans_900Black',
    color: '#1A3028',
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 46,
  },
  subtitle: {
    fontSize: Layout.fontSize.md,
    color: '#5A7870',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E8EEF0',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.lg,
    shadowColor: '#0F6E56',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  iconBox: {
    width: 110,
    height: 110,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconImage: {
    width: 62,
    height: 62,
  },
  textWrap: {
    flex: 1,
    gap: 6,
  },
  cardLabel: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1A2E26',
  },
  cardSub: {
    fontSize: Layout.fontSize.md,
    color: '#6B8A80',
  },
  chevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(200,228,220,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});