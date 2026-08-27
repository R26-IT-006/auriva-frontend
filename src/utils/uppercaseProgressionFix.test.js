import fs from 'fs';
import path from 'path';

/**
 * Uppercase progression fix — screen-level integration coverage. These
 * screens import 'react-native' and can't be mounted under this repo's
 * plain-node jest config; verified by source-text assertion, the same
 * established technique teacherReportLoadGuard.test.js /
 * teacherReportFeature11.test.js already use for screen files in this
 * project. The underlying pure logic (real category order, taxonomy,
 * mastered-letter filtering) is covered by uppercaseAdaptiveSequencing.test.js
 * and masteredLetterFiltering.test.js — this file proves the screens are
 * actually WIRED to that logic.
 */

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  return source.slice(start, end);
}

const assessmentComplete = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/AssessmentCompleteScreen.js'), 'utf8'
);
const letterPractice = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/LetterPracticeScreen.js'), 'utf8'
);
const letterWriting = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/LetterWritingScreen.js'), 'utf8'
);
const uppercaseWriting = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/uppercase/UppercaseWritingScreen.js'), 'utf8'
);

// ═══════════════════════════════════════════════════════════════════════════
// 1/2 — real adaptive uppercase sequence generated & stored
// ═══════════════════════════════════════════════════════════════════════════

