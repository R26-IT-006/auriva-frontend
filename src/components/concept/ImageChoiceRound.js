import { useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { getConceptQuestion, getConceptQuestionSi } from '../../data/conceptData';
import { Layout } from '../../constants/layout';

/**
 * "Can you find a <concept>?" — tap the matching picture.
 * The Tier 1 format, so it is the first thing a child sees in every activity.
 *
 * Purely presentational: owns no progression state. The shell decides what a tap
 * means and when to advance.
 */
function OptionCard({ item, cardW, cardH, imgSize, locked, isCorrect, isWrong, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    if (locked) return;
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width:  cardW,
          height: cardH,
          backgroundColor: isCorrect ? '#C8F0CC' : isWrong ? '#FFD6D6' : theme.cardSurface,
          borderColor:     isCorrect ? '#4CAF50' : isWrong ? '#F44336' : theme.cardOutline,
          transform: [{ scale }],
        },
        isCorrect && styles.cardCorrect,
        isWrong   && styles.cardWrong,
      ]}
    >
      <Pressable
        disabled={locked}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.cardTouchable}
      >
        <View style={{ width: imgSize, height: imgSize }}>
          <Image source={item.real} style={styles.cardImage} resizeMode="contain" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ImageChoiceRound({ round, concept, options, theme, locked, feedback, onAnswer }) {
  const { width } = useWindowDimensions();

  const GAP    = 20;
  const H_PAD  = Layout.spacing.lg;
  const count  = Math.max(options.length, 1);
  // The cap keeps a 2-option round from becoming absurdly wide on a tablet; the
  // divided width takes over at 4 options so the row still fits.
  const cardW  = Math.min(
    (width - H_PAD * 2 - GAP * (count - 1)) / count,
    280,
  );
  const cardH   = cardW;
  const imgSize = Math.floor(cardW * 0.76);

  return (
    <View style={styles.root}>
      <View style={styles.questionBlock}>
        <Text style={[styles.questionEn, { color: theme.headingText }]}>
          {getConceptQuestion(concept)}
        </Text>
        {concept.labelSi && (
          <Text style={[styles.questionSi, { color: theme.headingText }]}>
            {getConceptQuestionSi(concept)}
          </Text>
        )}
      </View>

      <View style={[styles.cardsRow, { paddingHorizontal: H_PAD, gap: GAP }]}>
        {options.map((item) => {
          const tapped = feedback?.selectedKey === item.key;
          return (
            <OptionCard
              key={item.key}
              item={item}
              cardW={cardW}
              cardH={cardH}
              imgSize={imgSize}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },

  questionBlock: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: Layout.spacing.lg,
    gap: 4,
  },
  questionEn: {
    fontSize: 26,
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  questionSi: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    opacity: 0.65,
    textAlign: 'center',
  },

  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    borderRadius: 32,
    borderWidth: 3.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  cardCorrect: { shadowColor: '#4CAF50', shadowOpacity: 0.3, elevation: 7 },
  cardWrong:   { shadowColor: '#F44336', shadowOpacity: 0.25, elevation: 5 },
  cardTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cardImage: { width: '100%', height: '100%' },
});
