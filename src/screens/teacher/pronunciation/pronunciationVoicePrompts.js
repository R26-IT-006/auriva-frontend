import { Audio } from "expo-av";

import {
  getPlayableAudioSource,
  setPronunciationPlaybackMode,
} from "./pronunciationAudioPlayback.js";

/**
 * Short recorded coaching lines spoken to the child.
 *
 * Two kinds, and the difference matters for sensory settings:
 * INSTRUCTION prompts tell the child what to do next and always play — a
 * non-reading child depends on them. PRAISE prompts are celebration, so they
 * are suppressed for a student with "reduce celebration effects" on, exactly
 * like confetti and the triumph sounds.
 */
export const VOICE_PROMPTS = {
  repeatAfterMe: {
    kind: "instruction",
    asset: require("../../../../assets/new_audio/Repeat_after_me.mp3"),
  },
  tapRecordAndSpeak: {
    kind: "instruction",
    asset: require("../../../../assets/new_audio/Tap_the_record_button_and_speak.mp3"),
  },
  listenAgain: {
    kind: "instruction",
    asset: require("../../../../assets/new_audio/Tap_on_the_button_to_listen_again.mp3"),
  },
  goodJob: {
    kind: "praise",
    asset: require("../../../../assets/new_audio/Good_job.mp3"),
  },
  tryOneMoreTime: {
    kind: "instruction",
    asset: require("../../../../assets/new_audio/Lets_try_one_more_time.mp3"),
  },
  youCanDoIt: {
    kind: "praise",
    asset: require("../../../../assets/new_audio/You_can_do_it.mp3"),
  },
};

// One prompt at a time: a second prompt cuts the first off rather than
// talking over it, which would be unintelligible for the child.
let activePrompt = null;

export async function stopVoicePrompt() {
  const sound = activePrompt;
  activePrompt = null;
  if (!sound) return;

  await sound.stopAsync().catch(() => {});
  await sound.unloadAsync().catch(() => {});
}

/**
 * Plays a coaching line. Fire-and-forget: never throws, never blocks the UI,
 * and unloads itself when finished.
 *
 * @param {keyof typeof VOICE_PROMPTS} promptKey
 * @param {{ reduceStimulation?: boolean, volume?: number }} options
 */
export async function playVoicePrompt(promptKey, options = {}) {
  const prompt = VOICE_PROMPTS[promptKey];
  if (!prompt) return;
  if (options.reduceStimulation && prompt.kind === "praise") return;

  try {
    await stopVoicePrompt();
    await setPronunciationPlaybackMode();

    const source = await getPlayableAudioSource(prompt.asset);
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      volume: options.volume ?? 1,
    });
    activePrompt = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || !status.didJustFinish) return;
      sound.setOnPlaybackStatusUpdate(null);
      sound.unloadAsync().catch(() => {});
      if (activePrompt === sound) activePrompt = null;
    });
  } catch (error) {
    console.log(`Voice prompt (${promptKey}) playback error:`, error.message);
  }
}
