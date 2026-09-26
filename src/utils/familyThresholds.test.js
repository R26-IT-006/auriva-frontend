// Feature 2 Teacher Dashboard integration fix — familyThresholds.js.
//
// Covers normalizeFamilyThresholdsResponse's pure shape-handling (every
// backend response variant: resolved+available, resolved+unavailable,
// invalid_input, malformed/absent body) and fetchFamilyThresholds's
// never-throws contract. Mirrors this project's established
// worksheetRecommendations.test.js / supportRecommendation.test.js pattern.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import { normalizeFamilyThresholdsResponse, fetchFamilyThresholds } from './familyThresholds';

describe('normalizeFamilyThresholdsResponse', () => {
  it('passes through a fully-resolved response with all three families available', () => {
    const result = normalizeFamilyThresholdsResponse({
      status: 'resolved',
      families: {
        straight: { status: 'available', threshold: 89, source: 'family_evaluation' },
        curved:   { status: 'available', threshold: 84, source: 'family_evaluation' },
        complex:  { status: 'available', threshold: 96, source: 'family_evaluation' },
      },
    });
    expect(result).toEqual({ status: 'resolved', families: { straight: 89, curved: 84, complex: 96 } });
  });

  it('maps an "unavailable" family entry to null — never a fabricated number', () => {
    const result = normalizeFamilyThresholdsResponse({
      status: 'resolved',
      families: {
        straight: { status: 'unavailable', threshold: null, source: null },
        curved:   { status: 'available', threshold: 84, source: 'family_evaluation' },
        complex:  { status: 'unavailable', threshold: null, source: null },
      },
    });
    expect(result).toEqual({ status: 'resolved', families: { straight: null, curved: 84, complex: null } });
  });

  it('reports invalid_input distinctly from a read failure', () => {
    const result = normalizeFamilyThresholdsResponse({ status: 'invalid_input' });
    expect(result.status).toBe('invalid_input');
    expect(result.families).toEqual({ straight: null, curved: null, complex: null });
  });

  it.each([
    ['null body', null],
    ['undefined body', undefined],
    ['non-object body', 'not an object'],
    ['missing status', {}],
    ['unrecognized status', { status: 'something_else' }],
    ['missing families', { status: 'resolved' }],
  ])('fails safe to read_failed for %s', (_label, data) => {
    const result = normalizeFamilyThresholdsResponse(data);
    expect(result).toEqual({ status: 'read_failed', families: { straight: null, curved: null, complex: null } });
  });

  it('never trusts a non-numeric threshold value even when status claims available', () => {
    const result = normalizeFamilyThresholdsResponse({
      status: 'resolved',
      families: { straight: { status: 'available', threshold: '89' }, curved: null, complex: undefined },
    });
    expect(result.families).toEqual({ straight: null, curved: null, complex: null });
  });
});

describe('fetchFamilyThresholds', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves the normalized shape on a successful call', async () => {
    client.get.mockResolvedValueOnce({
      data: {
        status: 'resolved',
        families: {
          straight: { status: 'available', threshold: 89 },
          curved:   { status: 'available', threshold: 84 },
          complex:  { status: 'available', threshold: 96 },
        },
      },
    });
    const result = await fetchFamilyThresholds({ studentId: 31 });
    expect(result).toEqual({ status: 'resolved', families: { straight: 89, curved: 84, complex: 96 } });
    expect(client.get).toHaveBeenCalledWith('/handwriting/family-thresholds/31');
  });

  it('never throws — resolves read_failed on a network/HTTP error', async () => {
    client.get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(fetchFamilyThresholds({ studentId: 31 })).resolves.toEqual({
      status: 'read_failed',
      families: { straight: null, curved: null, complex: null },
    });
  });
});
