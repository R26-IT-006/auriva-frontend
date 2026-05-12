import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const RECORDING_AUDIO_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  shouldDuckAndroid: true,
  interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  playThroughEarpieceAndroid: false,
};

export const PLAYBACK_AUDIO_MODE = {
  ...RECORDING_AUDIO_MODE,
  allowsRecordingIOS: false,
};

const PRONUNCIATION_RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 64000,
  },
};

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let output = "";
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    const triplet =
      (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    output += BASE64_ALPHABET[(triplet >> 18) & 63];
    output += BASE64_ALPHABET[(triplet >> 12) & 63];
    output += BASE64_ALPHABET[(triplet >> 6) & 63];
    output += BASE64_ALPHABET[triplet & 63];
  }

  if (index < bytes.length) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const triplet = (first << 16) | (second << 8);
    output += BASE64_ALPHABET[(triplet >> 18) & 63];
    output += BASE64_ALPHABET[(triplet >> 12) & 63];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 63] : "=";
    output += "=";
  }

  return output;
}

function getAudioMimeType(uri) {
  const lowerUri = String(uri || "").toLowerCase();
  if (lowerUri.endsWith(".m4a")) return "audio/mp4";
  if (lowerUri.endsWith(".caf")) return "audio/x-caf";
  if (lowerUri.endsWith(".wav")) return "audio/wav";
  if (lowerUri.endsWith(".3gp")) return "audio/3gpp";
  return "audio/mp4";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resetAudioSessionForRecording() {
  await Audio.setIsEnabledAsync(false).catch(() => {});
  await wait(140);
  await Audio.setIsEnabledAsync(true);
  await wait(60);
  await Audio.setAudioModeAsync(RECORDING_AUDIO_MODE);
}

export async function createRecordingWithRecovery() {
  const recordingAttempts = [
    PRONUNCIATION_RECORDING_OPTIONS,
    Audio.RecordingOptionsPresets.LOW_QUALITY,
  ];
  let lastError = null;

  for (const options of recordingAttempts) {
    try {
      await resetAudioSessionForRecording();
      return await Audio.Recording.createAsync(options);
    } catch (error) {
      lastError = error;
      Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
      await wait(160);
    }
  }

  throw lastError || new Error("Unable to prepare the audio recorder.");
}

export async function readAudioClip(uri) {
  if (!uri) return null;

  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const rawAudioBase64 = arrayBufferToBase64(buffer);
  const rawAudioSize = buffer.byteLength || null;

  if (!rawAudioBase64 || !rawAudioSize) {
    throw new Error("Recorded audio file was empty.");
  }

  return {
    rawAudioBase64,
    rawAudioMimeType: getAudioMimeType(uri),
    rawAudioSize,
  };
}
