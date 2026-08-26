import client from './client';
import { ENDPOINTS } from '../constants/api';

export const level2Api = {
  async getQuestionnaire(studentId) {
    const { data } = await client.get(ENDPOINTS.LEVEL2_QUESTIONNAIRE(studentId));
    return data;
  },

  async saveQuestionnaire(studentId, payload) {
    const { data } = await client.put(ENDPOINTS.LEVEL2_QUESTIONNAIRE(studentId), payload);
    return data;
  },

  /**
   * Persist ONLY the child's self-portrait strokes (TASK-17 Fix 2 — dedicated
   * endpoint, so a child with no questionnaire row yet can still save a
   * portrait, and saving never rewrites the other questionnaire fields).
   */
  async savePortrait(studentId, portraitStrokes) {
    const { data } = await client.patch(
      `/teacher/level2/questionnaire/${studentId}/portrait`,
      { portrait_strokes: portraitStrokes }
    );
    return data;
  },

  /**
   * PATCH individual questionnaire fields (friend/pet data) without touching
   * the self-introduction fields already saved via saveQuestionnaire (PUT).
   */
  async patchQuestionnaire(studentId, payload) {
    const { data } = await client.patch(ENDPOINTS.LEVEL2_QUESTIONNAIRE(studentId), payload);
    return data;
  },

  async startSession(studentId, sessionId = null, topic = 'self_introduction') {
    const body = sessionId
      ? { session_id: sessionId, topic }
      : { topic };
    const { data } = await client.post(ENDPOINTS.LEVEL2_SESSION_START(studentId), body);
    return data;
  },

  async completeSession(studentId, sessionId) {
    const { data } = await client.post(ENDPOINTS.LEVEL2_SESSION_COMPLETE(studentId, sessionId));
    return data;
  },

  async recordStep3(studentId, sessionId, sentenceIndex, result) {
    const { data } = await client.post(
      ENDPOINTS.LEVEL2_STEP3(studentId, sessionId, sentenceIndex),
      { result }
    );
    return data;
  },

  async recordGenderSelection(studentId, sessionId, { firstTap, requiredPrompt = false, autoAdvanced = false }) {
    const { data } = await client.post(
      ENDPOINTS.LEVEL2_GENDER_SELECTION(studentId, sessionId),
      { first_tap: firstTap, required_prompt: requiredPrompt, auto_advanced: autoAdvanced }
    );
    return data;
  },

  async recordActivitySelection(studentId, sessionId, childSelectedActivity) {
    const { data } = await client.post(
      ENDPOINTS.LEVEL2_ACTIVITY_SELECTION(studentId, sessionId),
      { child_selected_activity: childSelectedActivity }
    );
    return data;
  },

  async assessStep4(studentId, sessionId, sentenceIndex, audioBase64, mimeType) {
    const { data } = await client.post(
      ENDPOINTS.LEVEL2_STEP4(studentId, sessionId, sentenceIndex),
      { audio_base64: audioBase64, mime_type: mimeType }
    );
    return data;
  },

  async assessParagraph(studentId, sessionId, { audioBase64, mimeType, silenceTimeout = false }) {
    const { data } = await client.post(
      ENDPOINTS.LEVEL2_PARAGRAPH_ATTEMPT(studentId, sessionId),
      { audio_base64: audioBase64 ?? undefined, mime_type: mimeType ?? undefined, silence_timeout: silenceTimeout }
    );
    return data;
  },

  async assessSentenceBySentence(studentId, sessionId, sentenceIndex, { audioBase64, mimeType, silenceTimeout = false }) {
    const { data } = await client.post(
      ENDPOINTS.LEVEL2_SXS_ATTEMPT(studentId, sessionId, sentenceIndex),
      { audio_base64: audioBase64 ?? undefined, mime_type: mimeType ?? undefined, silence_timeout: silenceTimeout }
    );
    return data;
  },

  async getProgress(studentId) {
    const { data } = await client.get(ENDPOINTS.LEVEL2_PROGRESS(studentId));
    return data;
  },

  /**
   * TASK-46 — one Level 2 report per student, covering all three topics.
   * Returns the `{ data: { totals, topics } }` envelope every other method in
   * this file returns; callers unwrap `.data`, as they already do elsewhere.
   */
  async getReport(studentId) {
    const { data } = await client.get(ENDPOINTS.LEVEL2_REPORT(studentId));
    return data;
  },
};
