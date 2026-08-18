// Word-writing child feedback — maps the backend's advisory
// ('size'|'spacing'|'both'|null, from resolveChildFeedbackAdvisory in
// wordLayoutService.js) to a short, neutral, supportive message for the
// child-facing UI. Pure function, no side effects — the screens decide
// WHEN to show this (after an authoritative save, never live while drawing;
// see WordWritingScreen.js / ExerciseE_WriteWord.js), this only decides WHAT
// to say. Deliberately avoids clinical/judgemental language ("wrong", "bad",
// "motor control", "severity", "failed") per product guidance — this is
// encouragement, not a diagnosis, and it never implies pass/fail changed.
const CHILD_FEEDBACK_MESSAGES = {
  size: 'Try to keep your letters a similar size.',
  spacing: 'Try to leave even spaces between letters.',
  both: 'Try to keep your letters a similar size and leave even spaces.',
};

export function childFeedbackMessage(childFeedback) {
  return CHILD_FEEDBACK_MESSAGES[childFeedback] ?? null;
}
