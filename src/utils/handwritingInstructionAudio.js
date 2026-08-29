import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import { getHandwritingInstructionAudio } from '../constants/handwritingInstructionAudio';

let currentPlayback = null;
let latestRequest = 0;
let operationQueue = Promise.resolve();

async function releaseSound(sound) {
  if (!sound) return;
  try { await sound.stopAsync(); } catch {}
  try { await sound.unloadAsync(); } catch {}
}

async function releasePlayback(playback, reason) {
  if (!playback) return;
  await releaseSound(playback.sound);
  playback.finish(reason);
}

function enqueue(operation) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => {});
  return result;
}

/**
 * Plays one bundled bilingual instruction from its beginning. Calls are
 * serialized, so rapid replays cannot create overlapping Audio.Sound objects.
 *
 * @returns {Promise<boolean|null>} true when started, false on a real playback
 * failure, or null when a newer play/stop request superseded this request.
 */
export function playInstructionAudio(
  instructionKey,
  { onPlaybackEnd, onPlaybackStatus } = {},
) {
  const requestId = ++latestRequest;
  let ended = false;
  const finish = (reason) => {
    if (ended) return;
    ended = true;
    try { onPlaybackEnd?.(reason); } catch {}
  };

  return enqueue(async () => {
    if (currentPlayback) {
      const previous = currentPlayback;
      currentPlayback = null;
      await releasePlayback(previous, 'superseded');
    }

    if (requestId !== latestRequest) {
      finish('superseded');
      return null;
    }

    const source = getHandwritingInstructionAudio(instructionKey);
    if (!source) {
      finish('failed');
      return false;
    }

    let sound = null;
    try {
      const asset = Asset.fromModule(source);
      if (!asset.downloaded) await asset.downloadAsync();
      if (requestId !== latestRequest) {
        finish('superseded');
        return null;
      }

      ({ sound } = await Audio.Sound.createAsync(
        { uri: asset.localUri ?? asset.uri },
        { shouldPlay: false, volume: 1.0 },
      ));

      if (requestId !== latestRequest) {
        await releaseSound(sound);
        finish('superseded');
        return null;
      }

      const playback = { sound, finish };
      currentPlayback = playback;
      sound.setOnPlaybackStatusUpdate((status) => {
        try { onPlaybackStatus?.(status); } catch {}
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (currentPlayback === playback) currentPlayback = null;
          finish('completed');
        } else if (!status.isLoaded && status.error) {
          if (currentPlayback === playback) currentPlayback = null;
          releaseSound(sound).catch(() => {});
          finish('failed');
        }
      });
      await sound.playAsync();
      return true;
    } catch (error) {
      if (sound) {
        if (currentPlayback?.sound === sound) currentPlayback = null;
        await releaseSound(sound);
      }
      finish('failed');
      console.warn('[handwritingInstructionAudio] playback failed:', error?.message ?? error);
      return false;
    }
  });
}

/** Stops and releases the active fixed-instruction recording, if any. */
export function stopInstructionAudio() {
  ++latestRequest;
  return enqueue(async () => {
    const playback = currentPlayback;
    currentPlayback = null;
    await releasePlayback(playback, 'stopped');
  });
}
