// Static require() map for all Level-1 dialogue word assets.
// React Native requires static paths — dynamic require() is NOT allowed.
// Base path: assets/dialogue-images/words/{category}/{word_key}/
//
// NOTE: thank_you uses its own naming convention (correct_contextN / context_wrongN).
// NOTE: here_you_are and here_it_is have no image assets yet — add entries when artwork is ready.

export const DIALOGUE_WORD_ASSETS = {
  // ── Greetings ────────────────────────────────────────────────────────────
  hello: {
    scene:          require('../../assets/dialogue-images/words/greetings/hello/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/hello/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/hello/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/hello/context_wrong_2.png'),
  },
  goodbye: {
    scene:          require('../../assets/dialogue-images/words/greetings/goodbye/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/goodbye/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/goodbye/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/goodbye/context_wrong_2.png'),
  },
  good_morning: {
    scene:          require('../../assets/dialogue-images/words/greetings/good_morning/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/good_morning/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/good_morning/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/good_morning/context_wrong_2.png'),
  },
  good_afternoon: {
    scene:          require('../../assets/dialogue-images/words/greetings/good_afternoon/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/good_afternoon/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong_2.png'),
  },
  good_night: {
    scene:          require('../../assets/dialogue-images/words/greetings/good_night/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/good_night/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/good_night/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/good_night/context_wrong_2.png'),
  },
  happy_birthday: {
    scene:          require('../../assets/dialogue-images/words/greetings/happy_birthday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/happy_birthday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong_2.png'),
  },
  how_are_you: {
    scene:          require('../../assets/dialogue-images/words/greetings/how_are_you/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/how_are_you/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/how_are_you/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/how_are_you/context_wrong_2.png'),
  },
  im_fine: {
    scene:          require('../../assets/dialogue-images/words/greetings/im_fine/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/im_fine/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/im_fine/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/im_fine/context_wrong_2.png'),
  },
  happy_new_year: {
    scene:          require('../../assets/dialogue-images/words/greetings/happy_new_year/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/greetings/happy_new_year/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong_2.png'),
  },

  // ── Magic Words ──────────────────────────────────────────────────────────
  please: {
    scene:          require('../../assets/dialogue-images/words/magic_words/please/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/magic_words/please/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/magic_words/please/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/magic_words/please/context_wrong_2.png'),
  },
  // thank_you uses its own naming scheme (correct_contextN / context_wrongN)
  thank_you: {
    scene:          require('../../assets/dialogue-images/words/magic_words/thank_you/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
    contextWrong:   require('../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
  },
  // im_sorry matches the backend asset_key and the im_sorry/ folder
  im_sorry: {
    scene:          require('../../assets/dialogue-images/words/magic_words/im_sorry/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/magic_words/im_sorry/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/magic_words/im_sorry/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/magic_words/im_sorry/context_wrong_2.png'),
  },
  // sorry folder also exists — kept for any legacy references
  sorry: {
    scene:          require('../../assets/dialogue-images/words/magic_words/sorry/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/magic_words/sorry/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/magic_words/sorry/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/magic_words/sorry/context_wrong_2.png'),
  },
  youre_welcome: {
    scene:          require('../../assets/dialogue-images/words/magic_words/youre_welcome/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/magic_words/youre_welcome/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong_2.png'),
  },
  please_excuse_me: {
    scene:          require('../../assets/dialogue-images/words/magic_words/please_excuse_me/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/magic_words/please_excuse_me/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/magic_words/please_excuse_me/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/magic_words/please_excuse_me/context_wrong_2.png'),
  },

  // ── Abilities ────────────────────────────────────────────────────────────
  clap: {
    scene:          require('../../assets/dialogue-images/words/abilities/clap/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/clap/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/clap/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/clap/context_wrong_2.png'),
  },
  run: {
    scene:          require('../../assets/dialogue-images/words/abilities/run/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/run/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/run/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/run/context_wrong_2.png'),
  },
  walk: {
    scene:          require('../../assets/dialogue-images/words/abilities/walk/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/walk/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/walk/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/walk/context_wrong_2.png'),
  },
  jump: {
    scene:          require('../../assets/dialogue-images/words/abilities/jump/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/jump/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/jump/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/jump/context_wrong_2.png'),
  },
  talk: {
    scene:          require('../../assets/dialogue-images/words/abilities/talk/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/talk/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/talk/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/talk/context_wrong_2.png'),
  },
  dance: {
    scene:          require('../../assets/dialogue-images/words/abilities/dance/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/dance/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/dance/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/dance/context_wrong_2.png'),
  },
  sing: {
    scene:          require('../../assets/dialogue-images/words/abilities/sing/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/sing/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/sing/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/sing/context_wrong_2.png'),
  },
  can_you: {
    scene:          require('../../assets/dialogue-images/words/abilities/can_you/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/can_you/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/can_you/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/can_you/context_wrong_2.png'),
  },
  yes_i_can: {
    scene:          require('../../assets/dialogue-images/words/abilities/yes_i_can/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/yes_i_can/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/yes_i_can/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/yes_i_can/context_wrong_2.png'),
  },
  no_i_cant: {
    scene:          require('../../assets/dialogue-images/words/abilities/no_i_cant/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/no_i_cant/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/no_i_cant/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/no_i_cant/context_wrong_2.png'),
  },
  i_can: {
    scene:          require('../../assets/dialogue-images/words/abilities/i_can/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/abilities/i_can/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/abilities/i_can/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/abilities/i_can/context_wrong_2.png'),
  },

  // ── Days of the Week ─────────────────────────────────────────────────────
  monday: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/monday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/monday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/monday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/monday/context_wrong_2.png'),
  },
  tuesday: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/tuesday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/tuesday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/tuesday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/tuesday/context_wrong_2.png'),
  },
  wednesday: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/wednesday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/wednesday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/wednesday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/wednesday/context_wrong_2.png'),
  },
  thursday: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/thursday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/thursday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/thursday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/thursday/context_wrong_2.png'),
  },
  friday: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/friday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/friday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/friday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/friday/context_wrong_2.png'),
  },
  saturday: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/saturday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/saturday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/saturday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/saturday/context_wrong_2.png'),
  },
  sunday: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/sunday/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/sunday/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/sunday/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/sunday/context_wrong_2.png'),
  },
  whats_the_day_today: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/whats_the_day_today/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/whats_the_day_today/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/whats_the_day_today/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/whats_the_day_today/context_wrong_2.png'),
  },
  today_is: {
    scene:          require('../../assets/dialogue-images/words/days_of_week/today_is/scene.png'),
    contextCorrect: require('../../assets/dialogue-images/words/days_of_week/today_is/context_correct.png'),
    contextWrong:   require('../../assets/dialogue-images/words/days_of_week/today_is/context_wrong.png'),
    contextWrong2:  require('../../assets/dialogue-images/words/days_of_week/today_is/context_wrong_2.png'),
  },
};
