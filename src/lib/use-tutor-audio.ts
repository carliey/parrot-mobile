import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { RealTutor, type Session } from './practice';

const service = new RealTutor();

export function useTutorAudio() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const files = useRef(new Map<string, File>());
  const pending = useRef(new Map<string, Promise<File>>());
  const generation = useRef(0);
  const mounted = useRef(true);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    generation.current++;
    player.pause();
    setActive(null);
    setLoading(false);
  }, [player]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') stop();
    });
    const cache = files.current;
    const epoch = generation;
    return () => {
      mounted.current = false;
      epoch.current++;
      subscription.remove();
      for (const file of cache.values()) {
        try { file.delete(); } catch {}
      }
      cache.clear();
    };
  }, [stop]);

  async function play(session: Session, messageId: string, clip?: number) {
    stop();
    const ticket = generation.current;
    const key = `${session.session_id}-${messageId}`;
    setActive(messageId);
    setLoading(true);
    setError('');
    try {
      if (clip !== undefined) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (!mounted.current || ticket !== generation.current) return;
        player.replace(clip);
        player.play();
        return;
      }
      let file = files.current.get(key);
      if (!file?.exists) {
        let request = pending.current.get(key);
        if (!request) {
          request = service.speech(session, messageId).then(audio => {
            if (!mounted.current) throw new Error('Playback cancelled');
            const result = new File(Paths.cache, `parrot-tts-${key}.mp3`);
            result.write(audio.audio_base64, { encoding: 'base64' });
            files.current.set(key, result);
            return result;
          }).finally(() => pending.current.delete(key));
          pending.current.set(key, request);
        }
        file = await request;
      }
      if (!mounted.current || ticket !== generation.current) return;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!mounted.current || ticket !== generation.current) return;
      player.replace({ uri: file.uri });
      player.play();
    } catch (e) {
      if (mounted.current && ticket === generation.current) {
        setError(e instanceof Error ? e.message : 'Audio unavailable. Tap replay to try again.');
      }
    } finally {
      if (mounted.current && ticket === generation.current) setLoading(false);
    }
  }

  return { play, stop, active, loading, playing: status.playing,
    error: error || (active && status.error ? 'Could not play audio. Tap replay to try again.' : '') };
}
