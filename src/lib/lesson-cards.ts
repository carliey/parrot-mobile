import type { Lesson, Phrase } from '../data/lessons';

export type PhraseOption = { text: string; english: string; example?: boolean };

export function phraseOptions(text: string, english: string): PhraseOption[] {
  return text.split(' / ').map(value => {
    // Match the supplied recording and the practice tutor’s name.
    if (/^suna\s*na\s+(?:…|\.\.\.|Aku)$/i.test(value.trim())) {
      return { text: 'Suna na Aku', english: 'My name is Aku', example: true };
    }
    return { text: value.trim(), english };
  });
}

export function lessonCards(lesson: Lesson): Phrase[] {
  // These response-only cards are already taught beside the matching statement.
  return lesson.phrases.filter(phrase => !['g2', 'g7', 'i2'].includes(phrase.id));
}

export function cardContext(phrase: Phrase): string {
  const contexts: Record<string, string> = {
    g1: 'Start a greeting', g3: 'In the morning', g4: 'In the afternoon',
    g5: 'In the evening', g6: 'To a younger person', g8: 'Close warmly',
    i1: 'Ask a name', i3: 'Ask in return', i4: 'Acknowledge the introduction',
    i5: 'Say thanks', b1: 'Greet the seller', b2: 'Point to an item',
    b3: 'Recognise the price', b4: 'Ask for the item', b5: 'Either person can say thanks',
  };
  return contexts[phrase.id] ?? 'Listen and repeat';
}
