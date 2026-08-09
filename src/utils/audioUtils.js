import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';

let _currentSound = null;

export async function playConceptAudio(source) {
  if (!source) return false;
  try {
    // Stop and release any currently playing sound
    if (_currentSound) {
      try { await _currentSound.stopAsync(); } catch {}
      try { await _currentSound.unloadAsync(); } catch {}
      _currentSound = null;
    }

    // Configure audio session — essential for Android speaker + iOS silent mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:       false,
      playsInSilentModeIOS:     true,
      shouldDuckAndroid:        false,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground:  false,
    });

    // Resolve the bundled asset to an on-device URI before loading
    const asset = Asset.fromModule(source);
    if (!asset.downloaded) {
      await asset.downloadAsync();
    }
    const uri = asset.localUri ?? asset.uri;

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 1.0 },
    );
    _currentSound = sound;

    // Release the sound automatically once playback finishes
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (_currentSound === sound) _currentSound = null;
      }
    });

    return true;
  } catch (e) {
    console.warn('[audioUtils] playback failed:', e?.message ?? e);
    return false;
  }
}

export function stopConceptAudio() {
  if (_currentSound) {
    _currentSound.stopAsync().catch(() => {});
    _currentSound.unloadAsync().catch(() => {});
    _currentSound = null;
  }
}
