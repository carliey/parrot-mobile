// Content is generated from parrot-backend/app/lesson_plans.json.
// After editing the source, run: python3 parrot-backend/sync_lessons.py
import content from './lesson-plans.json';

export type TopicId = 'greetings' | 'introductions' | 'buying-things' | 'general-practice';
export type Phrase = {
  id: string;
  hausa: string;
  english: string;
  response: string;
  responseEnglish: string;
  note?: string;
};
export type Lesson = {
  id: TopicId;
  title: string;
  description: string;
  scenario: string;
  objective: string;
  color: string;
  icon: string;
  mode: 'guided' | 'mixed';
  cultural_notes: string[];
  phrases: Phrase[];
};
export const LESSON_VERSION = content.version;
export const LANGUAGE_REVIEW = content.language_review;
function lessonFor(id: TopicId): Lesson {
  const lesson = content.lessons.find(value => value.id === id);
  if (!lesson) throw new Error(`Missing lesson: ${id}`);
  return { ...lesson, id, mode: lesson.mode === 'mixed' ? 'mixed' : 'guided', phrases: lesson.vocabulary };
}
export const lessons: Record<TopicId, Lesson> = {
  greetings: lessonFor('greetings'),
  introductions: lessonFor('introductions'),
  'buying-things': lessonFor('buying-things'),
  'general-practice': lessonFor('general-practice'),
};
export const topics = Object.values(lessons);
export function isTopic(value: string): value is TopicId {
  return Object.hasOwn(lessons, value);
}
