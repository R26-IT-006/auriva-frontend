'use strict';

// Feature 6 Step 3 — TESTS: PERSISTENCE SEMANTICS (spec item 48).
// resolveActualDemoSpeedLevel is pure: no mocks needed.

import { resolveActualDemoSpeedLevel } from './demoSpeedPersistence';
import { SUPPORT_LEVELS } from '../constants/handwritingSupportLevels';

describe('resolveActualDemoSpeedLevel — HIGH support, tracer shown, no reduce-motion', () => {
  it('slow recommendation at HIGH support with the tracer actually shown -> slow', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: false,
    })).toBe('slow');
  });

  it('standard recommendation at HIGH support with the tracer actually shown -> standard', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'standard',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: false,
    })).toBe('standard');
  });
});

describe('resolveActualDemoSpeedLevel — MEDIUM/LOW support: no tracer exists there', () => {
  it('slow recommendation at MEDIUM support -> null (no tracer at MEDIUM)', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow',
      supportLevel: SUPPORT_LEVELS.MEDIUM,
      showAnimatedTracer: false,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });

  it('slow recommendation at LOW support -> null (no tracer at LOW)', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow',
      supportLevel: SUPPORT_LEVELS.LOW,
      showAnimatedTracer: false,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });

  it('standard recommendation at MEDIUM support -> null', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'standard',
      supportLevel: SUPPORT_LEVELS.MEDIUM,
      showAnimatedTracer: false,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });

  it('standard recommendation at LOW support -> null', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'standard',
      supportLevel: SUPPORT_LEVELS.LOW,
      showAnimatedTracer: false,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });
});

describe('resolveActualDemoSpeedLevel — reduce-motion always wins', () => {
  it('HIGH support + reduceMotion true -> null, even with a slow recommendation and showAnimatedTracer true', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: true,
      collectionMode: false,
    })).toBeNull();
  });

  it('HIGH support + reduceMotion true -> null, standard recommendation too', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'standard',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: true,
      collectionMode: false,
    })).toBeNull();
  });
});

describe('resolveActualDemoSpeedLevel — defensive showAnimatedTracer check', () => {
  it('HIGH support but showAnimatedTracer explicitly false -> null (tracer not actually rendered)', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: false,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });
});

describe('resolveActualDemoSpeedLevel — collection mode always null', () => {
  it('collection mode at HIGH support with the tracer shown and a slow recommendation -> null', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: true,
    })).toBeNull();
  });

  it('collection mode overrides even a fully qualifying standard case -> null', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'standard',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: true,
    })).toBeNull();
  });
});

describe('resolveActualDemoSpeedLevel — invalid/missing input', () => {
  it('an invalid recommendedSpeedLevel -> null, never guessed', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'turbo',
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });

  it('a missing recommendedSpeedLevel -> null', () => {
    expect(resolveActualDemoSpeedLevel({
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });

  it('a missing/invalid supportLevel -> null', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow',
      supportLevel: 'nonsense',
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: false,
    })).toBeNull();
  });

  it('called with no arguments at all -> null, does not throw', () => {
    expect(resolveActualDemoSpeedLevel()).toBeNull();
  });
});

describe('resolveActualDemoSpeedLevel — no timing metric involved', () => {
  it('the module source has zero references to raw timing metrics', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, './demoSpeedPersistence.js'), 'utf8');
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/attempt_duration_ms|attempt_avg_speed|pause_frequency|pause_duration_ratio/);
  });
});
