import { File, Paths } from "expo-file-system";
import type { TopicId } from "@/data/lessons";
const key = (topic: TopicId) => `lesson-complete:${topic}`;
const progressFile = () => new File(Paths.document, "lesson-progress.json");
async function read(): Promise<Record<string, boolean>> {
  if (process.env.EXPO_OS === "web") {
    try {
      return JSON.parse(localStorage.getItem("parrot-progress") ?? "{}");
    } catch {
      return {};
    }
  }
  const file = progressFile();
  if (!file.exists) return {};
  try {
    return JSON.parse(await file.text());
  } catch {
    return {};
  }
}
export async function isLessonComplete(topic: TopicId) {
  return Boolean((await read())[key(topic)]);
}
export async function setLessonComplete(topic: TopicId, complete: boolean) {
  const state = { ...(await read()), [key(topic)]: complete };
  if (process.env.EXPO_OS === "web")
    localStorage.setItem("parrot-progress", JSON.stringify(state));
  else progressFile().write(JSON.stringify(state));
}
