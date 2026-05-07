import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let _currentPlayer = null;

async function _ensureAudioMode() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {}
}

// Synchronous — pauses then releases the current player immediately
function _stopCurrent() {
  if (_currentPlayer) {
    try { _currentPlayer.pause(); } catch {}
    try { _currentPlayer.remove(); } catch {}
    _currentPlayer = null;
  }
}

export async function playConceptAudio(source) {
  if (!source) return false;
  try {
    _stopCurrent(); // stop old audio synchronously before any await
    await _ensureAudioMode();

    const player = createAudioPlayer(source);
    _currentPlayer = player;
    player.play();
    return true;
  } catch {
    return false;
  }
}

export function stopConceptAudio() {
  _stopCurrent();
}
