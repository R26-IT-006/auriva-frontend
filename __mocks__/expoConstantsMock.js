// Stands in for expo-constants under the plain-node jest config.
//
// expo-constants ships untransformed ESM and re-exports expo-modules-core,
// whose entry point is raw TypeScript — so a transformIgnorePatterns exception
// is not enough to load it here, and any test that reaches constants/api.js
// (directly, or through the api/ layer) dies at import time.
//
// Every field the app reads off Constants is optional-chained with a fallback,
// so an empty manifest is a faithful stand-in rather than a fiction:
// constants/api.js finds no Expo host and falls through to
// DEFAULT_API_BASE_URL, and utils/collectionSession.js reports the 'unknown'
// app_version it already reports whenever expoConfig carries no version.
// Nothing under test asserts either value.
module.exports = {
  __esModule: true,
  default: {
    expoConfig: {},
    manifest: null,
    manifest2: null,
  },
};
