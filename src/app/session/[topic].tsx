import { useEffect, useRef, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isTopic, lessons } from "@/data/lessons";
import { RealTutor, type Feedback, type Session } from "@/lib/practice";
import { HoldRecorder, type RecordingPhase } from "@/lib/hold-recorder";

const tutor = new RealTutor();
const turnId = () =>
  `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
type Message = { id: string; role: "learner" | "tutor"; text: string };
const colors = {
  ink: "#173B32",
  muted: "#768279",
  paper: "#F6F3EA",
  lime: "#DDE8C5",
  line: "#E3E6DB",
  red: "#A94232",
};

function Microphone({ active = false }: { active?: boolean }) {
  const color = active ? "#FFFDF8" : colors.ink;
  return (
    <View accessible={false} style={s.micIcon}>
      <View style={[s.micCapsule, { backgroundColor: color }]} />
      <View style={[s.micCup, { borderColor: color }]} />
      <View style={[s.micStem, { backgroundColor: color }]} />
    </View>
  );
}

export default function SessionScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const lesson =
    typeof topic === "string" && isTopic(topic) ? lessons[topic] : null;
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder, 100);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("");
  const [voice, setVoice] = useState<RecordingPhase>("idle");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hint, setHint] = useState(false);
  const [validation, setValidation] = useState(false);
  const [consent, setConsent] = useState(false);
  const [participantId, setParticipantId] = useState("");
  const [lastTurn, setLastTurn] = useState<{ id: string; text: string } | null>(
    null,
  );
  const controller = useRef<HoldRecorder | null>(null);
  const submitAudio = useRef<(uri: string) => Promise<void>>(async () => {});
  const alive = useRef(true);
  const locked = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const turns = messages.filter((m) => m.role === "learner").length;
  const blocked = busy || voice !== "idle";

  useEffect(() => {
    alive.current = true;
    const capture = new HoldRecorder({
      prepare: async () => {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Microphone access is off. Enable it in Settings, or type a reply below.",
          );
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
      },
      record: () => recorder.record({ forDuration: 29 }),
      stop: async () => {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        return recorder.uri;
      },
      cleanup: async (uri) => {
        try {
          if (uri) new File(uri).delete();
        } catch {}
        await setAudioModeAsync({ allowsRecording: false });
      },
      submit: (uri) => submitAudio.current(uri),
      phaseChanged: setVoice,
      error: setError,
    });
    controller.current = capture;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void capture.release(false);
    });
    return () => {
      alive.current = false;
      capture.dispose();
      subscription.remove();
      controller.current = null;
    };
  }, [recorder]);

  // Sending a transcript and sending typed text share the same retry and bubble handling.
  async function submitText(text: string, id: string) {
    if (!session) return;
    const clean = text.trim();
    setLastTurn({ id, text: clean });
    setMessages((old) =>
      old.some((m) => m.id === id)
        ? old
        : [...old, { id, role: "learner", text: clean }],
    );
    setActivity("Your tutor is replying…");
    const result = await tutor.turn(session, id, clean);
    if (!alive.current) return;
    setMessages((old) => [
      ...old.filter((m) => m.id !== `reply-${id}`),
      { id: `reply-${id}`, role: "tutor", text: result.tutor_response },
    ]);
    setDraft("");
    setLastTurn(null);
  }

  useEffect(() => {
    submitAudio.current = async (uri) => {
      if (!session || locked.current) return;
      locked.current = true;
      setBusy(true);
      setError("");
      setActivity("Listening to your reply…");
      try {
        const id = turnId();
        const result = await tutor.transcribe(session, id, uri);
        if (alive.current) await submitText(result.transcript, id);
      } catch (e) {
        if (alive.current)
          setError(
            e instanceof Error
              ? e.message
              : "Could not send your recording. Please try again.",
          );
      } finally {
        locked.current = false;
        if (alive.current) {
          setBusy(false);
          setActivity("");
        }
      }
    };
  });

  async function start() {
    if (!lesson || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await tutor.start(lesson.id, consent, participantId);
      if (!alive.current) return;
      setSession(result);
      setMessages([
        { id: "opening", role: "tutor", text: result.initial_tutor_message },
      ]);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Could not start practice.");
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function send(text = draft, id = turnId()) {
    if (!session || locked.current || voice !== "idle" || !text.trim()) return;
    Keyboard.dismiss();
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await submitText(text, id);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Could not send your reply.");
    } finally {
      locked.current = false;
      if (alive.current) {
        setBusy(false);
        setActivity("");
      }
    }
  }

  async function finish() {
    if (!session || locked.current || voice !== "idle") return;
    locked.current = true;
    setBusy(true);
    setError("");
    setActivity("Preparing your practice notes…");
    Keyboard.dismiss();
    try {
      const result = await tutor.finish(session);
      if (alive.current) setFeedback(result);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Could not finish practice.");
    } finally {
      locked.current = false;
      if (alive.current) {
        setBusy(false);
        setActivity("");
      }
    }
  }

  function exit() {
    void controller.current?.release(false);
    if (session && !feedback)
      Alert.alert("Leave practice?", "Your conversation will end here.", [
        { text: "Keep practising", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]);
    else router.back();
  }

  if (!lesson) return <Text>Practice topic not found.</Text>;
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={exit}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Leave practice"
        >
          <Text style={s.backArrow}>‹</Text>
        </Pressable>
        <View style={s.headerTitle}>
          <Text style={s.eyebrow}>HAUSA PRACTICE</Text>
          <Text style={s.title}>{lesson.title}</Text>
        </View>
        {!!session && !feedback && (
          <Pressable
            onPress={() => void finish()}
            disabled={blocked}
            accessibilityRole="button"
            style={[s.end, blocked && s.disabled]}
          >
            <Text style={s.endText}>Finish</Text>
          </Pressable>
        )}
        {!session && (
          <View style={s.languageTag}>
            <Text style={s.languageText}>HA</Text>
          </View>
        )}
      </View>

      <ScrollView
        ref={scroll}
        style={s.conversation}
        contentContainerStyle={s.messages}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (session) scroll.current?.scrollToEnd({ animated: true });
        }}
      >
        {!session && (
          <>
            <View style={s.introArt}>
              <Text style={s.introWord}>Sannu.</Text>
              <View style={s.introTag}>
                <Text style={s.introTagText}>
                  A little conversation goes a long way.
                </Text>
              </View>
            </View>
            <Text style={s.hero}>Let’s talk.</Text>
            <Text style={s.introCopy}>
              {lesson.scenario} {lesson.objective}
            </Text>
            <View style={s.instruction}>
              <Microphone />
              <View style={s.flex}>
                <Text style={s.instructionTitle}>Hold. Speak. Release.</Text>
                <Text style={s.small}>
                  Hold the microphone while you speak. Release it to send your
                  reply.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setValidation(!validation)}
              accessibilityRole="button"
              accessibilityState={{ expanded: validation }}
              style={s.validationToggle}
            >
              <Text style={s.small}>Taking part in user testing?</Text>
              <Text style={s.small}>{validation ? "−" : "+"}</Text>
            </Pressable>
            {validation && (
              <View style={s.validationCard}>
                <TextInput
                  value={participantId}
                  onChangeText={setParticipantId}
                  maxLength={80}
                  placeholder="Tester code, e.g. P01"
                  placeholderTextColor={colors.muted}
                  style={s.testerInput}
                  accessibilityLabel="Tester code"
                />
                <Pressable
                  onPress={() => setConsent(!consent)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consent }}
                  style={s.consent}
                >
                  <Text style={s.check}>{consent ? "☑" : "☐"}</Text>
                  <Text style={[s.small, s.flex]}>
                    Allow my text conversation to be included in the project’s
                    testing results. Optional; recordings are deleted.
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {!!session && (
          <>
            <View style={s.sessionNote}>
              <View style={s.dot} />
              <Text style={s.noteText}>A little Hausa, every day</Text>
            </View>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[s.messageRow, m.role === "learner" && s.learnerRow]}
              >
                {m.role === "tutor" && (
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>P</Text>
                  </View>
                )}
                <View
                  style={[
                    s.bubble,
                    m.role === "learner" ? s.learnerBubble : s.tutorBubble,
                  ]}
                >
                  <Text
                    style={[
                      s.speaker,
                      m.role === "learner" && s.learnerSpeaker,
                    ]}
                  >
                    {m.role === "learner" ? "YOU" : "PARROT"}
                  </Text>
                  <Text
                    selectable
                    style={[
                      s.messageText,
                      m.role === "learner" && s.learnerText,
                    ]}
                  >
                    {m.text}
                  </Text>
                </View>
              </View>
            ))}
            {!!activity && (
              <View style={s.activity} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors.ink} />
                <Text style={s.small}>{activity}</Text>
              </View>
            )}
          </>
        )}
        {!!error && (
          <View style={s.error} accessibilityLiveRegion="polite">
            <Text style={s.errorText}>{error}</Text>
            {lastTurn && (
              <Pressable
                disabled={blocked}
                onPress={() => void send(lastTurn.text, lastTurn.id)}
                style={s.retry}
              >
                <Text style={s.retryText}>Retry reply ↗</Text>
              </Pressable>
            )}
          </View>
        )}
        {!!feedback && (
          <View style={s.summary}>
            <Text style={s.eyebrow}>PRACTICE COMPLETE</Text>
            <Text style={s.summaryTitle}>
              A little better,{"\n"}every conversation.
            </Text>
            <Text style={s.small}>{feedback.message}</Text>
            {feedback.tasks_completed.map((task, i) => (
              <Text key={i} style={s.task}>
                ✓ {task}
              </Text>
            ))}
            {feedback.corrections.map((c, i) => (
              <Text key={i} style={s.small}>
                {c.original} → {c.suggested}
                {"\n"}
                {c.explanation}
              </Text>
            ))}
            <Pressable
              onPress={() => {
                setSession(null);
                setMessages([]);
                setFeedback(null);
                setError("");
                setLastTurn(null);
                setDraft("");
              }}
              style={s.primary}
            >
              <Text style={s.primaryText}>Practise again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {!feedback && (
        <View
          style={[s.composer, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          {!session ? (
            <Pressable
              onPress={() => void start()}
              disabled={busy}
              style={[s.primary, busy && s.disabled]}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.primaryText}>Start conversation ↗</Text>
              )}
            </Pressable>
          ) : (
            <>
              {hint && (
                <View style={s.hint}>
                  <Text style={s.hintLabel}>TRY SAYING</Text>
                  <Text style={s.hintPhrase}>
                    {
                      lesson.phrases[Math.min(turns, lesson.phrases.length - 1)]
                        .hausa
                    }
                  </Text>
                  <Text style={s.small}>
                    {
                      lesson.phrases[Math.min(turns, lesson.phrases.length - 1)]
                        .english
                    }
                  </Text>
                </View>
              )}
              <View style={s.composerTop}>
                <Pressable
                  onPress={() => setHint(!hint)}
                  style={s.hintButton}
                  accessibilityRole="button"
                >
                  <Text style={s.hintButtonText}>
                    {hint ? "− Hide hint" : "+ Need a hint?"}
                  </Text>
                </Pressable>
                <Text style={s.turns}>
                  {turns} {turns === 1 ? "reply" : "replies"}
                </Text>
              </View>
              <View style={s.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Or type your reply…"
                  placeholderTextColor={colors.muted}
                  editable={!blocked}
                  multiline
                  maxLength={500}
                  style={s.input}
                  accessibilityLabel="Your Hausa reply"
                />
                <Pressable
                  onPress={() => void send()}
                  disabled={blocked || !draft.trim()}
                  style={[s.send, (blocked || !draft.trim()) && s.sendDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Send reply"
                >
                  <Text style={s.sendArrow}>↑</Text>
                </Pressable>
              </View>
              <Pressable
                onPressIn={() => {
                  if (!busy) {
                    Keyboard.dismiss();
                    setError("");
                    void controller.current?.hold();
                  }
                }}
                onPressOut={() => {
                  void controller.current?.release();
                }}
                disabled={busy || voice === "sending"}
                accessibilityRole="button"
                accessibilityLabel="Hold to speak"
                accessibilityHint="Keep pressing while speaking. Release to send. You can also type your reply."
                style={[
                  s.holdButton,
                  voice === "recording" && s.holdActive,
                  (busy || voice === "sending") && s.disabled,
                ]}
              >
                {busy || voice === "sending" || voice === "preparing" ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Microphone active={voice === "recording"} />
                )}
                <View>
                  <Text style={[s.holdTitle, voice === "recording" && s.white]}>
                    {voice === "recording"
                      ? "Release to send"
                      : voice === "preparing"
                        ? "Getting ready…"
                        : busy || voice === "sending"
                          ? "Sending your reply…"
                          : "Hold to speak"}
                  </Text>
                  <Text
                    style={[
                      s.holdCaption,
                      voice === "recording" && s.activeCaption,
                    ]}
                  >
                    {voice === "recording"
                      ? `Recording · ${(recording.durationMillis / 1000).toFixed(1)}s / 28s`
                      : "Speak in Hausa · up to 15 seconds"}
                  </Text>
                </View>
                {voice === "recording" && <View style={s.recordDot} />}
              </Pressable>
            </>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  white: { color: "#FFFDF8" },
  disabled: { opacity: 0.5 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  back: {
    width: 42,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#EAEDE2",
  },
  backArrow: { fontSize: 36, color: colors.ink, lineHeight: 38 },
  headerTitle: { flex: 1, gap: 3 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.muted,
  },
  title: { fontSize: 21, fontWeight: "700", color: colors.ink },
  end: { padding: 12 },
  endText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  languageTag: {
    borderWidth: 1,
    borderColor: "#CFD9C8",
    borderRadius: 20,
    padding: 10,
  },
  languageText: { fontSize: 12, fontWeight: "700", color: colors.ink },
  conversation: { flex: 1 },
  messages: { padding: 22, gap: 20, paddingBottom: 28 },
  sessionNote: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#92A775" },
  noteText: { fontSize: 11, color: colors.muted, letterSpacing: 0.6 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingRight: 26,
  },
  learnerRow: { justifyContent: "flex-end", paddingRight: 0, paddingLeft: 40 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  bubble: { flexShrink: 1, padding: 18, borderRadius: 22, gap: 7 },
  tutorBubble: {
    backgroundColor: "#FFFDF8",
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: "#ECEDE4",
  },
  learnerBubble: { backgroundColor: colors.ink, borderBottomRightRadius: 5 },
  speaker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#7A8C75",
  },
  learnerSpeaker: { color: "#ACC7A4" },
  messageText: { fontSize: 18, lineHeight: 27, color: colors.ink },
  learnerText: { color: "#F6F3EA" },
  activity: {
    flexDirection: "row",
    gap: 10,
    paddingLeft: 36,
    alignItems: "center",
  },
  small: { fontSize: 13, lineHeight: 20, color: colors.muted },
  composer: {
    backgroundColor: "#FFFDF8",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  composerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hintButton: { paddingVertical: 5 },
  hintButtonText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  turns: { color: colors.muted, fontSize: 11 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F2EB",
    borderRadius: 18,
    padding: 6,
    paddingLeft: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.ink,
    maxHeight: 95,
    minHeight: 40,
    paddingVertical: 8,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  sendDisabled: { backgroundColor: "#BAC6B2" },
  sendArrow: { color: "white", fontSize: 24, fontWeight: "600" },
  holdButton: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 15,
  },
  holdActive: { backgroundColor: colors.ink },
  holdTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  holdCaption: { fontSize: 11, color: "#6B7C60", marginTop: 3 },
  activeCaption: { color: "#BCD3AC" },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D4E98C",
  },
  micIcon: { width: 24, height: 30, alignItems: "center" },
  micCapsule: { width: 10, height: 17, borderRadius: 7 },
  micCup: {
    position: "absolute",
    top: 9,
    width: 20,
    height: 15,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 2,
    borderTopWidth: 0,
  },
  micStem: { position: "absolute", top: 24, width: 2, height: 6 },
  hint: { backgroundColor: "#F1F4E6", borderRadius: 16, padding: 14, gap: 3 },
  hintLabel: {
    color: "#84936D",
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  hintPhrase: { fontSize: 17, fontWeight: "600", color: colors.ink },
  introArt: {
    marginTop: 16,
    height: 142,
    borderRadius: 28,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-2deg" }],
  },
  introWord: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 58,
    color: colors.ink,
    letterSpacing: -3,
  },
  introTag: {
    backgroundColor: "#F5F6E7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    transform: [{ rotate: "2deg" }],
  },
  introTagText: { fontSize: 10, color: "#5A6E50" },
  hero: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 38,
    letterSpacing: -1,
    color: colors.ink,
    marginTop: 10,
  },
  introCopy: { fontSize: 16, lineHeight: 25, color: "#677765", marginTop: -10 },
  instruction: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    paddingVertical: 10,
  },
  instructionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 5,
  },
  validationToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  validationCard: { gap: 12 },
  testerInput: {
    backgroundColor: "#FFFDF8",
    padding: 14,
    borderRadius: 12,
    color: colors.ink,
  },
  consent: { flexDirection: "row", gap: 10 },
  check: { fontSize: 21, color: colors.ink },
  primary: {
    minHeight: 58,
    borderRadius: 19,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  primaryText: { fontSize: 16, fontWeight: "700", color: "white" },
  error: { backgroundColor: "#FAEDE7", borderRadius: 16, padding: 16, gap: 10 },
  errorText: { color: colors.red, fontSize: 13, lineHeight: 20 },
  retry: { paddingVertical: 5 },
  retryText: { color: colors.red, fontWeight: "700", fontSize: 13 },
  summary: {
    backgroundColor: "#E8EED9",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  summaryTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 28,
    color: colors.ink,
    lineHeight: 35,
  },
  task: { color: colors.ink, fontSize: 15 },
});
