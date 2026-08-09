import client from './client';
import { ENDPOINTS } from '../constants/api';

export const evaluationApi = {
  async getStatus(studentId) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_EVALUATIONS_STATUS(studentId));
    return data;
  },

  async build(studentId, category) {
    const { data } = await client.get(ENDPOINTS.DIALOGUE_EVALUATIONS_BUILD(studentId, category));
    return data;
  },

  async record(studentId, category, pairs) {
    const { data } = await client.post(
      ENDPOINTS.DIALOGUE_EVALUATIONS_RECORD(studentId, category),
      { pairs }
    );
    return data;
  },
};
