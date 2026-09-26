import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Photo ↔ drawing pair match. Two columns of the same concepts, each shuffled,
 * and the child taps one card from each side to pair them.
 *
 * Tap-to-pair rather than drag: the drag boards in this module exist because
 * dragging *is* the skill being practised there (into a basket, into a box).
 * Here the skill is recognising that a photograph and a drawing are the same
 * thing, so a drag would only add a motor hurdle in front of it.
 *
 * Purely presentational — the shell owns what is matched, what is selected and
 * what a tap means. It reports taps and animates what it is told.
 */

/** Opaque hex → rgba, for the wash a matched card takes on. */
function tint(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function PairCard({ item, isMatched, isSelected, wrongNonce, locked, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  // Selecting lifts the card; matching pops it once and settles.
  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSelected ? 1.06 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();
  }, [isSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMatched) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.1, useNativeDriver: true, speed: 40, bounciness: 18 }),
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 16, bounciness: 10 }),
    ]).start();
  }, [isMatched]); // eslint-disable-line react-hooks/exhaustive-deps

  // A changing nonce is what replays the shake — a boolean would not fire twice
  // for the same wrong pair picked twice in a row.
  useEffect(() => {
    if (!wrongNonce) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [wrongNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const accent = isMatched  ? item.pairColor
               : isSelected ? theme.button
               : theme.cardOutline;

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          transform: [
            { scale },
            { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) },
          ],
        },
      ]}
    >
      <Pressable
        disabled={isMatched || locked}
        accessibilityRole="button"
        accessibilityLabel={isMatched ? `${item.label}, matched` : item.label}
        accessibilityState={{ selected: isSelected, disabled: isMatched }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            // Always the plain card surface. The concept artwork is PNG with an
            // opaque white backing, so any tint here shows up as a white box
            // around the picture instead of colouring the card.
            backgroundColor: theme.cardSurface,
            borderColor: accent,
            borderWidth: isSelected || isMatched ? 5 : 3,
            // Only the live cards float; a matched one settles onto the board.
            shadowOpacity: isMatched ? 0.04 : isSelected ? 0.22 : 0.1,
            shadowRadius:  isSelected ? 14 : 8,
            elevation:     isMatched ? 1 : isSelected ? 7 : 3,
          },
          pressed && !isMatched && !locked && styles.cardPressed,
        ]}
      >
        <Image source={item.image} style={styles.cardImage} resizeMode="contain" />

        {isMatched && (
          <View style={[styles.tick, { backgroundColor: item.pairColor }]}>
            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function PairMatchBoard({
  photos,
  drawings,
  matched,
  selected,
  wrongToken,
  theme,
  locked,
  onSelect,
}) {
  function renderColumn(side, items, icon, heading) {
    return (
      <View style={styles.column}>
        <View style={[styles.columnHead, { backgroundColor: tint(theme.cardOutline, 0.22) }]}>
          <Ionicons name={icon} size={14} color={theme.headingText} />
          <Text style={[styles.columnHeadText, { color: theme.headingText }]}>{heading}</Text>
        </View>

        {items.map((item) => {
          // The nonce only reaches the two cards that were actually wrong.
          const inWrongPair = wrongToken
            && (side === 'photo'
              ? wrongToken.photoKey === item.key
              : wrongToken.drawingKey === item.key);

          return (
            <PairCard
              key={item.key}
              item={item}
              isMatched={matched.includes(item.key)}
              isSelected={selected?.side === side && selected?.key === item.key}
              wrongNonce={inWrongPair ? wrongToken.n : 0}
              locked={locked}
              theme={theme}
              onPress={() => onSelect(side, item)}
            />
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {renderColumn('photo', photos, 'camera', 'PHOTO')}
      {renderColumn('drawing', drawings, 'color-palette', 'PICTURE')}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    gap: 54,
    paddingHorizontal: 30,
    paddingBottom: 14,
  },
  column: {
    flex: 1,
    gap: 12,
  },
  columnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  columnHeadText: {
    fontSize: 12,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: 1,
  },

  // Cards share the column's height rather than carrying a fixed one, so a
  // three-pair and a four-pair board both fill the space without scrolling.
  // The square comes from the row height: aspectRatio derives the width from it,
  // and maxWidth keeps a short, narrow column from pushing the square past its
  // own gutter.
  cardWrap: { flex: 1, alignItems: 'center' },
  card: {
    height: '100%',
    aspectRatio: 1,
    maxWidth: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    overflow: 'hidden',
    shadowColor: '#1A2E3B',
    shadowOffset: { width: 0, height: 4 },
  },
  cardPressed: {
    opacity: 0.9,
  },
  // Inset within the square rather than filling it, so the artwork sits inside
  // the card's border with room to breathe.
  cardImage: {
    width: '72%',
    height: '72%',
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
