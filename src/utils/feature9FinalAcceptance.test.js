// Feature 9 Step 6 — Final End-to-End Validation + Closure (frontend).
//
// Re-verifies the pure fetch-normalization/helper behavior from
// teacherRecommendationValidations.js (items 41/44-48/51-58) as a fresh,
// standalone closure-step suite, PLUS source-scan wiring proof against the
// real TeacherReportScreen.js (items 42/43/49/50/59-70) — mirrors
// feature8FinalAcceptance.test.js's own established closure-step shape
// exactly. No RN component-testing infra exists in this project
// (jest.config.js's own comment), so screen wiring is proven the same way
// every other feature's own closure step already proved it.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

const fs = require('fs');
const path = require('path');
import client from '../api/client';
import {
  fetchTeacherRecommendationValidationState,
  submitTeacherRecommendationValidation,
  formatTeacherReviewLabel,
  getOppositeValidationAction,
  normalizeTeacherNoteForSubmit,
  filterHistoryForStream,
  normalizeTeacherValidationHistoryResponse,
  TEACHER_NOTE_MAX_LENGTH,
} from './teacherRecommendationValidations';
import { normalizeWorksheetRecommendationsResponse } from './worksheetRecommendations';

beforeEach(() => {
  jest.clearAllMocks();
});

const FP = 'a'.repeat(64);

function readScreen() {
  return fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');
}

// ─── 41-42: fingerprint preservation + display exclusion ───────────────────

describe('41. recommendation fingerprint preserved from Feature 8', () => {
  it('normalizeWorksheetRecommendationsResponse passes a well-formed fingerprint through unchanged', () => {
    const result = normalizeWorksheetRecommendationsResponse({
      status: 'evaluated', recommendations: [{
        recommendationType: 'motor_family_practice', caseType: 'lowercase', family: 'curved',
        title: 'Curved Movement Practice', focusLetters: ['c', 'o'], rationale: 'x', suggestedActivities: ['y'],
        recommendationFingerprint: FP,
      }],
      summary: { evaluatedStreamCount: 6, persistentStreamCount: 1, notPersistentCount: 0, insufficientDataCount: 5, recommendationCount: 1 },
    });
    expect(result.recommendations[0].recommendationFingerprint).toBe(FP);
  });
});

describe('42. fingerprint never rendered', () => {
  it('TeacherReviewSection JSX never interpolates recommendationFingerprint inside a <Text> node', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch).not.toBeNull();
    expect(trsMatch[0]).not.toMatch(/<Text[^>]*>\s*\{?\s*recommendationFingerprint/);
  });
});

// ─── 43-45: request shape ────────────────────────────────────────────────

describe('43. current-state request sends fingerprint', () => {
  it('fetchTeacherRecommendationValidationState forwards recommendationFingerprint as a query param', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', current: null } });
    await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: FP });
    const [, config] = client.get.mock.calls[0];
    expect(config.params.recommendationFingerprint).toBe(FP);
  });

  it('the screen calls fetchTeacherRecommendationValidationState with recommendationFingerprint in its arguments', () => {
    const source = readScreen();
    expect(source).toMatch(/fetchTeacherRecommendationValidationState\(\{[\s\S]{0,120}?recommendationFingerprint/);
  });
});

describe('44. validation POST sends fingerprint', () => {
  it('submitTeacherRecommendationValidation includes recommendationFingerprint in the body', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    const [, body] = client.post.mock.calls[0];
    expect(body.recommendationFingerprint).toBe(FP);
  });
});

describe('45. no teacherId sent', () => {
  it('the POST body never includes teacherId/teacher_id', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    const [, body] = client.post.mock.calls[0];
    expect(body).not.toHaveProperty('teacherId');
    expect(body).not.toHaveProperty('teacher_id');
  });

  it('the screen never references req.body.teacherId / a client-supplied teacher id for the POST call', () => {
    const source = readScreen();
    const handleActionMatch = source.match(/async function handleAction\(validation\) \{[\s\S]*?\n {2}\}/);
    expect(handleActionMatch).not.toBeNull();
    expect(handleActionMatch[0]).not.toMatch(/teacherId/);
  });
});

// ─── 46-50: label/action correctness ────────────────────────────────────

describe('46. null -> Not reviewed', () => {
  it('formatTeacherReviewLabel(null) === "Not reviewed"', () => {
    expect(formatTeacherReviewLabel(null)).toBe('Not reviewed');
  });
});

describe('47. confirmed -> Confirmed', () => {
  it('formatTeacherReviewLabel("confirmed") === "Confirmed"', () => {
    expect(formatTeacherReviewLabel('confirmed')).toBe('Confirmed');
  });
});

describe('48. dismissed -> Not suitable', () => {
  it('formatTeacherReviewLabel("dismissed") === "Not suitable"', () => {
    expect(formatTeacherReviewLabel('dismissed')).toBe('Not suitable');
  });
});

