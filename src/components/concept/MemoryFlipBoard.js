import { useRef, useEffect } from 'react';
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Memory board — a grid of face-down cards the child turns over two at a time.
 *
 * Purely presentational: the shell owns which cards are face up, which are
 * matched and what a tap means. Each card animates its own flip, so turning one
 * over never re-renders or re-animates the rest of the grid.
 */

const FLIP_MS = 320;

function FlipCard({ card, size, faceUp, matched, locked, theme, onPress }) {
  // 0 = back showing, 1 = face showing.
  const flip = useRef(new Animated.Value(faceUp ? 1 : 0)).current;
  const pop  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(flip, {
      toValue: faceUp || matched ? 1 : 0,
      duration: FLIP_MS,
      useNativeDriver: true,
    }).start();
  }, [faceUp, matched]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!matched) return;
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.1, useNativeDriver: true, speed: 40, bounciness: 18 }),
      Animated.spring(pop, { toValue: 1,   useNativeDriver: true, speed: 16, bounciness: 10 }),
    ]).start();
  }, [matched]); // eslint-disable-line react-hooks/exhaustive-deps

  // The two halves sit on top of each other, each hiding its own backface, so
  // only one is ever visible through the rotation.
  const backSpin = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const faceSpin = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: pop }] }}>
      <Pressable
        disabled={faceUp || matched || locked}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          matched ? `${card.label}, matched`
          : faceUp ? card.label
          : 'Face-down card'
        }
        accessibilityState={{ disabled: faceUp || matched }}
        style={styles.press}
      >
        {/* Back */}
        <Animated.View
          style={[
            styles.half,
            {
              backgroundColor: theme.button,
              borderColor: theme.cardOutline,
              transform: [{ perspective: 900 }, { rotateY: backSpin }],
            },
          ]}
        >
          <Ionicons name="help" size={Math.round(size * 0.34)} color={theme.buttonText} />
        </Animated.View>

        {/* Face */}
        <Animated.View
          style={[
            styles.half,
            styles.faceHalf,
            {
              backgroundColor: theme.cardSurface,
              borderColor: matched ? card.pairColor : theme.cardOutline,
              borderWidth: matched ? 5 : 3,
              transform: [{ perspective: 900 }, { rotateY: faceSpin }],
            },
          ]}
        >
          <Image source={card.image} style={styles.image} resizeMode="contain" />
          {matched && (
            <View style={[styles.tick, { backgroundColor: card.pairColor }]}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function MemoryFlipBoard({
  cards,
  faceUp,
  matched,
  locked,
  cardSize,
  gap = 14,
  columns = 4,
  theme,
  onFlip,
}) {
  // Pinned to exactly one row's width so wrapping lands on the intended column
  // count — left to fill the screen, a rounding pixel can drop a card to the
  // next row and turn a 4×4 into a 3-wide grid.
  const rowWidth = cardSize * columns + gap * (columns - 1);

  return (
    <View style={[styles.grid, { gap, maxWidth: rowWidth }]}>
      {cards.map((card) => (
        <FlipCard
          key={card.id}
          card={card}
          size={cardSize}
          faceUp={faceUp.includes(card.id)}
          matched={matched.includes(card.key)}
          locked={locked}
          theme={theme}
          onPress={() => onFlip(card)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
    alignSelf: 'center',
  },
  press: {
    width: '100%',
    height: '100%',
  },
  half: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    shadowColor: '#1A2E3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  faceHalf: {
    padding: 8,
  },
  image: {
    width: '76%',
    height: '76%',
  },
  tick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
