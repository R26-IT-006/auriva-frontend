import fs from 'fs';
import path from 'path';

/**
 * Proposal FR-16, Phase 7B — screen/context/component-level wiring proof.
 * These files import 'react-native' and can't be mounted under this repo's
 * plain-node jest config; verified by source-text assertion, the same
 * established technique used for learningSessionWiring.test.js (Phase 7A).
 * Pure-logic behavior (patch shapes, staleness, display normalization) has
 * full behavioral coverage in liveSessionSnapshot.test.js — this file
 * proves the screens/context/UI are correctly WIRED to it.
 */

function read(relPath) {
  return fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');
}
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const contextSource = read('../context/LearningSessionContext.js');
const cardSource    = read('../components/teacher/LiveSessionCard.js');
const apiSource     = read('../api/liveSession.js');
const policySource  = read('../constants/liveSessionPolicy.js');

const LEARNING_SCREENS = [
  { path: '../screens/handwriting/LetterWritingScreen.js',               activityType: 'LOWERCASE_LETTER' },
  { path: '../screens/handwriting/uppercase/UppercaseWritingScreen.js',  activityType: 'UPPERCASE_LETTER' },
  { path: '../screens/handwriting/words/WordWritingScreen.js',           activityType: 'WORD_WRITING' },
  { path: '../screens/handwriting/PreWritingActivityScreen.js',          activityType: 'PREWRITING' },
  { path: '../screens/handwriting/words/WordActivityScreen.js',          activityType: 'WORD_ACTIVITY' },
];

// ─── 11/12. entering lowercase/uppercase/word writing sets correct activity ─
describe('Each learning screen supplies its own studentId + activityType (spec §17)', () => {
  it.each(LEARNING_SCREENS)('$path passes studentId and LIVE_ACTIVITY_TYPES.$activityType into useLearningSessionActivity', ({ path: p, activityType }) => {
    const source = read(p);
    expect(source).toContain('studentId: student.sid');
    expect(source).toContain(`LIVE_ACTIVITY_TYPES.${activityType}`);
  });
});

// ─── 10/child-flow-continues. no raw stroke coordinates in any push ────────
describe('No raw stroke coordinates are ever sent to the live-session endpoint (spec §3/§4)', () => {
  it.each(LEARNING_SCREENS)('$path never passes a strokes/points/x-y array into notifyLiveSessionUpdate', ({ path: p }) => {
    const source = read(p);
    const calls = source.match(/notifyLiveSessionUpdate\([^;]*?\);/gs) || [];
    for (const call of calls) {
      expect(call).not.toMatch(/allPaths|strokes|currentPath|\.x\b|\.y\b/);
    }
  });

  it('api/liveSession.js never imports anything stroke/canvas-related', () => {
    expect(apiSource).not.toMatch(/stroke|canvas|dtw/i);
  });
});

// ─── 15/16/attempt/support updates reflected — one bundled event ──────────
describe('Attempt/support/case updates are bundled into one meaningful-event push', () => {
  it('LetterWritingScreen and UppercaseWritingScreen push current_item + case_type + attempt_number + support_level together', () => {
    for (const p of ['../screens/handwriting/LetterWritingScreen.js', '../screens/handwriting/uppercase/UppercaseWritingScreen.js']) {
      const source = read(p);
      expect(source).toMatch(/buildProgressPatch\(\{\s*\n?\s*currentItem: letter, caseType, attemptNumber: attempt, supportLevel,?\s*\n?\s*\}\)/);
    }
  });

  it('LetterWritingScreen and UppercaseWritingScreen push a saved score after a successful LETTER_COMPLETE save', () => {
    for (const p of ['../screens/handwriting/LetterWritingScreen.js', '../screens/handwriting/uppercase/UppercaseWritingScreen.js']) {
      const source = read(p);
      expect(source).toContain('notifyLiveSessionUpdate(buildScorePatch(Math.max(...attemptScoresRef.current)))');
    }
  });
});

// ─── 7/9. current snapshot / no unbounded rows / structural upsert proof ──
// (Backend-level; covered by liveSessionAuthorization.test.js in
// auriva-backend. Nothing to source-scan on the frontend for this item.)

// ─── 9. child flow continues when live-monitor update fails (spec §10) ────
describe('pushLiveSessionSnapshot never throws — child flow isolation (spec §10)', () => {
  it('api/liveSession.js wraps its PUT in try/catch and always resolves (never rejects)', () => {
    const fn = apiSource.slice(apiSource.indexOf('export async function pushLiveSessionSnapshot'));
    expect(fn).toContain('try {');
    expect(fn).toContain('catch (err)');
    expect(fn).toContain('return false;');
  });

  it('every screen push call site is a bare (non-awaited-for-gating) call — notifyLiveSessionUpdate is fire-and-forget from the caller\'s perspective', () => {
    for (const { path: p } of LEARNING_SCREENS) {
      const source = read(p);
      // Never "await notifyLiveSessionUpdate(...)" — it must never block or gate anything.
      expect(source).not.toMatch(/await\s+notifyLiveSessionUpdate/);
    }
  });
});

