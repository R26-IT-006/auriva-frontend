import client from './client';

const base = (sid) => `/teacher/student/${sid}/cat3`;

export const cat3Api = {
  getNextWord: (studentId) =>
    client.get(`${base(studentId)}/next-word`).then(r => r.data),

  recordPhase1Tap: (studentId, wordId, sessionId) =>
    client.post(`${base(studentId)}/word/${wordId}/phase1-tap`, {
      session_id: sessionId ?? undefined,
    }).then(r => r.data),

  recordDragToLine: (studentId, wordId, result, sessionId) =>
    client.post(`${base(studentId)}/word/${wordId}/drag-to-line`, {
      result,
      session_id: sessionId ?? undefined,
    }).then(r => r.data),

  assessPhase2Speech: (studentId, wordId, audioBase64, mimeType, sessionId, avatarAudioEndTs, recordingStartTs) =>
    client.post(`${base(studentId)}/word/${wordId}/phase2-assess`, {
      audio_base64:        audioBase64,
      mime_type:           mimeType,
      session_id:          sessionId ?? undefined,
      avatar_audio_end_ts: avatarAudioEndTs ?? undefined,
      recording_start_ts:  recordingStartTs ?? undefined,
    }).then(r => r.data),

  recordPhase2NonVerbal: (studentId, wordId, tapCorrect, sessionId) =>
    client.post(`${base(studentId)}/word/${wordId}/phase2-nonverbal`, {
      tap_correct: tapCorrect,
      session_id:  sessionId ?? undefined,
    }).then(r => r.data),

  recordPhase3Check: (studentId, wordId, {
    correctOnFirst, secondAttemptCorrect, sessionId,
    attempt1LatencyMs, attempt2LatencyMs,
    attempt1FirstTapCorrect, attempt2FirstTapCorrect,
    attempt1SelectionChangeCount, attempt2SelectionChangeCount,
    attempt1PromptCount, attempt2PromptCount,
  }) =>
    client.post(`${base(studentId)}/word/${wordId}/phase3-check`, {
      correct_on_first: correctOnFirst,
      ...(secondAttemptCorrect !== undefined && { second_attempt_correct: secondAttemptCorrect }),
      session_id: sessionId ?? undefined,
      attempt1_latency_ms: attempt1LatencyMs ?? undefined,
      ...(attempt2LatencyMs !== undefined && { attempt2_latency_ms: attempt2LatencyMs }),
      attempt1_first_tap_correct: attempt1FirstTapCorrect ?? undefined,
      ...(attempt2FirstTapCorrect !== undefined && {
        attempt2_first_tap_correct: attempt2FirstTapCorrect }),
      attempt1_selection_change_count: attempt1SelectionChangeCount ?? 0,
      ...(attempt2SelectionChangeCount !== undefined && {
        attempt2_selection_change_count: attempt2SelectionChangeCount }),
      attempt1_prompt_count: attempt1PromptCount ?? 1,
      ...(attempt2PromptCount !== undefined && { attempt2_prompt_count: attempt2PromptCount }),
    }).then(r => r.data),

  completeWordSession: (studentId, wordId, phase3Passed, sessionId) =>
    client.post(`${base(studentId)}/word/${wordId}/complete`, {
      phase3_passed: phase3Passed,
      session_id:    sessionId ?? undefined,
    }).then(r => r.data),
};
