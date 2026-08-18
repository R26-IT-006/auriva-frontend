// Initial Motor Assessment scoring/consistency fix — motorBaseline.js.
//
// Covers normalizeMotorBaselineResponse's pure shape-handling and
// fetchMotorBaseline's never-throws contract, including the 404 →
// baseline_not_found mapping. Mirrors familyThresholds.test.js's
// established pattern for this exact class of fetch wrapper.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import { normalizeMotorBaselineResponse, fetchMotorBaseline } from './motorBaseline';

describe('normalizeMotorBaselineResponse', () => {
  it('passes through a found baseline with all four scores', () => {
    const result = normalizeMotorBaselineResponse({
      status: 'found',
      baseline: { scores: { straight: 84, curved: 79, complex: 91, overall: 88 } },
    });
    expect(result).toEqual({ status: 'found', baseline: { straight: 84, curved: 79, complex: 91, overall: 88 } });
  });

  it('reports baseline_not_found distinctly from a read failure', () => {
    const result = normalizeMotorBaselineResponse({ status: 'baseline_not_found', baseline: null });
    expect(result).toEqual({ status: 'baseline_not_found', baseline: null });
  });

  it.each([
    ['null body', null],
    ['undefined body', undefined],
    ['non-object body', 'not an object'],
    ['missing status', {}],
    ['unrecognized status', { status: 'something_else' }],
    ['missing scores', { status: 'found', baseline: {} }],
    ['non-numeric score', { status: 'found', baseline: { scores: { straight: '84', curved: 79, complex: 91, overall: 88 } } }],
  ])('fails safe to read_failed for %s', (_label, data) => {
    expect(normalizeMotorBaselineResponse(data)).toEqual({ status: 'read_failed', baseline: null });
  });
});

describe('fetchMotorBaseline', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves the normalized shape on a successful call', async () => {
    client.get.mockResolvedValueOnce({
      data: { status: 'found', baseline: { scores: { straight: 84, curved: 79, complex: 91, overall: 88 } } },
    });
    const result = await fetchMotorBaseline({ studentId: 31 });
    expect(result).toEqual({ status: 'found', baseline: { straight: 84, curved: 79, complex: 91, overall: 88 } });
    expect(client.get).toHaveBeenCalledWith('/handwriting/motor-baseline/31');
  });

  it('maps a 404 response to baseline_not_found rather than a generic read failure', async () => {
    client.get.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(fetchMotorBaseline({ studentId: 9 })).resolves.toEqual({ status: 'baseline_not_found', baseline: null });
  });

  it('never throws — resolves read_failed on a network/other HTTP error', async () => {
    client.get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(fetchMotorBaseline({ studentId: 31 })).resolves.toEqual({ status: 'read_failed', baseline: null });
  });
});
