import {
  SESSION_STATUS, createInitialSessionState, tick, registerActiveScreen, unregisterActiveScreen,
  startWriting, endWriting, shouldShowBreakPrompt, pauseForBreak, resumeFromBreak, finishForNow, resetSession,
} from './learningSessionTimer';

const CONFIG = { warningMs: 15 * 60 * 1000, maxMs: 20 * 60 * 1000 };

describe('createInitialSessionState', () => {
  it('starts idle, zero elapsed, no active screens, not writing', () => {
    const s = createInitialSessionState();
    expect(s.status).toBe(SESSION_STATUS.IDLE);
    expect(s.elapsedMs).toBe(0);
    expect(s.activeScreenCount).toBe(0);
    expect(s.isWriting).toBe(false);
  });
});

describe('1. timer starts entering learning flow', () => {
  it('registering an active screen transitions idle -> active', () => {
    const s = registerActiveScreen(createInitialSessionState());
    expect(s.status).toBe(SESSION_STATUS.ACTIVE);
    expect(s.activeScreenCount).toBe(1);
  });
});

describe('2. elapsed time increases while active', () => {
  it('tick() advances elapsedMs while a screen is registered', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, 5000, CONFIG);
    expect(s.elapsedMs).toBe(5000);
    s = tick(s, 3000, CONFIG);
    expect(s.elapsedMs).toBe(8000);
  });
});

describe('3. backgrounded/inactive time not counted', () => {
  it('tick() is a no-op when no screen is registered active (idle)', () => {
    const s = tick(createInitialSessionState(), 5000, CONFIG);
    expect(s.elapsedMs).toBe(0);
  });

  it('tick() is a no-op while paused (Take a Break)', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, 5000, CONFIG);
    s = pauseForBreak(s);
    s = tick(s, 999999, CONFIG);
    expect(s.elapsedMs).toBe(5000); // unchanged while paused
  });

  it('unregistering the last active screen stops further accumulation', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, 1000, CONFIG);
    s = unregisterActiveScreen(s);
    s = tick(s, 999999, CONFIG);
    expect(s.elapsedMs).toBe(1000);
    expect(s.status).toBe(SESSION_STATUS.IDLE);
  });

  it('multiple registered screens (e.g. rapid navigation) only stop counting once ALL are unregistered', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = registerActiveScreen(s); // 2 active
    s = unregisterActiveScreen(s); // 1 active
    s = tick(s, 2000, CONFIG);
    expect(s.elapsedMs).toBe(2000);
    expect(s.status).toBe(SESSION_STATUS.ACTIVE);
  });

  it('unregisterActiveScreen never goes negative on a mismatched call', () => {
    const s = unregisterActiveScreen(createInitialSessionState());
    expect(s.activeScreenCount).toBe(0);
  });
});

describe('4. warning occurs once', () => {
  it('crossing SESSION_WARNING_MINUTES sets warningReached and status=warning, exactly once', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, CONFIG.warningMs - 1000, CONFIG);
    expect(s.warningReached).toBe(false);
    expect(s.status).toBe(SESSION_STATUS.ACTIVE);

    s = tick(s, 2000, CONFIG); // crosses the warning threshold
    expect(s.warningReached).toBe(true);
    expect(s.status).toBe(SESSION_STATUS.WARNING);

    const beforeSecondCross = s.warningReached;
    s = tick(s, 1000, CONFIG); // ticking again past warning doesn't "re-trigger" anything observable
    expect(s.warningReached).toBe(beforeSecondCross);
  });

  it('warning alone (below the max) never makes the break prompt eligible', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, CONFIG.warningMs + 1000, CONFIG);
    expect(s.status).toBe(SESSION_STATUS.WARNING);
    expect(shouldShowBreakPrompt(s)).toBe(false);
  });
});

