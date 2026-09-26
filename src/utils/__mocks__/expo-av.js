// Manual Jest mock for expo-av, scoped to what useGuardedRecorder.js needs.
// Audio.Recording instance methods delegate to module-level jest.fn()s shared
// across every `new Audio.Recording()` call, so tests can assert call counts
// / control resolve-reject timing regardless of how many instances the hook
// creates across a run (e.g. one per start attempt).

const prepareToRecordAsync = jest.fn().mockResolvedValue(undefined);
const startAsync = jest.fn().mockResolvedValue(undefined);
const stopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
const getURI = jest.fn(() => 'mock://recording.m4a');

class MockRecording {
  prepareToRecordAsync(...args) { return prepareToRecordAsync(...args); }
  startAsync(...args) { return startAsync(...args); }
  stopAndUnloadAsync(...args) { return stopAndUnloadAsync(...args); }
  getURI(...args) { return getURI(...args); }
}

const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);

export const Audio = {
  Recording: MockRecording,
  requestPermissionsAsync,
  setAudioModeAsync,
  AndroidOutputFormat: { MPEG_4: 'mpeg4' },
  AndroidAudioEncoder: { AAC: 'aac' },
  IOSOutputFormat: { MPEG4AAC: 'aac' },
  IOSAudioQuality: { HIGH: 'high' },
};

// Exposed so tests can reconfigure/reset the shared instance-method mocks
// without needing to reach into whatever Audio.Recording instance the hook
// happened to construct.
Audio.__mocks__ = {
  prepareToRecordAsync,
  startAsync,
  stopAndUnloadAsync,
  getURI,
  requestPermissionsAsync,
  setAudioModeAsync,
};
