/**
 * abilitiesWords.js
 *
 * Content for the Dialogue Level 1 "Can you…?" (abilities) category, in one
 * place. The abilities screens follow the same flow and layout as Magic Words
 * and Greetings (landing → watch → drag ×3 → Phase 1 complete → say it →
 * picture choice → Phase 3 → Word Complete); only the media and wording here
 * are specific to this category. Phase 3 is one question (the word's video +
 * "What is the avatar doing?"), not the A/B/C scenarios of the other two.
 *
 * Every abilities word folder has one watch video (Phase1And3.mp4), one drag
 * scene video (Drag_Activity.mp4) and one photo (Non_Verbal.jpg).
 *
 * Missing audio is null, never a borrowed clip from another word: the screens
 * skip a null sound and keep showing the text.
 */

// Display order — also the rotation used to pick other words' photos as
// distractors, so a word never sees the same decoy pair twice in a row.
export const ABILITY_WORD_ORDER = [
  'cat3_yes', 'cat3_no', 'clap', 'run', 'walk', 'jump', 'talk', 'dance', 'sing',
  'brush', 'wash', 'eat', 'drink', 'write', 'play', 'sleep', 'watch',
];

export const ABILITY_LABELS = {
  cat3_yes: 'Yes',
  cat3_no:  'No',
  clap:     'Clap',
  run:      'Run',
  walk:     'Walk',
  jump:     'Jump',
  talk:     'Talk',
  dance:    'Dance',
  sing:     'Sing',
  brush:    'Brush',
  wash:     'Wash',
  eat:      'Eat',
  drink:    'Drink',
  write:    'Write',
  play:     'Play',
  sleep:    'Sleep',
  watch:    'Watch',
};

/** Yes and No are answers, not actions, so some wording differs for them. */
export function isAbilityAnswerWord(wordKey) {
  return wordKey === 'cat3_yes' || wordKey === 'cat3_no';
}

export function abilityLabel(wordKey) {
  return ABILITY_LABELS[wordKey] ?? String(wordKey ?? '').replace(/^cat3_/, '').replace(/_/g, ' ');
}

