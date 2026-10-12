import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isTopic, lessons, type Lesson } from "@/data/lessons";
import { audioFor } from "@/data/lesson-audio";
import {
  cardContext,
  lessonCards,
  phraseOptions,
  type PhraseOption,
} from "@/lib/lesson-cards";
import { useLessonAudio } from "@/lib/use-lesson-audio";
import { prepareRecording } from "@/lib/recorded-audio";
import { isLessonComplete, setLessonComplete } from "@/lib/progress";

const ink = "#173B32";
type Playback = ReturnType<typeof useLessonAudio>;
const subscribeToClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => Platform.OS !== "web";

export function generateStaticParams() {
  return Object.keys(lessons).map((topic) => ({ topic }));
}

function PhrasePanel({
  options,
  response = false,
  playback,
}: {
  options: PhraseOption[];
  response?: boolean;
  playback: Playback;
}) {
  const [selected, setSelected] = useState(0);
  const option = options[selected];
  const clip = audioFor(option.text);
  useEffect(() => {
    if (clip !== undefined) {
      // Prepare the visible phrase and response while the learner reads the card.
      void prepareRecording(clip).catch(() => {
        // A tap retries preparation and displays any failure through the player.
      });
    }
  }, [clip]);
  const active = clip !== undefined && playback.active === clip;
  const playing = active && playback.playing;
  return (
    <View style={[s.panel, response && s.responsePanel]}>
      <Text style={[s.label, response && s.responseLabel]}>
        {response ? "THE RESPONSE" : "THE PHRASE"}
      </Text>
      {options.length > 1 && (
        <View style={s.options}>
          {options.map((item, index) => (
            <Pressable
              key={item.text}
              accessibilityRole="button"
              accessibilityLabel={`Show ${item.text}`}
              accessibilityState={{ selected: selected === index }}
              onPress={() => {
                playback.stop();
                setSelected(index);
              }}
              style={[
                s.option,
                response && s.responseOption,
                selected === index && s.selectedOption,
              ]}
            >
              <Text
                style={[
                  s.optionText,
                  response && s.responseOptionText,
                  selected === index && s.selectedOptionText,
                ]}
              >
                {item.text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text selectable style={[s.phrase, response && s.responsePhrase]}>
        {option.text}
      </Text>
      <Text style={[s.translation, response && s.responseTranslation]}>
        {option.english}
      </Text>
      {option.example && (
        <Text style={[s.example, response && s.responseTranslation]}>
          Example name: Aku. Try your own name next.
        </Text>
      )}
      {clip !== undefined ? (
        <Pressable
          onPress={() => void playback.play(clip)}
          accessibilityRole="button"
          accessibilityLabel={`${playing ? "Pause" : "Play"} ${option.text}`}
          accessibilityHint="Listen to the recorded pronunciation. Tap again to pause."
          style={({ pressed }) => [
            s.listen,
            response && s.responseListen,
            pressed && s.pressed,
          ]}
        >
          {active && playback.loading ? (
            <ActivityIndicator color={response ? ink : "#F4F7DC"} />
          ) : (
            <Text style={[s.playIcon, response && s.responseListenText]}>
              {playing ? "Ⅱ" : "▶"}
            </Text>
          )}
          <Text style={[s.listenText, response && s.responseListenText]}>
            {playing ? "Pause" : "Listen"}
          </Text>
        </Pressable>
      ) : (
        <Text style={[s.noAudio, response && s.responseTranslation]}>
          Recording coming soon
        </Text>
      )}
    </View>
  );
}

function LessonDeck({ lesson }: { lesson: Lesson }) {
  const insets = useSafeAreaInsets();
  const cards = lessonCards(lesson);
  const [index, setIndex] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const playback = useLessonAudio();
  const card = cards[index];
  const last = index === cards.length - 1;

  useEffect(() => {
    alive.current = true;
    isLessonComplete(lesson.id)
      .then((value) => {
        if (alive.current) setComplete(value);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, [lesson.id]);

  function move(next: number) {
    playback.stop();
    setIndex(next);
    setNoteOpen(false);
    setAboutOpen(false);
    setError("");
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function next() {
    if (saving) return;
    if (!last) {
      move(index + 1);
      return;
    }
    playback.stop();
    setSaving(true);
    try {
      await setLessonComplete(lesson.id, true);
      if (alive.current) {
        setComplete(true);
        setFinished(true);
      }
    } catch {
      if (alive.current)
        setError("Could not save your progress. Please try again.");
    } finally {
      if (alive.current) setSaving(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => {
            playback.stop();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Back to lessons"
          style={s.backButton}
        >
          <Text style={s.backIcon}>‹</Text>
        </Pressable>
        <View style={s.headerTitle}>
          <Text style={s.kicker}>LEARN HAUSA</Text>
          <Text style={s.title}>{lesson.title}</Text>
        </View>
        <Pressable
          onPress={() => setAboutOpen(!aboutOpen)}
          accessibilityRole="button"
          accessibilityLabel="About this lesson"
          accessibilityState={{ expanded: aboutOpen }}
          style={s.aboutButton}
        >
          <Text style={s.aboutIcon}>i</Text>
        </Pressable>
      </View>
      <View
        style={s.progressRow}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: cards.length,
          now: finished ? cards.length : index + 1,
        }}
      >
        {cards.map((item, i) => (
          <View
            key={item.id}
            style={[
              s.progressPart,
              (finished || i <= index) && s.progressFilled,
            ]}
          />
        ))}
      </View>
      <ScrollView
        ref={scroll}
        style={s.scroll}
        contentContainerStyle={s.content}
      >
        {aboutOpen && (
          <View style={s.aboutCard}>
            <Text style={s.noteHeading}>Your lesson</Text>
            <Text style={s.noteText}>{lesson.objective}</Text>
            {lesson.cultural_notes.map((note) => (
              <Text key={note} style={s.noteText}>
                {note}
              </Text>
            ))}
          </View>
        )}
        {finished ? (
          <View style={s.finishCard}>
            <View style={s.finishMark}>
              <Text style={s.finishCheck}>✓</Text>
            </View>
            <Text style={s.finishEyebrow}>LESSON COMPLETE</Text>
            <Text style={s.finishTitle}>
              A little Hausa.{"\n"}A little more confidence.
            </Text>
            <Text style={s.finishCopy}>
              You’ve explored {cards.length} short exchanges. Try using them in
              a conversation.
            </Text>
            <Pressable
              onPress={() => {
                setFinished(false);
                move(0);
              }}
              accessibilityRole="button"
              style={s.reviewButton}
            >
              <Text style={s.reviewText}>Listen again ↺</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.cardHeading}>
              <Text style={s.context}>{cardContext(card)}</Text>
              <Text style={s.counter}>
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(cards.length).padStart(2, "0")}
              </Text>
            </View>
            <View style={s.exchange} key={card.id}>
              <PhrasePanel
                options={phraseOptions(card.hausa, card.english)}
                playback={playback}
              />
              {!!card.response && (
                <PhrasePanel
                  options={phraseOptions(card.response, card.responseEnglish)}
                  response
                  playback={playback}
                />
              )}
            </View>
            <Text style={s.listenTip}>Listen once. Then say it out loud.</Text>
            {!!card.note && (
              <View style={s.note}>
                <Pressable
                  onPress={() => setNoteOpen(!noteOpen)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: noteOpen }}
                  style={s.noteToggle}
                >
                  <Text style={s.noteHeading}>When to use it</Text>
                  <Text style={s.noteHeading}>{noteOpen ? "−" : "+"}</Text>
                </Pressable>
                {noteOpen && <Text style={s.noteText}>{card.note}</Text>}
              </View>
            )}
          </>
        )}
        {!!(error || playback.error) && (
          <Text accessibilityRole="alert" style={s.error}>
            {error || playback.error}
          </Text>
        )}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        {finished ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              playback.stop();
              router.replace(`/session/${lesson.id}`);
            }}
            style={[s.next, { flex: 0 }]}
          >
            <Text style={s.nextText}>Practise this lesson ↗</Text>
          </Pressable>
        ) : (
          <View style={s.navigation}>
            <Pressable
              onPress={() => move(index - 1)}
              disabled={index === 0 || saving}
              accessibilityRole="button"
              accessibilityLabel="Previous card"
              style={[s.previous, (index === 0 || saving) && s.disabled]}
            >
              <Text style={s.previousText}>← Back</Text>
            </Pressable>
            <Pressable
              onPress={() => void next()}
              disabled={saving}
              accessibilityRole="button"
              style={[s.next, saving && s.disabled]}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.nextText}>
                  {last ? "Finish lesson ✓" : "Next card →"}
                </Text>
              )}
            </Pressable>
          </View>
        )}
        {complete && !finished && (
          <Text style={s.reviewBadge}>Previously completed · reviewing</Text>
        )}
      </View>
    </View>
  );
}

export default function LessonScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  // Expo's web audio player creates an HTML Audio element, which needs a browser.
  const ready = useSyncExternalStore(
    subscribeToClient,
    clientSnapshot,
    serverSnapshot,
  );
  if (typeof topic !== "string" || !isTopic(topic))
    return <Text>Lesson not found.</Text>;
  if (!ready)
    return (
      <View style={[s.screen, { justifyContent: "center" }]}>
        <ActivityIndicator color={ink} accessibilityLabel="Loading lesson" />
      </View>
    );
  return <LessonDeck key={topic} lesson={lessons[topic]} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F3EA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  backButton: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#EAEBDD",
  },
  backIcon: { color: ink, fontSize: 38, lineHeight: 42 },
  headerTitle: { flex: 1 },
  kicker: {
    color: "#738275",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: { color: ink, fontSize: 23, fontWeight: "700", marginTop: 3 },
  aboutButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  aboutIcon: {
    color: ink,
    fontSize: 19,
    borderWidth: 1,
    borderColor: "#9BA998",
    borderRadius: 13,
    width: 26,
    height: 26,
    textAlign: "center",
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    gap: 5,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  progressPart: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DFE2D5",
  },
  progressFilled: { backgroundColor: "#729267" },
  scroll: { flex: 1 },
  content: {
    padding: 24,
    paddingTop: 14,
    gap: 16,
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
  },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  context: { color: "#577064", fontSize: 14, fontWeight: "600", flex: 1 },
  counter: {
    color: "#7B877A",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  exchange: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCE2D2",
  },
  panel: { backgroundColor: ink, padding: 26, gap: 14 },
  responsePanel: { backgroundColor: "#E5ECD9" },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: "#C3D4B9",
  },
  responseLabel: { color: "#607757" },
  phrase: {
    fontSize: 38,
    lineHeight: 46,
    fontWeight: "600",
    color: "#FFFDF3",
    letterSpacing: -1,
  },
  responsePhrase: { color: ink, fontSize: 30, lineHeight: 38 },
  translation: { color: "#D2DDCE", fontSize: 17, lineHeight: 24 },
  responseTranslation: { color: "#536B4E" },
  example: { color: "#D2DDCE", fontSize: 12, lineHeight: 18 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#57756A",
    justifyContent: "center",
  },
  responseOption: { borderColor: "#B3C5A5" },
  selectedOption: { backgroundColor: "#DDE8C5", borderColor: "#DDE8C5" },
  optionText: { color: "#DAE4D2", fontSize: 12, fontWeight: "600" },
  responseOptionText: { color: "#536B4E" },
  selectedOptionText: { color: ink },
  listen: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: "#35584A",
    minHeight: 48,
    minWidth: 116,
  },
  responseListen: { backgroundColor: "#D2DFC3" },
  playIcon: { fontSize: 15, color: "#F4F7DC" },
  listenText: { fontSize: 14, fontWeight: "700", color: "#F4F7DC" },
  responseListenText: { color: ink },
  pressed: { opacity: 0.75 },
  noAudio: { color: "#C3D4B9", fontSize: 12, lineHeight: 18 },
  listenTip: {
    fontSize: 13,
    color: "#75816F",
    textAlign: "center",
    lineHeight: 20,
  },
  note: { borderTopWidth: 1, borderTopColor: "#E0E4D7" },
  noteToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48,
  },
  noteHeading: { color: "#496544", fontWeight: "600", fontSize: 14 },
  noteText: { color: "#63775E", fontSize: 14, lineHeight: 22 },
  aboutCard: {
    backgroundColor: "#ECEEDF",
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  footer: {
    paddingTop: 14,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "#E1E4D8",
    gap: 10,
    backgroundColor: "#F6F3EA",
  },
  navigation: { flexDirection: "row", alignItems: "center", gap: 14 },
  previous: { minHeight: 56, paddingHorizontal: 14, justifyContent: "center" },
  previousText: { color: ink, fontSize: 15, fontWeight: "600" },
  next: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ink,
  },
  nextText: { color: "#FFFDF3", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.35 },
  reviewBadge: { color: "#738275", fontSize: 11, textAlign: "center" },
  error: { color: "#A94232", fontSize: 14, lineHeight: 21 },
  finishCard: { alignItems: "center", paddingVertical: 32, gap: 24 },
  finishMark: {
    backgroundColor: "#DDE8C5",
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-6deg" }],
  },
  finishCheck: { color: ink, fontSize: 40 },
  finishEyebrow: {
    color: "#718268",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  finishTitle: {
    color: ink,
    fontSize: 34,
    lineHeight: 42,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: -1,
  },
  finishCopy: {
    color: "#657660",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 290,
  },
  reviewButton: { minHeight: 48, justifyContent: "center", padding: 12 },
  reviewText: { color: ink, fontSize: 15, fontWeight: "600" },
});