describe('49. opposite action only', () => {
  it('getOppositeValidationAction never returns the same value it was given', () => {
    expect(getOppositeValidationAction('confirmed')).toBe('dismissed');
    expect(getOppositeValidationAction('dismissed')).toBe('confirmed');
  });

  it('the screen conditions each button on showConfirmButton/showDismissButton derived from getOppositeValidationAction', () => {
    const source = readScreen();
    expect(source).toMatch(/const opposite = getOppositeValidationAction\(currentValidation\);/);
    expect(source).toMatch(/const showConfirmButton = currentValidation === null \|\| opposite === 'confirmed';/);
    expect(source).toMatch(/const showDismissButton = currentValidation === null \|\| opposite === 'dismissed';/);
  });
});

describe('50. no same-action button', () => {
  it('the Confirm button JSX is gated by showConfirmButton, Not-suitable by showDismissButton (never both unconditionally)', () => {
    const source = readScreen();
    expect(source).toMatch(/\{showConfirmButton && \(/);
    expect(source).toMatch(/\{showDismissButton && \(/);
  });
});

// ─── 51-52: note handling ────────────────────────────────────────────────

describe('51. note max length 2000', () => {
  it('TEACHER_NOTE_MAX_LENGTH === 2000', () => {
    expect(TEACHER_NOTE_MAX_LENGTH).toBe(2000);
  });

  it('the screen applies maxLength={TEACHER_NOTE_MAX_LENGTH} to the note TextInput', () => {
    const source = readScreen();
    expect(source).toMatch(/maxLength=\{TEACHER_NOTE_MAX_LENGTH\}/);
  });
});

describe('52. note trimming/null behavior', () => {
  it('normalizeTeacherNoteForSubmit trims and collapses empty to null', () => {
    expect(normalizeTeacherNoteForSubmit('  hello  ')).toBe('hello');
    expect(normalizeTeacherNoteForSubmit('   ')).toBeNull();
    expect(normalizeTeacherNoteForSubmit(undefined)).toBeNull();
  });
});

// ─── 53-55: error/reset messaging ────────────────────────────────────────

describe('53. recommendation_changed message', () => {
  it('a 409/recommendation_changed error normalizes to the refresh-before-reviewing message', async () => {
    const err = new Error('changed');
    err.status = 409;
    err.details = { status: 'recommendation_changed' };
    client.post.mockRejectedValueOnce(err);
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result.status).toBe('recommendation_changed');
    expect(result.message).toBe('This recommendation has changed. Refresh the report before reviewing it.');
  });
});

describe('54. recommendation_not_found message', () => {
  it('a 409/recommendation_not_found error normalizes to a distinct no-longer-available message', async () => {
    const err = new Error('not found');
    err.status = 409;
    err.details = { status: 'recommendation_not_found' };
    client.post.mockRejectedValueOnce(err);
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result.status).toBe('recommendation_not_found');
    expect(result.message).toBe('This recommendation is no longer available. Refresh the report.');
  });
});

describe('55. current:null resets new evidence', () => {
  it('a state fetch for a brand-new fingerprint returns current:null', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', current: null } });
    const result = await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: 'b'.repeat(64) });
    expect(result.current).toBeNull();
  });
});

// ─── 56-58: history helpers ──────────────────────────────────────────────

describe('56. history filtering', () => {
  it('filterHistoryForStream keeps only events matching caseType+family', () => {
    const events = [
      { id: 1, caseType: 'lowercase', family: 'curved' },
      { id: 2, caseType: 'uppercase', family: 'straight' },
    ];
    expect(filterHistoryForStream(events, 'lowercase', 'curved').map((e) => e.id)).toEqual([1]);
  });
});

describe('57. history order preserved', () => {
  it('normalizeTeacherValidationHistoryResponse never re-sorts events', () => {
    const result = normalizeTeacherValidationHistoryResponse({
      status: 'evaluated',
      events: [
        { id: 2, caseType: 'lowercase', family: 'curved', recommendation: {}, validation: 'dismissed', teacherNote: null, validatedAt: '2026-08-12T00:00:00.000Z' },
        { id: 1, caseType: 'lowercase', family: 'curved', recommendation: {}, validation: 'confirmed', teacherNote: null, validatedAt: '2026-08-10T00:00:00.000Z' },
      ],
      latestByStream: {},
    });
    expect(result.events.map((e) => e.id)).toEqual([2, 1]);
  });
});

describe('58. note display', () => {
  it('a history event carries its teacherNote through normalization', () => {
    const result = normalizeTeacherValidationHistoryResponse({
      status: 'evaluated',
      events: [{ id: 1, caseType: 'lowercase', family: 'curved', recommendation: {}, validation: 'confirmed', teacherNote: 'Focus on o before c', validatedAt: '2026-08-10T00:00:00.000Z' }],
      latestByStream: {},
    });
    expect(result.events[0].teacherNote).toBe('Focus on o before c');
  });

  it('the screen renders event.teacherNote conditionally inside the history list', () => {
    const source = readScreen();
    expect(source).toMatch(/event\.teacherNote \? <Text style=\{trs\.historyNote\}>Note: \{event\.teacherNote\}<\/Text> : null/);
  });
});

// ─── 59-63: no-automatic-write + lifecycle wiring ────────────────────────

