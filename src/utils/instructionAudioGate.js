export const INSTRUCTION_WRITE_UNLOCK_RATIO = 0.75;

/**
 * True once real playback has reached the writable portion of an instruction.
 * Unknown/invalid durations deliberately remain locked until playback either
 * completes or reports a failure, where the lifecycle hook unlocks safely.
 */
export function hasReachedInstructionWriteThreshold(status) {
  if (!status?.isLoaded) return false;
  const durationMillis = Number(status.durationMillis);
  const positionMillis = Number(status.positionMillis);
  if (!Number.isFinite(durationMillis) || durationMillis <= 0) return false;
  if (!Number.isFinite(positionMillis) || positionMillis < 0) return false;
  return positionMillis >= durationMillis * INSTRUCTION_WRITE_UNLOCK_RATIO;
}

/** A one-item queue prevents target TTS from overlapping fixed instructions. */
export function createInstructionTargetSpeechQueue() {
  let instructionPlaying = false;
  let pending = null;

  return {
    begin({ reset = false } = {}) {
      instructionPlaying = true;
      if (reset) pending = null;
    },
    request(speakTarget) {
      if (typeof speakTarget !== 'function') return;
      if (instructionPlaying) {
        if (!pending) pending = speakTarget;
      } else {
        speakTarget();
      }
    },
    complete() {
      instructionPlaying = false;
      const speakTarget = pending;
      pending = null;
      if (speakTarget) {
        try { speakTarget(); } catch {}
      }
    },
    cancel() {
      instructionPlaying = false;
      pending = null;
    },
  };
}
