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
  heardReferenceAudio,
}) {
  return {
    mode,
    category_id: isAlphabetMode ? null : categoryId,
    word_id: word?.id || "cat",
    word_label: getPronunciationWordLabel(word),
    difficulty: word?.difficulty || null,
    // Alphabet mode asks for the spoken letter name ("C" = /s i:/), while
    // `word.sounds` describes the letter's common in-word sound (/k/). The
    // backend owns the canonical A-Z letter-name profiles, so do not override
    // them with the teaching-card sound. Word mode still sends its full sound
    // breakdown as before.
    target_phonemes: isAlphabetMode ? [] : word?.sounds || [],
    response_duration: responseDuration,
    attempt_number: attemptNumber,
    pre_record_delay_seconds: preRecordDelaySeconds ?? null,
    heard_reference_audio: Boolean(heardReferenceAudio),
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
    gop: sound.gop ?? null,
    gop_score: sound.gop_score ?? null,
    similarity_score: sound.similarity_score ?? null,
    timing_score: sound.timing_score ?? null,
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
  scoringMethod,
  recognizedText,
  speechVerification,
  confidenceLevel,
  needsTeacherReview,
  heardReferenceAudio,
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
    scoring_method: scoringMethod || recommendation?.scoringMethod || null,
    recognized_text: recognizedText || null,
    speech_verification: speechVerification || null,
    confidence_level: confidenceLevel || null,
    needs_teacher_review: Boolean(needsTeacherReview),
    heard_reference_audio: Boolean(heardReferenceAudio),
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