describe('5/6. break recommendation only at a safe transition — never mid-stroke', () => {
  it('reaching the max duration alone (still writing) does NOT make the prompt eligible', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = startWriting(s);
    s = tick(s, CONFIG.maxMs + 1000, CONFIG);
    expect(s.status).toBe(SESSION_STATUS.LIMIT_REACHED);
    expect(shouldShowBreakPrompt(s)).toBe(false); // still writing — current stroke not interrupted
  });

  it('becomes eligible the moment writing ends after the limit was reached', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = startWriting(s);
    s = tick(s, CONFIG.maxMs + 1000, CONFIG);
    s = endWriting(s);
    expect(shouldShowBreakPrompt(s)).toBe(true);
  });

  it('never eligible before the limit is reached, even while not writing', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, 1000, CONFIG);
    s = endWriting(s);
    expect(shouldShowBreakPrompt(s)).toBe(false);
  });
});

describe('7. Take a Break preserves elapsed progress (pauses, does not reset)', () => {
  it('pauseForBreak retains elapsedMs and the reached flags', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, CONFIG.maxMs + 500, CONFIG);
    const beforeElapsed = s.elapsedMs;
    s = pauseForBreak(s);
    expect(s.status).toBe(SESSION_STATUS.PAUSED);
    expect(s.elapsedMs).toBe(beforeElapsed);
    expect(s.limitReached).toBe(true);
  });

  it('resumeFromBreak starts a genuinely fresh window (elapsed + flags cleared)', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, CONFIG.maxMs + 500, CONFIG);
    s = pauseForBreak(s);
    s = resumeFromBreak(s);
    expect(s.elapsedMs).toBe(0);
    expect(s.warningReached).toBe(false);
    expect(s.limitReached).toBe(false);
    // The screen that was already registered is still active (its own
    // register/unregister lifecycle is untouched by resumeFromBreak), so
    // deriveStatus correctly reports 'active', not 'idle' — 'idle' only
    // applies once resumeFromBreak runs with NO screen currently registered
    // (e.g. resuming happens on re-entering a learning screen, which
    // itself calls registerActiveScreen).
    expect(s.status).toBe(SESSION_STATUS.ACTIVE);
  });

  it('resumeFromBreak with no screen currently registered reports idle (the common real case — break was taken away from any learning screen)', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, CONFIG.maxMs + 500, CONFIG);
    s = pauseForBreak(s);
    s = unregisterActiveScreen(s); // navigated away to the calm/home screen
    s = resumeFromBreak(s);
    expect(s.status).toBe(SESSION_STATUS.IDLE);
    expect(s.elapsedMs).toBe(0);
  });
});

describe('8/9. Finish for Now / resume behavior', () => {
  it('finishForNow() returns a completely fresh session state', () => {
    const fresh = finishForNow();
    expect(fresh).toEqual(createInitialSessionState());
  });

  it('resetSession() is equivalent to finishForNow() for app-restart/new-session purposes', () => {
    expect(resetSession()).toEqual(finishForNow());
  });
});

describe('18. terminology guard — no fatigue/diagnosis language anywhere in this module\'s public surface', () => {
  it('SESSION_STATUS values never use fatigue/diagnosis language', () => {
    const values = Object.values(SESSION_STATUS).join(' ').toLowerCase();
    expect(values).not.toMatch(/fatigue|diagnos|clinical/);
  });

  it('the module source itself (comments included, since they document the public contract) never claims fatigue detection', () => {
    const fs = require('fs');
    const source = fs.readFileSync(require.resolve('./learningSessionTimer.js'), 'utf8').toLowerCase();
    expect(source).not.toMatch(/fatigue detected|autistic fatigue|clinical fatigue|motor fatigue diagnosis/);
  });
});

describe('State machine never produces an impossible combination', () => {
  it('status is never "limit_reached" with elapsedMs still below maxMs', () => {
    let s = registerActiveScreen(createInitialSessionState());
    s = tick(s, CONFIG.maxMs - 1, CONFIG);
    expect(s.status).not.toBe(SESSION_STATUS.LIMIT_REACHED);
  });

  it('tick() with a non-finite or non-positive delta is a safe no-op', () => {
    let s = registerActiveScreen(createInitialSessionState());
    expect(tick(s, NaN, CONFIG).elapsedMs).toBe(0);
    expect(tick(s, -100, CONFIG).elapsedMs).toBe(0);
    expect(tick(s, 0, CONFIG).elapsedMs).toBe(0);
    expect(tick(s, Infinity, CONFIG).elapsedMs).toBe(0);
  });
});
