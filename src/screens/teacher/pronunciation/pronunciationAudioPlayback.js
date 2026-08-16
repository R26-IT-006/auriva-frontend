import { Asset } from "expo-asset";
import { Audio } from "expo-av";

export const PRONUNCIATION_PLAYBACK_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
};

export async function setPronunciationPlaybackMode() {
  await Audio.setAudioModeAsync(PRONUNCIATION_PLAYBACK_AUDIO_MODE);
}

export async function getPlayableAudioSource(audioAsset) {
  const resolvedAsset = Asset.fromModule(audioAsset);
  await resolvedAsset.downloadAsync();

  return resolvedAsset.localUri ? { uri: resolvedAsset.localUri } : audioAsset;
}

export async function unloadSoundRef(soundRef) {
  if (!soundRef.current) return;

  await soundRef.current.unloadAsync().catch(() => {});
  soundRef.current = null;
}
