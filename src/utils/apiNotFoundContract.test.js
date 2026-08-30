// A 404 must reach the module that asked for it.
//
// THE BUG: api/client.js's response interceptor rejects with a PLAIN Error
// carrying `.status` — it never re-exposes axios's `.response`. Three modules
// checked `err.response.status === 404`, which is therefore always undefined,
// so every legitimate 404 fell through to their read_failed branch. On the
// device that produced:
//
//   [motorBaseline] fetch failed — treating as read_failed:
//   Request failed with status 404
//
// ...for a student who simply had not done the initial assessment yet. The
// endpoint was fine, the route was fine, the backend answered exactly as
// designed. Only the client-side detection was looking at the wrong field.
//
// A 404 that means "this does not exist yet" is a STATE, not a failure.
// `read_failed` stays reserved for genuine breakage: network down, timeout,
// 500, malformed body.

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const clientSrc = read('../api/client.js');

const MODULES = [
  ['motorBaseline.js', './motorBaseline.js'],
  ['letterMotorState.js', './letterMotorState.js'],
  ['motorClusterProfile.js', './motorClusterProfile.js'],
];

// ─── The client's actual error shape ────────────────────────────────────

describe('what api/client.js actually rejects with', () => {
  it('rejects a plain Error carrying .status, NOT an axios error with .response', () => {
    expect(clientSrc).toMatch(/const apiError = new Error\(message\);/);
    expect(clientSrc).toMatch(/apiError\.status\s+= response\.status;/);
    // It never re-attaches the axios response object...
    expect(clientSrc).not.toMatch(/apiError\.response\s*=/);
    // ...and the message is exactly what the device log showed.
    expect(clientSrc).toMatch(/`Request failed with status \$\{response\.status\}`/);
  });
});

// ─── Every module must read the field the client actually sets ──────────

describe('404 detection reads the field the client sets', () => {
  it.each(MODULES)('%s accepts err.status === 404', (_name, rel) => {
    const src = read(rel);
    expect(src).toMatch(/err\?\.status === 404/);
    // The old check may remain as a belt-and-braces fallback, but it can no
    // longer be the ONLY one.
    const onlyResponseShape = /err\?\.response\?\.status === 404/.test(src)
      && !/err\?\.status === 404/.test(src);
    expect(onlyResponseShape).toBe(false);
  });

  it.each(MODULES)('%s treats a 404 as a STATE, not a read failure', (_name, rel) => {
    const src = read(rel);
    // The 404 branch returns its own semantic status and returns before the
    // read_failed logging below it.
    const notFoundAt = src.indexOf('if (isNotFound(err))');
    const readFailedAt = src.search(/treating as read_failed/);
    expect(notFoundAt).toBeGreaterThan(-1);
    if (readFailedAt > -1) expect(notFoundAt).toBeLessThan(readFailedAt);
  });

  it.each(MODULES)('%s no longer shouts about a 404 in the log', (_name, rel) => {
    const src = read(rel);
    // Just the `if (isNotFound(err)) { ... }` block — brace-matched, so the
    // read_failed code that legitimately follows it is not in scope.
    const at = src.indexOf('if (isNotFound(err))');
    expect(at).toBeGreaterThan(-1);
    let i = src.indexOf('{', at);
    let depth = 0;
    for (;; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    const branch = src.slice(at, i + 1);
    // Calm, factual, and never the words a teacher should not see. Scanned as
    // CODE — the comment above the log explains what it deliberately is not.
    const code = branch.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/no (baseline|state|profile) recorded for this student yet/);
    expect(code).not.toMatch(/read_failed|404|error|failed/i);
  });
});

// ─── Behaviour, not just source text ────────────────────────────────────

