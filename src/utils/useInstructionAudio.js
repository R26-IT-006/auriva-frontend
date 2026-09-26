import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { ukSpeechOptions } from '../constants/speechLocale';
import { playInstructionAudio, stopInstructionAudio } from './handwritingInstructionAudio';
import {
  createInstructionTargetSpeechQueue,
  hasReachedInstructionWriteThreshold,
} from './instructionAudioGate';

/**
 * Screen lifecycle wrapper for fixed instruction recordings. It deliberately
 * knows nothing about navigation destinations, attempts, or activity rules;
 * callers supply the current canonical instruction key.
 */
export function useInstructionAudioState(
  instructionKey,
  { autoPlay = false, autoPlayToken = null, delayMs = 0, fallbackText = '' } = {},
) {
  const fallbackActiveRef = useRef(false);
  const runRef = useRef(0);
  const targetSpeechQueueRef = useRef(null);
  if (!targetSpeechQueueRef.current) {
    targetSpeechQueueRef.current = createInstructionTargetSpeechQueue();
    if (autoPlay && instructionKey) targetSpeechQueueRef.current.begin({ reset: true });
  }
  const [playback, setPlayback] = useState({
    key: instructionKey,
    token: autoPlayToken,
    playing: Boolean(autoPlay && instructionKey),
  });
  const [writeGate, setWriteGate] = useState({
    key: instructionKey,
    token: autoPlayToken,
    open: !autoPlay || !instructionKey,
  });

  const unlockWriting = useCallback(() => {
    setWriteGate(current => (
      current.open ? current : { ...current, open: true }
    ));
  }, []);

  const stopFallback = useCallback(() => {
    if (!fallbackActiveRef.current) return;
    fallbackActiveRef.current = false;
    Speech.stop();
  }, []);

  const replay = useCallback(async ({ resetWriteGate = false } = {}) => {
    const runId = ++runRef.current;
    if (resetWriteGate) {
      setWriteGate({ key: instructionKey, token: autoPlayToken, open: !instructionKey });
    }
    if (instructionKey) targetSpeechQueueRef.current.begin({ reset: resetWriteGate });
    else targetSpeechQueueRef.current.cancel();
    setPlayback({ key: instructionKey, token: autoPlayToken, playing: Boolean(instructionKey) });
    stopFallback();
    const finishRun = ({ unlock = true, speakPending = true } = {}) => {
      if (runRef.current === runId) {
        fallbackActiveRef.current = false;
        if (unlock) unlockWriting();
        setPlayback({ key: instructionKey, token: autoPlayToken, playing: false });
        if (speakPending) targetSpeechQueueRef.current.complete();
        else targetSpeechQueueRef.current.cancel();
      }
    };
    let fallbackStarted = false;
    const startFallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      if (!fallbackText) {
        finishRun();
        return;
      }
      fallbackActiveRef.current = true;
      Speech.stop();
      try {
        Speech.speak(fallbackText, {
          ...ukSpeechOptions(),
          onDone: finishRun,
          onStopped: finishRun,
          onError: finishRun,
        });
      } catch {
        finishRun();
      }
    };
    let played;
    try {
      played = await playInstructionAudio(instructionKey, {
        onPlaybackStatus: (status) => {
          if (
            runRef.current === runId
            && hasReachedInstructionWriteThreshold(status)
          ) {
            unlockWriting();
          }
        },
        onPlaybackEnd: (reason) => {
          if (reason === 'failed') {
            // A missing/broken recording must never leave the canvas locked.
            unlockWriting();
            startFallback();
          } else if (reason === 'completed') {
            finishRun();
          }
        },
      });
    } catch {
      startFallback();
    }
    return played;
  }, [autoPlayToken, fallbackText, instructionKey, stopFallback, unlockWriting]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let timer = null;

      if (autoPlay && instructionKey) {
        timer = setTimeout(() => { if (active) replay({ resetWriteGate: true }); }, delayMs);
      }

      return () => {
        active = false;
        ++runRef.current;
        targetSpeechQueueRef.current.cancel();
        if (timer) clearTimeout(timer);
        stopInstructionAudio();
        stopFallback();
      };
      // autoPlayToken intentionally restarts/stops audio when the caller's
      // activity or attempt changes without changing the instruction key.
    }, [autoPlay, autoPlayToken, delayMs, instructionKey, replay, stopFallback]),
  );

  const instructionPlaying = Boolean(
    instructionKey && (
      (autoPlay && playback.key !== instructionKey)
      || (autoPlay && playback.token !== autoPlayToken)
      || (playback.key === instructionKey && playback.playing)
    )
  );
  const canWrite = Boolean(
    !instructionKey
    || !autoPlay
    || (
      writeGate.key === instructionKey
      && writeGate.token === autoPlayToken
      && writeGate.open
    )
  );

  // Used only by the first valid writing touch. During the final 25% it
  // remembers one callback and runs it when instruction playback ends.
  const requestTargetSpeech = useCallback((speakTarget) => {
    targetSpeechQueueRef.current.request(speakTarget);
  }, []);

  return {
    replay,
    instructionPlaying,
    instructionReady: !instructionPlaying,
    canWrite,
    requestTargetSpeech,
  };
}

// Backward-compatible convenience for screens that only need replay behavior.
export function useInstructionAudio(instructionKey, options) {
  return useInstructionAudioState(instructionKey, options).replay;
}
