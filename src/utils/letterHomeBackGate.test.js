// Gated back navigation on the writing module's main (letter-or-word) screen.
//
// LetterHomeScreen.js imports 'react-native' and cannot be mounted under this
// repo's plain-node jest config, so it is verified by source-text assertion —
// the same technique teacherReportFeature11.test.js and learningSessionWiring
// .test.js already use for this class of screen.
//
// The property that matters: leaving a learning session is an ADULT decision.
// The button must never navigate directly; it must route through the same
// ParentGateModal the Concept screens already use for their back buttons.

import fs from 'fs';
import path from 'path';

const screen = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/LetterHomeScreen.js'), 'utf8');

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  return source.slice(start, end);
}

describe('back button exists on the letter-or-word choice screen', () => {
  it('renders a back arrow in the top bar', () => {
    const topBar = slice(screen, '{/* ── Top bar ── */}', '<View style={styles.topBtnGroup}>');
    expect(topBar).toMatch(/<Ionicons name="arrow-back"/);
    expect(topBar).toMatch(/style=\{\[styles\.backBtn/);
  });

  it('carries an accessible label that names the code requirement', () => {
    expect(screen).toMatch(/accessibilityLabel="Back — needs a grown-up code"/);
    expect(screen).toMatch(/accessibilityRole="button"/);
  });

  it('has its own styles rather than reusing an unrelated pill', () => {
    expect(screen).toMatch(/backBtn: \{/);
    expect(screen).toMatch(/leftGroup: \{/);
  });
});

describe('the back button is gated, never a direct navigation', () => {
  it('its onPress opens the parent gate and does not navigate', () => {
    const button = slice(screen, 'style={[styles.backBtn', '</TouchableOpacity>');
    expect(button).toContain("requestGatedAction('back')");
    // The critical property: no navigation call inside the button itself.
    expect(button).not.toMatch(/navigation\.(navigate|goBack|replace|popToTop)\(/);
  });

  it("'back' is part of the documented gate-action vocabulary", () => {
    expect(screen).toMatch(/'why' \| 'assessment' \| 'progress' \| 'back'/);
  });

  it('navigation happens only inside handleGateSuccess, after the code is accepted', () => {
    const handler = slice(screen, 'function handleGateSuccess()', 'function handleGateCancel()');
    expect(handler).toContain("pendingGateAction === 'back'");
    // Back now returns to the assessment starting screen rather than popping
    // one entry or exiting the module - see utils/moduleSelectionBack.js.
    // The GATE is unchanged: this still runs only after the code is accepted.
    expect(handler).toMatch(/backToAssessmentStart\(navigation, \{ student, theme \}\)/);
    expect(handler).toMatch(/navigation\.navigate\('TeacherMain'\)/);
  });

  it('cancelling the gate performs no navigation at all', () => {
    const cancel = slice(screen, 'function handleGateCancel()', 'function ');
    expect(stripComments(cancel)).not.toMatch(/navigation\./);
  });

  it('reuses the existing ParentGateModal rather than a second gate', () => {
    expect(screen).toMatch(/import \{ ParentGateModal \}/);
    expect((screen.match(/<ParentGateModal/g) ?? []).length).toBe(1);
  });
});

describe('the gate cannot be bypassed by the back button itself', () => {
  it('the back action reaches exactly one destination, and only via the gate', () => {
    const handler = slice(screen, "pendingGateAction === 'back'", 'setPendingGateAction(null);');
    // One call, one destination: the assessment starting screen.
    expect((handler.match(/backToAssessmentStart\(/g) ?? []).length).toBe(1);
    expect(handler.match(/navigation\.navigate\('([^']+)'\)/g) ?? []).toEqual([]);
    // And it is still unreachable without passing the gate first.
    expect(screen).not.toMatch(/onPress=\{\(\) => backToAssessmentStart/);
  });

  it('does not introduce a hardware/gesture back path that skips the gate', () => {
    // A raw BackHandler or `gestureEnabled` override would let a child leave
    // without the code, defeating the button's whole purpose.
    const code = stripComments(screen);
    expect(code).not.toMatch(/BackHandler/);
    expect(code).not.toMatch(/gestureEnabled/);
  });
});
