/* eslint-disable react-hooks/refs -- callbacks run only on user press */
import { useEffect, useRef, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { isTopic, lessons } from '@/data/lessons';
import { RealTutor, type Feedback, type Session } from '@/lib/practice';

const dark = '#173B32';
const tutor = new RealTutor();
const newVoiceTurnId = () => `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
type Message = { id: string; role: 'learner' | 'tutor'; text: string };

export default function SessionScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const lesson = typeof topic === 'string' && isTopic(topic) ? lessons[topic] : null;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder);
  const [consent, setConsent] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'intro' | 'listening' | 'processing' | 'ready' | 'error' | 'finished'>('intro');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hint, setHint] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [lastTurn, setLastTurn] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => () => {
    alive.current = false;
    void recorder.stop().then(() => { if (recorder.uri) new File(recorder.uri).delete(); }).catch(() => {});
    void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, [recorder]);

  if (!lesson) return <Text>Practice topic not found.</Text>;

  async function start() {
    if (busy) return;
    setBusy(true); setStatus('processing'); setError('');
    try {
      const result = await tutor.start(lesson!.id, consent, participantId);
      if (!alive.current) return;
      setSession(result);
      setMessages([{ id: 'opening', role: 'tutor', text: result.initial_tutor_message }]);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session'); setStatus('error');
    } finally { setBusy(false); }
  }

  async function send(text = draft, id?: string) {
    id ??= `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!session || busy || !text.trim()) return;
    setBusy(true); setStatus('processing'); setError('');
    const clean = text.trim();
    setLastTurn({ id, text: clean });
    try {
      const result = await tutor.turn(session, id, clean);
      if (!alive.current) return;
      setMessages(old => [...old, { id, role: 'learner', text: clean },
        { id: `reply-${id}`, role: 'tutor', text: result.tutor_response }]);
      setDraft(''); setTurnCount(n => n + 1); setLastTurn(null); setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send turn'); setStatus('error');
    } finally { setBusy(false); }
  }

  async function toggleRecording() {
    if (busy || !session) return;
    try {
      if (recording.isRecording) {
        await recorder.stop(); setStatus('processing');
        const uri = recorder.uri;
        if (!uri) throw new Error('Recording file is unavailable. Try again.');
        const id = newVoiceTurnId();
        try {
          setBusy(true);
          const result = await tutor.transcribe(session, id, uri);
          if (!alive.current) return;
          setDraft(result.transcript);
          setBusy(false);
          await send(result.transcript, id);
        } finally {
          setBusy(false);
          try { new File(uri).delete(); } catch {}
          await setAudioModeAsync({ allowsRecording: false });
        }
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setError('Microphone permission denied. You can still type your reply.'); setStatus('error'); return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync(); recorder.record(); setStatus('listening');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording or transcription failed'); setStatus('error');
    }
  }

  async function finish() {
    if (!session || busy) return;
    setBusy(true); setStatus('processing');
    try {
      if (recording.isRecording) await recorder.stop();
      const result = await tutor.finish(session);
      if (!alive.current) return;
      setFeedback(result); setStatus('finished');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish'); setStatus('error');
    } finally { setBusy(false); }
  }

  function exit() {
    if (session && status !== 'finished') {
      Alert.alert('Leave practice?', 'This active session will be abandoned.', [
        { text: 'Keep practising', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]);
    } else router.back();
  }

  const action = (label: string, onPress: () => void, secondary = false, disabled = false) =>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={{ backgroundColor: secondary ? '#DDE8C5' : dark, borderRadius: 16, padding: 16,
        minHeight: 54, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .5 : 1 }}>
      <Text style={{ color: secondary ? dark : 'white', fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
    style={{ backgroundColor: '#F6F3EA' }} contentContainerStyle={{ padding: 24, paddingBottom: 90, gap: 16 }}>
    <Stack.Screen options={{ title: lesson.title, headerBackVisible: false,
      headerLeft: () => <Text onPress={exit} style={{ color: dark, fontWeight: '700' }}>Back</Text> }} />
    <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 1.5, color: '#6B7B69' }}>N-ATLAS + HAUSA ASR</Text>
    <Text style={{ fontSize: 32, fontWeight: '800', color: dark }}>{lesson.title}</Text>
    <Text style={{ fontSize: 16, color: '#536B5D', lineHeight: 24 }}>{lesson.scenario} {lesson.objective}</Text>

    {status === 'intro' && <>
      <View style={{ padding: 18, backgroundColor: '#FFFDF8', borderRadius: 18 }}>
        <Text style={{ color: '#536B5D' }}>Practice with the N-ATLAS tutor. You can speak a reply or type one.</Text>
      </View>
      <TextInput value={participantId} onChangeText={setParticipantId} placeholder="Tester code (optional, e.g. P01)"
        placeholderTextColor="#88978C" maxLength={80} accessibilityLabel="Tester code"
        style={{ backgroundColor: 'white', borderRadius: 16, padding: 17, color: dark, fontSize: 16 }} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)}
        style={{ padding: 18, backgroundColor: '#FFFDF8', borderRadius: 16 }}>
        <Text style={{ color: dark, fontWeight: '700' }}>{consent ? '☑' : '☐'} Allow my text transcript in local validation export</Text>
        <Text style={{ color: '#536B5D', marginTop: 5 }}>Optional. Only consenting sessions are exported; audio is deleted after transcription.</Text>
      </Pressable>
      {action('Start practice', () => void start())}
    </>}

    {session && status !== 'finished' && <>
      <View style={{ gap: 12 }}>{messages.map(m =>
        <View key={m.id} style={{ alignSelf: m.role === 'learner' ? 'flex-end' : 'flex-start', maxWidth: '88%',
          backgroundColor: m.role === 'learner' ? '#DDE8C5' : 'white', borderRadius: 18, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#65806E', marginBottom: 5 }}>
            {m.role === 'learner' ? 'YOU' : 'TUTOR'}
          </Text>
          <Text style={{ fontSize: 17, color: dark, lineHeight: 24 }}>{m.text}</Text>
        </View>)}</View>
      <Text style={{ color: '#667C6D' }}>Turn {turnCount} of about 4–6 · You can end early</Text>
      {hint && <View style={{ padding: 15, backgroundColor: '#FFFDF8', borderRadius: 15 }}>
        <Text style={{ color: dark }}>Try: {lesson.phrases[Math.min(turnCount, lesson.phrases.length - 1)].hausa} — {lesson.phrases[Math.min(turnCount, lesson.phrases.length - 1)].english}</Text>
      </View>}
      {action(hint ? 'Hide hint' : 'Show a hint', () => setHint(!hint), true)}
      <TextInput value={draft} onChangeText={setDraft} placeholder="Type a Hausa reply" placeholderTextColor="#88978C"
        multiline maxLength={500} accessibilityLabel="Your Hausa reply"
        style={{ backgroundColor: 'white', borderRadius: 16, padding: 17, color: dark, fontSize: 17, minHeight: 65 }} />
      {action('Send reply', () => void send(), false, status === 'processing' || status === 'listening' || !draft.trim())}
      {action(recording.isRecording ? 'Stop recording' : 'Tap to record', () => void toggleRecording(), true, status === 'processing')}
      <Text style={{ fontSize: 13, color: '#7A806F' }}>Your recording is sent to the local Hausa ASR, then its transcript is sent to N-ATLAS. Audio is deleted after transcription.</Text>
      {action('End practice', () => void finish(), true, status === 'processing' || status === 'listening')}
      {action('Leave practice', exit, true)}
    </>}

    {status === 'listening' && <Text style={{ color: '#B34B36', fontWeight: '700' }}>
      Listening… {Math.round(recording.durationMillis / 1000)}s
    </Text>}
    {status === 'processing' && <Text style={{ color: '#536B5D' }}>Processing…</Text>}
    {!!error && <View style={{ backgroundColor: '#FDECE6', padding: 16, borderRadius: 14, gap: 10 }}>
      <Text style={{ color: '#853A27' }}>{error}</Text>
      {lastTurn && action('Retry failed reply', () => void send(lastTurn.text, lastTurn.id), true)}
      {!session && action('Retry starting', () => void start(), true)}
    </View>}
    {feedback && <View style={{ gap: 13 }}>
      <Text style={{ fontSize: 25, fontWeight: '800', color: dark }}>Practice summary</Text>
      <Text style={{ color: '#536B5D', lineHeight: 23 }}>{feedback.message}</Text>
      {feedback.tasks_completed.map((task, i) => <Text key={i} style={{ color: dark }}>✓ {task}</Text>)}
      {feedback.corrections.map((c, i) => <Text key={i} style={{ color: dark }}>
        {c.original} → {c.suggested}: {c.explanation}
      </Text>)}
      {action('Practise again', () => {
        setSession(null); setFeedback(null); setMessages([]); setTurnCount(0); setStatus('intro');
      })}
      {action('Return to Learn', () => router.replace('/'), true)}
    </View>}
  </ScrollView>;
}
