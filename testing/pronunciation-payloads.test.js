import {
  buildPronunciationResultPayload,
  buildPronunciationScoringPayload,
  getPronunciationWordLabel,
  normalizePhonemeScores,
} from '../src/screens/teacher/students/modules/pronunciationSupport/pronunciationPayloads';
import { getStudentIdentifier } from '../src/screens/teacher/students/modules/pronunciationSupport/studentIdentity';

describe('pronunciation payload builders', () => {
  const word = {
    id: 'cat',
    word: 'Cat',
    difficulty: 2,
    sounds: [{ text: 'k', type: 'consonant' }, { text: 'æ' }, { text: 't' }],
  };
  const audioData = { rawAudioBase64: 'YWJj', rawAudioMimeType: 'audio/mpeg', rawAudioSize: 3 };

  test('gets display labels in letter, word, id, then fallback order', () => {
    expect(getPronunciationWordLabel({ letter: 'A', word: 'Ant', id: 'a' })).toBe('A');
    expect(getPronunciationWordLabel({ word: 'Cat', id: 'cat' })).toBe('Cat');
    expect(getPronunciationWordLabel({ id: 'cat' })).toBe('cat');
    expect(getPronunciationWordLabel(null, 'fallback')).toBe('fallback');
  });

  test('builds a complete word-mode scoring request', () => {
    expect(buildPronunciationScoringPayload({
      mode: 'word', categoryId: 'animals', isAlphabetMode: false, word,
      responseDuration: 1.4, attemptNumber: 2, audioData,
      preRecordDelaySeconds: 0.8, heardReferenceAudio: true,
    })).toEqual({
      mode: 'word', category_id: 'animals', word_id: 'cat', word_label: 'Cat', difficulty: 2,
      target_phonemes: word.sounds, response_duration: 1.4, attempt_number: 2,
      pre_record_delay_seconds: 0.8, heard_reference_audio: true,
      raw_audio_base64: 'YWJj', raw_audio_mime_type: 'audio/mpeg', raw_audio_size: 3,
    });
  });

  test('alphabet scoring never sends the UI teaching sound as canonical phonemes', () => {
    const payload = buildPronunciationScoringPayload({
      mode: 'alphabet', categoryId: 'ignored', isAlphabetMode: true,
      word: { id: 'c', letter: 'C', sounds: [{ text: 'k' }] },
      audioData, heardReferenceAudio: 1,
    });
    expect(payload.category_id).toBeNull();
    expect(payload.target_phonemes).toEqual([]);
    expect(payload.heard_reference_audio).toBe(true);
  });

  test('normalizes phoneme scores while preserving explicit zero values', () => {
    expect(normalizePhonemeScores({
      displayScore: 75,
      sounds: [{ text: 'k', score: 0, gop: 0 }, { text: 'æ', cue: 'open mouth' }],
    })).toEqual([
      expect.objectContaining({ text: 'k', score: 0, gop: 0 }),
      expect.objectContaining({ text: 'æ', score: 75, cue: 'open mouth' }),
    ]);
  });

  test('builds a persisted result with safe defaults and a minimum attempt number', () => {
    const payload = buildPronunciationResultPayload({
      mode: 'word', categoryId: 'animals', isAlphabetMode: false,
      currentWord: word, displayScore: 82, sounds: word.sounds,
      responseDuration: 1.2, numberOfAttempts: 0,
      recommendation: { type: 'advance', message: 'Great', details: { source: 'adaptive' } },
      nextWord: { id: 'dog' }, listenChooseData: null, needsTeacherReview: 0,
    });
    expect(payload).toEqual(expect.objectContaining({
      word_id: 'cat', overall_score: 82, attempt_number: 1, workflow_completed: true,
      next_word_id: 'dog', recommendation_type: 'advance', needs_teacher_review: false,
      recording_uri: null, raw_audio_base64: null,
    }));
    expect(payload.phoneme_scores).toHaveLength(3);
  });
});

describe('student identity compatibility', () => {
  test('supports sid, id, and student_id with explicit precedence', () => {
    expect(getStudentIdentifier({ sid: 1, id: 2, student_id: 3 })).toBe(1);
    expect(getStudentIdentifier({ id: 2, student_id: 3 })).toBe(2);
    expect(getStudentIdentifier({ student_id: 3 })).toBe(3);
    expect(getStudentIdentifier(null)).toBeNull();
  });
});
