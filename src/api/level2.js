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

  async startSession(studentId, sessionId = null) {
    const body = sessionId ? { session_id: sessionId } : {};
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
};
