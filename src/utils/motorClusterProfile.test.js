import { normalizeMotorClusterResponse } from './motorClusterProfile';

jest.mock('../api/client', () => ({ get: jest.fn() }));
import client from '../api/client';
import { fetchMotorClusterProfile } from './motorClusterProfile';

describe('normalizeMotorClusterResponse', () => {
  it('returns found + the research-safe profile fields for a predicted response', () => {
    const result = normalizeMotorClusterResponse({
      status: 'predicted',
      prediction: {
        cluster_id: 1, profile_code: 'profile_b', display_name: 'Motor Profile B',
        description: 'A distinct initial motor profile.', model_version: 'motor_cluster_v1',
        nearest_distance: 0.4, second_nearest_distance: 1.9, separation_margin: 1.5,
      },
    });
    expect(result.status).toBe('found');
    expect(result.profile).toEqual({
      displayName: 'Motor Profile B', description: 'A distinct initial motor profile.',
      profileCode: 'profile_b', modelVersion: 'motor_cluster_v1',
    });
    expect(result.debug).toEqual({
      clusterId: 1, nearestDistance: 0.4, secondNearestDistance: 1.9, separationMargin: 1.5,
    });
  });

  it('returns not_found for baseline_not_found', () => {
    expect(normalizeMotorClusterResponse({ status: 'baseline_not_found', prediction: null }))
      .toEqual({ status: 'not_found', profile: null, debug: null });
  });

  it('returns unavailable for missing/malformed data, never throws', () => {
    expect(normalizeMotorClusterResponse(undefined)).toEqual({ status: 'unavailable', profile: null, debug: null });
    expect(normalizeMotorClusterResponse(null)).toEqual({ status: 'unavailable', profile: null, debug: null });
    expect(normalizeMotorClusterResponse({})).toEqual({ status: 'unavailable', profile: null, debug: null });
    expect(normalizeMotorClusterResponse({ status: 'predicted', prediction: { cluster_id: 1 } }))
      .toEqual({ status: 'unavailable', profile: null, debug: null }); // missing display_name/description
  });
});

describe('fetchMotorClusterProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the normalized profile on success', async () => {
    client.get.mockResolvedValueOnce({
      data: { status: 'predicted', prediction: { display_name: 'Motor Profile A', description: 'desc', profile_code: 'a', model_version: 'v1' } },
    });
    const result = await fetchMotorClusterProfile(42);
    expect(result.status).toBe('found');
    expect(result.profile.displayName).toBe('Motor Profile A');
  });

  it('treats a 404 response as not_found (no baseline yet), not an error', async () => {
    const err = new Error('Not Found');
    err.response = { status: 404, data: { status: 'baseline_not_found' } };
    client.get.mockRejectedValueOnce(err);
    const result = await fetchMotorClusterProfile(42);
    expect(result).toEqual({ status: 'not_found', profile: null, debug: null });
  });

  it('treats a network/server failure as unavailable, never throws', async () => {
    client.get.mockRejectedValueOnce(new Error('network down'));
    const result = await fetchMotorClusterProfile(42);
    expect(result.status).toBe('unavailable');
  });
});
