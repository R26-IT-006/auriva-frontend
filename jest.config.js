const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...expoPreset,
  roots: ['<rootDir>/testing'],
  testMatch: ['<rootDir>/testing/**/*.test.js'],
  // Expo's native Jest environment aliases `window` to Node's global object.
  // Seed the location Metro's HMR shim reads during preset initialization.
  setupFiles: [
    expoPreset.setupFiles[0],
    '<rootDir>/testing/environment.js',
    ...expoPreset.setupFiles.slice(1),
  ],
  setupFilesAfterEnv: ['<rootDir>/testing/setup.js'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/navigation/**',
    '!src/**/index.js',
  ],
  clearMocks: true,
  watchman: false,
  haste: {
    defaultPlatform: 'ios',
    // Limiting the crawl to the platform this test run resolves keeps Jest
    // fast without changing React Native's Platform module semantics.
    platforms: ['ios'],
  },
};
