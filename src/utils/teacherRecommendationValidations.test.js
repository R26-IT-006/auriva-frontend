// Feature 9 Step 5 — TESTS: fetch/submit utility (spec §64, items 1-17) +
// pure UI/helper functions (spec §65, items 18-31). `client` is mocked so
// these tests never hit a real network or write to the live database.
// Mirrors utils/worksheetRecommendations.test.js's exact convention.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import client from '../api/client';
import {
  fetchTeacherRecommendationValidationHistory,
  fetchTeacherRecommendationValidationState,
  submitTeacherRecommendationValidation,
  normalizeTeacherValidationHistoryResponse,
  normalizeCurrentValidationStateResponse,
  formatTeacherReviewLabel,
  getOppositeValidationAction,
  normalizeTeacherNoteForSubmit,
  filterHistoryForStream,
  formatReviewDate,
  TEACHER_NOTE_MAX_LENGTH,
} from './teacherRecommendationValidations';

beforeEach(() => {
  jest.clearAllMocks();
});

const FP = 'a'.repeat(64);
const ACTION_ID = '11111111-1111-4111-8111-111111111111';

function historyEvent(overrides = {}) {
  return {
    id: 1, caseType: 'lowercase', family: 'curved',
    recommendation: { type: 'motor_family_practice', title: 'Curved Movement Practice', focusLetters: ['c', 'o'] },
    validation: 'confirmed', teacherNote: null, validatedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

// ─── 1-3: history fetch ──────────────────────────────────────────────────

describe('1. history success', () => {
  it('resolves with events + latestByStream on a 200 evaluated response', async () => {
    client.get.mockResolvedValueOnce({
      data: { status: 'evaluated', studentId: 13, events: [historyEvent()], latestByStream: { lowercase: { curved: { validation: 'confirmed', teacherNote: null, validatedAt: '2026-08-10T00:00:00.000Z' } } }, uppercase: {} },
    });
    const result = await fetchTeacherRecommendationValidationHistory({ studentId: 13 });
    expect(result.status).toBe('evaluated');
    expect(result.events).toEqual([historyEvent()]);
  });
});

describe('2. empty history', () => {
  it('resolves with an empty events array, not an error', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', studentId: 13, events: [], latestByStream: { lowercase: {}, uppercase: {} } } });
    const result = await fetchTeacherRecommendationValidationHistory({ studentId: 13 });
    expect(result.status).toBe('evaluated');
    expect(result.events).toEqual([]);
  });
});

describe('3. history read failure', () => {
  it('a rejected request resolves to read_failed, never throws', async () => {
    client.get.mockRejectedValueOnce(new Error('network down'));
    const result = await fetchTeacherRecommendationValidationHistory({ studentId: 13 });
    expect(result.status).toBe('read_failed');
    expect(result.events).toEqual([]);
  });

  it('a backend read_failed status also normalizes to read_failed', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'read_failed' } });
    const result = await fetchTeacherRecommendationValidationHistory({ studentId: 13 });
    expect(result.status).toBe('read_failed');
  });
});

// ─── 4-7: current-state fetch ────────────────────────────────────────────

describe('4. current state null (never reviewed)', () => {
  it('resolves current: null', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', current: null } });
    const result = await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: FP });
    expect(result).toEqual({ status: 'evaluated', current: null });
  });
});

describe('5. current state confirmed', () => {
  it('resolves the current object with validation: confirmed', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', current: { validation: 'confirmed', teacherNote: null, validatedAt: '2026-08-10T00:00:00.000Z' } } });
    const result = await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: FP });
    expect(result.current.validation).toBe('confirmed');
  });
});

describe('6. current state dismissed', () => {
  it('resolves the current object with validation: dismissed', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', current: { validation: 'dismissed', teacherNote: 'Not suitable right now', validatedAt: '2026-08-12T00:00:00.000Z' } } });
    const result = await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: FP });
    expect(result.current.validation).toBe('dismissed');
    expect(result.current.teacherNote).toBe('Not suitable right now');
  });
});

