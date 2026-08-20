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

  async getWordById(wordId) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_WORD_BY_ID(wordId));
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

  async recordPhase2Nonverbal(studentId, wordId, { imageSelectedCorrect, sessionId, isProbe = false }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE2_NONVERBAL(studentId, wordId),
      {
        image_selected_correct: imageSelectedCorrect,
        session_id:             sessionId ?? undefined,
        // omitted (not `false`) when not a probe, so every existing non-probe
        // caller's request body is byte-identical to before this was added
        is_probe:                isProbe || undefined,
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

  async getTrajectory(studentId, wordId) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_TRAJECTORY(studentId, wordId));
    return data;
  },

  // TASK-43 — why a word got its trajectory label.
  // Returns { trajectory, tier, confidence, explanation, caveat }.
  async getTrajectoryExplanation(studentId, wordId) {
    const { data } = await client.get(
      ENDPOINTS.DIALOGUE_TRAJECTORY_EXPLAIN(studentId, wordId)
    );
    return data;
  },

  // TASK-43 — one trajectory report per student, in a single call.
  // Returns { totals, words: [...] }. SHAP is slow enough that one round trip
  // per word would be visibly bad, hence the batch shape.
  async getTrajectoryReport(studentId) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_TRAJECTORY_REPORT(studentId));
    return data;
  },

  // TASK-12 — Non-Verbal Adaptive Wait-Time Escalation
  // Returns { consecutive_refusals_today, wait_multiplier, auto_nonverbal_today }.
  // Fetched by each Phase 2 production screen on mount; failure degrades to 1.0×.
  async getSpeechState(studentId) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_SPEECH_STATE(studentId));
    return data;
  },

  // Rule 5 — periodic production probe (TASK-37 backend, TASK-39 frontend)
  async getProbeCandidate(studentId, category) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_PROBE_CANDIDATE(studentId), {
      params: category != null ? { category } : undefined,
    });
    return data;
  },

  async recordProbeResult(studentId, wordId, { audioBase64, mimeType, sessionId }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_PROBE_RESULT(studentId, wordId),
      {
        audio_base64: audioBase64,
        mime_type:    mimeType,
        session_id:   sessionId ?? undefined,
      }
    );
    return data;
  },
};
