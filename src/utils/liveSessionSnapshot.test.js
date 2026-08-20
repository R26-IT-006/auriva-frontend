import {
  buildActivityEnteredPatch, buildProgressPatch, buildScorePatch, buildHeartbeatPatch,
  buildBreakPatch, buildResumePatch, buildEndedPatch,
  formatElapsed, describeLiveSession,
} from './liveSessionSnapshot';

// Proposal FR-16, Phase 7B — pure logic tests for the shared child-side
// patch builders + teacher-side display normalizer. Real function calls
// throughout (no mocking needed — this module is framework-free).

describe('patch builders — spec §8 meaningful events', () => {
  it('buildActivityEnteredPatch carries activity_type + status=active', () => {
    expect(buildActivityEnteredPatch('prewriting')).toEqual({ activity_type: 'prewriting', status: 'active' });
  });

  it('buildProgressPatch only includes fields actually supplied — never an unrelated field with an implicit value', () => {
    expect(buildProgressPatch({ currentItem: 'a', attemptNumber: 2 })).toEqual({ current_item: 'a', attempt_number: 2 });
    expect(buildProgressPatch({ currentItem: 'cat' })).toEqual({ current_item: 'cat' });
    expect(buildProgressPatch({})).toEqual({});
  });

  it('buildProgressPatch carries case_type and support_level when present', () => {
    expect(buildProgressPatch({ currentItem: 'b', caseType: 'lowercase', attemptNumber: 1, supportLevel: 'high' }))
      .toEqual({ current_item: 'b', case_type: 'lowercase', attempt_number: 1, support_level: 'high' });
  });

  it('buildScorePatch carries only latest_saved_score — never raw strokes/points', () => {
    const patch = buildScorePatch(87);
    expect(patch).toEqual({ latest_saved_score: 87 });
    expect(Object.keys(patch)).toEqual(['latest_saved_score']);
  });

  it('buildHeartbeatPatch carries only elapsed_active_seconds', () => {
    expect(buildHeartbeatPatch(42)).toEqual({ elapsed_active_seconds: 42 });
  });

  it('buildBreakPatch / buildResumePatch / buildEndedPatch map to the exact spec §18 status transitions', () => {
    expect(buildBreakPatch()).toEqual({ status: 'break', activity_type: 'break' });
    expect(buildResumePatch('lowercase_letter')).toEqual({ status: 'active', activity_type: 'lowercase_letter' });
    expect(buildResumePatch(null)).toEqual({ status: 'active', activity_type: 'idle' }); // safe fallback, never undefined
    expect(buildEndedPatch()).toEqual({ status: 'ended', activity_type: 'completed' });
  });
});

describe('formatElapsed', () => {
  it('formats under a minute as 0:SS', () => {
    expect(formatElapsed(5)).toBe('0:05');
  });
  it('formats minutes:seconds under an hour', () => {
    expect(formatElapsed(125)).toBe('2:05');
  });
  it('formats an hour+ as Hh MMm', () => {
    expect(formatElapsed(3725)).toBe('1h 02m');
  });
  it('never goes negative for bad input', () => {
    expect(formatElapsed(-10)).toBe('0:00');
    expect(formatElapsed(NaN)).toBe('0:00');
    expect(formatElapsed(undefined)).toBe('0:00');
  });
});

describe('describeLiveSession — teacher-facing normalization (spec §13/§14)', () => {
  it('null/undefined/malformed input is NOT ACTIVE, never a crash', () => {
    expect(describeLiveSession(null)).toEqual({ active: false, connection: 'not_active', connectionLabel: 'Not Active' });
    expect(describeLiveSession(undefined)).toEqual({ active: false, connection: 'not_active', connectionLabel: 'Not Active' });
    expect(describeLiveSession('garbage')).toEqual({ active: false, connection: 'not_active', connectionLabel: 'Not Active' });
  });

  it('{status: "not_active"} (no row exists yet) is NOT ACTIVE', () => {
    expect(describeLiveSession({ status: 'not_active' }).active).toBe(false);
  });

  it('an ended row (connection_status computed server-side as not_active) is NOT ACTIVE even with other fields present', () => {
    const raw = { status: 'ended', connection_status: 'not_active', activity_type: 'completed', elapsed_active_seconds: 600 };
    expect(describeLiveSession(raw).active).toBe(false);
  });

  it('a live, active row produces neutral, teacher-facing labels — never raw enum strings or JSON', () => {
    const raw = {
      student_id: 10, activity_type: 'lowercase_letter', status: 'active',
      current_item: 'a', case_type: 'lowercase', attempt_number: 2, support_level: 'medium',
      elapsed_active_seconds: 95, latest_saved_score: 82.6,
      started_at: '2026-08-20T10:00:00.000Z', last_updated_at: '2026-08-20T10:01:30.000Z',
      connection_status: 'live',
    };
    const display = describeLiveSession(raw);
    expect(display).toEqual({
      active: true,
      connection: 'live',
      connectionLabel: 'Live',
      activityLabel: 'Lowercase Letters',
      statusLabel: 'Active',
      currentItem: 'a',
      caseType: 'lowercase',
      attemptNumber: 2,
      supportLevel: 'medium',
      elapsedSeconds: 95,
      elapsedLabel: '1:35',
      latestScore: 83, // rounded, never a raw float
      startedAt: '2026-08-20T10:00:00.000Z',
      lastUpdatedAt: '2026-08-20T10:01:30.000Z',
    });
  });

  it('a stale row is surfaced as "Connection Interrupted", not silently treated as live', () => {
    const raw = { status: 'active', activity_type: 'word_writing', elapsed_active_seconds: 40, connection_status: 'stale' };
    expect(describeLiveSession(raw).connectionLabel).toBe('Connection Interrupted');
  });

  it('an unrecognized activity_type/status never crashes — falls back to a neutral label', () => {
    const raw = { status: 'weird', activity_type: 'unknown_thing', connection_status: 'live', elapsed_active_seconds: 0 };
    const display = describeLiveSession(raw);
    expect(display.activityLabel).toBe('Learning');
    expect(display.statusLabel).toBe('Active'); // safe default, never crashes on an unrecognized status
  });

  it('never surfaces a raw stroke/point field even if one were present on the input (privacy guard)', () => {
    const raw = {
      status: 'active', activity_type: 'lowercase_letter', connection_status: 'live',
      elapsed_active_seconds: 5, strokes: [[{ x: 1, y: 2 }]], raw_points: [1, 2, 3],
    };
    const display = describeLiveSession(raw);
    expect(display.strokes).toBeUndefined();
    expect(display.raw_points).toBeUndefined();
    expect(JSON.stringify(display)).not.toMatch(/strokes|raw_points/);
  });
});
