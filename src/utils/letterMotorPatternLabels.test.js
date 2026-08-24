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
