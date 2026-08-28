// Minimal Jest setup for pure-JS unit tests (utils/*.test.js). Deliberately
// does NOT pull in jest-expo/react-native's test preset — component tests
// would need that, but the DTW/scoring utils under test have no
// react-native imports, so a plain node environment + babel-jest transform
// (reusing the app's existing babel.config.js) is enough and keeps `npm
// test` fast.
module.exports = {
  testEnvironment: 'node',
  // src/research/**: offline, non-production candidate-scoring modules
  // (e.g. motor_score_v2 research — never imported by any live screen)
  // that still deserve the same deterministic pure-function test coverage
  // as src/utils/.
  testMatch: ['<rootDir>/src/utils/**/*.test.js', '<rootDir>/src/research/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  // babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` into an import
  // from expo/virtual/env.js, which ships as untransformed ESM. node_modules
  // is not transformed by default, so that one virtual module has to be
  // excepted or any file reading an EXPO_PUBLIC_ variable fails to load here.
  // Deliberately narrow: only expo/virtual, never node_modules at large.
  // Metro turns an image require() into a React Native asset reference;
  // Node cannot read a .jpg, so without this any test importing
  // constants/wordImages.js fails at import and that map stays untestable.
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/imageAssetMock.js',
  },
  transformIgnorePatterns: ['/node_modules/(?!expo/virtual/)'],
};
