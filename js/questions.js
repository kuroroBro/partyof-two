export const MODES = ["averages", "emojis", "in-the-mix", "out-of-the-mix", "two-words", "timeline", "in-the-mix-2"];

// 15 distinct questions per mode. startGame() in game.js shuffles and
// draws `questionsPerRound` of these per selected mode instead of
// cloning a single question -- with only one question per mode, every
// round in a show used to be the exact same prompt repeated.
export const QUESTIONS = [
  // averages: both partners privately guess a number; they score if the
  // AVERAGE of their two guesses lands on the true answer.
  { id: "p2-averages-1", mode: "averages", prompt: "How many U.S. states are there?", answer: 50, points: 1 },
  { id: "p2-averages-2", mode: "averages", prompt: "How many continents are there on Earth?", answer: 7, points: 1 },
  { id: "p2-averages-3", mode: "averages", prompt: "How many strings does a standard guitar have?", answer: 6, points: 1 },
  { id: "p2-averages-4", mode: "averages", prompt: "How many bones are in the adult human body?", answer: 206, points: 1 },
  { id: "p2-averages-5", mode: "averages", prompt: "How many minutes are in a full day?", answer: 1440, points: 1 },
  { id: "p2-averages-6", mode: "averages", prompt: "How many Grand Slam tennis tournaments are there each year?", answer: 4, points: 1 },
  { id: "p2-averages-7", mode: "averages", prompt: "How many keys are on a standard piano?", answer: 88, points: 1 },
  { id: "p2-averages-8", mode: "averages", prompt: "How many countries are in South America?", answer: 12, points: 1 },
  { id: "p2-averages-9", mode: "averages", prompt: "How many books are in the main Harry Potter series?", answer: 7, points: 1 },
  { id: "p2-averages-10", mode: "averages", prompt: "How many rings are on the Olympic flag?", answer: 5, points: 1 },
  { id: "p2-averages-11", mode: "averages", prompt: "How many time zones does the contiguous United States span?", answer: 4, points: 1 },
  { id: "p2-averages-12", mode: "averages", prompt: "How many Wonders of the Ancient World were there?", answer: 7, points: 1 },
  { id: "p2-averages-13", mode: "averages", prompt: "How many players are on a basketball team on the court at once?", answer: 5, points: 1 },
  { id: "p2-averages-14", mode: "averages", prompt: "How many strings does a standard violin have?", answer: 4, points: 1 },
  { id: "p2-averages-15", mode: "averages", prompt: "How many degrees are in a right angle?", answer: 90, points: 1 },

  // two-words: partners split a two-word answer between them, each
  // privately submitting one word, hoping together they land on both.
  { id: "p2-two-words-1", mode: "two-words", prompt: "Who directed Jurassic Park?", answer: "Steven Spielberg", answers: ["Steven", "Spielberg"], points: 1 },
  { id: "p2-two-words-2", mode: "two-words", prompt: "Who wrote Romeo and Juliet?", answer: "William Shakespeare", answers: ["William", "Shakespeare"], points: 1 },
  { id: "p2-two-words-3", mode: "two-words", prompt: "Who is the founder of Tesla and SpaceX?", answer: "Elon Musk", answers: ["Elon", "Musk"], points: 1 },
  { id: "p2-two-words-4", mode: "two-words", prompt: "Who was the first person to walk on the Moon?", answer: "Neil Armstrong", answers: ["Neil", "Armstrong"], points: 1 },
  { id: "p2-two-words-5", mode: "two-words", prompt: "Who wrote the Twilight series?", answer: "Stephenie Meyer", answers: ["Stephenie", "Meyer"], points: 1 },
  { id: "p2-two-words-6", mode: "two-words", prompt: "Who is the lead singer of Coldplay?", answer: "Chris Martin", answers: ["Chris", "Martin"], points: 1 },
  { id: "p2-two-words-7", mode: "two-words", prompt: "What coffee shop do the Friends characters hang out at?", answer: "Central Perk", answers: ["Central", "Perk"], points: 1 },
  { id: "p2-two-words-8", mode: "two-words", prompt: "What 1993 movie is set on the dinosaur island Isla Nublar?", answer: "Jurassic Park", answers: ["Jurassic", "Park"], points: 1 },
  { id: "p2-two-words-9", mode: "two-words", prompt: "What Pixar movie is about toys that come to life?", answer: "Toy Story", answers: ["Toy", "Story"], points: 1 },
  { id: "p2-two-words-10", mode: "two-words", prompt: "What is Tony Stark's superhero name?", answer: "Iron Man", answers: ["Iron", "Man"], points: 1 },
  { id: "p2-two-words-11", mode: "two-words", prompt: "What Christmas movie features a boy named Kevin McCallister?", answer: "Home Alone", answers: ["Home", "Alone"], points: 1 },
  { id: "p2-two-words-12", mode: "two-words", prompt: "Who wrote Pride and Prejudice?", answer: "Jane Austen", answers: ["Jane", "Austen"], points: 1 },
  { id: "p2-two-words-13", mode: "two-words", prompt: "Who is the physicist famous for the equation E=mc²?", answer: "Albert Einstein", answers: ["Albert", "Einstein"], points: 1 },
  { id: "p2-two-words-14", mode: "two-words", prompt: "Who wore jersey number 23 for the Chicago Bulls?", answer: "Michael Jordan", answers: ["Michael", "Jordan"], points: 1 },
  { id: "p2-two-words-15", mode: "two-words", prompt: "Who is known as the \"King of Pop\"?", answer: "Michael Jackson", answers: ["Michael", "Jackson"], points: 1 },

  // emojis: mouth the clue with emojis only -- guess the well-known thing.
  { id: "p2-emojis-1", mode: "emojis", prompt: "Use only emojis to describe the movie Titanic.", answer: "Titanic", points: 1 },
  { id: "p2-emojis-2", mode: "emojis", prompt: "Use only emojis to describe the movie Finding Nemo.", answer: "Finding Nemo", accepted: ["Nemo"], points: 1 },
  { id: "p2-emojis-3", mode: "emojis", prompt: "Use only emojis to describe the movie The Lion King.", answer: "The Lion King", accepted: ["Lion King"], points: 1 },
  { id: "p2-emojis-4", mode: "emojis", prompt: "Use only emojis to describe the movie Frozen.", answer: "Frozen", points: 1 },
  { id: "p2-emojis-5", mode: "emojis", prompt: "Use only emojis to describe Harry Potter.", answer: "Harry Potter", points: 1 },
  { id: "p2-emojis-6", mode: "emojis", prompt: "Use only emojis to describe Star Wars.", answer: "Star Wars", points: 1 },
  { id: "p2-emojis-7", mode: "emojis", prompt: "Use only emojis to describe the movie Jurassic Park.", answer: "Jurassic Park", points: 1 },
  { id: "p2-emojis-8", mode: "emojis", prompt: "Use only emojis to describe The Avengers.", answer: "The Avengers", accepted: ["Avengers"], points: 1 },
  { id: "p2-emojis-9", mode: "emojis", prompt: "Use only emojis to describe the movie Home Alone.", answer: "Home Alone", points: 1 },
  { id: "p2-emojis-10", mode: "emojis", prompt: "Use only emojis to describe the movie Toy Story.", answer: "Toy Story", points: 1 },
  { id: "p2-emojis-11", mode: "emojis", prompt: "Use only emojis to describe the movie Moana.", answer: "Moana", points: 1 },
  { id: "p2-emojis-12", mode: "emojis", prompt: "Use only emojis to describe Shark Week.", answer: "Shark Week", points: 1 },
  { id: "p2-emojis-13", mode: "emojis", prompt: "Use only emojis to describe Christmas.", answer: "Christmas", points: 1 },
  { id: "p2-emojis-14", mode: "emojis", prompt: "Use only emojis to describe Halloween.", answer: "Halloween", points: 1 },
  { id: "p2-emojis-15", mode: "emojis", prompt: "Use only emojis to describe Valentine's Day.", answer: "Valentine's Day", accepted: ["Valentines Day", "Valentine's"], points: 1 },

  // in-the-mix: describe the thing in three words; opponents mix in one
  // confusing word before the reveal.
  { id: "p2-mix-1", mode: "in-the-mix", prompt: "In the Mix card 1: describe the secret subject with three one-word clues.", answer: "Pizza", points: 1 },
  { id: "p2-mix-2", mode: "in-the-mix", prompt: "In the Mix card 2: describe the secret subject with three one-word clues.", answer: "The Beach", accepted: ["Beach"], points: 1 },
  { id: "p2-mix-3", mode: "in-the-mix", prompt: "In the Mix card 3: describe the secret subject with three one-word clues.", answer: "Christmas Morning", points: 1 },
  { id: "p2-mix-4", mode: "in-the-mix", prompt: "In the Mix card 4: describe the secret subject with three one-word clues.", answer: "A Rainy Day", accepted: ["Rainy Day"], points: 1 },
  { id: "p2-mix-5", mode: "in-the-mix", prompt: "In the Mix card 5: describe the secret subject with three one-word clues.", answer: "Summer Vacation", points: 1 },
  { id: "p2-mix-6", mode: "in-the-mix", prompt: "In the Mix card 6: describe the secret subject with three one-word clues.", answer: "New Year's Eve", accepted: ["New Years Eve"], points: 1 },
  { id: "p2-mix-7", mode: "in-the-mix", prompt: "In the Mix card 7: describe the secret subject with three one-word clues.", answer: "A Road Trip", accepted: ["Road Trip"], points: 1 },
  { id: "p2-mix-8", mode: "in-the-mix", prompt: "In the Mix card 8: describe the secret subject with three one-word clues.", answer: "Grandma's House", accepted: ["Grandmas House"], points: 1 },
  { id: "p2-mix-9", mode: "in-the-mix", prompt: "In the Mix card 9: describe the secret subject with three one-word clues.", answer: "The Gym", accepted: ["Gym"], points: 1 },
  { id: "p2-mix-10", mode: "in-the-mix", prompt: "In the Mix card 10: describe the secret subject with three one-word clues.", answer: "A Wedding", accepted: ["Wedding"], points: 1 },
  { id: "p2-mix-11", mode: "in-the-mix", prompt: "In the Mix card 11: describe the secret subject with three one-word clues.", answer: "Monday Mornings", points: 1 },
  { id: "p2-mix-12", mode: "in-the-mix", prompt: "In the Mix card 12: describe the secret subject with three one-word clues.", answer: "A Rock Concert", accepted: ["Rock Concert"], points: 1 },
  { id: "p2-mix-13", mode: "in-the-mix", prompt: "In the Mix card 13: describe the secret subject with three one-word clues.", answer: "The Dentist", accepted: ["Dentist"], points: 1 },
  { id: "p2-mix-14", mode: "in-the-mix", prompt: "In the Mix card 14: describe the secret subject with three one-word clues.", answer: "A Camping Trip", accepted: ["Camping Trip"], points: 1 },
  { id: "p2-mix-15", mode: "in-the-mix", prompt: "In the Mix card 15: describe the secret subject with three one-word clues.", answer: "Black Friday", points: 1 },

  // out-of-the-mix: describe the thing in three words; opponents guess
  // blind and any match is removed before the reveal.
  { id: "p2-out-1", mode: "out-of-the-mix", prompt: "Out of the Mix card 1: describe the secret subject with three one-word clues.", answer: "A Birthday Party", accepted: ["Birthday Party"], points: 1 },
  { id: "p2-out-2", mode: "out-of-the-mix", prompt: "Out of the Mix card 2: describe the secret subject with three one-word clues.", answer: "Winter", points: 1 },
  { id: "p2-out-3", mode: "out-of-the-mix", prompt: "Out of the Mix card 3: describe the secret subject with three one-word clues.", answer: "Coffee", points: 1 },
  { id: "p2-out-4", mode: "out-of-the-mix", prompt: "Out of the Mix card 4: describe the secret subject with three one-word clues.", answer: "A Long Flight", accepted: ["Long Flight"], points: 1 },
  { id: "p2-out-5", mode: "out-of-the-mix", prompt: "Out of the Mix card 5: describe the secret subject with three one-word clues.", answer: "The First Day of School", accepted: ["First Day of School"], points: 1 },
  { id: "p2-out-6", mode: "out-of-the-mix", prompt: "Out of the Mix card 6: describe the secret subject with three one-word clues.", answer: "A Thunderstorm", accepted: ["Thunderstorm"], points: 1 },
  { id: "p2-out-7", mode: "out-of-the-mix", prompt: "Out of the Mix card 7: describe the secret subject with three one-word clues.", answer: "Fast Food", points: 1 },
  { id: "p2-out-8", mode: "out-of-the-mix", prompt: "Out of the Mix card 8: describe the secret subject with three one-word clues.", answer: "A Video Game", accepted: ["Video Game"], points: 1 },
  { id: "p2-out-9", mode: "out-of-the-mix", prompt: "Out of the Mix card 9: describe the secret subject with three one-word clues.", answer: "The Ocean", accepted: ["Ocean"], points: 1 },
  { id: "p2-out-10", mode: "out-of-the-mix", prompt: "Out of the Mix card 10: describe the secret subject with three one-word clues.", answer: "A Music Festival", accepted: ["Music Festival"], points: 1 },
  { id: "p2-out-11", mode: "out-of-the-mix", prompt: "Out of the Mix card 11: describe the secret subject with three one-word clues.", answer: "Homework", points: 1 },
  { id: "p2-out-12", mode: "out-of-the-mix", prompt: "Out of the Mix card 12: describe the secret subject with three one-word clues.", answer: "A Football Game", accepted: ["Football Game"], points: 1 },
  { id: "p2-out-13", mode: "out-of-the-mix", prompt: "Out of the Mix card 13: describe the secret subject with three one-word clues.", answer: "A Garage Sale", accepted: ["Garage Sale"], points: 1 },
  { id: "p2-out-14", mode: "out-of-the-mix", prompt: "Out of the Mix card 14: describe the secret subject with three one-word clues.", answer: "The Library", accepted: ["Library"], points: 1 },
  { id: "p2-out-15", mode: "out-of-the-mix", prompt: "Out of the Mix card 15: describe the secret subject with three one-word clues.", answer: "A Snow Day", accepted: ["Snow Day"], points: 1 },

  // timeline: a reference event with a known year, plus two mystery
  // events whose real years are hidden -- the pair arranges all three
  // in chronological order (see game.js's timelineOrder/redaction).
  { id: "p2-timeline-1", mode: "timeline", prompt: "Timeline card 1: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "World War II begins", year: 1939 }, events: [{ id: "e1", label: "The first iPhone is released", year: 2007 }, { id: "e2", label: "The Berlin Wall falls", year: 1989 }], points: 1 },
  { id: "p2-timeline-2", mode: "timeline", prompt: "Timeline card 2: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The first Moon landing", year: 1969 }, events: [{ id: "e1", label: "Google is founded", year: 1998 }, { id: "e2", label: "World War I begins", year: 1914 }], points: 1 },
  { id: "p2-timeline-3", mode: "timeline", prompt: "Timeline card 3: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The Titanic sinks", year: 1912 }, events: [{ id: "e1", label: "The first modern Olympic Games are held", year: 1896 }, { id: "e2", label: "Facebook is founded", year: 2004 }], points: 1 },
  { id: "p2-timeline-4", mode: "timeline", prompt: "Timeline card 4: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The first Star Wars film is released", year: 1977 }, events: [{ id: "e1", label: "The Chernobyl nuclear disaster occurs", year: 1986 }, { id: "e2", label: "Queen Elizabeth II's reign begins", year: 1952 }], points: 1 },
  { id: "p2-timeline-5", mode: "timeline", prompt: "Timeline card 5: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The U.S. Declaration of Independence is signed", year: 1776 }, events: [{ id: "e1", label: "The French Revolution begins", year: 1789 }, { id: "e2", label: "The Wright brothers' first powered flight", year: 1903 }], points: 1 },
  { id: "p2-timeline-6", mode: "timeline", prompt: "Timeline card 6: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The Berlin Wall falls", year: 1989 }, events: [{ id: "e1", label: "The Soviet Union dissolves", year: 1991 }, { id: "e2", label: "World War II ends", year: 1945 }], points: 1 },
  { id: "p2-timeline-7", mode: "timeline", prompt: "Timeline card 7: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The first iPhone is released", year: 2007 }, events: [{ id: "e1", label: "YouTube is founded", year: 2005 }, { id: "e2", label: "The first iPad is released", year: 2010 }], points: 1 },
  { id: "p2-timeline-8", mode: "timeline", prompt: "Timeline card 8: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "World War I ends", year: 1918 }, events: [{ id: "e1", label: "The Russian Revolution", year: 1917 }, { id: "e2", label: "The Wall Street Crash", year: 1929 }], points: 1 },
  { id: "p2-timeline-9", mode: "timeline", prompt: "Timeline card 9: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The first modern Olympic Games are held", year: 1896 }, events: [{ id: "e1", label: "The Wright brothers' first powered flight", year: 1903 }, { id: "e2", label: "World War I begins", year: 1914 }], points: 1 },
  { id: "p2-timeline-10", mode: "timeline", prompt: "Timeline card 10: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The first Harry Potter book is published", year: 1997 }, events: [{ id: "e1", label: "Twitter is founded", year: 2006 }, { id: "e2", label: "The first iPhone is released", year: 2007 }], points: 1 },
  { id: "p2-timeline-11", mode: "timeline", prompt: "Timeline card 11: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The movie Titanic (starring Leonardo DiCaprio) is released", year: 1997 }, events: [{ id: "e1", label: "Toy Story is released", year: 1995 }, { id: "e2", label: "Jurassic Park is released", year: 1993 }], points: 1 },
  { id: "p2-timeline-12", mode: "timeline", prompt: "Timeline card 12: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The United Nations is founded", year: 1945 }, events: [{ id: "e1", label: "NASA is founded", year: 1958 }, { id: "e2", label: "The Berlin Wall is built", year: 1961 }], points: 1 },
  { id: "p2-timeline-13", mode: "timeline", prompt: "Timeline card 13: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The first successful human heart transplant", year: 1967 }, events: [{ id: "e1", label: "The first Moon landing", year: 1969 }, { id: "e2", label: "The Watergate scandal breaks", year: 1972 }], points: 1 },
  { id: "p2-timeline-14", mode: "timeline", prompt: "Timeline card 14: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The World Wide Web is invented", year: 1989 }, events: [{ id: "e1", label: "Amazon.com is founded", year: 1994 }, { id: "e2", label: "Google is founded", year: 1998 }], points: 1 },
  { id: "p2-timeline-15", mode: "timeline", prompt: "Timeline card 15: place these three events in chronological order -- earliest first.", reference: { id: "ref", label: "The fall of the Western Roman Empire", year: 476 }, events: [{ id: "e1", label: "The signing of the Magna Carta", year: 1215 }, { id: "e2", label: "Columbus reaches the Americas", year: 1492 }], points: 1 },

  // in-the-mix-2: describe the thing in three words; opponents each add
  // one decoy multiple-choice option, and the guesser taps an answer.
  { id: "p2-mix-2-1", mode: "in-the-mix-2", prompt: "In the Mix 2 card 1: describe the secret subject with three one-word clues.", answer: "A Rock Band", accepted: ["Rock Band"], points: 1 },
  { id: "p2-mix-2-2", mode: "in-the-mix-2", prompt: "In the Mix 2 card 2: describe the secret subject with three one-word clues.", answer: "The Airport", accepted: ["Airport"], points: 1 },
  { id: "p2-mix-2-3", mode: "in-the-mix-2", prompt: "In the Mix 2 card 3: describe the secret subject with three one-word clues.", answer: "A Job Interview", accepted: ["Job Interview"], points: 1 },
  { id: "p2-mix-2-4", mode: "in-the-mix-2", prompt: "In the Mix 2 card 4: describe the secret subject with three one-word clues.", answer: "Grandma's Cooking", accepted: ["Grandmas Cooking"], points: 1 },
  { id: "p2-mix-2-5", mode: "in-the-mix-2", prompt: "In the Mix 2 card 5: describe the secret subject with three one-word clues.", answer: "A Horror Movie", accepted: ["Horror Movie"], points: 1 },
  { id: "p2-mix-2-6", mode: "in-the-mix-2", prompt: "In the Mix 2 card 6: describe the secret subject with three one-word clues.", answer: "The Zoo", accepted: ["Zoo"], points: 1 },
  { id: "p2-mix-2-7", mode: "in-the-mix-2", prompt: "In the Mix 2 card 7: describe the secret subject with three one-word clues.", answer: "A Wedding Toast", accepted: ["Wedding Toast"], points: 1 },
  { id: "p2-mix-2-8", mode: "in-the-mix-2", prompt: "In the Mix 2 card 8: describe the secret subject with three one-word clues.", answer: "Rush Hour Traffic", points: 1 },
  { id: "p2-mix-2-9", mode: "in-the-mix-2", prompt: "In the Mix 2 card 9: describe the secret subject with three one-word clues.", answer: "A Karaoke Night", accepted: ["Karaoke Night"], points: 1 },
  { id: "p2-mix-2-10", mode: "in-the-mix-2", prompt: "In the Mix 2 card 10: describe the secret subject with three one-word clues.", answer: "The First Snow", accepted: ["First Snow"], points: 1 },
  { id: "p2-mix-2-11", mode: "in-the-mix-2", prompt: "In the Mix 2 card 11: describe the secret subject with three one-word clues.", answer: "A Family Reunion", accepted: ["Family Reunion"], points: 1 },
  { id: "p2-mix-2-12", mode: "in-the-mix-2", prompt: "In the Mix 2 card 12: describe the secret subject with three one-word clues.", answer: "Exam Week", points: 1 },
  { id: "p2-mix-2-13", mode: "in-the-mix-2", prompt: "In the Mix 2 card 13: describe the secret subject with three one-word clues.", answer: "A Road Trip Playlist", accepted: ["Road Trip Playlist"], points: 1 },
  { id: "p2-mix-2-14", mode: "in-the-mix-2", prompt: "In the Mix 2 card 14: describe the secret subject with three one-word clues.", answer: "The Farmers Market", accepted: ["Farmers Market"], points: 1 },
  { id: "p2-mix-2-15", mode: "in-the-mix-2", prompt: "In the Mix 2 card 15: describe the secret subject with three one-word clues.", answer: "A Power Outage", accepted: ["Power Outage"], points: 1 },
];

export function questionsForModes(modes = MODES) { return QUESTIONS.filter(q => modes.includes(q.mode)); }
