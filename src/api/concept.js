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

  async logMatchAttempt({ studentId, sessionId, categoryKey, conceptKey, attemptNumber, selectedKey, correctKey, timeTakenMs, wasCorrect, optionKeys, distractorSource }) {
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
      // The options actually presented. A picked option is only ever one the
      // policy offered, so without this the logs cannot distinguish a genuine
      // confusion from the distractor policy's own choice.
      ...(optionKeys ? { option_keys: optionKeys } : {}),
      ...(distractorSource ? { distractor_source: distractorSource } : {}),
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

  async logAdaptiveAttempt({ studentId, sessionId, categoryKey, conceptKey, confusedConceptKey, roundNumber, wasCorrect, timeTakenMs, optionKeys }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_ADAPTIVE_ATTEMPT, {
      student_id:           studentId,
      session_id:           sessionId           || null,
      category_key:         categoryKey,
      concept_key:          conceptKey,
      confused_concept_key: confusedConceptKey,
      round_number:         roundNumber,
      was_correct:          wasCorrect,
      time_taken_ms:        timeTakenMs         || null,
      // The adaptive round is always a forced choice between the target and one
      // confused concept, but log it explicitly rather than leaving the analysis
      // to infer the pair.
      ...(optionKeys ? { option_keys: optionKeys } : {}),
    });
    return data;
  },

  async startTier2({ studentId, categoryKey, conceptKey }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER2_START, {
      student_id:   studentId,
      category_key: categoryKey,
      concept_key:  conceptKey,
    });
    return data;
  },

  async completeTier2({ studentId, categoryKey, conceptKey, passed, score, attemptCount, confusedWith }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER2_COMPLETE, {
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

  async startTier3({ studentId, categoryKey, conceptKey }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER3_START, {
      student_id:   studentId,
      category_key: categoryKey,
      concept_key:  conceptKey,
    });
    return data;
  },

  async getDistractors({ studentId, categoryKey, conceptKey, tier }) {
    const { data } = await client.get(ENDPOINTS.CONCEPT_DISTRACTORS, {
      params: { student_id: studentId, category_key: categoryKey, concept_key: conceptKey, tier: tier || 1 },
    });
    return data;
  },

  async completeTier3({ studentId, categoryKey, conceptKey, timeSpentMs }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_TIER3_COMPLETE, {
      student_id:    studentId,
      category_key:  categoryKey,
      concept_key:   conceptKey,
      time_spent_ms: timeSpentMs || 0,
    });
    return data;
  },

  async completeAdaptive({ studentId, sessionId, categoryKey, conceptKey, confusedKeys, roundResults, allPassed }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_ADAPTIVE_COMPLETE, {
      student_id:    studentId,
      session_id:    sessionId    || null,
      category_key:  categoryKey,
      concept_key:   conceptKey,
      confused_keys: confusedKeys || [],
      round_results: roundResults || [],
      all_passed:    allPassed,
    });
    return data;
  },

  // ── Cross-concept activities ──────────────────────────────────────────────

  async getActivityStatus(categoryKey, studentId) {
    const { data } = await client.get(ENDPOINTS.CONCEPT_ACTIVITY_STATUS(categoryKey), {
      params: { student_id: studentId },
    });
    return data;
  },

  async startActivity({ studentId, categoryKey, sessionId }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_ACTIVITY_START, {
      student_id:   studentId,
      category_key: categoryKey,
      session_id:   sessionId || null,
    });
    return data;
  },

  async logActivityAttempt({ studentId, sessionId, activityId, categoryKey, conceptKey, roundNumber, questionType, selectedKey, wasCorrect, timeTakenMs, optionKeys }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_ACTIVITY_ATTEMPT, {
      student_id:    studentId,
      session_id:    sessionId  || null,
      activity_id:   activityId,
      category_key:  categoryKey,
      concept_key:   conceptKey,
      round_number:  roundNumber,
      question_type: questionType,
      selected_key:  selectedKey,
      was_correct:   wasCorrect,
      time_taken_ms: timeTakenMs || 0,
      option_keys:   optionKeys  || [],
    });
    return data;
  },

  async completeActivity({ studentId, sessionId, activityId, roundResults }) {
    const { data } = await client.post(ENDPOINTS.CONCEPT_ACTIVITY_COMPLETE, {
      student_id:    studentId,
      session_id:    sessionId || null,
      activity_id:   activityId,
      round_results: roundResults || [],
    });
    return data;
  },
};
