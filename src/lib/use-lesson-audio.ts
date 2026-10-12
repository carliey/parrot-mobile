import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { prepareRecording } from './recorded-audio';

export function useLessonAudio() {
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const request = useRef(0);
  const source = useRef<number | null>(null);

  const stop = useCallback(() => {
    request.current += 1;
    player.pause();
    setActive(null);
    setError('');
    setPreparing(false);
  }, [player]);

  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') stop();
    });
    return () => {
      request.current += 1;
      try { player.pause(); } catch { /* The native player may already be released. */ }
      subscription.remove();
    };
  }, [player, stop]));

  async function play(clip: number) {
    const id = ++request.current;
    setError('');
    if (source.current === clip && player.playing) {
      player.pause();
      return;
    }
    player.pause();
    setActive(clip);
    setPreparing(true);
    try {
      const uri = await prepareRecording(clip);
      if (id !== request.current) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false,
        shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      if (id !== request.current) return;
      if (source.current === clip) {
        await player.seekTo(0);
      } else {
        player.replace({ uri });
        source.current = clip;
      }
      if (id === request.current) player.play();
    } catch {
      if (id === request.current) {
        setActive(null);
        setError('Could not play this recording. Tap to try again.');
      }
    } finally {
      if (id === request.current) setPreparing(false);
    }
  }

  return { play, stop, active, playing: status.playing,
    loading: active !== null && !status.error && (preparing || !status.isLoaded || status.isBuffering),
    error: error || (status.error ? 'Could not play this recording. Tap to try again.' : '') };
}