describe('7. invalid current-state request', () => {
  it('a backend invalid_input status normalizes to invalid_input, current: null', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'invalid_input', current: null } });
    const result = await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'mixedcase', family: 'curved', recommendationFingerprint: FP });
    expect(result.status).toBe('invalid_input');
    expect(result.current).toBeNull();
  });

  it('a rejected request resolves to read_failed, never throws', async () => {
    client.get.mockRejectedValueOnce(new Error('boom'));
    const result = await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: FP });
    expect(result.status).toBe('read_failed');
  });
});

// ─── 8-13: submit ─────────────────────────────────────────────────────────

describe('8. POST confirmed success', () => {
  it('resolves status: validated, duplicate: false', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false, validation: { id: 1, validatedAt: '2026-08-14T00:00:00.000Z' } } });
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result).toEqual({ status: 'validated', duplicate: false, message: null });
  });
});

describe('9. POST dismissed success', () => {
  it('resolves status: validated for a dismissed action too', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'dismissed', recommendationFingerprint: FP });
    expect(result.status).toBe('validated');
  });
});

describe('10. POST duplicate success', () => {
  it('resolves duplicate: true as a success, not an error', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: true } });
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result).toEqual({ status: 'validated', duplicate: true, message: null });
  });
});

describe('11. recommendation_changed', () => {
  it('a 409 with details.status=recommendation_changed normalizes to a refresh message, no fingerprint leaked', async () => {
    const err = new Error('The recommendation has changed. Refresh the report before validating it.');
    err.status = 409;
    err.details = { status: 'recommendation_changed' };
    client.post.mockRejectedValueOnce(err);
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result.status).toBe('recommendation_changed');
    expect(result.message).toMatch(/This recommendation has changed\. Refresh the report/);
    expect(JSON.stringify(result)).not.toMatch(/[a-f0-9]{64}/);
  });
});

describe('12. recommendation_not_found', () => {
  it('a 409 with details.status=recommendation_not_found normalizes to a distinct refresh message', async () => {
    const err = new Error('This recommendation is no longer available.');
    err.status = 409;
    err.details = { status: 'recommendation_not_found' };
    client.post.mockRejectedValueOnce(err);
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result.status).toBe('recommendation_not_found');
    expect(result.message).toMatch(/This recommendation is no longer available\. Refresh the report/);
  });
});

describe('13. write failure', () => {
  it('a plain 500 (or network error) normalizes to write_failed with a generic message', async () => {
    const err = new Error('Internal server error');
    err.status = 500;
    client.post.mockRejectedValueOnce(err);
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result.status).toBe('write_failed');
    expect(result.message).toBe('Teacher review could not be saved.');
  });

  it('a 422 (invalid_input) also resolves safely, distinct status', async () => {
    const err = new Error('Invalid teacher validation request');
    err.status = 422;
    client.post.mockRejectedValueOnce(err);
    const result = await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    expect(result.status).toBe('invalid_input');
  });
});

// ─── 14-17: body shape discipline ────────────────────────────────────────

describe('14. teacherId never sent', () => {
  it('the POST body never includes teacherId/teacher_id', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    const [, body] = client.post.mock.calls[0];
    expect(body).not.toHaveProperty('teacherId');
    expect(body).not.toHaveProperty('teacher_id');
  });
});

describe('15. only allowed body keys sent', () => {
  it('the POST body contains exactly caseType/family/validation/teacherNote/recommendationFingerprint/actionId', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', teacherNote: 'x', recommendationFingerprint: FP, actionId: ACTION_ID });
    const [, body] = client.post.mock.calls[0];
    expect(Object.keys(body).sort()).toEqual(['caseType', 'family', 'validation', 'teacherNote', 'recommendationFingerprint', 'actionId'].sort());
  });

  it('studentId is never in the body (it is the URL path param)', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    const [url, body] = client.post.mock.calls[0];
    expect(url).toMatch(/\/13$/);
    expect(body).not.toHaveProperty('studentId');
  });
});

describe('16. fingerprint preserved', () => {
  it('the exact fingerprint given is sent verbatim, never recomputed/altered', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP });
    const [, body] = client.post.mock.calls[0];
    expect(body.recommendationFingerprint).toBe(FP);
  });

  it('fetchTeacherRecommendationValidationState sends the exact fingerprint as a query param, never computes one', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', current: null } });
    await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: FP });
    const [, config] = client.get.mock.calls[0];
    expect(config.params.recommendationFingerprint).toBe(FP);
  });
});

