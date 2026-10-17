// The API client must never automatically replay a non-idempotent request.
//
// A network error means "no HTTP response arrived", which is NOT the same as
// "the server never processed the request". The interceptor used to replay ANY
// failed request up to three times with no method check, so a POST whose
// response was merely lost got applied again.
//
// For POST /handwriting/letter-complete that produced a second complete
// practice cycle: the backend mints a fresh session_key per call, there is no
// idempotency key, and letter_attempts has no unique constraint on
// (session_key, attempt_number). The duplicate consumed one of the child's
// three daily cycles for a performance they gave once, and appeared in the
// research export as two independent cycles.
//
// Source-scan rather than a mounted-client test, matching this repo's
// convention: client.js imports the auth store and SecureStore, which the
// plain-node jest config here cannot mount.

import fs from 'fs';
import path from 'path';

const CLIENT = path.resolve(__dirname, '../api/client.js');

function read() { return fs.readFileSync(CLIENT, 'utf8'); }
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('automatic retries are restricted to idempotent methods', () => {
  const code = stripComments(read());

  it('declares an explicit allow-list of retryable methods', () => {
    expect(code).toMatch(/const RETRYABLE_METHODS = new Set\(\['get', 'head'\]\)/);
  });

  it('never lists a state-changing method as retryable', () => {
    const listMatch = code.match(/const RETRYABLE_METHODS = new Set\(\[([^\]]*)\]\)/);
    expect(listMatch).not.toBeNull();
    const listed = listMatch[1];
    for (const unsafe of ['post', 'patch', 'put', 'delete']) {
      expect(listed).not.toContain(unsafe);
    }
  });

  it('gates the retry branch on the method, not only on the absence of a response', () => {
    const branch = code.slice(code.indexOf('if (!response'), code.indexOf('if (response)'));
    expect(branch).toMatch(/isRetryableMethod\(config\)/);
    // The replay itself still lives behind that same guard.
    expect(branch).toMatch(/config\._retryCount/);
    expect(branch).toMatch(/return client\(config\)/);
  });

  it('treats a missing or non-string method as NOT retryable (fails closed)', () => {
    const fn = code.slice(code.indexOf('function isRetryableMethod'));
    expect(fn.slice(0, 320)).toMatch(/typeof config\?\.method === 'string'/);
    expect(fn.slice(0, 320)).toMatch(/method != null && RETRYABLE_METHODS\.has\(method\)/);
  });

  it('still surfaces a network error to the caller, with the message unchanged', () => {
    // A non-retryable failure must reject with the SAME message the retry path
    // produced after exhausting itself, so no caller's error handling changes
    // shape — it simply happens immediately instead of ~2.1s later.
    const occurrences = code.match(/Network error\. Check your connection\./g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves timeout handling intact', () => {
    expect(code).toMatch(/error\.code !== 'ECONNABORTED'/);
    expect(code).toMatch(/Request timed out\. Please try again\./);
  });

  it('leaves the 401 logout path intact', () => {
    expect(code).toMatch(/response\.status === 401/);
    expect(code).toMatch(/useAuthStore\.getState\(\)\.logout\(\)/);
  });
});

describe('the retry policy is enforced in one place only', () => {
  const code = stripComments(read());

  it('there is exactly one replay call site', () => {
    expect((code.match(/return client\(config\)/g) ?? []).length).toBe(1);
  });

  it('no screen or util adds its own replay loop for a handwriting POST', () => {
    // The completion POST's failure path must HOLD for a human-initiated retry
    // (see LetterWritingScreen/UppercaseWritingScreen's catch), never loop by
    // itself — an automatic loop would reintroduce exactly the duplicate this
    // policy exists to prevent.
    for (const rel of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
    ]) {
      const screen = stripComments(fs.readFileSync(path.resolve(__dirname, rel), 'utf8'));
      expect(screen).not.toMatch(/_retryCount/);
      expect(screen).not.toMatch(/while\s*\([^)]*\)\s*\{[\s\S]{0,200}LETTER_COMPLETE/);
    }
  });
});