describe('fetchMotorBaseline behaviour against the real client error shape', () => {
  const makeClientError = (status) => {
    // Exactly what api/client.js constructs.
    const e = new Error(`Request failed with status ${status}`);
    e.status = status;
    e.details = null;
    return e;
  };

  function loadWith(rejection) {
    jest.resetModules();
    jest.doMock('../api/client', () => ({
      __esModule: true,
      default: { get: jest.fn(() => Promise.reject(rejection)) },
    }));
    return require('./motorBaseline');
  }

  it('a 404 becomes baseline_not_found — the state, not a failure', async () => {
    const { fetchMotorBaseline } = loadWith(makeClientError(404));
    await expect(fetchMotorBaseline({ studentId: 10 }))
      .resolves.toEqual({ status: 'baseline_not_found', baseline: null, summary: null });
  });

  it('a 500 stays read_failed — genuine breakage is never disguised', async () => {
    const { fetchMotorBaseline } = loadWith(makeClientError(500));
    await expect(fetchMotorBaseline({ studentId: 10 }))
      .resolves.toMatchObject({ status: 'read_failed', baseline: null });
  });

  it('a network error stays read_failed', async () => {
    const { fetchMotorBaseline } = loadWith(new Error('Network error. Check your connection.'));
    await expect(fetchMotorBaseline({ studentId: 10 }))
      .resolves.toMatchObject({ status: 'read_failed', baseline: null });
  });

  it('a timeout stays read_failed', async () => {
    const { fetchMotorBaseline } = loadWith(new Error('Request timed out. Please try again.'));
    await expect(fetchMotorBaseline({ studentId: 10 }))
      .resolves.toMatchObject({ status: 'read_failed', baseline: null });
  });

  it('SENTINEL — the old check alone would NOT have caught this', async () => {
    // Proof the fix is load-bearing: the client's error has no `.response`,
    // so the pre-fix condition is false for a real 404.
    const err = makeClientError(404);
    expect(err?.response?.status === 404).toBe(false);  // the old check
    expect(err?.status === 404).toBe(true);             // the new one
  });
});

// ─── The route contract is correct and unchanged ────────────────────────

describe('the route was never the problem', () => {
  it('the frontend path matches the backend route exactly', () => {
    const endpoints = read('../constants/api.js');
    expect(endpoints).toMatch(
      /MOTOR_BASELINE:\s+\(studentId\) => `\/handwriting\/motor-baseline\/\$\{studentId\}`/);
    const routes = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/routes/handwriting.js'), 'utf8');
    expect(routes).toMatch(/router\.get\('\/motor-baseline\/:studentId'/);
  });

  it('the backend distinguishes "no baseline" from a real failure', () => {
    const controller = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/controllers/handwritingController.js'), 'utf8');
    // 404 with an explicit semantic body, never a bare 404.
    expect(controller).toMatch(
      /return res\.status\(404\)\.json\(\{ status: 'baseline_not_found', baseline: null \}\)/);
  });
});

// ─── A missing baseline must not touch practice ─────────────────────────

describe('a missing baseline changes nothing about practice', () => {
  it('no practice screen reads the baseline at all', () => {
    for (const rel of ['../screens/teacher/handwriting/LetterWritingScreen.js',
      '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js',
      '../screens/teacher/handwriting/LetterPracticeScreen.js']) {
      const src = read(rel);
      expect(src).not.toMatch(/fetchMotorBaseline|MOTOR_BASELINE/);
    }
  });

  it('the only consumer is the teacher report card, which has its own branch', () => {
    const report = read('../screens/teacher/handwriting/reports/TeacherReportScreen.js');
    expect(report).toMatch(/fetchMotorBaseline/);
    // "not done yet" and "temporarily unavailable" are different messages,
    // which is the whole point of separating the two statuses.
    expect(report).toMatch(/status === 'baseline_not_found' \? \(/);
    expect(report).toMatch(/Complete the initial motor assessment to see the baseline summary/);
    expect(report).toMatch(/Initial motor baseline is temporarily unavailable/);
  });

  it('the teacher never sees 404, read_failed or database wording', () => {
    const report = read('../screens/teacher/handwriting/reports/TeacherReportScreen.js');
    const visible = (report.match(/message="[^"]+"/g) ?? []).join(' ');
    expect(visible).not.toMatch(/404|read_failed|null|database|query|baseline_not_found/i);
  });
});
