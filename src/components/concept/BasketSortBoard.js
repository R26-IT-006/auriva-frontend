import { useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLOR_HEX, labelInkFor } from '../../data/conceptConclusions';
import { Layout } from '../../constants/layout';

/**
 * "Put each one in the basket of its colour." The conclusion-activity board.
 *
 * Purely presentational: owns no progression state and no notion of a score. It
 * reports a drop and animates whatever the shell says the answer was — the shell
 * decides what a drop means, what gets logged, and when the game is over.
 *
 * `onDrop(item, colorKey)` must return true/false synchronously so the board can
 * play the right reaction on the basket the finger was over.
 *
 * Built on the same drag mechanics as DragDropRound (which is left untouched —
 * it is still the Tier 2 / activity-shell round). The difference is N drop zones
 * instead of one, so layouts are measured into an array and hit-tested in turn.
 */
export default function BasketSortBoard({ baskets, items, placed, theme, locked, onDrop }) {
  const { width, height } = useWindowDimensions();

  const H_PAD    = Layout.spacing.lg;
  const GAP      = 18;
  const BASKET_W = Math.min((width - H_PAD * 2 - GAP * (baskets.length - 1)) / baskets.length, 210);
  const BASKET_H = Math.min(BASKET_W * 0.82, height * 0.30);
  const CARD_W   = Math.min((width - H_PAD * 2 - GAP * 5) / 6, 122);

  // Page-space rects for each basket. measureInWindow gives page coordinates
  // directly, and re-running it on every layout pass keeps the hit boxes correct
  // after a rotation.
  const zoneLayouts = useRef([]);
  const basketRefs  = useRef([]);

  function measureBaskets() {
    basketRefs.current.forEach((ref, i) => {
      ref?.measureInWindow((x, y, w, h) => {
        if (w && h) zoneLayouts.current[i] = { x, y, width: w, height: h };
      });
    });
  }

  // Keyed by concept, not by index: items leave the tray as they are placed, and
  // index-keyed pans would hand a departing item's offsets to its neighbour.
  const pansRef = useRef(new Map());
  function panFor(key) {
    if (!pansRef.current.has(key)) {
      pansRef.current.set(key, new Animated.ValueXY({ x: 0, y: 0 }));
    }
    return pansRef.current.get(key);
  }

  const basketScales = useRef(baskets.map(() => new Animated.Value(1))).current;
  const basketShakes = useRef(baskets.map(() => new Animated.Value(0))).current;

  function snapBack(pan) {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 5,
      tension: 80,
    }).start();
  }

  function bounceBasket(i) {
    Animated.sequence([
      Animated.spring(basketScales[i], { toValue: 1.12, useNativeDriver: true, bounciness: 18, speed: 20 }),
      Animated.spring(basketScales[i], { toValue: 1,    useNativeDriver: true, bounciness: 12, speed: 14 }),
    ]).start();
  }

  function shakeBasket(i) {
    basketShakes[i].setValue(0);
    Animated.sequence([
      Animated.timing(basketShakes[i], { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(basketShakes[i], { toValue:  1, duration: 60, useNativeDriver: true }),
      Animated.timing(basketShakes[i], { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(basketShakes[i], { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  /**
   * The basket the child meant, or -1 for a drop that was nowhere near one.
   *
   * Tier2DragDropScreen forgives a near-miss by padding its single drop zone by
   * a third on every side, for children still developing fine motor control. The
   * same padding here would make three adjacent baskets overlap and turn a
   * near-miss into an arbitrary pick, so forgiveness is expressed as "nearest
   * basket centre within reach" instead: just as generous, never ambiguous.
   */
  function hitTestZone(g) {
    const zones = zoneLayouts.current;

    const exact = zones.findIndex((z) =>
      z &&
      g.moveX >= z.x && g.moveX <= z.x + z.width &&
      g.moveY >= z.y && g.moveY <= z.y + z.height
    );
    if (exact !== -1) return exact;

    let best = -1;
    let bestDistance = Infinity;
    zones.forEach((z, i) => {
      if (!z) return;
      const dx = g.moveX - (z.x + z.width / 2);
      const dy = g.moveY - (z.y + z.height / 2);
      const distance = Math.hypot(dx, dy);
      const reach = Math.max(z.width, z.height) * 0.85;
      if (distance < reach && distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  const panResponders = useMemo(
    () => items.map((item) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !locked,
        onMoveShouldSetPanResponder:  () => !locked,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: Animated.event(
          [null, { dx: panFor(item.key).x, dy: panFor(item.key).y }],
          { useNativeDriver: false },
        ),
        onPanResponderRelease: (_, g) => {
          const pan = panFor(item.key);
          if (locked) { snapBack(pan); return; }

          const zone = hitTestZone(g);
          if (zone === -1) { snapBack(pan); return; }

          const correct = onDrop(item, baskets[zone].colorKey);
          if (correct) {
            // Reset without animating: the shell's re-render moves this item out
            // of the tray and into the basket, so a spring-back would just be a
            // stray card flying across a board it has already left.
            pan.setValue({ x: 0, y: 0 });
            bounceBasket(zone);
          } else {
            snapBack(pan);
            shakeBasket(zone);
          }
        },
        onPanResponderTerminate: () => snapBack(panFor(item.key)),
      }),
    ),
    [items, locked, onDrop, baskets], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <View style={styles.root}>

      {/* Baskets */}
      <View style={[styles.basketRow, { gap: GAP, paddingHorizontal: H_PAD }]}>
        {baskets.map((basket, i) => {
          const hex      = COLOR_HEX[basket.colorKey] ?? theme.cardOutline;
          const contents = placed[basket.colorKey] ?? [];
          const shown    = contents.slice(0, 4);
          const overflow = contents.length - shown.length;

          return (
            /* The measured node is this plain wrapper, not the animated child.
               measureInWindow reports a node's *transformed* rect, so measuring
               the bouncing view would capture the hit box at 1.12x scale if a
               layout pass landed mid-bounce. */
            <View
              key={basket.colorKey}
              ref={(r) => { basketRefs.current[i] = r; }}
              onLayout={measureBaskets}
              style={{ width: BASKET_W, height: BASKET_H }}
            >
              <Animated.View
                style={[
                  styles.basket,
                  {
                    width:  '100%',
                    height: '100%',
                    borderColor: hex,
                    transform: [
                      { scale: basketScales[i] },
                      {
                        translateX: basketShakes[i].interpolate({
                          inputRange:  [-1, 1],
                          outputRange: [-9, 9],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={[styles.basketLabelRow, { backgroundColor: hex }]}>
                  {basket.icon && (
                    <Image source={basket.icon} style={styles.basketSwatch} resizeMode="contain" />
                  )}
                  <Text
                    style={[styles.basketLabel, { color: labelInkFor(basket.colorKey) }]}
                    numberOfLines={1}
                  >
                    {basket.label}
                  </Text>
                </View>

                <View style={styles.basketBody}>
                  {shown.length === 0 ? (
                    <Ionicons name="basket-outline" size={34} color={hex} style={{ opacity: 0.35 }} />
                  ) : (
                    <View style={styles.basketContents}>
                      {shown.map((c) => (
                        <Image
                          key={c.key}
                          source={c.icon ?? c.real}
                          style={styles.basketThumb}
                          resizeMode="contain"
                        />
                      ))}
                      {overflow > 0 && (
                        <Text style={[styles.basketOverflow, { color: hex }]}>+{overflow}</Text>
                      )}
                    </View>
                  )}
                </View>
              </Animated.View>
            </View>
          );
        })}
      </View>

      {/* Tray */}
      <View style={[styles.tray, { gap: GAP, paddingHorizontal: H_PAD }]}>
        {items.map((item, i) => {
          const pan = panFor(item.key);
          return (
            <Animated.View
              key={item.key}
              style={[
                styles.card,
                {
                  width:  CARD_W,
                  height: CARD_W,
                  backgroundColor: theme.cardSurface,
                  borderColor:     theme.cardOutline,
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                  ],
                },
              ]}
              {...panResponders[i].panHandlers}
            >
              <Image
                source={item.real ?? item.icon}
                style={styles.cardImage}
                resizeMode="contain"
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
  },

  basketRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  basket: {
    borderRadius: 22,
    borderWidth: 4,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
  },
  basketLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  basketSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  basketLabel: {
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
  },
  basketBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  basketContents: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  basketThumb: {
    width: 40,
    height: 40,
  },
  basketOverflow: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
  },

  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
});