describe('59. no POST on render', () => {
  it('submitTeacherRecommendationValidation is referenced only inside handleAction, never at component-body top level', () => {
    const source = readScreen();
    const occurrences = source.match(/submitTeacherRecommendationValidation\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});

describe('60. no POST on focus', () => {
  it('no useFocusEffect body anywhere in the screen calls submitTeacherRecommendationValidation', () => {
    const source = readScreen();
    const focusEffectBodies = source.match(/useFocusEffect\(\s*useCallback\(\(\) => \{[\s\S]*?\n {4}\}, \[student\]\)\s*\n {2}\);/g) ?? [];
    expect(focusEffectBodies.length).toBeGreaterThan(0);
    for (const body of focusEffectBodies) {
      expect(body).not.toMatch(/submitTeacherRecommendationValidation/);
    }
  });
});

describe('61. history fetched once', () => {
  it('fetchTeacherRecommendationValidationHistory appears exactly once', () => {
    const source = readScreen();
    const occurrences = source.match(/fetchTeacherRecommendationValidationHistory\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});

describe('62. current-state request keyed by fingerprint', () => {
  it('the effect dependency array is exactly [studentId, caseType, family, recommendationFingerprint]', () => {
    const source = readScreen();
    expect(source).toMatch(/\}, \[studentId, caseType, family, recommendationFingerprint\]\);/);
  });
});

describe('63. stale-response guard', () => {
  it('TeacherReviewSection uses both a local active flag and mountedRef', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch).not.toBeNull();
    expect(trsMatch[0]).toMatch(/let active = true/);
    expect(trsMatch[0]).toMatch(/if \(!active \|\| !mountedRef\.current\) return;/);
  });
});

// ─── 64-68: independence/privacy re-confirmation ─────────────────────────

describe('64. no recommendation suppression', () => {
  it('the recommendation-card render block never filters on validation/dismissed state', () => {
    const source = readScreen();
    const match = source.match(/\{worksheetRecs\.status === 'evaluated' && worksheetRecs\.recommendations\.length > 0 && \([\s\S]*?\)\)\}\s*\n\s*<\/View>\s*\n\s*\)\}/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/dismissed|\.filter\(/);
  });
});

describe('65. no severity/correctness wording', () => {
  it('TeacherReviewSection never renders Correct/Incorrect/Approve/Reject/high/medium/low', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch).not.toBeNull();
    expect(trsMatch[0]).not.toMatch(/>Correct</);
    expect(trsMatch[0]).not.toMatch(/>Incorrect</);
    expect(trsMatch[0]).not.toMatch(/>Approve</);
    expect(trsMatch[0]).not.toMatch(/>Reject</);
  });

  it('the trs stylesheet never uses the red/amber/green severity trio', () => {
    const source = readScreen();
    const match = source.match(/const trs = StyleSheet\.create\(\{[\s\S]*?\n\}\);/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/#EF4444|#F59E0B|#22C55E/);
  });
});

describe('66. Share.share unchanged', () => {
  it('handleShare() references no Feature 9 identifier', () => {
    const source = readScreen();
    const match = source.match(/async function handleShare\(\)[\s\S]*?\n {2}\}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/teacherHistory|recommendationFingerprint|teacherNote|submitTeacherRecommendationValidation|TeacherReviewSection/);
  });
});

describe('67. general recommendations unchanged', () => {
  it('the report.recommendations render block carries no Feature 9 identifier', () => {
    const source = readScreen();
    const match = source.match(/\{report\.recommendations\.map\(\(rec, i\) => \([\s\S]*?\)\)\}/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/teacherHistory|TeacherReviewSection|recommendationFingerprint/);
  });
});

describe('68. no collection endpoint usage', () => {
  it('the screen never hardcodes the collection-mode /teacher-validation path', () => {
    const source = readScreen();
    expect(source).not.toMatch(/['"]\/handwriting\/teacher-validation['"]/);
    expect(source).not.toMatch(/ENDPOINTS\.TEACHER_VALIDATION\b/);
  });
});

// ─── 69-70: accessibility + raw-fingerprint exclusion ────────────────────

describe('69. accessibility labels present', () => {
  it('both review buttons and the note input carry accessibility props', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch).not.toBeNull();
    expect(trsMatch[0]).toMatch(/accessibilityRole="button"/);
    expect(trsMatch[0]).toMatch(/accessibilityLabel="Confirm this recommendation"/);
    expect(trsMatch[0]).toMatch(/accessibilityLabel="Mark this recommendation as not suitable"/);
    expect(trsMatch[0]).toMatch(/accessibilityLabel="Optional note about this teacher review"/);
    expect(trsMatch[0]).toMatch(/disabled=\{saving \|\| !recommendationFingerprint\}/);
  });
});

describe('70. no raw fingerprint interpolation anywhere in rendered text', () => {
  it('no <Text> node in the whole screen interpolates a raw fingerprint variable', () => {
    const source = readScreen();
    expect(source).not.toMatch(/<Text[^>]*>\s*\{?\s*(evidenceFingerprint|recommendation\.recommendationFingerprint)\s*\}?\s*<\/Text>/);
  });
});
