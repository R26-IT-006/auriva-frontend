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

/**
 * Persists a replayable finalize record. Store only what's needed to replay
 * PATCH /handwriting/assessment/:assessmentId/finalize — never raw
 * trajectories, ShapeFeature data, names, tokens, or API error objects.
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
    return true;
  } catch (err) {
    console.error(`Pending finalization clear failed [student ${studentId}, assessment ${assessmentId}]:`, err);
    return false;
  }
}
