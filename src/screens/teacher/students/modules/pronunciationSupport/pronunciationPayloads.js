export function getPronunciationWordLabel(word, fallback = "cat") {
  return word?.letter || word?.word || word?.id || fallback;
}

export function buildPronunciationScoringPayload({
  mode,
  categoryId,
  isAlphabetMode,
  word,
  responseDuration,
  attemptNumber,
  audioData,
  preRecordDelaySeconds,
}) {
  return {
    mode,
    category_id: isAlphabetMode ? null : categoryId,
    word_id: word?.id || "cat",
    word_label: getPronunciationWordLabel(word),
    difficulty: word?.difficulty || null,
    target_phonemes: word?.sounds || [],
    response_duration: responseDuration,
    attempt_number: attemptNumber,
    pre_record_delay_seconds: preRecordDelaySeconds ?? null,
    raw_audio_base64: audioData.rawAudioBase64,
    raw_audio_mime_type: audioData.rawAudioMimeType,
    raw_audio_size: audioData.rawAudioSize,
  };
}

export function normalizePhonemeScores({ sounds, displayScore }) {
  return sounds.map((sound) => ({
    text: sound.text || "",
    type: sound.type || null,
    position: sound.position || null,
    cue: sound.cue || null,
    score: sound.score ?? displayScore,
  }));
}

export function buildPronunciationResultPayload({
  mode,
  categoryId,
  isAlphabetMode,
  currentWord,
  displayScore,
  sounds,
  responseDuration,
  hesitationTime,
  recommendation,
  nextWord,
  numberOfAttempts,
  recordingUri,
  rawAudioBase64,
  rawAudioMimeType,
  rawAudioSize,
  listenChooseData,
}) {
  return {
    mode,
    category_id: isAlphabetMode ? null : categoryId,
    word_id: currentWord.id,
    word_label: getPronunciationWordLabel(currentWord, currentWord.id),
    overall_score: displayScore,
    phoneme_scores: normalizePhonemeScores({ sounds, displayScore }),
    response_duration: responseDuration,
    hesitation_time: hesitationTime ?? null,
    recommendation_type: recommendation?.type || null,
    recommendation_message: recommendation?.message || null,
    recommendation_details: recommendation?.details || null,
    next_word_id: nextWord?.id || null,
    attempt_number: Math.max(1, numberOfAttempts || 1),
    workflow_completed: true,
    recording_uri: recordingUri || null,
    raw_audio_base64: rawAudioBase64 || null,
    raw_audio_mime_type: rawAudioMimeType || null,
    raw_audio_size: rawAudioSize || null,
    listen_choose_data: listenChooseData,
  };
}