// ─── 11/16/17. Timer integration + break/resume/finish state mapping ──────
describe('LearningSessionContext reuses the SAME Phase 7A state machine — no second timer (spec §9)', () => {
  it('only one setInterval is created in the whole file (the existing Phase 7A tick interval); the FR-16 heartbeat piggybacks on it', () => {
    const count = (contextSource.match(/setInterval\(/g) || []).length;
    expect(count).toBe(1);
  });

  it('heartbeat push is gated on status === "active" and throttled by LIVE_SESSION_HEARTBEAT_MS, not a raw per-tick push', () => {
    expect(contextSource).toContain('LIVE_SESSION_HEARTBEAT_MS');
    expect(contextSource).toMatch(/stateRef\.current\.status === 'active'/);
  });

  it('takeBreak pushes buildBreakPatch (status=break)', () => {
    const block = contextSource.slice(contextSource.indexOf('const takeBreak ='), contextSource.indexOf('const resumeAfterBreak ='));
    expect(block).toContain('buildBreakPatch()');
  });

  it('resumeAfterBreak pushes buildResumePatch (status=active)', () => {
    const block = contextSource.slice(contextSource.indexOf('const resumeAfterBreak ='), contextSource.indexOf('const finishForNowAction ='));
    expect(block).toContain('buildResumePatch(activityTypeRef.current)');
  });

  it('finishForNowAction pushes buildEndedPatch (status=ended) and clears the live-session identity', () => {
    const block = contextSource.slice(contextSource.indexOf('const finishForNowAction ='), contextSource.indexOf('const value ='));
    expect(block).toContain('buildEndedPatch()');
    expect(block).toContain('studentIdRef.current = null');
  });

  it('the Provider pushes a final buildEndedPatch on its own unmount (natural navigation-out, spec §18)', () => {
    const cleanupEffect = contextSource.slice(
      contextSource.indexOf('// FR-16 spec §18'),
      contextSource.indexOf('const registerActive ')
    );
    expect(cleanupEffect).toContain('buildEndedPatch()');
    expect(cleanupEffect).toContain('return () => {');
  });
});

// ─── 20/21. LiveSessionCard polling — starts/stops correctly, no duplicates ─
describe('LiveSessionCard polling lifecycle (spec §15)', () => {
  it('uses useFocusEffect, not a bare useEffect, so polling is focus-gated', () => {
    expect(cardSource).toContain('useFocusEffect(');
  });

  it('clears any existing interval before starting a new one — duplicate intervals are structurally prevented', () => {
    const block = cardSource.slice(cardSource.indexOf('useFocusEffect'), cardSource.indexOf('if (snapshot === undefined)'));
    expect(block).toMatch(/if \(intervalRef\.current\) clearInterval\(intervalRef\.current\);/);
    expect(block).toContain('intervalRef.current = setInterval(poll, LIVE_SESSION_POLL_MS)');
  });

  it('the focus-effect cleanup clears the interval (stops polling on blur/unmount)', () => {
    const block = cardSource.slice(cardSource.indexOf('useFocusEffect'), cardSource.indexOf('if (snapshot === undefined)'));
    expect(block).toMatch(/return \(\) => \{[\s\S]*clearInterval\(intervalRef\.current\)/);
  });

  it('polling interval comes from the centralized policy constant, never a magic number', () => {
    expect(cardSource).not.toMatch(/setInterval\(poll,\s*\d/);
    expect(cardSource).toContain("from '../../constants/liveSessionPolicy'");
  });
});

// ─── 14. Neutral teacher UI — no raw JSON, no model terminology ───────────
describe('LiveSessionCard renders neutral labels only (spec §14)', () => {
  const cardCodeOnly = stripComments(cardSource);

  it('never renders JSON.stringify or a raw model-internal term', () => {
    expect(cardCodeOnly).not.toMatch(/JSON\.stringify|centroid|cluster|dtw/i);
  });

  it('connection state uses the same 3-way vocabulary (live/stale/not_active) driven by describeLiveSession, not a re-derived threshold', () => {
    expect(cardSource).toContain('describeLiveSession');
    expect(cardSource).not.toMatch(/Date\.now\(\)\s*-/); // never re-derives staleness from a raw timestamp itself
  });
});

// ─── 19/22. Collection-mode exclusion carried over from Phase 7A ──────────
describe('collection_mode exclusion applies identically to FR-16 (spec §19)', () => {
  it('the two case-type screens suspend BOTH FR-13 and FR-16 together via the same suspend flag — no separate FR-16-only bypass exists', () => {
    for (const p of ['../screens/handwriting/LetterWritingScreen.js', '../screens/handwriting/uppercase/UppercaseWritingScreen.js']) {
      const source = read(p);
      expect(source).toMatch(/useLearningSessionActivity\(\{\s*\n?\s*suspend: collectionMode,/);
    }
  });

  it('the progress-patch effect in both case-type screens also skips when collectionMode is true', () => {
    for (const p of ['../screens/handwriting/LetterWritingScreen.js', '../screens/handwriting/uppercase/UppercaseWritingScreen.js']) {
      const source = read(p);
      const idx = source.indexOf('notifyLiveSessionUpdate(buildProgressPatch');
      const before = source.slice(Math.max(0, idx - 200), idx);
      expect(before).toMatch(/if \(collectionMode\) return;/);
    }
  });
});

// ─── 24. Features 1–11 unchanged — no source in this feature touches them ──
describe('Zero footprint in Feature 1–11 decision logic (spec — "DO NOT modify")', () => {
  it('LearningSessionContext.js / LiveSessionCard.js / liveSessionSnapshot.js never reference mastery/threshold/clustering internals', () => {
    for (const source of [contextSource, cardSource, stripComments(read('./liveSessionSnapshot.js'))]) {
      expect(source).not.toMatch(/motor_cluster|personal_thresholds|LetterMotorMasteryEvidence|computeMotorScore|clustering/i);
    }
  });
});
