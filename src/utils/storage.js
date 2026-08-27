/**
 * Persistent storage utilities
 *
 * Two storage layers:
 *   SecureStore   — auth token (encrypted, device-only)
 *   AsyncStorage  — letter learning data (serialised JSON)
 *
 * AsyncStorage key convention:
 *   student_<id>_letterSequence            — adaptive letter sequence array
 *   student_<id>_motorProfile              — motor profile calculated from assessment
 *   student_<id>_letter_<l>_progress       — attempt history for one letter
 *   student_<id>_completedLetters          — running list of completed letters
 *   student_<id>_pendingFinalize_<assessId> — replayable finalize record (Reliability Step 2)
 *   student_<id>_demosShown                — completed one-time demonstrations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DTW_CORRECT_THRESHOLD } from './adaptiveSequencing';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Token  (SecureStore)
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'auriva_auth_token';

export const storage = {
  async getToken() {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (err) {
      console.error('Failed to save token:', err);
    }
  },

  async removeToken() {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sequenceKey(studentId)              { return `student_${studentId}_letterSequence`; }
function motorProfileKey(studentId)          { return `student_${studentId}_motorProfile`; }
function letterProgressKey(studentId, letter){ return `student_${studentId}_letter_${letter}_progress`; }
function completedLettersKey(studentId)      { return `student_${studentId}_completedLetters`; }
function wordProgressKey(studentId)          { return `student_${studentId}_wordProgress`; }
function demosShownKey(studentId)            { return `student_${studentId}_demosShown`; }

async function safeGet(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function safeSet(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`AsyncStorage write failed [${key}]:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// One-time demonstrations  (utils/demoPolicy.js owns WHICH demos exist)
//
// A child sees each demonstration at most once, ever. That "ever" is why
// this is persistent per-student storage and not session state: a demo that
// replayed after every app restart would be a tutorial the child has to sit
// through repeatedly, which is the exact opposite of what a predictable,
// ASD-friendly flow needs.
//
// Written ONLY when the child presses "I'm Ready" at the end of the
// demonstration — never when navigation into it merely starts. A crash or a
// forced close mid-demo therefore leaves the key unwritten and the child
// sees the demonstration again, which is the safe direction to fail: a
// repeated demo costs 15 seconds, a wrongly-suppressed one costs the child
// the only explanation they were going to get.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number|string} studentId
 * @returns {Promise<string[]>} completed demo keys — always an array, never
 *   null, so a read failure reads as "none completed" and the child is
 *   shown the demonstration rather than silently skipped past it.
 */
export async function getShownDemos(studentId) {
  const stored = await safeGet(demosShownKey(studentId));
  return Array.isArray(stored) ? stored.filter((k) => typeof k === 'string') : [];
}

/**
 * Records one demonstration as completed for one child. Idempotent, and
 * additive — never rewrites the list from a caller's own copy, so two
 * screens marking different demos cannot erase each other.
 *
 * @param {number|string} studentId
 * @param {string} demoKey
 * @returns {Promise<string[]>} the stored list after the write.
 */
export async function markDemoShown(studentId, demoKey) {
  if (typeof demoKey !== 'string' || demoKey === '') return getShownDemos(studentId);
  const current = await getShownDemos(studentId);
  if (current.includes(demoKey)) return current;
  const next = [...current, demoKey];
  await safeSet(demosShownKey(studentId), next);
  return next;
}

