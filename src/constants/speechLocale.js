/**
 * speechLocale.js
 *
 * The spoken-English locale for the writing module: **British English**.
 *
 * ── Why ──────────────────────────────────────────────────────────────────
 * Every Speech.speak() call in the module asked for `en-US`, so a child
 * learning to write under a British curriculum heard American letter names
 * and American word pronunciations — `z` as "zee", `vase` as /veɪs/, `zebra`
 * as /ˈziːbrə/, and rhotic /r/ everywhere the displayed IPA said there was
 * none. The transcription under the letter and the voice reading it out
 * disagreed.
 *
 * ── Locale, never a named voice ──────────────────────────────────────────
 * This is a BCP-47 LANGUAGE TAG, not a voice identifier. No device is assumed
 * to have any particular British voice installed:
 *
 *   • expo-speech passes the tag to the platform engine, which selects the
 *     best matching installed voice itself;
 *   • with no en-GB voice available the engine falls back to another English
 *     voice (usually the system default) and still speaks — it does not throw,
 *     and it does not go silent;
 *   • so the worst case is exactly today's behaviour, and the common case is
 *     the right accent.
 *
 * Hardcoding a voice id (`Speech.speak(text, { voice: 'en-gb-x-gbb-network' })`)
 * would be the fragile version of this and is deliberately not done — a voice
 * id that is missing yields no speech at all.
 *
 * Sinhala speech already uses `si-LK` and is unaffected.
 */

'use strict';

/** British English. Used by every English Speech.speak() in the writing module. */
export const SPEECH_LOCALE_EN = 'en-GB';

/** Sinhala, as already used elsewhere in the app. */
export const SPEECH_LOCALE_SI = 'si-LK';

/**
 * Merges the British locale into a set of Speech.speak options.
 *
 * Rate and pitch are per-call and deliberately preserved — a letter is spoken
 * more slowly than a word, and that tuning is not this module's business.
 *
 * @param {{rate?: number, pitch?: number}} [options]
 * @returns {object} the same options with `language` set to en-GB.
 */
export function ukSpeechOptions(options = {}) {
  return { ...options, language: SPEECH_LOCALE_EN };
}

/** Calm, device-portable delivery used only for dynamic target-letter names. */
export function ukLetterSpeechOptions() {
  return ukSpeechOptions({ rate: 0.75, pitch: 0.9 });
}
