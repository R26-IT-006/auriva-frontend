import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { NORMALIZATION_VERSION } from './dtwNormalization';

// Build-time constants describing this protocol/feature-extraction/template
// revision — bumped whenever the shape/letter set, feature formulas, or
// on-screen templates change, so ML rows can be grouped by what actually
// produced them.
export const PROTOCOL_VERSION = 'v1';
export const FEATURE_VERSION = 'v1';
export const TEMPLATE_VERSION = 'v1';

// dtw_norm_v1 — see utils/dtwNormalization.js. Re-exported here so every
// screen can import all *_version metadata from this one module.
export { NORMALIZATION_VERSION };

// RN has no built-in crypto.randomUUID — this is a small dependency-free
// UUID v4 generator, sufficient for a session-tracking id (not
// security-sensitive).
export function generateCollectionSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDeviceMetadata() {
  return {
    device_type: Platform.OS,
    app_version: Constants.expoConfig?.version ?? 'unknown',
  };
}
