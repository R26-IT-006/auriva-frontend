import client from './client';
import { ENDPOINTS } from '../constants/api';

export const dialogueApi = {
  async getLevel1Overview(studentId) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_LEVEL1_OVERVIEW(studentId));
    return data;
  },

  async getNextWord(studentId, { category = null, excludeWordId = null, sessionPassed = null, status = null } = {}) {
    const params = {};
    if (category      != null) params.category        = category;
    if (excludeWordId != null) params.exclude_word_id  = excludeWordId;
    if (sessionPassed != null) params.session_passed   = sessionPassed;
    if (status        != null) params.status            = status;
    const { data } = await client.get(ENDPOINTS.DIALOGUE_LEVEL1_NEXT_WORD(studentId), { params });
    return data;
  },

  async recordPhase1Exposure(studentId, wordId) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE1_EXPOSURE(studentId, wordId)
    );
    return data;
  },

  async submitPhase1Gate(studentId, wordId, gatePassed) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE1_GATE(studentId, wordId),
      { gate_passed: gatePassed }
    );
    return data;
  },

  async recordPhase2Nonverbal(studentId, wordId, { imageSelectedCorrect, sessionId }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE2_NONVERBAL(studentId, wordId),
      {
        image_selected_correct: imageSelectedCorrect,
        session_id:             sessionId ?? undefined,
      }
    );
    return data;
  },

  async assessPhase2Speech(studentId, wordId, {
    audioBase64, mimeType, sessionId, avatarAudioEndTs, recordingStartTs,
  }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE2_ASSESS(studentId, wordId),
      {
        audio_base64:        audioBase64,
        mime_type:           mimeType,
        session_id:          sessionId ?? undefined,
        avatar_audio_end_ts: avatarAudioEndTs ?? undefined,
        recording_start_ts:  recordingStartTs ?? undefined,
      }
    );
    return data;
  },

  async submitPhase3Scenario(studentId, wordId, {
    scenarioLabel, selectedCorrect, sessionId,
    responseLatencyMs, selectionChangeCount, promptCount, firstTapCorrect,
  }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE3_SCENARIO(studentId, wordId),
      {
        scenario_label:         scenarioLabel,
        selected_correct:       selectedCorrect,
        session_id:             sessionId ?? undefined,
        response_latency_ms:    responseLatencyMs ?? undefined,
        selection_change_count: selectionChangeCount ?? 0,
        prompt_count:           promptCount ?? 1,
        first_tap_correct:      firstTapCorrect ?? undefined,
      }
    );
    return data;
  },

  async submitPhase3(studentId, wordId, { phase3Passed, sessionId }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE3_COMPLETE(studentId, wordId),
      {
        phase3_passed: phase3Passed,
        session_id:    sessionId ?? undefined,
      }
    );
    return data;
  },
};

// Days of the Week – specific API methods
export const daysApi = {
  async getPhase3Question(studentId, wordId) {
    const { data } = await client.get(ENDPOINTS.DAYS_PHASE3_QUESTION(studentId, wordId));
    return data;
  },

  async getSpinningWheelRound(studentId, attemptedWordIds = []) {
    const { data } = await client.get(ENDPOINTS.DAYS_SPINNING_WHEEL(studentId, attemptedWordIds));
    return data;
  },

  async recordSpinningWheelAttempt(studentId, { targetWordId, selectedWordId, sessionId }) {
    const { data } = await client.post(
      ENDPOINTS.DAYS_SPINNING_WHEEL_ATTEMPT(studentId),
      {
        target_word_id:   targetWordId,
        selected_word_id: selectedWordId,
        session_id:       sessionId ?? undefined,
      }
    );
    return data;
  },
};
