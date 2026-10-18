// Teacher-facing letter-motor pattern labels — the single presentation
// mapping used by every teacher surface.
//
// Proves state_code is the sole source of a visible A/B label, that a raw
// internal code can never reach a teacher, and that the wording carries no
// severity/progression/diagnostic language.

import fs from 'fs';
import path from 'path';

import {
  LETTER_MOTOR_PATTERN_LABELS,
  LETTER_MOTOR_PATTERN_FALLBACK,
  LETTER_MOTOR_PATTERN_CAPTION,
  getLetterMotorPatternLabel,
} from './letterMotorPatternLabels';

describe('getLetterMotorPatternLabel', () => {
  it('maps each known state_code to its neutral visible label', () => {
    expect(getLetterMotorPatternLabel('LETTER_STATE_A')).toBe('Letter Motor Pattern A');
    expect(getLetterMotorPatternLabel('LETTER_STATE_B')).toBe('Letter Motor Pattern B');
  });

  it.each([
    ['unknown code', 'LETTER_STATE_Z'],
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['number', 3],
    ['object', {}],
    ['legacy display_name passed by mistake', 'Letter Motor State A'],
  ])('falls back to the neutral generic label for %s', (_label, input) => {
    expect(getLetterMotorPatternLabel(input)).toBe('Letter Motor Pattern');
  });

  it('never returns a raw internal state code', () => {
    for (const input of ['LETTER_STATE_A', 'LETTER_STATE_B', 'LETTER_STATE_Z', null, undefined, 7]) {
      expect(getLetterMotorPatternLabel(input)).not.toMatch(/LETTER_STATE/);
    }
  });

  it('exposes exactly the two nominal labels', () => {
    expect(Object.keys(LETTER_MOTOR_PATTERN_LABELS).sort()).toEqual(['LETTER_STATE_A', 'LETTER_STATE_B']);
    expect(LETTER_MOTOR_PATTERN_FALLBACK).toBe('Letter Motor Pattern');
  });
});

describe('wording is neutral', () => {
  const BANNED = /\b(experimental|pilot|abnormal|anomaly|anomalous|impaired|severe|severity|risk|confidence|probability|good|bad|poor|strong|weak|mild|moderate|normal|better|worse|stage|development|developmental|diagnos\w*|autis\w*|ASD)\b/i;

  it('no label or caption contains banned vocabulary', () => {
    const strings = [
      ...Object.values(LETTER_MOTOR_PATTERN_LABELS),
      LETTER_MOTOR_PATTERN_FALLBACK,
    ];
    for (const s of strings) expect(s).not.toMatch(BANNED);
  });

  it('the caption states the labels are nominal', () => {
    expect(LETTER_MOTOR_PATTERN_CAPTION).toBe(
      'Pattern labels are descriptive categories and do not indicate severity or progression.',
    );
  });

  it('no visible label implies ordering, numbering or a stage', () => {
    for (const s of Object.values(LETTER_MOTOR_PATTERN_LABELS)) {
      expect(s).not.toMatch(/\b(1|2|first|second|next|then|level|phase|step)\b/i);
      expect(s).not.toMatch(/State/);
    }
  });
});

describe('module stays dependency-free', () => {
  // The pure PDF builder imports this module and must remain unit-testable
  // without a react-native environment.
  it('imports nothing', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './letterMotorPatternLabels.js'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
  });
});

describe('Letter V1 feature descriptions', () => {
  const {
    getLetterMotorFeatureDescription, isLegacyMilestoneResult,
    LETTER_MOTOR_LEGACY_MILESTONE_NOTE,
  } = require('./letterMotorPatternLabels');
  const v1 = 'letter_motor_cluster_v1';

  it('describes Pattern A and B only for a Writing Check result on the v1 model', () => {
    expect(getLetterMotorFeatureDescription({ stateCode: 'LETTER_STATE_A', modelVersion: v1, milestone: 'WRITING_CHECK' }))
      .toEqual({
        summary: 'Closer letter-shape matching in the pilot reference data.',
        explanation: 'This pattern is associated with letter strokes that follow the reference shapes more closely than those in Pattern B.',
      });
    expect(getLetterMotorFeatureDescription({ stateCode: 'LETTER_STATE_B', modelVersion: v1, milestone: 'WRITING_CHECK' }))
      .toEqual({
        summary: 'Greater letter-shape differences in the pilot reference data.',
        explanation: 'This pattern is associated with letter strokes that differ more from the reference shapes than those in Pattern A.',
      });
  });

  it('returns null for legacy milestones, other models, unknown sources and unknown codes', () => {
    for (const milestone of ['UPPERCASE_STRAIGHT_14', 'UPPERCASE_CURVED_17', 'FULL_REFERENCE_20', null, undefined, 'SOMETHING_NEW']) {
      expect(getLetterMotorFeatureDescription({ stateCode: 'LETTER_STATE_A', modelVersion: v1, milestone })).toBeNull();
    }
    expect(getLetterMotorFeatureDescription({ stateCode: 'LETTER_STATE_A', modelVersion: 'letter_motor_cluster_v2', milestone: 'WRITING_CHECK' })).toBeNull();
    expect(getLetterMotorFeatureDescription({ stateCode: 'LETTER_STATE_A', modelVersion: null, milestone: 'WRITING_CHECK' })).toBeNull();
    expect(getLetterMotorFeatureDescription({ stateCode: 'LETTER_STATE_C', modelVersion: v1, milestone: 'WRITING_CHECK' })).toBeNull();
    expect(getLetterMotorFeatureDescription({ stateCode: null, modelVersion: v1, milestone: 'WRITING_CHECK' })).toBeNull();
    expect(getLetterMotorFeatureDescription()).toBeNull();
  });

  it('flags only 14/17/20 as legacy and carries the approved note', () => {
    expect(isLegacyMilestoneResult('UPPERCASE_STRAIGHT_14')).toBe(true);
    expect(isLegacyMilestoneResult('FULL_REFERENCE_20')).toBe(true);
    expect(isLegacyMilestoneResult('WRITING_CHECK')).toBe(false);
    expect(isLegacyMilestoneResult(null)).toBe(false);
    expect(LETTER_MOTOR_LEGACY_MILESTONE_NOTE).toBe(
      'Historical practice-based grouping. This result uses different writing conditions from the controlled Writing Check and should not be interpreted as an equivalent assessment.'
    );
  });
});
