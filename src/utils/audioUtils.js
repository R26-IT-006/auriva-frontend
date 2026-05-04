import { Audio } from 'expo-av';

let _currentSound = null;

// Call once at app start (or lazily on first play) to allow audio in silent mode on iOS
async function _ensureAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:   false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid:    true,
    });
  } catch {}
}

export async function playConceptAudio(source) {
  if (!source) return false;
  try {
    await _ensureAudioMode();

    // Stop anything already playing
    if (_currentSound) {
      try { await _currentSound.stopAsync(); } catch {}
      try { await _currentSound.unloadAsync(); } catch {}
      _currentSound = null;
    }

    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
    _currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (_currentSound === sound) _currentSound = null;
      }
    });

    return true; // audio played — caller can skip TTS fallback
  } catch {
    return false; // audio failed — caller should fall back to TTS
  }
}

export async function stopConceptAudio() {
  if (_currentSound) {
    try { await _currentSound.stopAsync(); } catch {}
    try { await _currentSound.unloadAsync(); } catch {}
    _currentSound = null;
  }
}
