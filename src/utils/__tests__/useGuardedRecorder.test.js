import { act, create } from 'react-test-renderer';
import { useGuardedRecorder } from '../useGuardedRecorder';

jest.mock('expo-av');

// eslint-disable-next-line import/first
import { Audio } from 'expo-av';

const mocks = Audio.__mocks__;

function renderGuardedRecorder(options) {
  const ref = {};
  function Harness() {
    ref.current = useGuardedRecorder(options);
    return null;
  }
  act(() => {
    create(<Harness />);
  });
  return ref;
}

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

async function reachRecording(hookRef) {
  await act(async () => {
    hookRef.current.toggleRecording();
    await flushMicrotasks();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mocks.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mocks.setAudioModeAsync.mockResolvedValue(undefined);
  mocks.prepareToRecordAsync.mockResolvedValue(undefined);
  mocks.startAsync.mockResolvedValue(undefined);
  mocks.stopAndUnloadAsync.mockResolvedValue(undefined);
  mocks.getURI.mockReturnValue('mock://recording.m4a');
});

afterEach(() => {
  jest.useRealTimers();
});

test('1. rapid-tap during recording calls stopAndUnloadAsync exactly once', async () => {
  const hookRef = renderGuardedRecorder();
  await reachRecording(hookRef);
  expect(hookRef.current.state).toBe('recording');

  // clear the 800ms minimum-recording floor before hammering stop taps
  act(() => { jest.advanceTimersByTime(900); });

  await act(async () => {
    for (let i = 0; i < 10; i++) hookRef.current.toggleRecording();
    await flushMicrotasks();
  });

  expect(mocks.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
});

test('2. rapid-tap during idle-to-starting calls prepareToRecordAsync exactly once', async () => {
  const hookRef = renderGuardedRecorder();
  expect(hookRef.current.state).toBe('idle');

  await act(async () => {
    for (let i = 0; i < 10; i++) hookRef.current.toggleRecording();
    await flushMicrotasks();
  });

  expect(mocks.prepareToRecordAsync).toHaveBeenCalledTimes(1);
});

test('3. a tap inside the 600ms debounce window after an accepted tap is a no-op', async () => {
  const hookRef = renderGuardedRecorder();

  await act(async () => {
    hookRef.current.toggleRecording(); // idle -> starting -> recording (accepted)
    await flushMicrotasks();
  });
  expect(hookRef.current.state).toBe('recording');
  expect(mocks.prepareToRecordAsync).toHaveBeenCalledTimes(1);

  act(() => { jest.advanceTimersByTime(300); }); // still inside the 600ms window

  await act(async () => {
    hookRef.current.toggleRecording(); // should be a no-op
    await flushMicrotasks();
  });

  expect(hookRef.current.state).toBe('recording'); // unchanged
  expect(mocks.stopAndUnloadAsync).not.toHaveBeenCalled();
  expect(mocks.prepareToRecordAsync).toHaveBeenCalledTimes(1); // no new start either
});

test('4. minimum-recording floor: a stop tap before 800ms is ignored, one after is accepted', async () => {
  const hookRef = renderGuardedRecorder();
  await reachRecording(hookRef);
  expect(hookRef.current.state).toBe('recording');

  act(() => { jest.advanceTimersByTime(400); }); // under the 800ms floor

  await act(async () => {
    hookRef.current.toggleRecording();
    await flushMicrotasks();
  });
  expect(mocks.stopAndUnloadAsync).not.toHaveBeenCalled();
  expect(hookRef.current.state).toBe('recording'); // unchanged

  act(() => { jest.advanceTimersByTime(500); }); // 900ms total, past the 800ms floor

  await act(async () => {
    hookRef.current.toggleRecording();
    await flushMicrotasks();
  });
  expect(mocks.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
});

test('5. error path: startAsync rejects once, hook returns to idle, next tap starts fresh', async () => {
  const hookRef = renderGuardedRecorder();

  mocks.startAsync.mockRejectedValueOnce(new Error('mock start failure'));

  await act(async () => {
    hookRef.current.toggleRecording();
    await flushMicrotasks();
  });

  expect(hookRef.current.state).toBe('idle');
  expect(mocks.prepareToRecordAsync).toHaveBeenCalledTimes(1);

  act(() => { jest.advanceTimersByTime(700); }); // clear the debounce window from the failed tap

  await act(async () => {
    hookRef.current.toggleRecording();
    await flushMicrotasks();
  });

  expect(hookRef.current.state).toBe('recording');
  expect(mocks.prepareToRecordAsync).toHaveBeenCalledTimes(2);
});
