import { useEffect, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { isTopic, lessons } from "@/data/lessons";
import { isLessonComplete, setLessonComplete } from "@/lib/progress";
const button = {
  backgroundColor: "#173B32",
  padding: 17,
  borderRadius: 16,
  alignItems: "center" as const,
  minHeight: 54,
};
export default function LessonScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const valid = typeof topic === "string" && isTopic(topic);
  const lesson = valid ? lessons[topic] : null;
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (lesson)
      isLessonComplete(lesson.id)
        .then(setComplete)
        .catch(() => {});
  }, [lesson]);
  if (!lesson) return <Text>Lesson not found.</Text>;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: "#F6F3EA" }}
      contentContainerStyle={{ padding: 24, paddingBottom: 80, gap: 16 }}
    >
      <Stack.Screen options={{ title: lesson.title }} />
      <Text style={{ color: "#60796E", fontWeight: "700" }}>
        LESSON • DRAFT CONTENT
      </Text>
      <Text style={{ fontSize: 32, fontWeight: "800", color: "#173B32" }}>
        {lesson.title}
      </Text>
      <Text style={{ fontSize: 16, color: "#577064" }}>
        {lesson.description}
      </Text>
      {lesson.phrases.map((p, i) => (
        <View
          key={p.id}
          style={{
            backgroundColor: "#FFFDF8",
            padding: 22,
            borderRadius: 22,
            gap: 7,
          }}
        >
          <Text style={{ color: "#6A8474", fontWeight: "700" }}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <Text style={{ fontSize: 25, fontWeight: "700", color: "#173B32" }}>
            {p.hausa}
          </Text>
          <Text style={{ fontSize: 16, color: "#3D5A4D" }}>{p.english}</Text>
          <Text style={{ color: "#7A746B" }}>Say it: {p.pronunciation}</Text>
          <Text style={{ color: "#3D5A4D" }}>
            Reply: {p.response} · {p.responseEnglish}
          </Text>
          {p.note && <Text style={{ color: "#7A746B" }}>{p.note}</Text>}
          <Text style={{ color: "#8A8379", fontSize: 13 }}>
            Audio example unavailable until reviewed recording or TTS is added.
          </Text>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        style={button}
        onPress={async () => {
          await setLessonComplete(lesson.id, !complete);
          setComplete(!complete);
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {complete ? "Completed ✓ · Tap to undo" : "Mark lesson completed"}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={[button, { backgroundColor: "#DDE8C5" }]}
        onPress={() => router.push(`/session/${lesson.id}`)}
      >
        <Text style={{ color: "#173B32", fontWeight: "700" }}>
          Practise this topic →
        </Text>
      </Pressable>
    </ScrollView>
  );
}
