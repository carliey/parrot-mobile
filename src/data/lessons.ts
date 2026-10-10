export type TopicId = 'greetings' | 'buying-things';
export type Phrase = { id: string; hausa: string; english: string; pronunciation: string; response: string; responseEnglish: string; note?: string };
export type Lesson = { id: TopicId; title: string; description: string; scenario: string; objective: string; color: string; icon: string; phrases: Phrase[] };
export const LESSON_VERSION = 'draft-1';
export const LANGUAGE_REVIEW = 'pending';
export const lessons: Record<TopicId, Lesson> = {
  greetings: {
    id: 'greetings', title: 'Greetings', description: 'Start a warm conversation and introduce yourself.',
    scenario: 'You are meeting someone for the first time.', objective: 'Greet them, answer a greeting, and say your name.', color: '#DDE8C5', icon: '✳',
    phrases: [
      {id:'g1',hausa:'Sannu',english:'Hello',pronunciation:'SAHN-noo (draft guide)',response:'Sannu',responseEnglish:'Hello',note:'A common greeting.'},
      {id:'g2',hausa:'Yaya kake?',english:'How are you? (to a man)',pronunciation:'YAH-yah KAH-keh (draft guide)',response:'Lafiya lau',responseEnglish:'I am well',note:'Use “Yaya kike?” when addressing a woman.'},
      {id:'g3',hausa:'Lafiya lau',english:'I am well',pronunciation:'lah-FEE-yah low (draft guide)',response:'Alhamdulillahi',responseEnglish:'Thanks be to God'},
      {id:'g4',hausa:'Sunana Amina',english:'My name is Amina',pronunciation:'soo-NAH-nah ah-MEE-nah (draft guide)',response:'Na ji daɗi',responseEnglish:'Nice to meet you',note:'Replace Amina with your name.'},
    ],
  },
  'buying-things': {
    id:'buying-things',title:'Buying Things',description:'Ask for everyday items at a market.',scenario:'You are speaking with a seller at a small market.',objective:'Greet the seller, ask for an item, ask its price, and respond.',color:'#F7D7BF',icon:'◈',
    phrases:[
      {id:'b1',hausa:'Sannu',english:'Hello',pronunciation:'SAHN-noo (draft guide)',response:'Sannu',responseEnglish:'Hello'},
      {id:'b2',hausa:'Ina son ruwa',english:'I want water',pronunciation:'EE-nah sohn ROO-wah (draft guide)',response:'Ga ruwa',responseEnglish:'Here is water'},
      {id:'b3',hausa:'Nawa ne?',english:'How much is it?',pronunciation:'NAH-wah neh (draft guide)',response:'Naira ɗari biyu',responseEnglish:'Two hundred naira',note:'In this scenario water costs ₦200, bread ₦500, and bananas ₦300.'},
      {id:'b4',hausa:'Na gode',english:'Thank you',pronunciation:'nah GOH-deh (draft guide)',response:'Ba komai',responseEnglish:'You are welcome'},
    ],
  },
};
export const topics = Object.values(lessons);
export function isTopic(value: string): value is TopicId { return value === 'greetings' || value === 'buying-things'; }
