// Letter Details shows the child's own writing, or says honestly why it cannot.
//
// The panel said "No writing evidence available yet" for every letter,
// mastered ones included. The strokes were never missing — LetterAttempt has
// held them all along — but the report's payload excludes trajectories, and
// nothing recorded WHICH attempt established mastery. So the panel had neither
// the drawing nor a defensible way to pick one.

jest.mock('../api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

import fs from 'fs';
import path from 'path';

import client from '../api/client';
import {
  EVIDENCE_STATUS,
  caseTypeForLetter,
  fetchLetterMasteryEvidence,
  evidenceUnavailableMessage,
  evidenceCaption,
} from './letterMasteryEvidence';
import { computeShapePreviewPaths } from './shapePreviewGeometry';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const REPORT = '../screens/handwriting/reports/TeacherReportScreen.js';

const STROKES = [{ stroke_id: 0, points: [{ x: 10, y: 10 }, { x: 40, y: 60 }, { x: 70, y: 20 }] }];
const EVIDENCE = {
  letter: 's', case_type: 'lowercase', attempt_id: 77,
  attempt_number: 3, mastery_attempt_number: 3, score: 91,
  stroke_points: STROKES,
};

beforeEach(() => jest.clearAllMocks());

// ─── §8 case safety ─────────────────────────────────────────────────────

describe('§8 — lowercase s never shows uppercase S', () => {
  it('the case comes from the letter itself', () => {
    expect(caseTypeForLetter('s')).toBe('lowercase');
    expect(caseTypeForLetter('S')).toBe('uppercase');
    expect(caseTypeForLetter('a')).toBe('lowercase');
    expect(caseTypeForLetter('Z')).toBe('uppercase');
  });

  it('anything that is not a letter has no case', () => {
    for (const bad of ['', ' ', 'ss', '4', '-', null, undefined, 7, {}]) {
      expect(caseTypeForLetter(bad)).toBeNull();
    }
  });

  it('the request carries the case, and the two differ', async () => {
    client.get.mockResolvedValue({ data: { status: 'available', evidence: EVIDENCE } });
    await fetchLetterMasteryEvidence(51, 's');
    expect(client.get).toHaveBeenCalledWith('/handwriting/letter-mastery-evidence/51/s/lowercase');

    client.get.mockClear();
    await fetchLetterMasteryEvidence(51, 'S');
    expect(client.get).toHaveBeenCalledWith('/handwriting/letter-mastery-evidence/51/S/uppercase');
  });

  it('a letterless request never reaches the network', async () => {
    for (const args of [[51, ''], [51, '4'], [51, null], [0, 's'], [-1, 's'], ['x', 's']]) {
      const result = await fetchLetterMasteryEvidence(...args);
      expect(result.status).toBe(EVIDENCE_STATUS.NOT_MASTERED);
    }
    expect(client.get).not.toHaveBeenCalled();
  });
});

// ─── §10 what comes back ────────────────────────────────────────────────

describe('§10 — provable evidence, and honest negatives', () => {
  it('available evidence carries the strokes through', async () => {
    client.get.mockResolvedValue({ data: { status: 'available', evidence: EVIDENCE } });
    const result = await fetchLetterMasteryEvidence(51, 's');
    expect(result.status).toBe(EVIDENCE_STATUS.AVAILABLE);
    expect(result.evidence.stroke_points).toBe(STROKES);
  });

  it('every negative status drops the payload rather than half-rendering it', async () => {
    for (const status of ['not_mastered', 'unlinked', 'attempt_missing', 'no_strokes']) {
      client.get.mockResolvedValue({ data: { status, evidence: EVIDENCE } });
      const result = await fetchLetterMasteryEvidence(51, 's');
      expect(result.status).toBe(status);
      expect(result.evidence).toBeNull();
    }
  });

  it('a failed request is a read failure, not a crash and not a blank', async () => {
    client.get.mockRejectedValue(new Error('offline'));
    const result = await fetchLetterMasteryEvidence(51, 's');
    expect(result.status).toBe(EVIDENCE_STATUS.READ_FAILED);
    expect(result.evidence).toBeNull();
  });

  it('a malformed body is treated as a failed read', async () => {
    for (const data of [null, {}, { status: 'available' }, { evidence: EVIDENCE }]) {
      client.get.mockResolvedValue({ data });
      const result = await fetchLetterMasteryEvidence(51, 's');
      expect(result.status).toBe(EVIDENCE_STATUS.READ_FAILED);
    }
  });

  it('§4 an earlier record says exactly that', () => {
    expect(evidenceUnavailableMessage(EVIDENCE_STATUS.UNLINKED))
      .toBe('Mastery writing evidence unavailable for this earlier record.');
    expect(evidenceUnavailableMessage(EVIDENCE_STATUS.NOT_MASTERED))
      .toBe('No writing evidence available yet.');
    expect(evidenceUnavailableMessage(EVIDENCE_STATUS.NO_STROKES))
      .toBe('The mastery attempt for this letter has no saved writing.');
    expect(evidenceUnavailableMessage(EVIDENCE_STATUS.READ_FAILED)).toMatch(/Check the connection/);
    // Nothing here ever claims a drawing exists that is not shown.
    for (const status of Object.values(EVIDENCE_STATUS)) {
      expect(evidenceUnavailableMessage(status)).not.toMatch(/hidden|withheld|failed to master/i);
    }
  });
});

// ─── §7 the label ───────────────────────────────────────────────────────

describe('§7 — the caption', () => {
  it('names the mastery attempt and its score', () => {
    expect(evidenceCaption(EVIDENCE)).toBe('Mastery attempt · Attempt 3  ·  Score 91%');
  });

  it('reports the stored attempt number, not the policy constant', () => {
    expect(evidenceCaption({ ...EVIDENCE, attempt_number: 2 })).toMatch(/Attempt 2/);
  });

  it('omits a score it does not have, rather than printing a blank one', () => {
    for (const missing of [null, undefined, 'x', NaN]) {
      expect(evidenceCaption({ ...EVIDENCE, score: missing })).toBe('Mastery attempt · Attempt 3');
    }
    // A real zero is a number, and still prints.
    expect(evidenceCaption({ ...EVIDENCE, score: 0 })).toMatch(/Score 0%/);
    expect(evidenceCaption({ attempt_number: 3 })).toBe('Mastery attempt · Attempt 3');
    expect(evidenceCaption(null)).toBe('');
  });

  it('§7 never prints a cycle, because none is persisted', () => {
    const code = readCode('./letterMasteryEvidence.js');
    expect(code).not.toMatch(/[Cc]ycle/);
    expect(evidenceCaption(EVIDENCE)).not.toMatch(/[Cc]ycle/);
  });
});

// ─── §6 rendering ───────────────────────────────────────────────────────

describe('§6 — the drawing is the stored trajectory', () => {
  it('the stored shape renders through the existing preview helper', () => {
    const paths = computeShapePreviewPaths(STROKES, 132, 132, 10);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].length).toBeGreaterThanOrEqual(2);
    // Fitted inside the box, aspect preserved by the shared helper.
    for (const point of paths.flat()) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(132);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(132);
    }
  });

  it('empty or malformed strokes produce no paths, so nothing is drawn', () => {
    for (const bad of [null, undefined, [], [{ points: [] }], 'nope']) {
      expect(computeShapePreviewPaths(bad, 132, 132, 10)).toEqual([]);
    }
  });

  it('the panel draws polylines from the fetched strokes only', () => {
    const code = readCode(REPORT);
    expect(code).toMatch(/computeShapePreviewPaths\(\s*result\.evidence\?\.stroke_points, MASTERY_PREVIEW_SIZE, MASTERY_PREVIEW_SIZE, 10\)/);
    expect(code).toMatch(/const MASTERY_PREVIEW_SIZE = 132;/);
    const at = code.indexOf('function MasteryWritingPreview');
    const body = code.slice(at, code.indexOf('function LetterDetailSheet', at));
    expect(body).toMatch(/<Polyline/);
    // §9 no canonical path, no reference glyph, no generated example.
    expect(body).not.toMatch(/LETTER_PATHS|referencePath|canonical|guide|template/i);
    // §6 read-only: no replay, no editing, no scoring.
    expect(body).not.toMatch(/Animated|replay|onPress|PanResponder|score\s*[<>=]/i);
  });

  it('it says nothing while the read is still in flight', () => {
    const code = readCode(REPORT);
    expect(code).toMatch(/if \(result == null\) \{/);
    expect(code).toMatch(/Loading writing evidence/);
  });
});

