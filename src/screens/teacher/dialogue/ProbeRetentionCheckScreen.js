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

// Every word folder now has its own Non_Verbal.jpg — `correct` is the tapped
// word's own photo; wrong1/wrong2 borrow OTHER words' own Non_Verbal.jpg as
// decoys (same cross-word-distractor approach used in the Phase 3 screens),
// rotated so no two words in a category share the exact same distractor pair.
const MAGIC_WORDS_NV_IMAGES = {
  thank_you: {
    correct: require('../../../../assets/dialogue-images/words/magic_words/thank_you/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/magic_words/excuse_me/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/magic_words/im_sorry/Non_Verbal.jpg'),
  },
  im_sorry: {
    correct: require('../../../../assets/dialogue-images/words/magic_words/im_sorry/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/magic_words/youre_welcome/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/magic_words/excuse_me/Non_Verbal.jpg'),
  },
  youre_welcome: {
    correct: require('../../../../assets/dialogue-images/words/magic_words/youre_welcome/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/magic_words/excuse_me/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/magic_words/thank_you/Non_Verbal.jpg'),
  },
  excuse_me: {
    correct: require('../../../../assets/dialogue-images/words/magic_words/excuse_me/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/magic_words/thank_you/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/magic_words/im_sorry/Non_Verbal.jpg'),
  },
};

const MAGIC_WORDS_NV_CAPTIONS = {
  thank_you:     ['Anjalie receives\na present',  'Saman needs to\npass by Anjalie', 'Saman bumps into\nAnjalie'],
  im_sorry:      ['Saman bumps into\nAnjalie',    'Anjalie says\n"Thank you"',       'Saman needs to\npass by Anjalie'],
  youre_welcome: ['Anjalie says\n"Thank you"',    'Saman needs to\npass by Anjalie', 'Anjalie receives\na present'],
  excuse_me:     ['Saman needs to\npass by Anjalie', 'Anjalie receives\na present',  'Saman bumps into\nAnjalie'],
};

// Same cross-word-distractor pattern as magic_words above, rotated through
// all 9 greetings words.
const GREETINGS_NV_IMAGES = {
  hello: {
    correct: require('../../../../assets/dialogue-images/words/greetings/hello/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/goodbye/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/good_morning/Non_Verbal.jpg'),
  },
  goodbye: {
    correct: require('../../../../assets/dialogue-images/words/greetings/goodbye/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/good_morning/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/good_afternoon/Non_Verbal.jpg'),
  },
  good_morning: {
    correct: require('../../../../assets/dialogue-images/words/greetings/good_morning/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/good_afternoon/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/good_night/Non_Verbal.jpg'),
  },
  good_afternoon: {
    correct: require('../../../../assets/dialogue-images/words/greetings/good_afternoon/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/good_night/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/happy_birthday/Non_Verbal.jpg'),
  },
  good_night: {
    correct: require('../../../../assets/dialogue-images/words/greetings/good_night/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/happy_birthday/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/how_are_you/Non_Verbal.jpg'),
  },
  happy_birthday: {
    correct: require('../../../../assets/dialogue-images/words/greetings/happy_birthday/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/how_are_you/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/im_fine/Non_Verbal.jpg'),
  },
  how_are_you: {
    correct: require('../../../../assets/dialogue-images/words/greetings/how_are_you/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/im_fine/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/happy_new_year/Non_Verbal.jpg'),
  },
  im_fine: {
    correct: require('../../../../assets/dialogue-images/words/greetings/im_fine/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/happy_new_year/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/hello/Non_Verbal.jpg'),
  },
  happy_new_year: {
    correct: require('../../../../assets/dialogue-images/words/greetings/happy_new_year/Non_Verbal.jpg'),
    wrong1:  require('../../../../assets/dialogue-images/words/greetings/hello/Non_Verbal.jpg'),
    wrong2:  require('../../../../assets/dialogue-images/words/greetings/goodbye/Non_Verbal.jpg'),
  },
};

const GREETINGS_NV_CAPTIONS = {
  hello:          ['Friends greeting\neach other',                    'Waving goodbye\nat the door',       'Greeting teacher\nin the morning'],
  goodbye:        ['Waving goodbye\nat the door',                     'Greeting teacher\nin the morning',  'Afternoon greeting\nafter school'],
  good_morning:   ['Greeting teacher\nin the morning',                'Afternoon greeting\nafter school',  'Going to bed\nat night'],
  good_afternoon: ['Afternoon greeting\nafter school',                'Going to bed\nat night',            'Birthday party\nwith friends'],
  good_night:     ['Going to bed\nat night',                          'Birthday party\nwith friends',      'Asking a friend\nhow they are feeling'],
  happy_birthday: ['Birthday party\nwith friends',                    'Asking a friend\nhow they are feeling', 'Answering happily\nwhen asked "How are you?"'],
  how_are_you:    ['Asking a friend\nhow they are feeling',           'Answering happily\nwhen asked "How are you?"', 'New Year\ncelebration with family'],
  im_fine:        ['Answering happily\nwhen asked "How are you?"',    'New Year\ncelebration with family', 'Friends greeting\neach other'],
  happy_new_year: ['New Year\ncelebration with family',               'Friends greeting\neach other',      'Waving goodbye\nat the door'],
};

