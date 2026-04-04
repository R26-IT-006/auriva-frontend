import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const WORKSPACES = [
  {
    key:     'teacher',
    emoji:   '👩‍🏫',
    label:   'Teacher\nWorkspace',
    route:   'TeacherMain',
    border:  '#1A1A2E',
    bg:      '#F0F2FA',
  },
  {
    key:     'student',
    emoji:   '👦👧',
    label:   'Student\nWorkspace',
    route:   'StudentPicker',
    border:  '#1A1A2E',
    bg:      '#FFFFFF',
  },
];

export default function WorkspaceSelectScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const cardSize  = Math.min((width - Layout.spacing.lg * 2 - Layout.spacing.xl) / 2, 200);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Dot-pattern background layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DotGrid />
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>Choose your workspace</Text>

        <View style={styles.cardsRow}>
          {WORKSPACES.map((ws) => (
            <TouchableOpacity
              key={ws.key}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(ws.route)}
              style={[
                styles.card,
                { width: cardSize, height: cardSize + 20, borderColor: ws.border },
              ]}
            >
              <View style={[styles.emojiWrap, { backgroundColor: ws.bg }]}>
                <Text style={styles.emoji}>{ws.emoji}</Text>
              </View>
              <Text style={styles.cardLabel}>{ws.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

/* Lightweight dot-grid overlay */
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
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    gap: Layout.spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: Layout.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 28,
    borderWidth: 2.5,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 14,
    gap: 12,
    overflow: 'hidden',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emojiWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  emoji: {
    fontSize: 64,
    lineHeight: 80,
  },
  cardLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
