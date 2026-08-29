'use strict';

// Session-local (in-memory only, NEVER persisted) tracker for same-sitting
// rewatch/retry loops on a single Level 1 word. Caps how many times a child
// can be bounced back into the Phase 1 video for the same word within one
// continuous sitting, before the flow breaks out to a non-punitive stopping
// point instead of looping indefinitely.
//
// Deliberately not a DB column, not AsyncStorage, not Redux — this is a
// pure UX safety valve (TASK-44), not a mastery/progress signal. Rules 1-3
// (frozen, CLAUDE.md Hard Rule 1) are entirely unaffected by this file, and
// nothing here is read by dialogueService.js/category3Service.js.

const restartCounts = new Map();

function key(studentId, wordId) {
  return `${studentId}:${wordId}`;
}

// How many same-sitting rewatch loops have already happened for this word.
// 0 if none, or if the counter was never incremented / was just cleared.
export function getRestartCount(studentId, wordId) {
  return restartCounts.get(key(studentId, wordId)) ?? 0;
}

// Records one more same-sitting rewatch loop for this word.
export function incrementRestartCount(studentId, wordId) {
  const k = key(studentId, wordId);
  restartCounts.set(k, (restartCounts.get(k) ?? 0) + 1);
}

// Clears the counter for this word. Call whenever the child leaves this
// word's attempt cycle (starting it fresh, passing, skipping, or exiting),
// so a later, unrelated sitting never inherits a stale count.
export function clearRestartCount(studentId, wordId) {
  restartCounts.delete(key(studentId, wordId));
}

// One same-sitting rewatch is allowed; a second consecutive struggle in the
// same sitting breaks the loop instead of rewatching again.
export const MAX_SAME_SITTING_RESTARTS = 1;
