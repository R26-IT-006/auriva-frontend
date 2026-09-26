import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

// Fallback palette (GIF reference) — the app has no existing per-letter
// colour palette constant (constants/colors.js is semantic-only), so this
// cycling set is used directly per TASK-11 spec.
const LETTER_COLORS = [
  '#4C8BF5', // blue
  '#FF6FA5', // pink
  '#F4C430', // yellow
  '#4CAF7D', // green
  '#A66BE8', // purple
  '#FF7F5C', // coral
  '#2CBFAE', // teal
  '#E0A526', // gold
];

const CYCLE_DURATION = 900; // half-cycle; full loop ~1.8s
const STAGGER_MS = 90;

function AnimatedLetter({ char, color, delay, fontSize }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: CYCLE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: CYCLE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [delay]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });

  return (
    <Animated.Text
      style={[
        styles.letter,
        { color, fontSize, transform: [{ scale }, { rotate }] },
      ]}
    >
      {char}
    </Animated.Text>
  );
}

// Renders `word` with per-letter cycling colours and a gentle, staggered
// scale/rotate loop. Words stay grouped (no mid-word line breaks); the
// outer container wraps whole words onto a new line when needed.
export default function AnimatedWord({ word = '', fontSize = 52, style }) {
  const wordGroups = useMemo(() => {
    let index = 0;
    return (word ?? '').split(' ').map((w) => ({
      text: w,
      letters: w.split('').map((char) => ({ char, index: index++ })),
    }));
  }, [word]);

  return (
    <View style={[styles.container, style]}>
      {wordGroups.map((group, gi) => (
        <View key={`${group.text}-${gi}`} style={styles.wordGroup}>
          {group.letters.map(({ char, index }) => (
            <AnimatedLetter
              key={index}
              char={char}
              fontSize={fontSize}
              color={LETTER_COLORS[index % LETTER_COLORS.length]}
              delay={index * STAGGER_MS}
            />
          ))}
          {gi < wordGroups.length - 1 && <Text style={[styles.letter, { fontSize }]}> </Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letter: {
    fontWeight: '900',
  },
});
