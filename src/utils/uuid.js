// Zero-dependency UUID v4 generator. Deliberately has NO react-native or
// expo import — collectionSession.js (which does import react-native/
// expo-constants for device metadata) and preWritingSessionGuard.js (a pure
// utility, unit-tested under plain Jest with no RN transform configured)
// both need this same generator, and only this dependency-free split lets
// both consumers stay testable/importable in their respective contexts.
// Not security-sensitive — just needs to be collision-resistant for
// session/interaction tracking ids.
export function generateUuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
