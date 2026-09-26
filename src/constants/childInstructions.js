/**
 * childInstructions.js
 *
 * Every primary child-facing instruction in the Writing module, in one place,
 * in English and Sinhala.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The same three support instructions were written out in two different files
 * with two different sets of words, each screen carried a long second hint
 * saying the same thing again, and the pre-writing activities carried 36
 * strings (a name AND a prompt for each of 18 activities) for what is one
 * action. A child heard a different sentence for the same task depending on
 * which screen they were on.
 *
 * These are also the units that PRERECORDED VOICE will be cut against. One key
 * = one recording per language, reused everywhere that key appears — so
 * FOLLOW_PATH is a single clip covering all 18 pre-writing activities, and the
 * three support keys cover lowercase, uppercase and word writing alike. Adding
 * a screen-specific rewording of an existing key silently doubles the recording
 * work, which is the reason to keep this list short.
 *
 * Audio is resolved separately by handwritingInstructionAudio.js using these
 * same stable keys. This module remains the only source of visible copy.
 *
 * ── Scope ────────────────────────────────────────────────────────────────
 * The PRIMARY instruction shown before/during an activity — what the child is
 * being asked to do. Never feedback: pass/retry messages, avatar reactions and
 * celebrations all stay where they are and are deliberately not modelled here.
 *
 * ── The two per-item instructions ────────────────────────────────────────
 * WRITE_LETTER and WRITE_WORD interpolate the current target, so they are
 * functions rather than fixed strings. Their spoken form is the letter or word
 * itself, which the screens already speak; the carrier phrase is what is
 * shared. writeLetterInstruction() passes the character through UNCHANGED —
 * the case IS the instruction ('a' and 'A' are different targets), and forcing
 * a case here is exactly the bug this replaces.
 */

'use strict';

/** Stable identifiers — one per future voice recording. */
export const INSTRUCTION_KEYS = Object.freeze({
  FOLLOW_PATH:           'FOLLOW_PATH',
  WATCH_TRACE:           'WATCH_TRACE',
  FOLLOW_GUIDE:          'FOLLOW_GUIDE',
  WRITE_BY_YOURSELF:     'WRITE_BY_YOURSELF',
  CHOOSE_FIRST_LETTER:   'CHOOSE_FIRST_LETTER',
  CHOOSE_PICTURE:        'CHOOSE_PICTURE',
  CHOOSE_MISSING_LETTER: 'CHOOSE_MISSING_LETTER',
  MAKE_WORD:             'MAKE_WORD',
  WRITE_WORD:            'WRITE_WORD',
  PRACTISE_FIRST:        'PRACTISE_FIRST',
});

/**
 * key -> { en, si }. Approved copy — do not reword a key in a single screen;
 * that is what this module exists to prevent.
 */
export const CHILD_INSTRUCTIONS = Object.freeze({
  [INSTRUCTION_KEYS.FOLLOW_PATH]:           { en: 'Follow the path',           si: 'රේඛාව දිගේ අඳින්න' },
  [INSTRUCTION_KEYS.WATCH_TRACE]:           { en: 'Watch and trace',           si: 'බලා අඳින්න' },
  [INSTRUCTION_KEYS.FOLLOW_GUIDE]:          { en: 'Follow the guide',          si: 'සලකුණු අනුව අඳින්න' },
  [INSTRUCTION_KEYS.WRITE_BY_YOURSELF]:     { en: 'Write by yourself',         si: 'තනියම ලියන්න' },
  [INSTRUCTION_KEYS.CHOOSE_FIRST_LETTER]:   { en: 'Choose the first letter',   si: 'මුල් අකුර තෝරන්න' },
  [INSTRUCTION_KEYS.CHOOSE_PICTURE]:        { en: 'Choose the picture',        si: 'පින්තූරය තෝරන්න' },
  [INSTRUCTION_KEYS.CHOOSE_MISSING_LETTER]: { en: 'Choose the missing letter', si: 'නිවැරදි අකුර තෝරන්න' },
  [INSTRUCTION_KEYS.MAKE_WORD]:             { en: 'Make the word',             si: 'වචනය සාදන්න' },
  [INSTRUCTION_KEYS.WRITE_WORD]:            { en: 'Write the word',            si: 'වචනය ලියන්න' },
  // Shown when a letter is being warmed up after two failed cycles. Neutral
  // on purpose: it names what happens next, never how the child did.
  [INSTRUCTION_KEYS.PRACTISE_FIRST]:        { en: "Let's practise first",     si: 'මුලින් පුහුණු වෙමු' },
});

/**
 * Support level -> instruction key.
 *
 * This mapping is a LABEL for the level the support engine already chose. It
 * reads handwritingSupportLevels' decision and never influences it: no guide,
 * tracer, opacity or attempt behaviour is derived from anything in this file.
 */
export const SUPPORT_INSTRUCTION_KEY = Object.freeze({
  high:   INSTRUCTION_KEYS.WATCH_TRACE,
  medium: INSTRUCTION_KEYS.FOLLOW_GUIDE,
  low:    INSTRUCTION_KEYS.WRITE_BY_YOURSELF,
});

const EMPTY = Object.freeze({ en: '', si: '' });

/**
 * @param {'high'|'medium'|'low'} supportLevel
 * @returns {{en: string, si: string}} — empty strings for an unknown level, so
 *   a bad value shows nothing rather than crashing a child mid-activity.
 */
export function instructionForSupport(supportLevel) {
  const key = SUPPORT_INSTRUCTION_KEY[supportLevel];
  return CHILD_INSTRUCTIONS[key] ?? EMPTY;
}

/**
 * @param {string} letter — the target, in the case the child must write.
 *   Passed through untouched: 'a' stays 'a', 'A' stays 'A'.
 */
export function writeLetterInstruction(letter) {
  const ch = String(letter ?? '');
  return { en: `Write '${ch}'`, si: `'${ch}' ලියන්න` };
}

/** @param {string} word — the target word, as displayed. */
export function writeWordInstruction(word) {
  const w = String(word ?? '');
  return { en: `Write "${w}"`, si: `"${w}" ලියන්න` };
}
