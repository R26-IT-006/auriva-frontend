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

export default function ChildWelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>

          <Text style={[styles.heading, { color: theme.headingText }]}>
            Welcome
          </Text>

          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { color: theme.headingText }]}>
              Hello, {student.full_name}!
            </Text>
            <Image
              source={AVATAR_MAP[student?.avatar_key]}
              style={styles.avatarThumb}
            />
          </View>

          <Text style={styles.subtitle}>
            Let's begin the handwriting assessment.
          </Text>

          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: theme.button }]}
            onPress={() => navigation.navigate('ShapeAssessment', { student, theme })}
            activeOpacity={0.85}
          >
            <Text style={[styles.startText, { color: theme.buttonText }]}>
              Start
            </Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },

  card: {
    flex: 1,
    marginHorizontal: 24,
    marginVertical: 40,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  heading: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    marginBottom: 32,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  avatarThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },

  startButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 50,
  },
  startText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
});
