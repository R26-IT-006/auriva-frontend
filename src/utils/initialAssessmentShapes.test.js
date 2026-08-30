jest.mock('../api/client', () => ({ get: jest.fn() }));
import client from '../api/client';
import { fetchInitialAssessmentShapes, normalizeInitialAssessmentShapesResponse } from './initialAssessmentShapes';

describe('normalizeInitialAssessmentShapesResponse', () => {
  test('hasData:false normalizes to not_found', () => {
    expect(normalizeInitialAssessmentShapesResponse({ hasData: false })).toEqual({ status: 'not_found', shapes: null });
  });

  test('missing/malformed data normalizes to read_failed rather than throwing', () => {
    expect(normalizeInitialAssessmentShapesResponse(null)).toEqual({ status: 'read_failed', shapes: null });
    expect(normalizeInitialAssessmentShapesResponse(undefined)).toEqual({ status: 'read_failed', shapes: null });
    expect(normalizeInitialAssessmentShapesResponse('not an object')).toEqual({ status: 'read_failed', shapes: null });
  });

  test('hasData:true with an empty/missing shapes array normalizes to not_found', () => {
    expect(normalizeInitialAssessmentShapesResponse({ hasData: true, assessment: {} })).toEqual({ status: 'not_found', shapes: null });
    expect(normalizeInitialAssessmentShapesResponse({ hasData: true, assessment: { shapes: [] } })).toEqual({ status: 'not_found', shapes: null });
  });

  test('a real 6-shape response maps shape_id -> shapeId and preserves motor_score per shape', () => {
    const data = {
      hasData: true,
      assessment: {
        shapes: [
          { shape_id: 'horizontal_line', features: { motor_score: 77, smoothness: 0.07 } },
          { shape_id: 'vertical_line', features: { motor_score: 75 } },
          { shape_id: 'full_circle', features: { motor_score: 78 } },
          { shape_id: 'half_circle', features: { motor_score: 80 } },
          { shape_id: 'zigzag', features: { motor_score: 53 } },
          { shape_id: 'curve_wave', features: { motor_score: 66 } },
        ],
      },
    };
    const result = normalizeInitialAssessmentShapesResponse(data);
    expect(result.status).toBe('found');
    expect(result.shapes).toHaveLength(6);
    expect(result.shapes[0]).toEqual({ shapeId: 'horizontal_line', features: { motor_score: 77 } });
    expect(result.shapes.map(s => s.shapeId)).toEqual([
      'horizontal_line', 'vertical_line', 'full_circle', 'half_circle', 'zigzag', 'curve_wave',
    ]);
  });

  test('a shape with a genuinely unavailable motor_score keeps null rather than fabricating a number', () => {
    const data = { hasData: true, assessment: { shapes: [{ shape_id: 'zigzag', features: {} }] } };
    const result = normalizeInitialAssessmentShapesResponse(data);
    expect(result.shapes[0].features.motor_score).toBeNull();
  });
});

describe('fetchInitialAssessmentShapes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('resolves found status with 6 shapes on a successful response', async () => {
    client.get.mockResolvedValueOnce({
      data: { hasData: true, assessment: { shapes: [{ shape_id: 'zigzag', features: { motor_score: 53 } }] } },
    });
    const result = await fetchInitialAssessmentShapes({ studentId: 10 });
    expect(result.status).toBe('found');
    expect(result.shapes).toHaveLength(1);
  });

  test('a network error never throws — resolves to read_failed', async () => {
    client.get.mockRejectedValueOnce(new Error('network down'));
    await expect(fetchInitialAssessmentShapes({ studentId: 10 })).resolves.toEqual({ status: 'read_failed', shapes: null });
  });

  test('a student with no assessment at all resolves to not_found, not an error', async () => {
    client.get.mockResolvedValueOnce({ data: { hasData: false } });
    await expect(fetchInitialAssessmentShapes({ studentId: 999 })).resolves.toEqual({ status: 'not_found', shapes: null });
  });
});
