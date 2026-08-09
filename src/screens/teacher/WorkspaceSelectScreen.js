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
  const cardSize = Math.min(
    (width - Layout.spacing.lg * 2 - Layout.spacing.xl) / 2,
    200,
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Dot-pattern background layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DotGrid />
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
          onConfirm={logout}
          onCancel={() => setLogoutVisible(false)}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

/* Lightweight dot-grid overlay */
function DotGrid() {
  const { width, height } = useWindowDimensions();
  const GAP = 28;
  const COLS = Math.ceil(width / GAP);
  const ROWS = Math.ceil(height / GAP);
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            top: r * GAP + 6,
            left: c * GAP + 6,
            width: 3,
            height: 3,
            borderRadius: 2,
            backgroundColor: "rgba(160,160,180,0.22)",
          }}
        />,
      );
    }
  }
  return <>{dots}</>;
}

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xl,
    zIndex: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_600SemiBold',
    color: '#444',
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.spacing.lg,
    gap: Layout.spacing.xxl,
  },
  titleWrap: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Nunito_900Black',
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
    width: 88,
    height: 88,
  },
  textWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  cardLabel: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_600SemiBold',
    color: '#1A2E26',
  },
  cardLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary,
    textAlign: "center",
    lineHeight: 19,
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
