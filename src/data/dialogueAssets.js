// Static require() map for all Level-1 dialogue word assets.
// React Native requires static paths — dynamic require() is NOT allowed.
// Base path: assets/dialogue-images/words/{category}/{word_key}/
//
// NOTE: thank_you uses its own naming convention (correct_contextN / context_wrongN).
// NOTE: here_you_are and here_it_is have no image assets yet — add entries when artwork is ready.

export const DIALOGUE_WORD_ASSETS = {
  // ── Greetings ────────────────────────────────────────────────────────────
  hello: {
    // "scene" reuses contextCorrect — hello uses the numbered/comic-strip
    // convention (no single scene.png exists for it).
    scene:          require('../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  goodbye: {
    // "scene" reuses contextCorrect — goodbye uses the numbered/comic-strip
    // convention (no single scene.png exists for it).
    scene:          require('../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/goodbye/context_wrong1.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/goodbye/context_wrong2.png'),
  },
  good_morning: {
    // "scene" reuses contextCorrect — good_morning uses the numbered/comic-
    // strip convention (no single scene.png exists for it).
    scene:          require('../../assets/dialogue-images/words/greetings/good_morning/correct_context1.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/good_morning/correct_context1.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/good_morning/context_wrong1.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/good_morning/context_wrong2.png'),
  },
  // good_afternoon — real assets uploaded 2026-08-24. scene (AnimatedWord)
  // uses correct_context1, boldScene (BoldWord) uses correct_context2, so
  // the two familiarisation screens show different photos of the same word.
  good_afternoon: {
    scene:     require('../../assets/dialogue-images/words/greetings/good_afternoon/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/greetings/good_afternoon/correct_context2.jpg'),
  },
  good_night: {
    scene:     require('../../assets/dialogue-images/words/greetings/good_night/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/greetings/good_night/correct_context2.jpg'),
  },
  happy_birthday: {
    scene:     require('../../assets/dialogue-images/words/greetings/happy_birthday/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/greetings/happy_birthday/correct_context2.jpg'),
  },
  how_are_you: {
    scene:     require('../../assets/dialogue-images/words/greetings/how_are_you/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/greetings/how_are_you/correct_context2.jpg'),
  },
  im_fine: {
    scene:     require('../../assets/dialogue-images/words/greetings/im_fine/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/greetings/im_fine/correct_context2.jpg'),
  },
  happy_new_year: {
    scene:     require('../../assets/dialogue-images/words/greetings/happy_new_year/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/greetings/happy_new_year/correct_context2.jpg'),
  },

  // ── Magic Words ──────────────────────────────────────────────────────────
  // thank_you uses its own naming scheme (correct_contextN / context_wrongN).
  // "scene" reuses contextCorrect — no single scene.png exists for it.
  // Also has correct_context5.png / correct_context6.jpeg (extra variants,
  // note the .jpeg extension on #6) not used by the current 4-key mapping.
  thank_you: {
    scene:          require('../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
    contextCorrect: require('../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
    contextWrong:   require('../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
  },
  // im_sorry — real assets uploaded 2026-08-24 (same scene/boldScene split
  // as the greetings words above).
  im_sorry: {
    scene:     require('../../assets/dialogue-images/words/magic_words/im_sorry/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/magic_words/im_sorry/correct_context2.jpg'),
  },
  // youre_welcome uses comic-strip naming (correct_contextN / context_wrongN)
  youre_welcome: {
    scene:           require('../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context1.png'),
    correctContext1: require('../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context1.png'),
    correctContext2: require('../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context2.png'),
    correctContext3: require('../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context3.png'),
    correctContext4: require('../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context4.png'),
    contextWrong1:   require('../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong1.png'),
    contextWrong2:   require('../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong2.png'),
    contextWrong3:   require('../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong3.png'),
    contextWrong4:   require('../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong4.png'),
  },
  // excuse_me — real assets uploaded 2026-08-24 (same scene/boldScene split
  // as the greetings words above).
  excuse_me: {
    scene:     require('../../assets/dialogue-images/words/magic_words/excuse_me/correct_context1.jpg'),
    boldScene: require('../../assets/dialogue-images/words/magic_words/excuse_me/correct_context2.jpg'),
  },
};
// Abilities: no entries — the scene/context-correct/context-wrong concept
// does not apply to this category (confirmed 2026-07-28); previously-present
// entries (clap, run, walk, jump, talk, dance, sing, can_you, yes_i_can,
// no_i_cant, i_can) were removed, not defaulted to placeholder.
// Days of the Week: no entries — category retired (R-10); previously-present
// entries were removed at the human's explicit direction (2026-07-28),
// overriding this file's own earlier "leave as-is" note for the category.
