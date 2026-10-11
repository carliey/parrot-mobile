import { ScrollView, Text, View } from "react-native";
import { TopicCard } from "@/components/topic-card";
import { topics } from "@/data/lessons";
export default function Practice() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: "#F6F3EA" }}
      contentContainerStyle={{
        padding: 24,
        paddingTop: 64,
        paddingBottom: 120,
        gap: 16,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          letterSpacing: 2,
          color: "#60796E",
        }}
      >
        SPEAK WITH CONFIDENCE
      </Text>
      <Text style={{ fontSize: 42, fontWeight: "800", color: "#173B32" }}>
        Practice
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: "#577064",
          lineHeight: 24,
          marginBottom: 12,
        }}
      >
        Practise one lesson, or put all three together in a shop conversation.
        You can begin whenever you feel ready.
      </Text>
      {topics.map((lesson) => (
        <TopicCard key={lesson.id} lesson={lesson} kind="session" />
      ))}
      <View
        style={{ padding: 18, borderRadius: 16, backgroundColor: "#E6EEE5" }}
      >
        <Text style={{ color: "#3C5F51", lineHeight: 21 }}>
          Practice connects to the N-ATLAS tutor. Spoken replies use the
          official Hausa ASR model.
        </Text>
      </View>
    </ScrollView>
  );
}
