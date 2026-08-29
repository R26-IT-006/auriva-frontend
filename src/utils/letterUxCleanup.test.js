import fs from 'fs';
import path from 'path';

import { ukLetterSpeechOptions } from '../constants/speechLocale';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const LOWER = '../screens/handwriting/LetterWritingScreen.js';
const UPPER = '../screens/handwriting/uppercase/UppercaseWritingScreen.js';
const SCREENS = [LOWER, UPPER];

describe('end-of-cycle child feedback cleanup', () => {
  test.each(SCREENS)('%s removes only the redundant failed-cycle toast', (rel) => {
    const source = stripComments(read(rel));
    expect(source).not.toContain("show('Keep practising — try again!', 'info')");
    expect(source).toContain("show('We couldn’t record that attempt. Please try once more.', 'info')");
    expect(source).toContain('<AttemptAvatarFeedback');
  });

  test.each(SCREENS)('%s preserves failure persistence and cycle routing', (rel) => {
    const source = stripComments(read(rel));
    const failure = source.slice(
      source.indexOf('if (!collectionMode && response.data.completed === false)'),
      source.indexOf('} catch {', source.indexOf('if (!collectionMode && response.data.completed === false)')),
    );
    expect(failure).toMatch(/cycle_consumed === false[\s\S]*handleCaptureIncomplete/);
    expect(failure).toContain('scheduleAdaptiveRepetitionIfEligible()');
    expect(failure).toContain('handleFailedCycle(response.data?.cycle_usage?.cycles_today ?? null)');

    const handler = source.slice(
      source.indexOf('const handleFailedCycle'),
      source.indexOf('const scheduleAdaptiveRepetitionIfEligible'),
    );
    expect(handler).toContain('recordCycleCompleted({');
    expect(handler).toContain('MAX_CYCLES_PER_LETTER_PER_DATE');
    expect(handler).toContain('PRE_WRITING_REASON.CYCLE_3_REMEDIATION');
    expect(handler).toContain('setAttempt(1)');
  });
});

describe('calm UK dynamic target-letter speech', () => {
  test('the shared portable options are exact and contain no named voice', () => {
    expect(ukLetterSpeechOptions()).toEqual({
      rate: 0.75,
      pitch: 0.9,
      language: 'en-GB',
    });
    expect(ukLetterSpeechOptions()).not.toHaveProperty('voice');
  });

  test.each(SCREENS)('%s uses the shared options at the existing first-touch trigger', (rel) => {
    const source = stripComments(read(rel));
    expect(source).toMatch(/import \{ ukLetterSpeechOptions \} from '[^']*speechLocale'/);
    expect(source).toContain('Speech.speak(spoken.toUpperCase(), ukLetterSpeechOptions())');
    expect(source).toContain('if (!targetSpokenAttemptRef.current)');
    expect(source).toContain('requestTargetSpeech(() => playLetterSoundRef.current?.())');
    expect(source).not.toMatch(/Speech\.speak\(spoken\.toUpperCase\(\), \{[^}]*voice:/);
  });

  test('word speech and prerecorded instruction playback remain on their existing paths', () => {
    const wordWriting = read('../screens/handwriting/words/WordWritingScreen.js');
    const wordPractice = read('../screens/handwriting/words/WordActivityScreen.js');
    const instructionPlayback = read('./handwritingInstructionAudio.js');
    const instructionAudioMap = read('../constants/handwritingInstructionAudio.js');
    expect(wordWriting).toContain('Speech.speak(spoken, { rate: 0.82, language: SPEECH_LOCALE_EN })');
    expect(wordPractice).toContain('Speech.speak(spoken, { rate: 0.75, pitch: 1.0, language: SPEECH_LOCALE_EN })');
    expect(instructionPlayback).not.toContain('ukLetterSpeechOptions');
    expect(instructionAudioMap).toContain('follow_path.mp4');
    expect(instructionAudioMap).toContain('write_by_yourself.mp4');
  });
});
