import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Layout } from '../../constants/layout';

/**
 * "What is this called?" — picture on the left, name buttons on the right.
 * The Tier 2 format, so a child only meets it once they've been taught
 * name-matching for these concepts.
 */
function LabelPill({ item, index, locked, isCorrect, isWrong, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pop   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 8 }).start();
    }, 150 + index * 110);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pressIn() {
    if (locked) return;
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, pop) }] }}>
      <Pressable
        disabled={locked}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.labelPill,
          {
            backgroundColor: isCorrect ? '#C8F0CC' : isWrong ? '#FFD6D6' : '#FFFFFF',
            borderColor:     isCorrect ? '#4CAF50' : isWrong ? '#F44336' : theme.cardOutline,
          },
        ]}
      >
        <Text
          style={[
            styles.labelText,
            { color: isCorrect ? '#2E7D32' : isWrong ? '#C62828' : theme.headingText },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function NameChoiceRound({ round, concept, options, theme, locked, feedback, onAnswer }) {
  const { width, height } = useWindowDimensions();
  const imgSize = Math.min(width, height) * 0.34;

  return (
    <View style={styles.root}>
      <Text style={[styles.question, { color: theme.headingText }]}>
        What is this called?
      </Text>

      <View style={styles.contentRow}>
        <View style={styles.imageContainer}>
          <Image
            source={concept.real}
            style={{ width: imgSize, height: imgSize }}
            resizeMode="contain"
          />
        </View>

        <View style={styles.labelsContainer}>
          {options.map((item, index) => {
            const tapped = feedback?.selectedKey === item.key;
            return (
              <LabelPill
                key={item.key}
                item={item}
                index={index}
                locked={locked}
                isCorrect={tapped && feedback?.result === 'correct'}
                isWrong={tapped && feedback?.result === 'wrong'}
                theme={theme}
                onPress={() => onAnswer(item.key)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', alignItems: 'center' },

  question: {
    fontSize: 24,
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },

  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Layout.spacing.lg,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelsContainer: {
    width: 300,
    justifyContent: 'center',
    gap: 16,
  },
  labelPill: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  labelText: {
    fontSize: 22,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 0.2,
  },
});
