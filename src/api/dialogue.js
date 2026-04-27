import client from './client';
import { ENDPOINTS } from '../constants/api';

export const dialogueApi = {
  async getLevel1Overview(studentId) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_LEVEL1_OVERVIEW(studentId));
    return data;
  },

  async getNextWord(studentId, category = null) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_LEVEL1_NEXT_WORD(studentId, category));
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

  async assessPhase2Speech(studentId, wordId, { audioBase64, mimeType, sessionId }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE2_ASSESS(studentId, wordId),
      {
        audio_base64: audioBase64,
        mime_type:    mimeType,
        session_id:   sessionId ?? undefined,
      }
    );
    return data;
  },

  async submitPhase3Scenario(studentId, wordId, { scenarioLabel, selectedCorrect, sessionId }) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_LEVEL1_PHASE3_SCENARIO(studentId, wordId),
      {
        scenario_label:   scenarioLabel,
        selected_correct: selectedCorrect,
        session_id:       sessionId ?? undefined,
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
