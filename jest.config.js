// Two test projects, because this repo has two genuinely different kinds of
// test and each needs a different environment:
//
//   node       — the pure-JS units under src/utils and src/research (DTW,
//                scoring, report shaping). No react-native imports, so a plain
//                node environment + babel-jest keeps them fast.
//   components — the handful of tests that actually render a component with
//                react-test-renderer. Those need jest-expo's react-native
//                transform and native-module mocks.
//
// Before this was a `projects` config the two strategies lived on separate
// branches — a bare jest.config.js on one side, `"jest": { "preset":
// "jest-expo" }` in package.json on the other. Running either alone silently
// skipped the other's tests (testMatch simply never matched them), and having
// both present at once made Jest refuse to start with "Multiple configurations
// found". Keep the package.json `jest` key absent: this file is the only Jest
// config.
const node = {
  displayName: 'node',
  testEnvironment: 'node',
  // src/research/**: offline, non-production candidate-scoring modules
  // (e.g. motor_score_v2 research — never imported by any live screen)
  // that still deserve the same deterministic pure-function test coverage
  // as src/utils/.
  testMatch: ['<rootDir>/src/utils/**/*.test.js', '<rootDir>/src/research/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    // Metro turns an image require() into a React Native asset reference;
    // Node cannot read a .jpg, so without this any test importing
    // constants/wordImages.js fails at import and that map stays untestable.
    '\\.(jpg|jpeg|png|gif|webp|svg|mp4)$': '<rootDir>/__mocks__/imageAssetMock.js',
    // constants/api.js imports expo-constants, which cannot be loaded in this
    // environment at all — see the mock for why a transform exception does not
    // work. Mapped rather than transformed so the whole api/ layer stays
    // importable here.
    '^expo-constants$': '<rootDir>/__mocks__/expoConstantsMock.js',
  },
  // babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` into an import
  // from expo/virtual/env.js, which ships as untransformed ESM. node_modules
  // is not transformed by default, so that one virtual module has to be
  // excepted or any file reading an EXPO_PUBLIC_ variable fails to load here.
  // Deliberately narrow: only expo/virtual, never node_modules at large.
  transformIgnorePatterns: ['/node_modules/(?!expo/virtual/)'],
};

const components = {
  displayName: 'components',
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/components/**/*.test.js'],
};

module.exports = { projects: [node, components] };
