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
};
