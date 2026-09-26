// Feature 5 Step 3 — Spaced sequence reinsertion (pure).
//
// The ONLY place in this codebase that inserts a new element into a
// letter-practice `sequence` array. Every prior sequence mutation in this
// project (Feature 4's category-boundary/adaptive detours) is a SLICE —
// this is a genuinely new operation, so it lives in its own small,
// dedicated, fully pure/testable module rather than being added inline to
// LetterWritingScreen.js/UppercaseWritingScreen.js.
//
// ── Immutability ──────────────────────────────────────────────────────────
// Never mutates the input `sequence` array or any of its entries — always
// returns a new array. The ORIGINAL letter entry the child is currently
// failing is never touched; only the newly-inserted CLONE carries
// repetition metadata (Step 3 spec §24).
//
// ── This module does NOT ─────────────────────────────────────────────────
//   - decide WHETHER a repetition is justified (that's
//     repetitionRecommendationService.js, backend, Feature 5 Step 2);
//   - track how many repetitions have already been used (that's
//     repetitionSessionGuard.js);
//   - call any network/storage API — pure data transformation only.

/**
 * Deterministic MVP spacing rule (Step 3 spec §17-20): insert the repeated
 * entry after ONE intervening letter — i.e. at `currentIndex + 2` in the
 * sequence, clamped to the sequence's length. This single formula, with no
 * special-casing, produces every example the spec walks through:
 *   [c,o,s]  @ c (idx 0) -> insertionIndex = min(2,3) = 2 -> [c,o,c,s]
 *   [c,o]    @ c (idx 0) -> insertionIndex = min(2,2) = 2 -> [c,o,c]   (append)
 *   [c]      @ c (idx 0) -> insertionIndex = min(2,1) = 1 -> [c,c]     (append)
 * The "no intervening letter available" and "exactly one intervening
 * letter" cases are NOT special-cased — clamping already produces the
 * correct, spec-documented fallback (append to the end) for both.
 *
 * @param {number} currentIndex
 * @param {number} sequenceLength
 * @returns {number}
 */
function computeInsertionIndex(currentIndex, sequenceLength) {
  return Math.min(currentIndex + 2, sequenceLength);
}

function isValidIndex(index, sequence) {
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < sequence.length;
}

/**
 * Inserts ONE spaced-repetition clone of `targetLetterEntry` into
 * `sequence`, after one intervening letter (or appended at the end, if no
 * intervening letter exists) — UNLESS an adaptive repetition for the same
 * (letter, caseType) is already pending later in the sequence, in which
 * case no insertion happens (Step 3 spec §21 — enforced structurally here,
 * not left to the caller).
 *
 * @param {{
 *   sequence: object[],
 *   currentIndex: number,
 *   targetLetterEntry: {letter: string, caseType?: string, [key: string]: any},
 *   interactionId?: string|null,
 * }} params
 * @returns {{
 *   sequence: object[],
 *   inserted: boolean,
 *   reason: 'inserted'|'already_pending'|'invalid_input',
 *   insertionIndex: number|null,
 * }}
 */
export function insertSpacedRepetition({ sequence, currentIndex, targetLetterEntry, interactionId = null } = {}) {
  if (!Array.isArray(sequence)) {
    return { sequence: [], inserted: false, reason: 'invalid_input', insertionIndex: null };
  }
  if (!isValidIndex(currentIndex, sequence)) {
    return { sequence, inserted: false, reason: 'invalid_input', insertionIndex: null };
  }
  if (!targetLetterEntry || typeof targetLetterEntry.letter !== 'string' || targetLetterEntry.letter.length !== 1) {
    return { sequence, inserted: false, reason: 'invalid_input', insertionIndex: null };
  }

  // Duplicate-pending-repeat protection (spec §21): scan only the REMAINING
  // (not-yet-reached) portion of the sequence — a past/already-completed
  // adaptive repeat for this same letter earlier in the array (impossible
  // today, since currentIndex only ever advances forward, but checked
  // against the full remaining slice rather than assumed) must not block a
  // legitimately new one; only a still-PENDING duplicate does.
  const remaining = sequence.slice(currentIndex + 1);
  const alreadyPending = remaining.some(entry =>
    entry
    && entry.isAdaptiveRepetition === true
    && entry.letter === targetLetterEntry.letter
    && entry.caseType === targetLetterEntry.caseType
  );
  if (alreadyPending) {
    return { sequence, inserted: false, reason: 'already_pending', insertionIndex: null };
  }

  // The clone — never the original object reference. Minimal, additive
  // metadata only (spec §22/§23): isAdaptiveRepetition marks it as such;
  // adaptiveRepetitionOrdinal is always 1 in this MVP (cap=1 means no
  // target ever receives a second adaptive repeat — see repetitionPolicy.js);
  // sourceInteractionId is carried for defensive/future safety, mirroring
  // Feature 4's own interactionId-tagging discipline.
  const clone = {
    ...targetLetterEntry,
    isAdaptiveRepetition: true,
    adaptiveRepetitionOrdinal: 1,
    sourceInteractionId: interactionId,
  };

  const insertionIndex = computeInsertionIndex(currentIndex, sequence.length);
  const nextSequence = [
    ...sequence.slice(0, insertionIndex),
    clone,
    ...sequence.slice(insertionIndex),
  ];

  return { sequence: nextSequence, inserted: true, reason: 'inserted', insertionIndex };
}
