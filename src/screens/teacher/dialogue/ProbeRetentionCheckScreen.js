import { useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { dialogueApi } from '../../../api/dialogue';
import { cat3Api } from '../../../api/cat3';

// Rule 5 — periodic production probe (TASK-37 backend, TASK-39 frontend).
// Shared/category-agnostic, reached only from ProbeProductionScreen.js when
// speech_emerged: false. Reuses the multiple-choice-image-tap visual pattern
// from the existing non-verbal screens (Phase2NonVerbalScreen.js /
// GreetingPhase2NonVerbalScreen.js / Cat3Phase2NonVerbalScreen.js) for
// consistency of look-and-feel — the image/caption data below is duplicated
// from those three files' own NV_IMAGES/NV_CAPTIONS maps (this codebase's
// established per-screen duplication pattern), combined and switched by
// `category`. Deliberately does NOT reuse those screens' wrong-count
// escalation/correct-reveal state machine or any advance_to_phase3 logic —
// this is a neutral check-in, never a right/wrong indicator.

const MAGIC_WORDS_NV_IMAGES = {
  thank_you: {
    correct: require('../../../../assets/dialogue-images/Non-verbal/thankyou_NV_correct.png'),
    wrong1:  require('../../../../assets/dialogue-images/Non-verbal/thankyou_NV_wrong1.png'),
    wrong2:  require('../../../../assets/dialogue-images/Non-verbal/thankyou_NV_wrong2.png'),
  },
  im_sorry: {
    correct: require('../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
    wrong1:  require('../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
    wrong2:  require('../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
  },
  youre_welcome: {
    correct: require('../../../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context1.png'),
    wrong1:  require('../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong1.png'),
    wrong2:  require('../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong2.png'),
  },
  excuse_me: {
    correct: require('../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
    wrong1:  require('../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
    wrong2:  require('../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
  },
};

const MAGIC_WORDS_NV_CAPTIONS = {
  thank_you:     ['Anjalie receives\na present',  'Saman is reading\na book',  'Anjalie and Saman are\nplaying'],
  im_sorry:      ['Saman bumps into\nAnjalie',    'They are drawing\ntogether',  'Anjalie is eating\nher lunch'],
  youre_welcome: ["Anjalie says\n'Thank you'",    'Anjalie is sleeping',         'They are running\noutside'],
  excuse_me:     ['Saman needs to\npass by',      'Anjalie is drawing',          'Saman is playing\nwith toys'],
};

// Non-verbal pathway images are not yet available for most greeting words —
// using context images as placeholders, same as GreetingPhase2NonVerbalScreen.js.
const HELLO_NV = {
  correct: require('../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
  wrong1:  require('../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
  wrong2:  require('../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
};
const GREETINGS_NV_IMAGES = {
  hello: {
    correct: require('../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  goodbye: {
    correct: require('../../../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong1.png'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong2.png'),
  },
  good_morning: {
    correct: require('../../../../assets/dialogue-images/words/greetings/good_morning/correct_context1.png'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong1.png'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong2.png'),
  },
  good_afternoon: HELLO_NV,
  good_night:     HELLO_NV,
  happy_birthday: HELLO_NV,
  how_are_you:    HELLO_NV,
  im_fine:        HELLO_NV,
  happy_new_year: HELLO_NV,
};

const GREETINGS_NV_CAPTIONS = {
  hello:          ['Friends greeting\neach other',        'A child saying\nGoodbye',            'A child eating\nlunch'],
  goodbye:        ['Waving goodbye\nat the door',         'Playing at\nthe park',               'Eating dinner\ntogether'],
  good_morning:   ['Morning greeting\nat school',         'Playing in\nthe evening',            'Reading a book\nat night'],
  good_afternoon: ['Afternoon greeting\nafter school',    'Having breakfast\nin the morning',   'Playing outside\nat night'],
  good_night:     ['Going to bed\nat night',              'Playing in\nthe morning',            'Having lunch\ntogether'],
  happy_birthday: ['Birthday party\nwith friends',        'Eating lunch\ntogether',             'Playing football\noutside'],
  how_are_you:    ['Asking a friend\nhow they are',       'Playing alone\noutside',             'Eating dinner\nquietly'],
  im_fine:        ['Answering happily\n"I\'m Fine"',      'Running outside\nalone',             'Reading a\nstorybook'],
  happy_new_year: ['New Year\ncelebration',               'Playing in\nthe garden',             'Eating breakfast\nalone'],
};

const CAN_YOU_NV = {
  correct: require('../../../../assets/dialogue-images/words/abilities/can_you/context_correct.png'),
  wrong1:  require('../../../../assets/dialogue-images/words/abilities/can_you/context_wrong.png'),
  wrong2:  require('../../../../assets/dialogue-images/words/abilities/can_you/context_wrong_2.png'),
};
const ABILITIES_NV_IMAGES = {
  cat3_yes: CAN_YOU_NV,
  cat3_no:  CAN_YOU_NV,
  clap:     CAN_YOU_NV,
  run: {
    correct: require('../../../../assets/dialogue-images/words/abilities/run/Non_verbal.jpeg'),
    wrong1:  require('../../../../assets/dialogue-images/words/abilities/clap/Phase3.jpeg'),
    wrong2:  require('../../../../assets/dialogue-images/words/abilities/walk/Phase3.jpeg'),
  },
  walk: CAN_YOU_NV,
  jump: CAN_YOU_NV,
  talk: CAN_YOU_NV,
  dance: CAN_YOU_NV,
  sing: CAN_YOU_NV,
};

const ABILITIES_NV_CAPTIONS = {
  cat3_yes: ['Saying yes!',        'Playing alone',   'Looking away'],
  cat3_no:  ['Saying no!',         'Clapping hands',  'Running around'],
  clap:     ['Clapping hands',     'Running outside', 'Jumping up'],
  run:      ['Running fast',       'Clapping',        'Walking to School'],
  walk:     ['Walking along',      'Jumping high',    'Dancing around'],
  jump:     ['Jumping up high',    'Walking slowly',  'Talking quietly'],
  talk:     ['Talking to someone', 'Clapping hands',  'Running outside'],
  dance:    ['Dancing around',     'Singing a song',  'Walking slowly'],
  sing:     ['Singing a song',     'Dancing around',  'Jumping high'],
};

function nvDataFor(category, assetKey) {
  const [images, captions] =
    category === 'abilities'    ? [ABILITIES_NV_IMAGES,    ABILITIES_NV_CAPTIONS] :
    category === 'magic_words'  ? [MAGIC_WORDS_NV_IMAGES,  MAGIC_WORDS_NV_CAPTIONS] :
    /* greetings */                [GREETINGS_NV_IMAGES,    GREETINGS_NV_CAPTIONS];
  return { images: images[assetKey], captions: captions[assetKey] };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ProbeRetentionCheckScreen({ route, navigation }) {
  const { student, category, wordId, word, assetKey } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = word ?? '';

  const { images: nvImages, captions } = nvDataFor(category, assetKey);

  const imageItems = useMemo(() => {
    if (!nvImages) return [];
    return shuffleArray([
      { id: 'correct', image: nvImages.correct, caption: captions?.[0], isCorrect: true },
      { id: 'wrong1',  image: nvImages.wrong1,  caption: captions?.[1], isCorrect: false },
      { id: 'wrong2',  image: nvImages.wrong2,  caption: captions?.[2], isCorrect: false },
    ]);
  }, []);

  const [answered, setAnswered] = useState(false);

  function handleTap(item) {
    if (answered) return;
    setAnswered(true);

    if (category === 'abilities') {
      cat3Api.recordPhase2NonVerbal(student?.sid, wordId, item.isCorrect, undefined, true).catch(() => {});
    } else {
      dialogueApi.recordPhase2Nonverbal(student?.sid, wordId, {
        imageSelectedCorrect: item.isCorrect,
        isProbe: true,
      }).catch(() => {});
    }
  }

  function exitToOverview() {
    navigation.navigate('Level1Overview', { student, categoryKey: category });
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          {/* "Not now" exit — ungated, no hardware-back interception; a probe is optional and low-stakes */}
          <TouchableOpacity onPress={exitToOverview} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="close" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Quick check-in</Text>
          <View style={styles.headerSide} />
        </View>
      </SafeAreaView>

      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {!answered ? (
              <>
                <Text style={[styles.title, { color: theme.headingText }]}>
                  {"Where do we say '"}
                  <Text style={{ color: theme.button, fontWeight: '800' }}>{wordLabel}</Text>
                  {"'?"}
                </Text>
                <Text style={[styles.subtitle, { color: theme.headingText }]}>
                  Tap the picture
                </Text>

                <View style={styles.cardsRow}>
                  {imageItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleTap(item)}
                      activeOpacity={0.82}
                      style={[styles.imageCard, { backgroundColor: theme.cardSurface }]}
                    >
                      <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
                      <Text style={[styles.cardCaption, { color: theme.headingText }]} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.closingWrap}>
                <Ionicons name="heart" size={40} color={theme.button} />
                <Text style={[styles.closingText, { color: theme.headingText }]}>
                  Thanks for checking in!
                </Text>
                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: theme.button }]}
                  onPress={exitToOverview}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.doneBtnText, { color: theme.buttonText }]}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    paddingVertical:   12,
  },
  headerSide:  { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Layout.fontSize.md, fontWeight: '700' },

  body: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom:     Layout.spacing.xl,
    gap:               8,
  },

  title: {
    fontSize:     Layout.fontSize.xl,
    fontWeight:   '700',
    textAlign:    'center',
    marginBottom: Layout.spacing.xs,
  },
  subtitle: {
    fontSize:     Layout.fontSize.sm,
    textAlign:    'center',
    opacity:      0.65,
    marginBottom: Layout.spacing.lg,
  },

  cardsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            Layout.spacing.sm,
  },
  imageCard: {
    width:        104,
    borderRadius: Layout.radius.lg,
    overflow:     'hidden',
    ...Layout.shadow.sm,
  },
  cardImage: { width: '100%', height: 104 },
  cardCaption: {
    fontSize:          Layout.fontSize.xs,
    fontWeight:         '600',
    textAlign:          'center',
    paddingHorizontal:  Layout.spacing.xs,
    paddingVertical:    Layout.spacing.sm,
  },

  closingWrap: { alignItems: 'center', gap: Layout.spacing.lg },
  closingText: { fontSize: Layout.fontSize.xl, fontWeight: '700', textAlign: 'center' },
  doneBtn: {
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.md,
  },
  doneBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
