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

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function WelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <Text style={styles.pageLabel}>welcome page to handwriting</Text>

        <View style={styles.card}>

          {/* ── Left side ── */}
          <View style={styles.leftSide}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.appName, { color: theme.headingText }]}>Auriva</Text>
            <Text style={styles.appSubtitle}>LETTER WRITING</Text>

            <Text style={styles.description}>
              Learn to write letters at your own pace with friendly guide!
            </Text>

            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate('Instructions', { student, theme })}
              activeOpacity={0.85}
            >
              <Text style={[styles.startText, { color: theme.buttonText }]}>
                ▶{'  '}Start Learning
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Right side ── */}
          <View style={[styles.rightSide, { backgroundColor: theme.background }]}>
            <Image
              source={AVATAR_MAP[student?.avatar_key]}
              style={styles.avatarImage}
              resizeMode="contain"
            />
            <View style={[styles.speechBubble, { borderColor: theme.cardOutline }]}>
              <Text style={[styles.speechBold, { color: theme.headingText }]}>
                Hi there!
              </Text>
              <Text style={styles.speechSub}>Let's write together!</Text>
            </View>
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
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },

  // Left side
  leftSide: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#999999',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 32,
  },
  startButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 50,
  },
  startText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Right side
  rightSide: {
    width: 200,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 160,
    height: 200,
    marginTop: 'auto',
  },
  speechBubble: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  speechBold: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  speechSub: {
    fontSize: 12,
    color: '#666666',
  },
});
