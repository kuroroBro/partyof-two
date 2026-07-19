export const MODES = ["averages", "emojis", "in-the-mix", "out-of-the-mix", "two-words", "timeline", "in-the-mix-2"];
export const QUESTIONS = [
  { id: "p2-averages-1", mode: "averages", prompt: "How many sports were contested at the 2020 Tokyo Olympics?", answer: 33, points: 1 },
  { id: "p2-emojis-1", mode: "emojis", prompt: "Use only emojis to describe the 2020 Tokyo Olympics.", answer: "2020 Tokyo Olympics", points: 1 },
  { id: "p2-mix-1", mode: "in-the-mix", prompt: "Use three words to describe the 2020 Tokyo Olympics; opponents add one confusing word.", answer: "2020 Tokyo Olympics", points: 1 },
  { id: "p2-out-1", mode: "out-of-the-mix", prompt: "Use three words to describe the 2020 Tokyo Olympics; matching opponent words disappear.", answer: "2020 Tokyo Olympics", points: 1 },
  { id: "p2-two-words-1", mode: "two-words", prompt: "Who wrote Blink, Outliers, and The Tipping Point?", answer: "Malcolm Gladwell", answers: ["Malcolm", "Gladwell"], points: 1 },
  { id: "p2-timeline-1", mode: "timeline", prompt: "Place the start of World War II relative to the First Olympics and World War I.", answer: "1939", points: 1 },
  { id: "p2-mix-2-1", mode: "in-the-mix-2", prompt: "Use three words to describe the 2020 Tokyo Olympics; opponents add answer options.", answer: "2020 Tokyo Olympics", points: 1 },
];
export function questionsForModes(modes = MODES) { return QUESTIONS.filter(q => modes.includes(q.mode)); }
