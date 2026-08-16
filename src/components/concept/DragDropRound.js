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
import { Layout } from '../../constants/layout';

/**
 * "Drag the <concept> into the box." The Tier 2 drag-drop format.
 *
 * Pans are keyed to the round number by the shell (via `key`), so each round
 * mounts a fresh set at rest rather than inheriting the previous round's offsets.
 */
export default function DragDropRound({ round, concept, options, theme, locked, feedback, onAnswer }) {
  const { width, height } = useWindowDimensions();

  const ZONE_SIZE = Math.min(width, height) * 0.30;
  const GAP       = 20;
  const H_PAD     = Layout.spacing.lg;
  const count     = Math.max(options.length, 1);
  const CARD_W    = Math.min((width - H_PAD * 2 - GAP * (count - 1)) / count, 200);
  const CARD_H    = CARD_W;
  const IMG_SIZE  = Math.floor(CARD_W * 0.76);

  const dropZoneLayout = useRef(null);
  const pans = useRef(options.map(() => new Animated.ValueXY({ x: 0, y: 0 }))).current;

  function snapBack(pan) {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 5,
      tension: 80,
    }).start();
  }

  function isOverDropZone(g) {
    const dz = dropZoneLayout.current;
    if (!dz) return false;
    return (
      g.moveX >= dz.x && g.moveX <= dz.x + dz.width &&
      g.moveY >= dz.y && g.moveY <= dz.y + dz.height
    );
  }

  // Rebuilt whenever the option set or lock state changes; pans are stable refs.
  const panResponders = useMemo(
    () => options.map((item, i) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !locked,
        onMoveShouldSetPanResponder:  () => !locked,
        onPanResponderMove: Animated.event(
          [null, { dx: pans[i].x, dy: pans[i].y }],
          { useNativeDriver: false },
        ),
        onPanResponderRelease: (_, g) => {
          if (locked || !isOverDropZone(g)) { snapBack(pans[i]); return; }
          snapBack(pans[i]);
          onAnswer(item.key);
        },
        onPanResponderTerminate: () => snapBack(pans[i]),
      }),
    ),
    [options, locked, onAnswer], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const dropped = feedback?.selectedKey
    ? options.find((o) => o.key === feedback.selectedKey)
    : null;
  const droppedCorrect = feedback?.result === 'correct';

  return (
    <View style={styles.root}>
      <Text style={[styles.question, { color: theme.headingText }]}>
        Drag the {concept.label.toLowerCase()} into the box
      </Text>

      <View
        onLayout={(e) => {
          e.target.measure((_x, _y, w, h, pageX, pageY) => {
            dropZoneLayout.current = { x: pageX, y: pageY, width: w, height: h };
          });
        }}
        style={[
          styles.dropZone,
          {
            width:  ZONE_SIZE,
            height: ZONE_SIZE,
            borderColor: dropped ? (droppedCorrect ? '#4CAF50' : '#F44336') : theme.cardOutline,
            borderStyle: dropped ? 'solid' : 'dashed',
            backgroundColor: dropped
              ? (droppedCorrect ? '#C8F0CC' : '#FFD6D6')
              : 'rgba(255,255,255,0.35)',
          },
        ]}
      >
        {dropped ? (
          <Image
            source={dropped.real}
            style={{ width: ZONE_SIZE * 0.78, height: ZONE_SIZE * 0.78 }}
            resizeMode="contain"
          />
        ) : (
          <Ionicons
            name="arrow-down-circle-outline"
            size={40}
            color={theme.cardOutline}
            style={{ opacity: 0.4 }}
          />
        )}
      </View>

      <View style={[styles.cardsRow, { gap: GAP, paddingHorizontal: H_PAD }]}>
        {options.map((item, i) => (
          <Animated.View
            key={item.key}
            style={[
              styles.optionCard,
              {
                width:  CARD_W,
                height: CARD_H,
                backgroundColor: theme.cardSurface,
                borderColor:     theme.cardOutline,
                opacity: dropped && dropped.key === item.key ? 0.25 : 1,
                transform: [
                  { translateX: pans[i].x },
                  { translateY: pans[i].y },
                ],
              },
            ]}
            {...panResponders[i].panHandlers}
          >
            <View style={{ width: IMG_SIZE, height: IMG_SIZE }}>
              <Image source={item.real} style={styles.optionImage} resizeMode="contain" />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 20 },

  question: {
    fontSize: 24,
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  dropZone: {
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  optionCard: {
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  optionImage: { width: '100%', height: '100%' },
});
