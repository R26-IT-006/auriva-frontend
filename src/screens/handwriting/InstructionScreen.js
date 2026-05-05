import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const BULLETS = [
  'Ensure the child is comfortably holding the tablet stylus.',
  'Ask the child to trace or draw the shapes shown on the screen.',
  'Do not assist the child while drawing, unless necessary.',
  'Allow the child to complete each shape naturally at their own speed.',
  'The system will record stroke movement, direction, and stability.',
];

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function InstructionScreen({ route, navigation }) {
  const { student, theme } = route.params;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <Text style={styles.pageLabel}>Instructions Page</Text>

        <View style={styles.card}>

          {/* ── Top section ── */}
          <View style={styles.topSection}>
            <Text style={[styles.title, { color: theme.headingText }]}>
              Let's Practice Writing
            </Text>
            <Text style={[styles.sectionLabel, { color: theme.button }]}>
              Instructions for the Teacher
            </Text>
            <Text style={styles.intro}>
              Please guide the child through the following steps:
            </Text>

            {BULLETS.map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <View style={[styles.stepCircle, { backgroundColor: theme.button }]}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* ── Bottom section ── */}
          <View style={styles.bottomRow}>
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate('ChildWelcome', { student, theme })}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextText, { color: theme.buttonText }]}>Next</Text>
            </TouchableOpacity>

            <Image
              source={AVATAR_MAP[student?.avatar_key]}
              style={styles.avatarImage}
              resizeMode="contain"
            />
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },

  pageLabel: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 10,
  },

  // Card
  card: {
    flex: 1,
    marginHorizontal: 24,
    marginVertical: 40,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },

  // Top section
  topSection: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  intro: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginLeft: 12,
  },

  // Bottom section
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  nextButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
  },
  avatarImage: {
    width: 120,
    height: 140,
  },
});