/** Test/support helper — clears one child's demo history. */
export async function clearShownDemos(studentId) {
  await safeSet(demosShownKey(studentId), []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Letter Sequence
// Written by AssessmentCompleteScreen after the initial shape assessment.
// Read by LetterHomeScreen and LetterPracticeScreen to drive letter ordering.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores the motor-informed adaptive letter sequence for a student.
 * @param {number|string} studentId
 * @param {Object[]}      sequence   — array of letter objects from generateAdaptiveSequence()
 */
export async function storeLetterSequence(studentId, sequence) {
  await safeSet(sequenceKey(studentId), sequence);
}

/**
 * Retrieves the adaptive letter sequence for a student.
 * Returns null if no sequence has been stored yet.
 * @param {number|string} studentId
 * @returns {Object[]|null}
 */
export async function getLetterSequence(studentId) {
  return safeGet(sequenceKey(studentId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor Profile
// Stores the child's motor strengths / category order for XAI explanation
// and to re-hydrate LetterHomeScreen without requiring a new assessment.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores the motor profile calculated from the initial shape assessment.
 * @param {number|string} studentId
 * @param {Object}        profile   — output of calculateMotorProfile()
 */
export async function storeMotorProfile(studentId, profile) {
  await safeSet(motorProfileKey(studentId), profile);
}

/**
 * Retrieves the stored motor profile for a student.
 * Returns null if no assessment has been completed yet.
 * @param {number|string} studentId
 * @returns {Object|null}
 */
export async function getMotorProfile(studentId) {
  return safeGet(motorProfileKey(studentId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Letter Progress
// Per-letter attempt history supporting the three-attempt flow described
// in the proposal (animated demo → static guide → strokes only).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores or updates attempt data for one letter.
 * New attempts are appended; existing history is preserved.
 *
 * @param {number|string} studentId
 * @param {string}        letter       — e.g. 'a' or 'A'
 * @param {Object}        attemptData  — {
 *   attempt:            1|2|3,
 *   deviation:          number,   // px deviation from ideal stroke
 *   pauseCount:         number,
 *   completionTime:     number,   // ms
 *   strokeOrderCorrect: boolean,
 *   fingerLifts:        number,
 *   timestamp:          number,   // Date.now()
 * }
 */
export async function storeLetterProgress(studentId, letter, attemptData) {
  const key      = letterProgressKey(studentId, letter);
  const existing = (await safeGet(key)) ?? { letter, attempts: [] };

  existing.attempts.push({ ...attemptData, timestamp: attemptData.timestamp ?? Date.now() });

  // Mark as completed when any attempt passes the DTW trajectory gate,
  // or after the third attempt regardless (no-child-stuck fallback).
  // Replaces the vacuous "deviation < 25" check: deviation is always 0 at
  // call sites so it was never a real gate.
  const completed = existing.attempts.some(a =>
    a.attempt >= 3 || (a.dtw_distance != null && a.dtw_distance < DTW_CORRECT_THRESHOLD)
  );
  existing.completed = completed;

  await safeSet(key, existing);

  // Keep the completed-letters index in sync
  if (completed) {
    await _markLetterCompleted(studentId, letter);
  }
}

/**
 * Retrieves full progress history for one letter.
 * Returns null if the letter has not been attempted yet.
 * @param {number|string} studentId
 * @param {string}        letter
 * @returns {{ letter: string, attempts: Object[], completed: boolean }|null}
 */
export async function getLetterProgress(studentId, letter) {
  return safeGet(letterProgressKey(studentId, letter));
}

// ─────────────────────────────────────────────────────────────────────────────
// Completed Letters Index
// A lightweight list so we can quickly count completed letters
// without loading every individual letter progress record.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the array of letter characters the student has completed.
 * @param {number|string} studentId
 * @returns {string[]}  e.g. ['a', 'b', 'l']
 */
export async function getCompletedLetters(studentId) {
  return (await safeGet(completedLettersKey(studentId))) ?? [];
}

async function _markLetterCompleted(studentId, letter) {
  const key       = completedLettersKey(studentId);
  const completed = (await safeGet(key)) ?? [];
  if (!completed.includes(letter)) {
    completed.push(letter);
    await safeSet(key, completed);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Word Activity Progress
// Stores per-letter word exercise results persistently so they survive restarts.
// Shape: { [letter]: Array<{ word, emoji, imageKey, status: {A,B,C,D} }> }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves (or overwrites) word exercise results for one letter.
 * Called when the student finishes all words for that letter.
 * @param {number|string} studentId
 * @param {string}        letter      — e.g. 'a'
 * @param {Object[]}      wordResults — array of { word, emoji, imageKey, status }
 */
export async function storeWordProgress(studentId, letter, wordResults) {
  const key      = wordProgressKey(studentId);
  const existing = (await safeGet(key)) ?? {};
  existing[letter] = wordResults;
  await safeSet(key, existing);
}

/**
 * Returns all stored word exercise results for a student across all letters.
 * @param {number|string} studentId
 * @returns {{ [letter]: Object[] }}
 */
export async function getAllWordProgress(studentId) {
  return (await safeGet(wordProgressKey(studentId))) ?? {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending Assessment Finalization  (Reliability Step 2)
//
// Persisted BEFORE the finalize PATCH is attempted (see utils/finalizeSync.js)
// so a network failure or the app closing mid-request can never lose the
// child's ability to retry. Keyed per assessment (not just per student) so a
// later, different assessment session can never collide with or silently
// clobber an still-unsynced earlier one.
//
// Deliberately does NOT use safeSet() — safeSet() swallows write failures
// with no way for the caller to know persistence didn't happen, which would
// recreate exactly the reliability gap this record exists to close. These
// three functions use their own explicit try/catch and report success/
// failure back to the caller instead.
// ─────────────────────────────────────────────────────────────────────────────

function pendingFinalizeKey(studentId, assessmentId) {
  return `student_${studentId}_pendingFinalize_${assessmentId}`;
}

// Student-level index (Reliability Step 3) — required because LetterHomeScreen
// only ever has student.sid available, never assessmentId (confirmed: it is
// not passed through navigation, and even if it were, that wouldn't help
// after an app restart via a different navigation path). AsyncStorage has no
// prefix-query API, and this project does not otherwise use
// AsyncStorage.getAllKeys() anywhere, so a small maintained index — rather
// than a global key scan — keeps discovery to exactly the keys that matter
// for one student. Format: array of assessmentIds, e.g. [202, 305].
function pendingFinalizeIndexKey(studentId) {
  return `student_${studentId}_pendingFinalizeIndex`;
}

async function addToPendingIndex(studentId, assessmentId) {
  const key = pendingFinalizeIndexKey(studentId);
  const raw = await AsyncStorage.getItem(key);
  const index = raw ? JSON.parse(raw) : [];
  if (!index.includes(assessmentId)) {
    index.push(assessmentId);
    await AsyncStorage.setItem(key, JSON.stringify(index));
  }
}

async function removeFromPendingIndex(studentId, assessmentId) {
  const key = pendingFinalizeIndexKey(studentId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return;
  const index = JSON.parse(raw).filter(id => id !== assessmentId);
  await AsyncStorage.setItem(key, JSON.stringify(index));
}

/**
 * Persists a replayable finalize record. Store only what's needed to replay
 * PATCH /handwriting/assessment/:assessmentId/finalize — never raw
 * trajectories, ShapeFeature data, names, tokens, or API error objects.
 *
 * Also maintains the per-student discovery index (addToPendingIndex) in the
 * same try/catch as the record write, so a caller's `true` return means both
 * the record AND its discoverability are confirmed persisted.
 *
 * @param {number|string} studentId
 * @param {number|string} assessmentId
 * @param {Object}        record — {
 *   assessmentId, studentId, motorScore, motorProfile,
 *   createdAt, attemptCount, status: 'pending'|'conflict',
 * }
 * @returns {Promise<boolean>} true only if the write actually succeeded —
 *   callers MUST check this rather than assuming success.
 */
export async function storePendingFinalization(studentId, assessmentId, record) {
  try {
    await AsyncStorage.setItem(pendingFinalizeKey(studentId, assessmentId), JSON.stringify(record));
    await addToPendingIndex(studentId, assessmentId);
    return true;
  } catch (err) {
    console.error(`Pending finalization write failed [student ${studentId}, assessment ${assessmentId}]:`, err);
    return false;
  }
}

/**
 * @param {number|string} studentId
 * @param {number|string} assessmentId
 * @returns {Promise<Object|null>} the pending record, or null if none exists
 *   or the stored value is missing/corrupted.
 */
export async function getPendingFinalization(studentId, assessmentId) {
  try {
    const raw = await AsyncStorage.getItem(pendingFinalizeKey(studentId, assessmentId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Pending finalization read failed [student ${studentId}, assessment ${assessmentId}]:`, err);
    return null;
  }
}

/**
 * Removes a pending finalize record once server persistence is confirmed.
 * @param {number|string} studentId
 * @param {number|string} assessmentId
 * @returns {Promise<boolean>} true unless the removal itself failed.
 */
export async function clearPendingFinalization(studentId, assessmentId) {
  try {
    await AsyncStorage.removeItem(pendingFinalizeKey(studentId, assessmentId));
    await removeFromPendingIndex(studentId, assessmentId);
    return true;
  } catch (err) {
    console.error(`Pending finalization clear failed [student ${studentId}, assessment ${assessmentId}]:`, err);
    return false;
  }
}

/**
 * Discovers all pending/conflict finalization records for a student from
 * only studentId — no assessmentId needed. This is what makes retry work
 * after an app restart or via any navigation path into LetterHomeScreen,
 * not just the immediate post-assessment transition.
 *
 * Self-heals: if the index references an assessmentId whose record is
 * missing or corrupted, that entry is dropped from the index (never
 * throws, never re-adds a phantom entry).
 *
 * @param {number|string} studentId
 * @returns {Promise<Object[]>} records found (possibly empty) — never null.
 */
export async function getPendingFinalizationsForStudent(studentId) {
  let index;
  try {
    const raw = await AsyncStorage.getItem(pendingFinalizeIndexKey(studentId));
    index = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Pending finalization index read failed [student ${studentId}]:`, err);
    return [];
  }

  const records  = [];
  const staleIds = [];
  for (const assessmentId of index) {
    const record = await getPendingFinalization(studentId, assessmentId);
    if (record) {
      records.push(record);
    } else {
      staleIds.push(assessmentId);
    }
  }

  if (staleIds.length > 0) {
    const cleaned = index.filter(id => !staleIds.includes(id));
    try {
      await AsyncStorage.setItem(pendingFinalizeIndexKey(studentId), JSON.stringify(cleaned));
    } catch (err) {
      console.error(`Pending finalization index cleanup failed [student ${studentId}]:`, err);
    }
  }

  return records;
}