describe('16b. actionId preserved (Feature 9 repair)', () => {
  it('the exact actionId given by the caller is sent verbatim, never generated here', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({
      studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed',
      recommendationFingerprint: FP, actionId: ACTION_ID,
    });
    const [, body] = client.post.mock.calls[0];
    expect(body.actionId).toBe(ACTION_ID);
  });

  it('two separate submit calls with two different actionIds send two different bodies', async () => {
    const OTHER_ACTION_ID = '22222222-2222-4222-8222-222222222222';
    client.post.mockResolvedValue({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', recommendationFingerprint: FP, actionId: ACTION_ID });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'dismissed', recommendationFingerprint: FP, actionId: OTHER_ACTION_ID });
    expect(client.post.mock.calls[0][1].actionId).toBe(ACTION_ID);
    expect(client.post.mock.calls[1][1].actionId).toBe(OTHER_ACTION_ID);
  });
});

describe('17. note trimming/null behavior', () => {
  it('a whitespace-only note is sent as null', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', teacherNote: '   ', recommendationFingerprint: FP });
    const [, body] = client.post.mock.calls[0];
    expect(body.teacherNote).toBeNull();
  });

  it('a note with surrounding whitespace is trimmed', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'validated', duplicate: false } });
    await submitTeacherRecommendationValidation({ studentId: 13, caseType: 'lowercase', family: 'curved', validation: 'confirmed', teacherNote: '  Tired today  ', recommendationFingerprint: FP });
    const [, body] = client.post.mock.calls[0];
    expect(body.teacherNote).toBe('Tired today');
  });

  it('normalizeTeacherNoteForSubmit: undefined/non-string -> null', () => {
    expect(normalizeTeacherNoteForSubmit(undefined)).toBeNull();
    expect(normalizeTeacherNoteForSubmit(null)).toBeNull();
    expect(normalizeTeacherNoteForSubmit(42)).toBeNull();
  });

  it('normalizeTeacherNoteForSubmit: empty trimmed string -> null', () => {
    expect(normalizeTeacherNoteForSubmit('')).toBeNull();
    expect(normalizeTeacherNoteForSubmit('   \n  ')).toBeNull();
  });
});

// ─── 18-23: label/action helpers ─────────────────────────────────────────

describe('18. Not reviewed label', () => {
  it('formatTeacherReviewLabel(null/undefined) -> "Not reviewed"', () => {
    expect(formatTeacherReviewLabel(null)).toBe('Not reviewed');
    expect(formatTeacherReviewLabel(undefined)).toBe('Not reviewed');
  });
});

describe('19. Confirmed mapping', () => {
  it('formatTeacherReviewLabel("confirmed") -> "Confirmed"', () => {
    expect(formatTeacherReviewLabel('confirmed')).toBe('Confirmed');
  });
});

describe('20. Dismissed -> "Not suitable" mapping', () => {
  it('formatTeacherReviewLabel("dismissed") -> "Not suitable", never "Incorrect"/"Rejected"', () => {
    expect(formatTeacherReviewLabel('dismissed')).toBe('Not suitable');
  });
});

describe('21. invalid status safe', () => {
  it('an unrecognized machine value never crashes and never renders raw', () => {
    expect(formatTeacherReviewLabel('garbage')).toBe('Not reviewed');
    expect(formatTeacherReviewLabel(42)).toBe('Not reviewed');
  });
});

describe('22. opposite-action logic', () => {
  it('confirmed -> dismissed is offered next', () => {
    expect(getOppositeValidationAction('confirmed')).toBe('dismissed');
  });
  it('dismissed -> confirmed is offered next', () => {
    expect(getOppositeValidationAction('dismissed')).toBe('confirmed');
  });
  it('never reviewed (null) -> null (both actions available, not "opposite" of anything)', () => {
    expect(getOppositeValidationAction(null)).toBeNull();
  });
});

describe('23. same action not offered', () => {
  it('the opposite action never equals the current validation', () => {
    expect(getOppositeValidationAction('confirmed')).not.toBe('confirmed');
    expect(getOppositeValidationAction('dismissed')).not.toBe('dismissed');
  });
});

