import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { ukSpeechOptions } from '../constants/speechLocale';
import { playInstructionAudio, stopInstructionAudio } from './handwritingInstructionAudio';

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
  const [playback, setPlayback] = useState({
    key: instructionKey,
    token: autoPlayToken,
    playing: Boolean(autoPlay && instructionKey),
  });

  const stopFallback = useCallback(() => {
    if (!fallbackActiveRef.current) return;
    fallbackActiveRef.current = false;
    Speech.stop();
  }, []);

  const replay = useCallback(async () => {
    const runId = ++runRef.current;
    setPlayback({ key: instructionKey, token: autoPlayToken, playing: Boolean(instructionKey) });
    stopFallback();
    const finishRun = () => {
      if (runRef.current === runId) {
        fallbackActiveRef.current = false;
        setPlayback({ key: instructionKey, token: autoPlayToken, playing: false });
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
        onPlaybackEnd: (reason) => {
          if (reason === 'failed') startFallback();
          else finishRun();
        },
      });
    } catch {
      startFallback();
    }
    return played;
  }, [autoPlayToken, fallbackText, instructionKey, stopFallback]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let timer = null;

      if (autoPlay && instructionKey) {
        timer = setTimeout(() => { if (active) replay(); }, delayMs);
      }

      return () => {
        active = false;
        ++runRef.current;
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

  return { replay, instructionPlaying, instructionReady: !instructionPlaying };
}

// Backward-compatible convenience for screens that only need replay behavior.
export function useInstructionAudio(instructionKey, options) {
  return useInstructionAudioState(instructionKey, options).replay;
}
