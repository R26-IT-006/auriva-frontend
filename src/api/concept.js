import client from './client';
import { ENDPOINTS } from '../constants/api';

export const conceptApi = {
  async getConceptItems(categoryKey, studentId) {
    const { data } = await client.get(ENDPOINTS.CONCEPT_ITEMS(categoryKey), {
      params: { student_id: studentId },
    });
    return data;
  },

  async startTier1({ studentId, categoryKey, conceptKey }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER1_START, {
      student_id:   studentId,
      category_key: categoryKey,
      concept_key:  conceptKey,
    });
    return data;
  },

  async logInteraction({ studentId, sessionId, categoryKey, conceptKey, tier, eventType, eventData }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER1_INTERACTION, {
      student_id:   studentId,
      session_id:   sessionId   || null,
      category_key: categoryKey,
      concept_key:  conceptKey,
      tier:         tier        || 1,
      event_type:   eventType,
      event_data:   eventData   || {},
    });
    return data;
  },

  async logMatchAttempt({ studentId, sessionId, categoryKey, conceptKey, attemptNumber, selectedKey, correctKey, timeTakenMs, wasCorrect }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER1_ATTEMPT, {
      student_id:     studentId,
      session_id:     sessionId    || null,
      category_key:   categoryKey,
      concept_key:    conceptKey,
      attempt_number: attemptNumber,
      selected_key:   selectedKey,
      correct_key:    correctKey,
      time_taken_ms:  timeTakenMs  || null,
      was_correct:    wasCorrect,
    });
    return data;
  },

  async completeTier1({ studentId, categoryKey, conceptKey, passed, score, attemptCount, confusedWith }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER1_COMPLETE, {
      student_id:    studentId,
      category_key:  categoryKey,
      concept_key:   conceptKey,
      passed,
      score,
      attempt_count: attemptCount,
      confused_with: confusedWith || [],
    });
    return data;
  },
};
