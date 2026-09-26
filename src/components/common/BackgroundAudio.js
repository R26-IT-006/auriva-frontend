import { useEffect } from "react";
import { Audio } from "expo-av";

const BACKGROUND_AUDIO_ASSET = require("../../../assets/bg-music.wav");

export function BackgroundAudio() {
  useEffect(() => {
    let mounted = true;
    let bgSound = null;

    async function startBackgroundAudio() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          BACKGROUND_AUDIO_ASSET,
          {
            isLooping: true,
            shouldPlay: true,
            volume: 0.16,
          },
        );

        if (!mounted) {
          await sound.unloadAsync();
          return;
        }

        bgSound = sound;
      } catch (error) {
        console.log("Background audio playback error:", error);
      }
    }

    startBackgroundAudio();

    return () => {
      mounted = false;
      if (bgSound) {
        bgSound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  return null;
}