describe('AssessmentCompleteScreen generates and stores a REAL adaptive uppercase sequence', () => {
  const handlerBlock = slice(assessmentComplete, 'onPress={async () => {', 'setIsSaving(false);');

  it('calls generateAdaptiveSequence a second time with caseType "uppercase", using the same assessmentData', () => {
    const codeOnly = stripComments(handlerBlock);
    expect(codeOnly).toMatch(/generateAdaptiveSequence\(\s*assessmentData,\s*'lowercase'\s*\)/);
    expect(codeOnly).toMatch(/generateAdaptiveSequence\(\s*assessmentData,\s*'uppercase'\s*\)/);
  });

  it('stores BOTH sequences concatenated into one array, never overwriting the lowercase half with an uppercase-only or empty array', () => {
    expect(handlerBlock).toContain('storeLetterSequence(student.sid, [...letters, ...uppercaseLetters])');
  });

  it('still stores the SAME motorProfile used for lowercase (not a separately-computed one) — proves category-order personalization is shared, not duplicated/diverged', () => {
    expect(handlerBlock).toContain('storeMotorProfile(student.sid, motorProfile)');
    // The uppercase call's own destructured motorProfile (if any) must never
    // be the one persisted — only `letters` is taken from it.
    expect(handlerBlock).toMatch(/const \{ letters: uppercaseLetters \} = generateAdaptiveSequence/);
  });

  it('the collection-mode branch is completely untouched — still returns before any sequence generation, still uses the fixed DATA_COLLECTION_PROTOCOL', () => {
    const collectionBranch = slice(assessmentComplete, 'if (collectionMode) {', 'setIsSaving(true);');
    expect(collectionBranch).toContain('DATA_COLLECTION_PROTOCOL.lowercase');
    expect(collectionBranch).toContain('return;');
    expect(collectionBranch).not.toMatch(/generateAdaptiveSequence|storeLetterSequence/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Uppercase unlock gate
// ═══════════════════════════════════════════════════════════════════════════

describe('LetterPracticeScreen\'s uppercase unlock gate is authoritative, not hardcoded', () => {
  it('lowercaseDone is no longer hardcoded true', () => {
    expect(letterPractice).not.toMatch(/const lowercaseDone\s*=\s*true\s*;/);
  });

  it('lowercaseDone is derived from the backend-authoritative lowercaseProgress count (>= 26), the same LETTER_PROGRESS-sourced value ProgressReportScreen.js already uses', () => {
    expect(letterPractice).toMatch(/const lowercaseDone\s*=\s*lowercaseProgress\s*>=\s*26\s*;/);
    // No actual getCompletedLetters() call anywhere in this screen — the
    // gate is never derived from frontend AsyncStorage.
    expect(letterPractice).not.toMatch(/getCompletedLetters\(/);
  });

  it('lowercaseProgress itself comes from the LETTER_PROGRESS endpoint (backend LetterProgress-derived count), not local storage', () => {
    const effectBlock = slice(letterPractice, 'useFocusEffect(', 'const lowercaseDone');
    expect(effectBlock).toContain('ENDPOINTS.LETTER_PROGRESS(student.sid)');
    expect(effectBlock).toContain('setLowercaseProgress(res.data.lowercase_completed');
  });

  it("the uppercase pill's tap handler is still gated", () => {
    // The tap site now reads `uppercaseOpen`, which is `lowercaseDone` OR the
    // explicit demo-preview switch (constants/demoAccess.js), and nothing else.
    expect(letterPractice).toMatch(/onPress=\{\(\)\s*=>\s*uppercaseOpen\s*&&\s*goToLetterScreen\('uppercase'/);
    expect(letterPractice).toMatch(/const uppercaseOpen\s+= canOpen\(lowercaseDone\);/);
  });

  it('the EARNED rule is untouched - lowercaseDone still decides how the pill looks', () => {
    expect(letterPractice).toMatch(/const lowercaseDone\s+= lowercaseProgress >= 26;/);
    // "Ready to go!" - the earned state - is still keyed off the real rule.
    expect(letterPractice).toMatch(/lowercaseDone \? \(/);
    expect(letterPractice).toMatch(/<Text style=\{styles\.pillSubLabel\}>Ready to go!/);
  });

  it('an early tap is shown as a preview, never dressed up as earned', () => {
    expect(letterPractice).toMatch(/const uppercasePreview\s+= isPreview\(lowercaseDone\);/);
    expect(letterPractice).toMatch(/UPPERCASE_ORDER_CAPTION/);
    expect(letterPractice).toMatch(/PREVIEW_BADGE/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Uppercase mastered-letter resume integration (6/7) — proves the screen is
// WIRED to the already-tested pure filtering logic, not re-implementing it.
// ═══════════════════════════════════════════════════════════════════════════

describe('UppercaseWritingScreen is wired to the mastered-letter resume fix', () => {
  it('fetches authoritative mastered letters and filters baseSequence before first render (same fetchMasteredLetters/filterUnmasteredSequence utils LetterWritingScreen.js uses)', () => {
    expect(uppercaseWriting).toContain("import { fetchMasteredLetters, filterUnmasteredSequence } from '../../../utils/masteredLetterFiltering';");
    expect(uppercaseWriting).toContain('fetchMasteredLetters(student.sid)');
    expect(uppercaseWriting).toContain('filterUnmasteredSequence(baseSequence, pairs)');
  });

  it('gates the main render on masteredSequenceReady, so no mastered uppercase letter can flash before filtering resolves', () => {
    expect(uppercaseWriting).toMatch(/if \(!masteredSequenceReady\) \{\s*return <SafeAreaView style=\{styles\.safe\} \/>;/);
  });

  it('collection mode still bypasses filtering entirely (fixed protocol sequence, never skips a letter)', () => {
    const effectBlock = slice(uppercaseWriting, 'useEffect(() => {\n    if (collectionMode) {', 'return () => { cancelled = true; };');
    expect(effectBlock).toContain('setEffectiveSequence(baseSequence)');
    expect(effectBlock).toContain('setMasteredSequenceReady(true)');
  });

  it('baseSequence still filters letterSequence by caseType "uppercase" and falls back to getAllLetters only when the stored sequence has no uppercase entries (backward compatibility for students assessed before this fix)', () => {
    const fn = slice(uppercaseWriting, 'const baseSequence = useMemo(() => {', '}, [letterSequence]);');
    expect(fn).toContain("letterSequence.filter(l => l.caseType === caseType)");
    expect(fn).toContain('getAllLetters(caseType)');
  });
});

describe('LetterWritingScreen (lowercase) keeps its identical mastered-letter wiring — unchanged by this fix', () => {
  it('still fetches and filters exactly as before', () => {
    expect(letterWriting).toContain('fetchMasteredLetters(student.sid)');
    expect(letterWriting).toContain('filterUnmasteredSequence(baseSequence, pairs)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — lowercase sequencing / other features unaffected
// ═══════════════════════════════════════════════════════════════════════════

describe('Lowercase sequencing and other flows are unaffected by this fix', () => {
  it('LetterWritingScreen.js was not modified by this fix (no uppercase-specific code added there)', () => {
    expect(letterWriting).not.toMatch(/generateAdaptiveSequence\(\s*assessmentData,\s*'uppercase'\s*\)/);
  });

  it('word-writing / collection-session / Feature 1-11 imports in AssessmentCompleteScreen are untouched (still present, nothing removed)', () => {
    expect(assessmentComplete).toContain("import { attemptFinalization } from '../../utils/finalizeSync';");
    expect(assessmentComplete).toContain('DATA_COLLECTION_PROTOCOL');
  });
});
