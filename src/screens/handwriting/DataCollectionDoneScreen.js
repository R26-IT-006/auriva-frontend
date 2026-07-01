import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function DataCollectionDoneScreen({ route, navigation }) {
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
          <View style={[styles.iconWrap, { backgroundColor: theme.button + '20' }]}>
            <Ionicons name="checkmark-circle" size={64} color={theme.button} />
          </View>

          <Text style={[styles.title, { color: theme.headingText }]}>
            Data Collection Complete
          </Text>
          <Text style={styles.subtitle}>
            All shapes and letters for{'\n'}
            <Text style={{ fontWeight: '800' }}>{student?.full_name}</Text> have been recorded.
          </Text>

          <View style={[styles.infoBox, { borderColor: theme.button + '30', backgroundColor: theme.button + '0A' }]}>
            <Ionicons name="analytics-outline" size={18} color={theme.button} />
            <Text style={[styles.infoText, { color: theme.button }]}>
              6 shapes · 10 lowercase · 10 uppercase{'\n'}3 attempts per letter · collection_mode = true
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.navigate('TeacherMain')}
            activeOpacity={0.85}
          >
            <Ionicons name="home-outline" size={18} color={theme.buttonText} />
            <Text style={[styles.doneBtnText, { color: theme.buttonText }]}>
              Return to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    width: '88%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    gap: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },

  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 24,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },

  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 4,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
