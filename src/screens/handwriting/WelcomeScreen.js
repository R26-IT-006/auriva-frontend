import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;

  // avatar_key is lowercase ('boba') — capitalise for display
  const avatarLabel = student?.avatar_key
    ? student.avatar_key.charAt(0).toUpperCase() + student.avatar_key.slice(1)
    : '?';

  // avatarThemes uses 'button'; handwritingThemes uses 'primaryButton' — support both
  const buttonBg = theme.button ?? theme.primaryButton;

  const handleStart = () => {
    navigation.navigate('Instructions', { student, theme });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Top label */}
      <Text style={styles.pageLabel}>Welcome Page</Text>

      {/* Main card */}
      <View style={styles.card}>
        {/* Center content */}
        <View style={styles.centerContent}>
          <Text style={[styles.heading, { color: theme.headingText }]}>
            Welcome
          </Text>

          {/* Child name + avatar row */}
          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { color: theme.headingText }]}>
              Hello, {student.full_name}!
            </Text>
            <View style={[styles.smallCircle, { backgroundColor: theme.cardOutline }]}>
              <Text style={styles.smallInitial}>
                {avatarLabel.charAt(0)}
              </Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Let's begin the handwriting assessment.
          </Text>
        </View>

        {/* Bottom row: Start button + large avatar circle */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: buttonBg }]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <Text style={[styles.startText, { color: theme.buttonText }]}>
              Start
            </Text>
          </TouchableOpacity>

          <View style={[styles.largeCircle, { backgroundColor: theme.cardOutline }]}>
            <Text style={styles.largeInitial}>
              {avatarLabel.charAt(0)}
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

  // Top label
  pageLabel: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  // Center content
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
  },
  smallCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    marginTop: 'auto',
  },
  startButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 50,
  },
  startText: {
    fontSize: 18,
    fontWeight: '600',
  },
  largeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeInitial: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 1,
  },
});
