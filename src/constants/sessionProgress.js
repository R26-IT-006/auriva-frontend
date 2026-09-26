/**
 * In-memory session progress store.
 * Resets on app restart — designed for teacher review during a live session.
 *
 * Word data shape:
 *   { [letter]: Array<{ word, emoji, imageKey, status: { A, B, C, D } }> }
 *   status values: 'correct' | 'good' | 'pending'
 */

// ─── Word activity results ─────────────────────────────────────────────────────
const _wordData = {};

export function recordLetterProgress(letter, wordResults) {
  _wordData[letter] = wordResults;
}
export function getSessionProgress() { return _wordData; }
export function hasLetterProgress(letter) { return Boolean(_wordData[letter]); }

// ─── Assessment snapshot (shape assessment results) ───────────────────────────
let _assessmentData = null;
let _motorProfile   = null;

export function recordAssessmentSnapshot(assessmentData, motorProfile) {
  _assessmentData = assessmentData;
  _motorProfile   = motorProfile;
}
export function getAssessmentSnapshot() {
  return { assessmentData: _assessmentData, motorProfile: _motorProfile };
}

// ─── Session timing ───────────────────────────────────────────────────────────
const _sessionStart = Date.now();   // tracks from app load

export function getSessionDurationMinutes() {
  return Math.max(1, Math.round((Date.now() - _sessionStart) / 60000));
}

// ─── Full clear (e.g. new student) ───────────────────────────────────────────
export function clearSessionProgress() {
  Object.keys(_wordData).forEach(k => delete _wordData[k]);
  _assessmentData = null;
  _motorProfile   = null;
}
