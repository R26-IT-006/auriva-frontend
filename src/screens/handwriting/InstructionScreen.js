import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BULLETS = [
  'Ensure the child is comfortably holding the tablet stylus.',
  'Ask the child to trace or draw the shapes shown on the screen.',
  'Do not assist the child while drawing, unless necessary.',
  'Allow the child to complete each shape naturally at their own speed.',
  'The system will record stroke movement, direction, and stability.',
];

export default function InstructionScreen({ route, navigation }) {
  const { student, selectedAvatar, theme } = route.params;

  const handleNext = () => {
    navigation.navigate('Welcome', { student, selectedAvatar, theme });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Page label */}
      <Text style={styles.pageLabel}>Instructions Page</Text>

      {/* Main card */}
      <View style={styles.card}>
        <ScrollView
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Card header */}
          <Text style={[styles.title, { color: theme.headingText }]}>
            Let's Practice Writing
          </Text>
          <Text style={[styles.sectionLabel, { color: theme.primaryButton }]}>
            Instructions for the Teacher
          </Text>
          <Text style={styles.intro}>
            Please guide the child through the following steps:
          </Text>

          {/* Bullet points */}
          <View style={styles.bulletList}>
            {BULLETS.map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom row: Next button + avatar circle */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.primaryButton }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextText, { color: theme.buttonText }]}>
              Next
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: theme.cardOutline },
            ]}
          >
            <Text style={styles.avatarInitial}>
              {selectedAvatar.charAt(0)}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Page label
  pageLabel: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 10,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardContent: {
    flexGrow: 1,
  },

  // Card header
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  intro: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 16,
  },

  // Bullets
  bulletList: {
    gap: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 13,
    color: '#444444',
    lineHeight: 22,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#444444',
    lineHeight: 22,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
    paddingTop: 24,
  },
  nextButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 50,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 1,
  },
});
