import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEMES, getTheme } from '../../constants/handwritingThemes';

export default function AvatarSelectScreen({ route, navigation }) {
  const { student } = route.params;
  const [selectedName, setSelectedName] = useState(null);

  const selectedTheme = selectedName ? getTheme(selectedName) : null;

  const screenBg     = selectedTheme?.background  ?? '#FFFFFF';
  const headingColor = selectedTheme?.headingText  ?? '#1A1A2E';
  const buttonBg     = selectedTheme?.primaryButton ?? '#CCCCCC';
  const buttonTxtClr = selectedTheme?.buttonText   ?? '#FFFFFF';
  const canStart     = selectedName !== null;

  const handleStart = () => {
    navigation.navigate('Instructions', {
      student,
      selectedAvatar: selectedTheme.name,
      theme: selectedTheme,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: screenBg }]}>
      {/* PART 1 — Header */}
      <View style={styles.header}>
        <Text style={[styles.heading, { color: headingColor }]}>
          Hi, {student.full_name}!
        </Text>
        <Text style={[styles.subtitle, { color: headingColor }]}>
          Pick your buddy!
        </Text>
      </View>

      {/* PART 2 — Avatar Grid */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {THEMES.map((theme) => {
          const isSelected = selectedName === theme.name;
          return (
            <TouchableOpacity
              key={theme.name}
              style={[
                styles.card,
                {
                  borderColor: isSelected ? theme.primaryButton : '#D0D0D0',
                  borderWidth: isSelected ? 3 : 1.5,
                  backgroundColor: theme.cardSurface,
                },
              ]}
              onPress={() => setSelectedName(theme.name)}
              activeOpacity={0.8}
            >
              <View style={[styles.circle, { backgroundColor: theme.cardOutline }]}>
                <Text style={styles.circleInitial}>
                  {theme.name.charAt(0)}
                </Text>
              </View>
              <Text
                style={[
                  styles.avatarName,
                  { color: isSelected ? theme.primaryButton : '#444444' },
                ]}
              >
                {theme.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* PART 3 — Bottom Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: canStart ? buttonBg : '#CCCCCC' },
          ]}
          onPress={handleStart}
          disabled={!canStart}
          activeOpacity={0.85}
        >
          <Text style={[styles.startText, { color: canStart ? buttonTxtClr : '#888888' }]}>
            Let's Start!
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.8,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    width: 140,
    minHeight: 140,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  circleInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  startButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  startText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