// ─── 24: note length ──────────────────────────────────────────────────────

describe('24. note max 2000', () => {
  it('TEACHER_NOTE_MAX_LENGTH is exactly 2000, matching the backend bound', () => {
    expect(TEACHER_NOTE_MAX_LENGTH).toBe(2000);
  });
});

// ─── 25: new-fingerprint reset ────────────────────────────────────────────

describe('25. new fingerprint resets via current:null', () => {
  it('a state fetch for a brand-new fingerprint returns current:null even if the stream has old history', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'evaluated', current: null } });
    const result = await fetchTeacherRecommendationValidationState({ studentId: 13, caseType: 'lowercase', family: 'curved', recommendationFingerprint: 'b'.repeat(64) });
    expect(result.current).toBeNull();
  });
});

// ─── 26-28: history helpers ───────────────────────────────────────────────

describe('26. history newest-first preserved', () => {
  it('normalizeTeacherValidationHistoryResponse never reorders events', () => {
    const raw = { status: 'evaluated', events: [historyEvent({ id: 2 }), historyEvent({ id: 1 })], latestByStream: {} };
    const result = normalizeTeacherValidationHistoryResponse(raw);
    expect(result.events.map((e) => e.id)).toEqual([2, 1]);
  });
});

describe('27. history filtered by case/family', () => {
  it('filterHistoryForStream keeps only matching events, in order', () => {
    const events = [
      historyEvent({ id: 1, caseType: 'lowercase', family: 'curved' }),
      historyEvent({ id: 2, caseType: 'uppercase', family: 'straight' }),
      historyEvent({ id: 3, caseType: 'lowercase', family: 'curved' }),
    ];
    const filtered = filterHistoryForStream(events, 'lowercase', 'curved');
    expect(filtered.map((e) => e.id)).toEqual([1, 3]);
  });

  it('an empty/non-array input returns []', () => {
    expect(filterHistoryForStream(null, 'lowercase', 'curved')).toEqual([]);
    expect(filterHistoryForStream(undefined, 'lowercase', 'curved')).toEqual([]);
  });
});

describe('28. note shown in history', () => {
  it('a history event with a teacherNote preserves it through normalization', () => {
    const raw = { status: 'evaluated', events: [historyEvent({ teacherNote: 'Focus on o before c' })], latestByStream: {} };
    const result = normalizeTeacherValidationHistoryResponse(raw);
    expect(result.events[0].teacherNote).toBe('Focus on o before c');
  });
});

// ─── 29-31: privacy/severity wording discipline (this file's own surface) ─

describe('29. fingerprint never displayed (this utility never derives display text from it)', () => {
  it('formatTeacherReviewLabel/getOppositeValidationAction take no fingerprint argument at all', () => {
    expect(formatTeacherReviewLabel.length).toBeLessThanOrEqual(1);
    expect(getOppositeValidationAction.length).toBeLessThanOrEqual(1);
  });
});

describe('30. no severity wording', () => {
  it('formatTeacherReviewLabel output never contains severity/priority words', () => {
    for (const v of ['confirmed', 'dismissed', null, 'garbage']) {
      const label = formatTeacherReviewLabel(v);
      expect(label).not.toMatch(/high|medium|low|severity|priority|risk/i);
    }
  });
});

describe('formatReviewDate', () => {
  it('formats an ISO timestamp as "D Mon YYYY"', () => {
    expect(formatReviewDate('2026-08-14T00:00:00.000Z')).toBe('14 Aug 2026');
  });
  it('returns "" for a malformed/missing value, never throws', () => {
    expect(formatReviewDate('not-a-date')).toBe('');
    expect(formatReviewDate(undefined)).toBe('');
    expect(formatReviewDate(null)).toBe('');
  });
});

describe('31. no correct/incorrect wording', () => {
  it('formatTeacherReviewLabel output never says correct/incorrect/approved/rejected', () => {
    for (const v of ['confirmed', 'dismissed', null, 'garbage']) {
      const label = formatTeacherReviewLabel(v);
      expect(label).not.toMatch(/correct|incorrect|approved|rejected/i);
    }
  });
});