// ─── §5 targeted fetch ──────────────────────────────────────────────────

describe('§5 — fetched only when the panel opens', () => {
  const code = readCode(REPORT);

  it('the fetch is inside the detail sheet, keyed on the letter', () => {
    expect(code).toMatch(/fetchLetterMasteryEvidence\(studentId, letter\.letter\)/);
    expect(code).toMatch(/\}, \[letter\?\.letter, letter\?\.status, studentId\]\);/);
  });

  it('a letter that is not mastered is never fetched', () => {
    const at = code.indexOf('function LetterDetailSheet');
    const effect = code.slice(at, code.indexOf('}, [letter?.letter', at));
    expect(effect).toMatch(/if \(letter\?\.status !== 'Mastered'\)/);
    expect(effect.indexOf("!== 'Mastered'"))
      .toBeLessThan(effect.indexOf('fetchLetterMasteryEvidence'));
  });

  it('the stale-response guard is in place', () => {
    const at = code.indexOf('function LetterDetailSheet');
    const effect = code.slice(at, code.indexOf('}, [letter?.letter', at));
    expect(effect).toMatch(/let active = true;/);
    expect(effect).toMatch(/if \(active\) setEvidence\(result\)/);
    expect(effect).toMatch(/return \(\) => \{ active = false; \};/);
  });

  it('the endpoint is scoped to one student, letter and case', () => {
    expect(readCode('../constants/api.js'))
      .toMatch(/LETTER_MASTERY_EVIDENCE:\s*\(studentId, letter, caseType\) =>/);
  });
});

// ─── §11 regression ─────────────────────────────────────────────────────

describe('§11 — nothing else moved', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('mastery policy, scoring and DTW are unchanged', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('stroke storage, canvas and touch mapping are unchanged', () => {
    expect(b('src/models/LetterAttempt.js')).toMatch(/stroke_points: \{\s*type:\s*DataTypes\.JSONB/);
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
  });

  it('the report’s own letter calculations are unchanged', () => {
    expect(readCode('./reportEngine.js'))
      .toMatch(/status: accuracy >= 80 \? 'Mastered' : accuracy >= 60 \? 'Progressing' : 'Needs Practice'/);
    const code = readCode(REPORT);
    expect(code).toMatch(/<DetailRow label="Status" value=\{letter\.status\} \/>/);
    expect(code).toMatch(/label="Practice attempts"/);
  });

  it('the shape preview it borrows from still works the same', () => {
    expect(readCode(REPORT)).toMatch(/const SHAPE_PREVIEW_SIZE = 44;/);
    expect(readCode('./shapePreviewGeometry.js')).toMatch(/export function normalizeStoredShapeTrajectory/);
  });
});
