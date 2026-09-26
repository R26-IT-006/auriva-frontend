import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { NORMALIZATION_VERSION } from './dtwNormalization';
import { generateUuidV4 } from './uuid';

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

// RN has no built-in crypto.randomUUID — generateUuidV4() (utils/uuid.js) is
// a small dependency-free UUID v4 generator, sufficient for a
// session-tracking id (not security-sensitive). Kept as its own
// zero-dependency module (rather than inline here) specifically so
// Feature 4 Step 3's preWritingSessionGuard.js can reuse the exact same
// generator for its interaction ids without also pulling in this file's
// react-native/expo-constants imports — see uuid.js's header comment.
export function generateCollectionSessionId() {
  return generateUuidV4();
}

export function getDeviceMetadata() {
  return {
    device_type: Platform.OS,
    app_version: Constants.expoConfig?.version ?? 'unknown',
  };
}