// Short description of each word's photo — used as picture captions.
export const ABILITY_CAPTIONS = {
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

// ── Watch (Phase 1) videos ─────────────────────────────────────────────────
export const ABILITY_WATCH_VIDEOS = {
  cat3_yes: require('../../assets/dialogue-videos/words/abilities/yes/Phase1And3.mp4'),
  cat3_no:  require('../../assets/dialogue-videos/words/abilities/no/Phase1And3.mp4'),
  clap:     require('../../assets/dialogue-videos/words/abilities/clap/Phase1And3.mp4'),
  run:      require('../../assets/dialogue-videos/words/abilities/run/Phase1And3.mp4'),
  walk:     require('../../assets/dialogue-videos/words/abilities/walk/Phase1And3.mp4'),
  jump:     require('../../assets/dialogue-videos/words/abilities/jump/Phase1And3.mp4'),
  talk:     require('../../assets/dialogue-videos/words/abilities/talk/Phase1And3.mp4'),
  dance:    require('../../assets/dialogue-videos/words/abilities/dance/Phase1And3.mp4'),
  sing:     require('../../assets/dialogue-videos/words/abilities/sing/Phase1And3.mp4'),
  brush:    require('../../assets/dialogue-videos/words/abilities/brush/Phase1And3.mp4'),
  wash:     require('../../assets/dialogue-videos/words/abilities/wash/Phase1And3.mp4'),
  eat:      require('../../assets/dialogue-videos/words/abilities/eat/Phase1And3.mp4'),
  drink:    require('../../assets/dialogue-videos/words/abilities/drink/Phase1And3.mp4'),
  write:    require('../../assets/dialogue-videos/words/abilities/write/Phase1And3.mp4'),
  play:     require('../../assets/dialogue-videos/words/abilities/play/Phase1And3.mp4'),
  sleep:    require('../../assets/dialogue-videos/words/abilities/sleep/Phase1And3.mp4'),
  watch:    require('../../assets/dialogue-videos/words/abilities/watch/Phase1And3.mp4'),
};

// Narration synced to the watch video — only Yes and No have one.
export const ABILITY_WATCH_NARRATION = {
  cat3_yes: require('../../assets/dialogue-audios/abilities/Yes_V1.mp3'),
  cat3_no:  require('../../assets/dialogue-audios/abilities/No_V1.mp3'),
};

// ── Drag activity scene videos ─────────────────────────────────────────────
export const ABILITY_DRAG_VIDEOS = {
  cat3_yes: require('../../assets/dialogue-videos/words/abilities/yes/Drag_Activity.mp4'),
  cat3_no:  require('../../assets/dialogue-videos/words/abilities/no/Drag_Activity.mp4'),
  clap:     require('../../assets/dialogue-videos/words/abilities/clap/Drag_Activity.mp4'),
  run:      require('../../assets/dialogue-videos/words/abilities/run/Drag_Activity.mp4'),
  walk:     require('../../assets/dialogue-videos/words/abilities/walk/Drag_Activity.mp4'),
  jump:     require('../../assets/dialogue-videos/words/abilities/jump/Drag_Activity.mp4'),
  talk:     require('../../assets/dialogue-videos/words/abilities/talk/Drag_Activity.mp4'),
  dance:    require('../../assets/dialogue-videos/words/abilities/dance/Drag_Activity.mp4'),
  sing:     require('../../assets/dialogue-videos/words/abilities/sing/Drag_Activity.mp4'),
  brush:    require('../../assets/dialogue-videos/words/abilities/brush/Drag_Activity.mp4'),
  wash:     require('../../assets/dialogue-videos/words/abilities/wash/Drag_Activity.mp4'),
  eat:      require('../../assets/dialogue-videos/words/abilities/eat/Drag_Activity.mp4'),
  drink:    require('../../assets/dialogue-videos/words/abilities/drink/Drag_Activity.mp4'),
  write:    require('../../assets/dialogue-videos/words/abilities/write/Drag_Activity.mp4'),
  play:     require('../../assets/dialogue-videos/words/abilities/play/Drag_Activity.mp4'),
  sleep:    require('../../assets/dialogue-videos/words/abilities/sleep/Drag_Activity.mp4'),
  watch:    require('../../assets/dialogue-videos/words/abilities/watch/Drag_Activity.mp4'),
};

// ── Photos ─────────────────────────────────────────────────────────────────
export const ABILITY_PHOTOS = {
  cat3_yes: require('../../assets/dialogue-images/words/abilities/yes/Non_Verbal.jpg'),
  cat3_no:  require('../../assets/dialogue-images/words/abilities/no/Non_Verbal.jpg'),
  clap:     require('../../assets/dialogue-images/words/abilities/clap/Non_Verbal.jpg'),
  run:      require('../../assets/dialogue-images/words/abilities/run/Non_Verbal.jpg'),
  walk:     require('../../assets/dialogue-images/words/abilities/walk/Non_Verbal.jpg'),
  jump:     require('../../assets/dialogue-images/words/abilities/jump/Non_Verbal.jpg'),
  talk:     require('../../assets/dialogue-images/words/abilities/talk/Non_Verbal.jpg'),
  dance:    require('../../assets/dialogue-images/words/abilities/dance/Non_Verbal.jpg'),
  sing:     require('../../assets/dialogue-images/words/abilities/sing/Non_Verbal.jpg'),
  brush:    require('../../assets/dialogue-images/words/abilities/brush/Non_Verbal.jpg'),
  wash:     require('../../assets/dialogue-images/words/abilities/wash/Non_Verbal.jpg'),
  eat:      require('../../assets/dialogue-images/words/abilities/eat/Non_Verbal.jpg'),
  drink:    require('../../assets/dialogue-images/words/abilities/drink/Non_Verbal.jpg'),
  write:    require('../../assets/dialogue-images/words/abilities/write/Non_Verbal.jpg'),
  play:     require('../../assets/dialogue-images/words/abilities/play/Non_Verbal.jpg'),
  sleep:    require('../../assets/dialogue-images/words/abilities/sleep/Non_Verbal.jpg'),
  watch:    require('../../assets/dialogue-images/words/abilities/watch/Non_Verbal.jpg'),
};

/** The word `offset` places after this one in ABILITY_WORD_ORDER. */
export function abilityWordAtOffset(wordKey, offset) {
  const i = Math.max(0, ABILITY_WORD_ORDER.indexOf(wordKey));
  return ABILITY_WORD_ORDER[(i + offset) % ABILITY_WORD_ORDER.length];
}

// ── Audio ──────────────────────────────────────────────────────────────────
export const ABILITY_WORD_AUDIO = {
  cat3_yes: require('../../assets/dialogue-audios/abilities/yes.mp3'),
  cat3_no:  require('../../assets/dialogue-audios/abilities/no.mp3'),
  clap:     require('../../assets/dialogue-audios/abilities/clap.mp3'),
  run:      require('../../assets/dialogue-audios/abilities/run.mp3'),
  walk:     require('../../assets/dialogue-audios/abilities/walk.mp3'),
  jump:     require('../../assets/dialogue-audios/abilities/jump.mp3'),
  talk:     require('../../assets/dialogue-audios/abilities/talk.mp3'),
  dance:    require('../../assets/dialogue-audios/abilities/dance.mp3'),
  sing:     require('../../assets/dialogue-audios/abilities/sing.mp3'),
  brush:    require('../../assets/dialogue-audios/abilities/brush.mp3'),
};

export const ABILITY_CAN_YOU_SAY_AUDIO = {
  cat3_yes: require('../../assets/dialogue-audios/abilities/can_you_say_yes.mp3'),
  cat3_no:  require('../../assets/dialogue-audios/abilities/can_you_say_no.mp3'),
  clap:     require('../../assets/dialogue-audios/abilities/can_you_say_clap.mp3'),
  jump:     require('../../assets/dialogue-audios/abilities/can_you_say_jump.mp3'),
  run:      require('../../assets/dialogue-audios/abilities/can_you_say_run.mp3'),
  walk:     require('../../assets/dialogue-audios/abilities/can_you_say_walk.mp3'),
  brush:    require('../../assets/dialogue-audios/abilities/can_you_say_brush.mp3'),
};

// One shared Phase 3 prompt recording for every abilities word.
export const ABILITY_PHASE3_PROMPT_AUDIO =
  require('../../assets/dialogue-audios/abilities/ContextAwarenessAbilities.mp3');
