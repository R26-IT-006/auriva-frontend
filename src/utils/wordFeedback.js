// Word-writing child feedback — maps the backend's advisory
// ('size'|'spacing'|'both'|null, from resolveChildFeedbackAdvisory in
// wordLayoutService.js) to a short, neutral, supportive message for the
// child-facing UI. Pure function, no side effects — the screens decide
// WHEN to show this (after an authoritative save, never live while drawing;
// see WordWritingScreen.js / ExerciseE_WriteWord.js), this only decides WHAT
// to say. Deliberately avoids clinical/judgemental language ("wrong", "bad",
// "motor control", "severity", "failed") per product guidance — this is
// encouragement, not a diagnosis, and it never implies pass/fail changed.
//
// ── Why spacing has three messages, not one ──────────────────────────────
// spacing_consistency_score alone cannot tell bunched-up from spread-out: it
// folds the average deviation through Math.abs, so 0.6 and 1.4 score the same.
// resolveSpacingDirection() in wordLayoutService.js reads the SIGNED per-pair
// gap_ratio values instead, and only names a direction when the average gap is
// clearly off AND that error is bigger than the variation between gaps.
//
// So 'spacing_tight' and 'spacing_wide' arrive only when the direction is
// real, and plain 'spacing' still covers "uneven, but no honest direction".
// A child is never told to move letters the wrong way.
//
// ── Register ─────────────────────────────────────────────────────────────
// Short imperative phrases, matching the Letter Writing avatar
// (AttemptAvatarFeedback.js: 'Great tracing!', 'Keep going.', 'Good try.').
// The previous full sentences ('Try to leave even spaces between letters.')
// were long for the child this is written for. English only — no Sinhala here.
const CHILD_FEEDBACK_MESSAGES = {
  size: 'Keep letters the same size',
  spacing_tight: 'Leave a little space',
  spacing_wide: 'Keep letters closer',
  spacing: 'Keep even spaces',
  both: 'Keep even sizes and spaces',
};

export function childFeedbackMessage(childFeedback) {
  return CHILD_FEEDBACK_MESSAGES[childFeedback] ?? null;
}