// Same cross-word-distractor pattern, rotated through all 17 abilities words
// (difficulty 1 and 2 both — every word folder has its own Non_Verbal.jpg).
function abilitiesFolder(wordKey) {
  if (wordKey === 'cat3_yes') return 'yes';
  if (wordKey === 'cat3_no')  return 'no';
  return wordKey;
}
const ABILITIES_NV_CAPTION_TEXT = {
  cat3_yes: 'Saying yes!',
  cat3_no:  'Saying no!',
  clap:     'Clapping hands',
  run:      'Running fast',
  walk:     'Walking along',
  jump:     'Jumping up high',
  talk:     'Talking to someone',
  dance:    'Dancing around',
  sing:     'Singing a song',
  brush:    'Brushing your teeth',
  wash:     'Washing your hands',
  eat:      'Eating your food',
  drink:    'Drinking some water',
  write:    'Writing a letter',
  play:     'Playing with toys',
  sleep:    'Sleeping soundly',
  watch:    'Watching TV',
};
const ABILITIES_ORDER = [
  'cat3_yes', 'cat3_no', 'clap', 'run', 'walk', 'jump', 'talk', 'dance', 'sing',
  'brush', 'wash', 'eat', 'drink', 'write', 'play', 'sleep', 'watch',
];
function abilitiesImage(wordKey) {
  const folder = abilitiesFolder(wordKey);
  const images = {
    yes:   require('../../../../assets/dialogue-images/words/abilities/yes/Non_Verbal.jpg'),
    no:    require('../../../../assets/dialogue-images/words/abilities/no/Non_Verbal.jpg'),
    clap:  require('../../../../assets/dialogue-images/words/abilities/clap/Non_Verbal.jpg'),
    run:   require('../../../../assets/dialogue-images/words/abilities/run/Non_Verbal.jpg'),
    walk:  require('../../../../assets/dialogue-images/words/abilities/walk/Non_Verbal.jpg'),
    jump:  require('../../../../assets/dialogue-images/words/abilities/jump/Non_Verbal.jpg'),
    talk:  require('../../../../assets/dialogue-images/words/abilities/talk/Non_Verbal.jpg'),
    dance: require('../../../../assets/dialogue-images/words/abilities/dance/Non_Verbal.jpg'),
    sing:  require('../../../../assets/dialogue-images/words/abilities/sing/Non_Verbal.jpg'),
    brush: require('../../../../assets/dialogue-images/words/abilities/brush/Non_Verbal.jpg'),
    wash:  require('../../../../assets/dialogue-images/words/abilities/wash/Non_Verbal.jpg'),
    eat:   require('../../../../assets/dialogue-images/words/abilities/eat/Non_Verbal.jpg'),
    drink: require('../../../../assets/dialogue-images/words/abilities/drink/Non_Verbal.jpg'),
    write: require('../../../../assets/dialogue-images/words/abilities/write/Non_Verbal.jpg'),
    play:  require('../../../../assets/dialogue-images/words/abilities/play/Non_Verbal.jpg'),
    sleep: require('../../../../assets/dialogue-images/words/abilities/sleep/Non_Verbal.jpg'),
    watch: require('../../../../assets/dialogue-images/words/abilities/watch/Non_Verbal.jpg'),
  };
  return images[folder];
}
const ABILITIES_NV_IMAGES = Object.fromEntries(ABILITIES_ORDER.map((key, i) => {
  const wrong1Key = ABILITIES_ORDER[(i + 1) % ABILITIES_ORDER.length];
  const wrong2Key = ABILITIES_ORDER[(i + 2) % ABILITIES_ORDER.length];
  return [key, {
    correct: abilitiesImage(key),
    wrong1:  abilitiesImage(wrong1Key),
    wrong2:  abilitiesImage(wrong2Key),
  }];
}));
const ABILITIES_NV_CAPTIONS = Object.fromEntries(ABILITIES_ORDER.map((key, i) => {
  const wrong1Key = ABILITIES_ORDER[(i + 1) % ABILITIES_ORDER.length];
  const wrong2Key = ABILITIES_ORDER[(i + 2) % ABILITIES_ORDER.length];
  return [key, [
    ABILITIES_NV_CAPTION_TEXT[key],
    ABILITIES_NV_CAPTION_TEXT[wrong1Key],
    ABILITIES_NV_CAPTION_TEXT[wrong2Key],
  ]];
}));

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
