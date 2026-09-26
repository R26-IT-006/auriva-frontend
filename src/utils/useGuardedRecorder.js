import { useRef, useState, useCallback } from 'react';
import { Audio } from 'expo-av';

const REC_OPTIONS = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

export const RecorderState = {
  IDLE: 'idle',
  STARTING: 'starting',
  RECORDING: 'recording',
  STOPPING: 'stopping',
};

const DEBOUNCE_MS = 600;
const MIN_RECORDING_MS = 800;

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Shared guard around the expo-av Audio.Recording start/stop lifecycle.
 *
 * `toggleRecording` is the single entry point a record button should call.
 * It ignores taps while transitioning (`starting`/`stopping` — the actual
 * bug this replaces: expo-av start/stop promises racing), debounces 600ms
 * after any accepted tap, and ignores a stop tap within 800ms of recording
 * start so instant start-stop churn can't produce empty clips. Any error in
 * start/stop force-unloads the recording and returns to `idle`, so the
 * pipeline can never stay wedged.
 *
 * @param {object} [opts]
 * @param {object} [opts.recOptions] override for Audio.Recording options
 * @param {() => (void|Promise<void>)} [opts.onGetReady] called before an
 *   adaptive mic delay (rc3Refs.micDelayRef), for screens that show a
 *   "Get ready..." message
 * @param {() => void} [opts.onStart] called once recording has started
 * @param {(uri: string) => (void|Promise<void>)} [opts.onStop] called once
 *   recording has stopped and unloaded, with the recorded file's URI
 * @param {(err: unknown) => void} [opts.onError] called when start/stop throws
 * @param {{ recordingStartRef?: { current: number }, micDelayRef?: { current: number } }} [opts.rc3Refs]
 *   optional RC3 timestamp/delay refs owned by the calling screen; the hook
 *   writes the recording start timestamp into `recordingStartRef` and reads
 *   `micDelayRef` for the adaptive pre-recording delay. Omit entirely for
 *   screens with no RC3 capture.
 */
export function useGuardedRecorder({
  recOptions = REC_OPTIONS,
  onGetReady,
  onStart,
  onStop,
  onError,
  rc3Refs,
} = {}) {
  const [state, _setState] = useState(RecorderState.IDLE);
  const stateRef = useRef(RecorderState.IDLE);
  const recordingRef = useRef(null);
  const startedAtRef = useRef(0);
  const debounceUntilRef = useRef(0);

  function setState(s) {
    stateRef.current = s;
    _setState(s);
  }

  const forceIdle = useCallback(async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      await rec.stopAndUnloadAsync().catch(() => {});
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    setState(RecorderState.IDLE);
  }, []);

  const startRecording = useCallback(async () => {
    setState(RecorderState.STARTING);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        onError?.(new Error('mic-permission-denied'));
        setState(RecorderState.IDLE);
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const micDelayMs = rc3Refs?.micDelayRef?.current ?? 0;
      if (micDelayMs > 0) {
        await onGetReady?.();
        await delay(micDelayMs);
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recOptions);
      await recording.startAsync();
      recordingRef.current = recording;
      startedAtRef.current = Date.now();
      if (rc3Refs?.recordingStartRef) rc3Refs.recordingStartRef.current = startedAtRef.current;

      setState(RecorderState.RECORDING);
      onStart?.();
    } catch (err) {
      onError?.(err);
      await forceIdle();
    }
  }, [recOptions, onGetReady, onStart, onError, rc3Refs, forceIdle]);

  const stopRecording = useCallback(async () => {
    setState(RecorderState.STOPPING);
    const recording = recordingRef.current;
    recordingRef.current = null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      setState(RecorderState.IDLE);
      await onStop?.(uri);
    } catch (err) {
      onError?.(err);
      await forceIdle();
    }
  }, [onStop, onError, forceIdle]);

  // Single entry point: state-locking + debounce + minimum-recording-floor
  // all live here, so every screen gets the same tap guard.
  const toggleRecording = useCallback(() => {
    const now = Date.now();
    if (now < debounceUntilRef.current) return;

    if (stateRef.current === RecorderState.IDLE) {
      debounceUntilRef.current = now + DEBOUNCE_MS;
      startRecording();
      return;
    }
    if (stateRef.current === RecorderState.RECORDING) {
      if (now - startedAtRef.current < MIN_RECORDING_MS) return;
      debounceUntilRef.current = now + DEBOUNCE_MS;
      stopRecording();
      return;
    }
    // starting / stopping: ignored — this is the race-condition fix
  }, [startRecording, stopRecording]);

  const reset = useCallback(() => { forceIdle(); }, [forceIdle]);

  return { state, toggleRecording, reset };
}
