import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEMES, getTheme } from '../../../constants/handwritingThemes';
import { rs, rf } from '../../../utils/responsive';

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
    paddingHorizontal: rs(24),
    paddingTop: rs(24),
    paddingBottom: rs(16),
    alignItems: 'center',
  },
  heading: {
    fontSize: rf(30),
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    marginBottom: rs(6),
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: rf(20),
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    textAlign: 'center',
    opacity: 0.8,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(24),
    gap: rs(16),
  },
  card: {
    width: rs(140),
    minHeight: rs(140),
    borderRadius: rs(20),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rs(20),
    paddingHorizontal: rs(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  circle: {
    width: rs(80),
    height: rs(80),
    borderRadius: rs(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(12),
  },
  circleInitial: {
    fontSize: rf(32),
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFFFFF',
  },
  avatarName: {
    fontSize: rf(16),
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: rs(24),
    paddingBottom: rs(24),
    paddingTop: rs(8),
  },
  startButton: {
    borderRadius: rs(16),
    paddingVertical: rs(18),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  startText: {
    fontSize: rf(20),
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 0.5,
  },
});
