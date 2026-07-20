// Pure Party of Two rules engine. No DOM, persistence, timers, or networking.
import { questionsForModes } from './questions.js';
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const MODES = ["averages", "emojis", "in-the-mix", "out-of-the-mix", "two-words", "timeline", "in-the-mix-2"];
export const PHASES = ["lobby", "pairing", "question", "reveal", "over"];

const clean = (v, max = 40) => String(v ?? "").trim().slice(0, max);
const token = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function createRoom(code, hostId) {
  return { code: clean(code, 12).toUpperCase(), hostId, phase: "lobby", players: [], pairs: [], deck: [], qIndex: 0, nextActivePairIndex: 0,
    settings: { modes: MODES.slice(0, 5), questionsPerRound: 3, timerSeconds: 0 }, current: null, lastResult: null, winnerPairIds: [], touchedAt: Date.now() };
}
export function getPlayer(room, id) { return room.players.find(p => p.id === id) || null; }
export function getPair(room, id) { return room.pairs.find(p => p.id === id) || null; }
export function addPlayer(room, id, name, resumeToken = token()) {
  if (!["lobby", "pairing"].includes(room.phase)) return { error: "Game already in progress" };
  if (room.players.length >= MAX_PLAYERS) return { error: "Room is full" };
  const n = clean(name, 24); if (!n) return { error: "Name is required" };
  if (room.players.some(p => p.name.toLowerCase() === n.toLowerCase())) return { error: "That name is already taken" };
  const player = { id, name: n, connected: true, left: false, resumeToken, pairId: null, score: 0, roleIndex: 0, response: null };
  room.players.push(player); room.touchedAt = Date.now(); return { player };
}
export function rejoinPlayer(room, id, resumeToken) {
  const p = room.players.find(x => x.resumeToken === resumeToken); if (!p) return { error: "No saved seat found" };
  const previousId = p.id;
  p.id = id; p.connected = true; p.left = false;
  room.pairs.forEach(pair => { pair.memberIds = pair.memberIds.map(memberId => memberId === previousId ? id : memberId); });
  if (room.current?.responses?.[previousId] !== undefined) { room.current.responses[id] = room.current.responses[previousId]; delete room.current.responses[previousId]; }
  if (room.current?.requiredIds) room.current.requiredIds = room.current.requiredIds.map((requiredId) => requiredId === previousId ? id : requiredId);
  if (room.current?.clueGiverId === previousId) room.current.clueGiverId = id;
  if (room.current?.guesserId === previousId) room.current.guesserId = id;
  Object.values(room.current?.distractors || {}).forEach((entry) => { if (entry.submittedBy === previousId) entry.submittedBy = id; });
  return { player: p };
}
export function removePlayer(room, id) { const p = getPlayer(room, id); if (!p) return false; p.connected = false; p.left = true; return true; }
export function proposePair(room, playerId, partnerId) {
  const a = getPlayer(room, playerId), b = getPlayer(room, partnerId);
  if (room.phase !== "lobby" && room.phase !== "pairing") return { error: "Pairing is closed" };
  if (!a || !b || a.id === b.id || !a.connected || !b.connected) return { error: "Invalid teammate" };
  a.proposal = b.id; room.phase = "pairing";
  if (b.proposal === a.id) return confirmPair(room, a.id, b.id);
  return { proposal: { from: a.id, to: b.id } };
}
export function confirmPair(room, playerId, partnerId) {
  const a = getPlayer(room, playerId), b = getPlayer(room, partnerId); if (!a || !b) return { error: "Player not found" };
  if (a.id === b.id || !a.connected || !b.connected) return { error: "Invalid pair" };
  if (a.pairId && a.pairId !== b.pairId || b.pairId && b.pairId !== a.pairId) return { error: "Player already paired" };
  let pair = a.pairId && getPair(room, a.pairId); if (!pair) { pair = { id: `pair-${token()}`, memberIds: [a.id, b.id], score: 0, confirmed: true }; room.pairs.push(pair); }
  a.pairId = pair.id; b.pairId = pair.id; a.proposal = b.proposal = null; return { pair };
}
export function clearPair(room, pairId) { const pair = getPair(room, pairId); if (!pair) return false; pair.memberIds.forEach(id => { const p = getPlayer(room,id); if (p) p.pairId = null; }); room.pairs = room.pairs.filter(p => p.id !== pairId); return true; }
function validRoster(room) { const connected = room.players.filter(p => p.connected); return connected.length >= MIN_PLAYERS && connected.length % 2 === 0 && connected.every(p => p.pairId && getPair(room,p.pairId)?.memberIds.length === 2); }
function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function startGame(room, byId, options = {}) {
  if (byId !== room.hostId) return { error: "Only the host can start the game" };
  if (!validRoster(room)) return { error: "Need an even number of connected players with valid pairs" };
  const modes = (options.modes || room.settings.modes).filter(m => MODES.includes(m)); if (!modes.length) return { error: "Choose at least one mode" };
  room.players.forEach(p => { p.score = 0; p.response = null; }); room.pairs.forEach(p => p.score = 0);
  room.settings = { ...room.settings, ...options, modes };
  const perRound = Math.max(1, Number(options.questionsPerRound || room.settings.questionsPerRound || 3));
  const rng = options.rng || Math.random;
  const usedIds = new Set(options.usedIds || []);
  // Draw `perRound` DISTINCT questions per mode instead of cloning the
  // first match `perRound` times (the old behavior, which made every
  // round of a mode show the exact same prompt). Prefer questions not
  // yet seen on this device; once a mode's fresh pool runs dry, fall
  // back to its full pool rather than under-filling the round.
  room.deck = options.deck || modes.flatMap((mode) => {
    const all = questionsForModes([mode]);
    if (!all.length) return Array.from({ length: perRound }, (_, i) => ({ mode, prompt: `${mode} challenge`, answer: "answer", points: 1, id: `${mode}-${i + 1}` }));
    const fresh = all.filter((q) => !usedIds.has(q.id));
    const pool = fresh.length >= perRound ? fresh : all;
    return shuffle(pool, rng).slice(0, Math.min(perRound, pool.length));
  });
  room.qIndex = 0; room.phase = "question"; room.current = createQuestion(room, options.question || room.deck[0]); return {};
}
// Emojis is a House of Games "one pair up, others may steal" format --
// structurally different from every other mode, which has ALL pairs
// answering the SAME question in parallel (see resolveQuestion). Needs
// at least 2 pairs for "one pair up, others may steal" to mean anything;
// with fewer, this returns null and the question falls back to the
// generic all-pairs-answer-independently path.
function assignEmojiRoles(room, mode) {
  if (mode !== "emojis" || room.pairs.length < 2) return null;
  const idx = (room.nextActivePairIndex || 0) % room.pairs.length;
  const activePair = room.pairs[idx];
  room.nextActivePairIndex = idx + 1;
  if (!activePair || activePair.memberIds.length !== 2) return null;
  // Alternates which member of the pair clues vs. guesses each time this
  // pair comes up, so everyone gets a turn at both roles across a show.
  const slot = activePair.nextClueGiverSlot || 0;
  activePair.nextClueGiverSlot = slot ? 0 : 1;
  return { activePairId: activePair.id, clueGiverId: activePair.memberIds[slot], guesserId: activePair.memberIds[slot ? 0 : 1] };
}
function assignInTheMixRoles(room, mode) {
  if (mode !== "in-the-mix" || !room.pairs.length) return null;
  const idx = (room.nextActivePairIndex || 0) % room.pairs.length;
  const activePair = room.pairs[idx];
  room.nextActivePairIndex = idx + 1;
  if (!activePair || activePair.memberIds.length !== 2) return null;
  const slot = activePair.nextMixClueGiverSlot || 0;
  activePair.nextMixClueGiverSlot = slot ? 0 : 1;
  return {
    activePairId: activePair.id,
    clueGiverId: activePair.memberIds[slot],
    guesserId: activePair.memberIds[slot ? 0 : 1],
    stage: "clues",
    clueWords: [],
    distractors: {},
    mixedWords: [],
  };
}
// Out of the Mix is In the Mix's inverse: opposing pairs guess a word
// BLIND (never seeing the real clue words -- see redactCurrentForViewer)
// hoping to accidentally name one; any match is REMOVED from what the
// guesser sees, instead of being added as a lookalike distractor.
function assignOutOfMixRoles(room, mode) {
  if (mode !== "out-of-the-mix" || !room.pairs.length) return null;
  const idx = (room.nextActivePairIndex || 0) % room.pairs.length;
  const activePair = room.pairs[idx];
  room.nextActivePairIndex = idx + 1;
  if (!activePair || activePair.memberIds.length !== 2) return null;
  const slot = activePair.nextOutMixClueGiverSlot || 0;
  activePair.nextOutMixClueGiverSlot = slot ? 0 : 1;
  return {
    activePairId: activePair.id,
    clueGiverId: activePair.memberIds[slot],
    guesserId: activePair.memberIds[slot ? 0 : 1],
    stage: "clues",
    clueWords: [],
    blocks: {},
    remainingWords: [],
  };
}
// In the Mix 2: same clue-giver/guesser split as In the Mix, and
// opposing pairs see the real clue words while composing their decoy
// (same privacy model as In the Mix's distractor stage -- they need to
// see the clues to write a plausible decoy answer). The difference is
// what opponents contribute: a full multiple-choice OPTION (a decoy
// answer) instead of one lookalike word, and the guesser picks from a
// shuffled list instead of typing free text.
function assignInTheMix2Roles(room, mode) {
  if (mode !== "in-the-mix-2" || !room.pairs.length) return null;
  const idx = (room.nextActivePairIndex || 0) % room.pairs.length;
  const activePair = room.pairs[idx];
  room.nextActivePairIndex = idx + 1;
  if (!activePair || activePair.memberIds.length !== 2) return null;
  const slot = activePair.nextMix2ClueGiverSlot || 0;
  activePair.nextMix2ClueGiverSlot = slot ? 0 : 1;
  return {
    activePairId: activePair.id,
    clueGiverId: activePair.memberIds[slot],
    guesserId: activePair.memberIds[slot ? 0 : 1],
    stage: "clues",
    clueWords: [],
    options: {},
    choices: [],
    correctChoiceId: null,
  };
}
// requiredIds is a snapshot of who must answer, taken once when the
// question is dealt -- NOT re-derived from live `.connected` status on
// every submission. A player's connection blipping mid-question (screen
// lock, a moment of bad signal -- routine on mobile) must not shrink the
// quorum and trigger an early reveal before they actually got to answer.
function createQuestion(room, q) {
  const entry = q || room.deck[0] || { mode: room.settings.modes[0], prompt: "", answer: null, points: 1 };
  const mode = entry.mode || room.settings.modes[0];
  const roles = assignEmojiRoles(room, mode) || assignInTheMixRoles(room, mode) || assignOutOfMixRoles(room, mode) || assignInTheMix2Roles(room, mode);
  const requiredIds = roles ? [roles.guesserId] : room.players.filter(p => p.connected).map(p => p.id);
  const startedAt = Date.now();
  return { ...entry, mode, responses: {}, startedAt, stageStartedAt: startedAt, requiredIds, ...(roles || {}) };
}
export function currentQuestion(room) { return room.current || room.deck[room.qIndex] || null; }
export function submitResponse(room, playerId, response) {
  if (room.phase !== "question") return { error: "No question is open" }; const p = getPlayer(room, playerId); if (!p || !p.connected) return { error: "Player is unavailable" }; if (room.current.responses[playerId] !== undefined) return { error: "Response already locked" };
  if (room.current.mode === "in-the-mix" || room.current.mode === "out-of-the-mix" || room.current.mode === "in-the-mix-2") return { error: "Use the action for your role in this round" };
  if (room.current.mode === "timeline") {
    const validIds = timelineIds(room.current);
    if (!Array.isArray(response) || response.length !== validIds.length || new Set(response).size !== validIds.length || !response.every((id) => validIds.includes(id))) return { error: "Submit a full ordering of all three events" };
  }
  // Role-split (emojis) questions only ever accept the designated
  // guesser here -- the clue-giver has nothing to submit (they already
  // know the answer), and a steal attempt goes through submitStealResponse
  // instead, since it's a different pair entirely.
  if (room.current.guesserId && playerId !== room.current.guesserId) return { error: "You're not answering this question" };
  room.current.responses[playerId] = response; p.response = response; return { ok: true };
}
const mixWord = (value) => clean(value, 24);
const isOneWord = (value) => /^[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*$/u.test(value);
function beginMixGuessing(room, now = Date.now()) {
  const q = room.current;
  const words = [...q.clueWords, ...Object.values(q.distractors).map((entry) => entry.word)];
  q.mixedWords = shuffle(words, Math.random);
  q.stage = "guessing"; q.requiredIds = [q.guesserId]; q.stageStartedAt = now;
  return { ok: true, stage: q.stage };
}
export function submitMixClues(room, playerId, words, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "in-the-mix") return { error: "In the Mix is not open" };
  if (q.stage !== "clues") return { error: "Clue entry is closed" };
  if (playerId !== q.clueGiverId) return { error: "Only the clue-giver can submit clues" };
  const player = getPlayer(room, playerId); if (!player?.connected) return { error: "Player is unavailable" };
  if (!Array.isArray(words) || words.length !== 3) return { error: "Enter exactly three clue words" };
  const clues = words.map(mixWord);
  if (clues.some((word) => !isOneWord(word))) return { error: "Each clue must be one word" };
  if (new Set(clues.map(norm)).size !== 3) return { error: "Clue words must be different" };
  q.clueWords = clues; q.responses[playerId] = clues.slice(); player.response = clues.slice();
  const opposingPairIds = room.pairs.filter((pair) => pair.id !== q.activePairId).map((pair) => pair.id);
  if (!opposingPairIds.length) return beginMixGuessing(room, now);
  q.stage = "distractors"; q.requiredIds = []; q.stageStartedAt = now;
  return { ok: true, stage: q.stage };
}
export function submitMixDistractor(room, playerId, value, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "in-the-mix") return { error: "In the Mix is not open" };
  if (q.stage !== "distractors") return { error: "Distractor entry is closed" };
  const player = getPlayer(room, playerId); if (!player?.connected || !player.pairId) return { error: "Player is unavailable" };
  if (player.pairId === q.activePairId) return { error: "The active pair cannot add a distractor" };
  if (q.distractors[player.pairId]) return { error: "Your pair already submitted a distractor" };
  const word = mixWord(value);
  if (!isOneWord(word)) return { error: "The distractor must be one word" };
  const used = [...q.clueWords, ...Object.values(q.distractors).map((entry) => entry.word)].map(norm);
  if (used.includes(norm(word))) return { error: "Choose a word that is not already in the mix" };
  q.distractors[player.pairId] = { word, submittedBy: playerId }; q.responses[playerId] = word; player.response = word;
  const opposingPairIds = room.pairs.filter((pair) => pair.id !== q.activePairId).map((pair) => pair.id);
  if (opposingPairIds.every((pairId) => q.distractors[pairId])) return beginMixGuessing(room, now);
  return { ok: true, stage: q.stage };
}
export function submitMixGuess(room, playerId, response, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "in-the-mix") return { error: "In the Mix is not open" };
  if (q.stage !== "guessing") return { error: "Guessing is not open" };
  if (playerId !== q.guesserId) return { error: "Only the designated guesser can answer" };
  const player = getPlayer(room, playerId); if (!player?.connected) return { error: "Player is unavailable" };
  if (q.responses[playerId] !== undefined) return { error: "Response already locked" };
  const guess = clean(response, 80); if (!guess) return { error: "Enter a guess" };
  q.responses[playerId] = guess; player.response = guess;
  return resolveQuestion(room, now);
}
function beginOutMixGuessing(room, now = Date.now()) {
  const q = room.current;
  const blockedWords = new Set(Object.values(q.blocks).map((w) => norm(w)));
  q.remainingWords = q.clueWords.filter((word) => !blockedWords.has(norm(word)));
  q.stage = "guessing"; q.requiredIds = [q.guesserId]; q.stageStartedAt = now;
  return { ok: true, stage: q.stage };
}
export function submitOutMixClues(room, playerId, words, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "out-of-the-mix") return { error: "Out of the Mix is not open" };
  if (q.stage !== "clues") return { error: "Clue entry is closed" };
  if (playerId !== q.clueGiverId) return { error: "Only the clue-giver can submit clues" };
  const player = getPlayer(room, playerId); if (!player?.connected) return { error: "Player is unavailable" };
  if (!Array.isArray(words) || words.length !== 3) return { error: "Enter exactly three clue words" };
  const clues = words.map(mixWord);
  if (clues.some((word) => !isOneWord(word))) return { error: "Each clue must be one word" };
  if (new Set(clues.map(norm)).size !== 3) return { error: "Clue words must be different" };
  q.clueWords = clues; q.responses[playerId] = clues.slice(); player.response = clues.slice();
  const opposingPairIds = room.pairs.filter((pair) => pair.id !== q.activePairId).map((pair) => pair.id);
  if (!opposingPairIds.length) return beginOutMixGuessing(room, now);
  q.stage = "blocking"; q.requiredIds = []; q.stageStartedAt = now;
  return { ok: true, stage: q.stage };
}
// Opposing pairs submit ONE word each, blind -- they never see the real
// clue words (redactCurrentForViewer withholds them at every stage for
// non-active-pair viewers, unlike In the Mix's distractor stage). No
// dedupe against other pairs' guesses: two pairs independently guessing
// the same word is a legitimate coincidence, not an error.
export function submitOutMixBlock(room, playerId, value, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "out-of-the-mix") return { error: "Out of the Mix is not open" };
  if (q.stage !== "blocking") return { error: "Blocking is closed" };
  const player = getPlayer(room, playerId); if (!player?.connected || !player.pairId) return { error: "Player is unavailable" };
  if (player.pairId === q.activePairId) return { error: "The active pair cannot submit a block" };
  if (q.blocks[player.pairId]) return { error: "Your pair already submitted a word" };
  const word = mixWord(value);
  if (!isOneWord(word)) return { error: "Your guess must be one word" };
  q.blocks[player.pairId] = word; q.responses[playerId] = word; player.response = word;
  const opposingPairIds = room.pairs.filter((pair) => pair.id !== q.activePairId).map((pair) => pair.id);
  if (opposingPairIds.every((pairId) => q.blocks[pairId])) return beginOutMixGuessing(room, now);
  return { ok: true, stage: q.stage };
}
export function submitOutMixGuess(room, playerId, response, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "out-of-the-mix") return { error: "Out of the Mix is not open" };
  if (q.stage !== "guessing") return { error: "Guessing is not open" };
  if (playerId !== q.guesserId) return { error: "Only the designated guesser can answer" };
  const player = getPlayer(room, playerId); if (!player?.connected) return { error: "Player is unavailable" };
  if (q.responses[playerId] !== undefined) return { error: "Response already locked" };
  const guess = clean(response, 80); if (!guess) return { error: "Enter a guess" };
  q.responses[playerId] = guess; player.response = guess;
  return resolveQuestion(room, now);
}
function buildMix2Choices(room, now = Date.now()) {
  const q = room.current;
  const trueId = `c-${token()}`;
  const decoys = Object.entries(q.options).map(([pairId, text]) => ({ id: `c-${token()}`, text, pairId }));
  q.choices = shuffle([{ id: trueId, text: q.answer }, ...decoys], Math.random).map(({ id, text }) => ({ id, text }));
  q.correctChoiceId = trueId;
  q.stage = "choosing"; q.requiredIds = [q.guesserId]; q.stageStartedAt = now;
  return { ok: true, stage: q.stage };
}
export function submitMix2Clues(room, playerId, words, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "in-the-mix-2") return { error: "In the Mix 2 is not open" };
  if (q.stage !== "clues") return { error: "Clue entry is closed" };
  if (playerId !== q.clueGiverId) return { error: "Only the clue-giver can submit clues" };
  const player = getPlayer(room, playerId); if (!player?.connected) return { error: "Player is unavailable" };
  if (!Array.isArray(words) || words.length !== 3) return { error: "Enter exactly three clue words" };
  const clues = words.map(mixWord);
  if (clues.some((word) => !isOneWord(word))) return { error: "Each clue must be one word" };
  if (new Set(clues.map(norm)).size !== 3) return { error: "Clue words must be different" };
  q.clueWords = clues; q.responses[playerId] = clues.slice(); player.response = clues.slice();
  const opposingPairIds = room.pairs.filter((pair) => pair.id !== q.activePairId).map((pair) => pair.id);
  if (!opposingPairIds.length) return buildMix2Choices(room, now);
  q.stage = "options"; q.requiredIds = []; q.stageStartedAt = now;
  return { ok: true, stage: q.stage };
}
export function submitMix2Option(room, playerId, value, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "in-the-mix-2") return { error: "In the Mix 2 is not open" };
  if (q.stage !== "options") return { error: "Option entry is closed" };
  const player = getPlayer(room, playerId); if (!player?.connected || !player.pairId) return { error: "Player is unavailable" };
  if (player.pairId === q.activePairId) return { error: "The active pair cannot submit an option" };
  if (q.options[player.pairId]) return { error: "Your pair already submitted an option" };
  const text = clean(value, 60); if (!text) return { error: "Enter a decoy answer" };
  const used = [q.answer, ...Object.values(q.options)].map(norm);
  if (used.includes(norm(text))) return { error: "Choose an answer that isn't already an option" };
  q.options[player.pairId] = text; q.responses[playerId] = text; player.response = text;
  const opposingPairIds = room.pairs.filter((pair) => pair.id !== q.activePairId).map((pair) => pair.id);
  if (opposingPairIds.every((pairId) => q.options[pairId])) return buildMix2Choices(room, now);
  return { ok: true, stage: q.stage };
}
export function submitMix2Choice(room, playerId, choiceId, now = Date.now()) {
  const q = room.current;
  if (room.phase !== "question" || q?.mode !== "in-the-mix-2") return { error: "In the Mix 2 is not open" };
  if (q.stage !== "choosing") return { error: "Choosing is not open" };
  if (playerId !== q.guesserId) return { error: "Only the designated guesser can answer" };
  const player = getPlayer(room, playerId); if (!player?.connected) return { error: "Player is unavailable" };
  if (q.responses[playerId] !== undefined) return { error: "Response already locked" };
  if (!(q.choices || []).some((c) => c.id === choiceId)) return { error: "Choose one of the listed options" };
  q.responses[playerId] = choiceId; player.response = choiceId;
  return resolveQuestion(room, now);
}
export function allPlayersSubmitted(room) { const requiredIds = room.current?.requiredIds || []; return room.phase === "question" && requiredIds.length > 0 && requiredIds.every(id => Object.prototype.hasOwnProperty.call(room.current?.responses || {}, id)); }
// Pure, deterministic (given an injected `now`) so the host's polling loop
// in main.js can call this on a plain interval without game.js touching
// timers itself -- same convention as this repo's sibling party games.
export function questionTimeRemainingMs(room, now = Date.now()) { if (room.phase !== "question" || !room.settings.timerSeconds) return null; const deadline = (room.current?.stageStartedAt || room.current?.startedAt || now) + room.settings.timerSeconds * 1000; return Math.max(0, deadline - now); }
export function questionTimerExpired(room, now = Date.now()) { const remaining = questionTimeRemainingMs(room, now); return remaining !== null && remaining <= 0; }
const norm = v => String(v ?? "").trim().toLowerCase();
function pairVals(q, players) { return players.map(p => q.responses[p.id]).filter(v => v !== undefined); }
// The true earliest-to-latest order of the reference plus both mystery
// events, by year -- the engine keeps the real years on room.current
// internally (see createQuestion/redactCurrentForViewer, which strips
// them from what's actually sent over the wire before reveal).
function timelineOrder(q) { return [q.reference, ...q.events].slice().sort((a, b) => a.year - b.year).map((e) => e.id); }
function timelineIds(q) { return [q.reference.id, ...q.events.map((e) => e.id)]; }
// two-words / timeline / everything else: judged independently, one pair at a time.
function resolvePair(q, pair, players) { const vals = pairVals(q, players); if (!vals.length) return false; if (q.mode === "two-words") return vals.length === 2 && vals.map(norm).sort().join("|") === (q.answers || []).map(norm).sort().join("|"); if (q.mode === "timeline") { const correct = timelineOrder(q); return vals.some((v) => Array.isArray(v) && v.length === correct.length && v.every((id, i) => id === correct[i])); } return vals.some(v => norm(v) === norm(q.answer)) || (q.accepted || []).map(norm).includes(norm(vals[vals.length - 1])); }
// Shared by both the all-pairs-in-parallel modes and the emojis
// one-pair-up format: scores exactly the pairs in `winningPairIds`
// (empty/omitted = nobody), clears in-flight responses, and moves to
// reveal. `winningPairIds` lets emojis award a single pair (or nobody,
// if every steal attempt missed) without duplicating this bookkeeping.
function finalizeQuestion(room, q, winningPairIds, now) {
  const winners = new Set(winningPairIds);
  const results = room.pairs.map((pair) => {
    const correct = winners.has(pair.id);
    const points = correct ? Number(q.points || 1) : 0;
    pair.score += points;
    pair.memberIds.forEach((id) => { const p = getPlayer(room, id); if (p) { p.score += points / pair.memberIds.length; p.response = null; } });
    return { pairId: pair.id, correct, points };
  });
  const revealedDistractors = q.mode === "in-the-mix" ? Object.fromEntries(Object.entries(q.distractors).map(([pairId, entry]) => [pairId, { word: entry.word }])) : null;
  room.lastResult = { mode: q.mode, prompt: q.prompt, answer: q.answer ?? null, results, at: now,
    ...(q.mode === "in-the-mix" ? { activePairId: q.activePairId, clueWords: q.clueWords.slice(), distractors: revealedDistractors, mixedWords: q.mixedWords.slice(), guess: q.responses[q.guesserId] ?? null } : {}),
    ...(q.mode === "out-of-the-mix" ? { activePairId: q.activePairId, clueWords: q.clueWords.slice(), blockedWords: Object.values(q.blocks), remainingWords: q.remainingWords.slice(), guess: q.responses[q.guesserId] ?? null } : {}),
    ...(q.mode === "timeline" ? { reference: q.reference, events: q.events, correctOrder: timelineOrder(q) } : {}),
    ...(q.mode === "in-the-mix-2" ? { activePairId: q.activePairId, clueWords: q.clueWords.slice(), choices: q.choices, correctChoiceId: q.correctChoiceId, chosenId: q.responses[q.guesserId] ?? null } : {}) };
  room.phase = "reveal";
  return room.lastResult;
}
export function resolveQuestion(room, now = Date.now()) {
  if (room.phase !== "question") return { error: "Question is not open" }; const q = room.current || currentQuestion(room);
  if (q.mode === "in-the-mix" && q.activePairId) {
    if (q.stage === "distractors") return beginMixGuessing(room, now);
    if (q.stage === "clues") return finalizeQuestion(room, q, [], now);
    const guess = q.responses[q.guesserId];
    const correct = guess !== undefined && (norm(guess) === norm(q.answer) || (q.accepted || []).map(norm).includes(norm(guess)));
    return finalizeQuestion(room, q, correct ? [q.activePairId] : [], now);
  }
  if (q.mode === "out-of-the-mix" && q.activePairId) {
    if (q.stage === "blocking") return beginOutMixGuessing(room, now);
    if (q.stage === "clues") return finalizeQuestion(room, q, [], now);
    const guess = q.responses[q.guesserId];
    const correct = guess !== undefined && (norm(guess) === norm(q.answer) || (q.accepted || []).map(norm).includes(norm(guess)));
    return finalizeQuestion(room, q, correct ? [q.activePairId] : [], now);
  }
  if (q.mode === "in-the-mix-2" && q.activePairId) {
    if (q.stage === "options") return buildMix2Choices(room, now);
    if (q.stage === "clues") return finalizeQuestion(room, q, [], now);
    const chosenId = q.responses[q.guesserId];
    return finalizeQuestion(room, q, chosenId === q.correctChoiceId ? [q.activePairId] : [], now);
  }
  // emojis: one pair is "up" at a time (assignEmojiRoles/createQuestion).
  // The guesser's own submission is checked immediately here (this runs
  // right after submitResponse via allPlayersSubmitted, since
  // requiredIds is just [guesserId] for this mode) or by the Host's
  // timer-expiry poll if they never answer at all. A wrong guess or a
  // timeout opens the steal window instead of ending the question --
  // claimSteal/submitStealResponse below drive it from there. Once open,
  // repeated timer-expiry calls here are deliberate no-ops (the steal
  // window has no timer of its own; the Host can always tap Next).
  if (q.mode === "emojis" && q.activePairId) {
    if (q.stealOpen) return { error: "Steal phase is already open" };
    const guess = q.responses[q.guesserId];
    if (guess !== undefined && (norm(guess) === norm(q.answer) || (q.accepted || []).map(norm).includes(norm(guess)))) {
      return finalizeQuestion(room, q, [q.activePairId], now);
    }
    q.stealOpen = true; q.stealAttempted = [q.activePairId]; q.stealClaimedBy = null; q.stealClaimerId = null;
    return { stealOpen: true };
  }
  // averages is a House of Games "On Average"-style round: pairs are
  // judged AGAINST EACH OTHER, not against a fixed exact target. Only
  // whichever pair's combined average lands closest to the true answer
  // scores -- landing on it exactly (the old rule) is a near-impossible
  // bar real guesses almost never clear, so it never actually paid out.
  if (q.mode === "averages" && q.answer != null) {
    const distances = room.pairs.map((pair) => { const members = pair.memberIds.map(id => getPlayer(room,id)).filter(Boolean); const vals = pairVals(q, members); if (!vals.length) return { pairId: pair.id, distance: Infinity }; const avg = vals.reduce((a,v)=>a+Number(v),0)/vals.length; return { pairId: pair.id, distance: Math.abs(avg - Number(q.answer)) }; });
    const minDistance = Math.min(...distances.map(d => d.distance));
    const closestPairIds = Number.isFinite(minDistance) ? distances.filter(d => d.distance === minDistance).map(d => d.pairId) : [];
    return finalizeQuestion(room, q, closestPairIds, now);
  }
  const winningPairIds = room.pairs.filter((pair) => resolvePair(q, pair, pair.memberIds.map(id => getPlayer(room,id)).filter(Boolean))).map((pair) => pair.id);
  return finalizeQuestion(room, q, winningPairIds, now);
}
// Any player on a pair other than the one currently up may claim the
// steal once the window opens -- first tap wins the race (buzzer-style);
// the claim is per-PLAYER (stealClaimerId), not per-pair, so exactly one
// person types the guess even though the whole pair scores if it's right.
export function claimSteal(room, playerId) {
  if (room.phase !== "question") return { error: "No question is open" }; const q = room.current;
  if (!q || q.mode !== "emojis" || !q.stealOpen) return { error: "Steal isn't open" };
  if (q.stealClaimedBy) return { error: "Someone already claimed the steal" };
  const p = getPlayer(room, playerId); if (!p || !p.connected || !p.pairId) return { error: "Player is unavailable" };
  if (p.pairId === q.activePairId) return { error: "Your pair already had a turn" };
  if ((q.stealAttempted || []).includes(p.pairId)) return { error: "Your pair already tried stealing" };
  q.stealClaimedBy = p.pairId; q.stealClaimerId = playerId; return { ok: true };
}
export function submitStealResponse(room, playerId, response) {
  if (room.phase !== "question") return { error: "No question is open" }; const q = room.current;
  if (!q || q.mode !== "emojis" || !q.stealOpen) return { error: "Steal isn't open" };
  if (q.stealClaimerId !== playerId) return { error: "You don't hold the steal" };
  const correct = norm(response) === norm(q.answer) || (q.accepted || []).map(norm).includes(norm(response));
  if (correct) return finalizeQuestion(room, q, [q.stealClaimedBy], Date.now());
  q.stealAttempted = [...(q.stealAttempted || []), q.stealClaimedBy]; q.stealClaimedBy = null; q.stealClaimerId = null;
  const eligible = room.pairs.filter((pair) => !q.stealAttempted.includes(pair.id));
  if (!eligible.length) return finalizeQuestion(room, q, [], Date.now());
  return { ok: true, correct: false };
}
// createQuestion(room) with no second argument falls back to
// room.deck[0] every time -- passing room.deck[room.qIndex] explicitly
// is what actually advances through the round instead of re-dealing the
// first card of the deck for the rest of the show.
export function advance(room) { if (room.phase !== "reveal") return { error: "Reveal is not open" }; room.qIndex++; if (room.qIndex >= room.deck.length) { room.phase = "over"; const max = Math.max(...room.pairs.map(p=>p.score), 0); room.winnerPairIds = room.pairs.filter(p=>p.score===max).map(p=>p.id); return { done: true }; } room.current = createQuestion(room, room.deck[room.qIndex]); room.phase = "question"; return { done: false, question: room.current }; }
export function rematch(room, byId, retainPairs = true) { if (byId !== room.hostId || room.phase !== "over") return { error: "Only the host can rematch" }; room.players = room.players.filter(p=>p.connected); room.players.forEach(p=>{p.score=0;p.response=null;if(!retainPairs)p.pairId=null;}); room.pairs.forEach(p=>p.score=0); if(!retainPairs)room.pairs=[]; room.nextActivePairIndex=0; room.phase = retainPairs ? "pairing" : "lobby"; return {}; }
// viewerId matters only for the current emojis question: everyone else
// gets the same redacted snapshot as before (answer/responses stripped),
// but the clue-giver specifically needs to see the real answer/prompt to
// know what they're describing, and nobody else -- not even their own
// partner -- may see it. Also computes a `viewerRole` so main.js doesn't
// have to re-derive "am I the clue-giver/guesser/stealer/spectator" from
// raw ids on every render.
function redactCurrentForViewer(current, viewerId, viewerPairId) {
  const { answer, responses, distractors, clueWords, mixedWords, blocks, remainingWords, events, options, choices, correctChoiceId, ...q } = current;
  if (current.mode === "in-the-mix" && current.activePairId) {
    const submittedPairIds = Object.keys(distractors || {});
    const base = { ...q, submittedPairIds };
    if (viewerId === current.clueGiverId) return { ...base, answer, clueWords: clueWords.slice(), ...(current.stage === "guessing" ? { mixedWords: mixedWords.slice() } : {}) };
    if (viewerId === current.guesserId) return { ...base, ...(current.stage === "guessing" ? { mixedWords: mixedWords.slice() } : {}) };
    if (viewerPairId && viewerPairId !== current.activePairId && current.stage === "distractors") return { ...base, clueWords: clueWords.slice() };
    return base;
  }
  // Out of the Mix: opposing pairs guess BLIND -- unlike In the Mix's
  // distractor stage, they never see clueWords at any point, or the
  // mechanic (accidentally naming a real clue) would be trivial to game.
  if (current.mode === "out-of-the-mix" && current.activePairId) {
    const submittedPairIds = Object.keys(blocks || {});
    const base = { ...q, submittedPairIds };
    if (viewerId === current.clueGiverId) return { ...base, answer, clueWords: clueWords.slice(), ...(current.stage === "guessing" ? { remainingWords: remainingWords.slice() } : {}) };
    if (viewerId === current.guesserId) return { ...base, ...(current.stage === "guessing" ? { remainingWords: remainingWords.slice() } : {}) };
    return base;
  }
  // In the Mix 2: correctChoiceId is destructured out above and never
  // re-added here -- it only ever appears in lastResult, after reveal.
  // Nobody may learn which shuffled option is correct from the current
  // question's own network payload, including the clue-giver (who
  // already knows via `answer` instead).
  if (current.mode === "in-the-mix-2" && current.activePairId) {
    const submittedPairIds = Object.keys(options || {});
    const base = { ...q, submittedPairIds };
    if (viewerId === current.clueGiverId) return { ...base, answer, clueWords: clueWords.slice(), ...(current.stage === "choosing" ? { choices } : {}) };
    if (viewerId === current.guesserId) return { ...base, ...(current.stage === "choosing" ? { choices } : {}) };
    if (viewerPairId && viewerPairId !== current.activePairId && current.stage === "options") return { ...base, clueWords: clueWords.slice() };
    return base;
  }
  // Timeline: the two mystery events' real years are the whole puzzle --
  // nobody (not even the submitter) may see them before reveal, unlike
  // every other redaction here which only hides things from SOME
  // viewers. The reference's year stays, by design, as the anchor point.
  const plain = { ...q, ...(clueWords !== undefined ? { clueWords } : {}), ...(mixedWords !== undefined ? { mixedWords } : {}), ...(distractors !== undefined ? { distractors } : {}), ...(events !== undefined ? { events: events.map(({ id, label }) => ({ id, label })) } : {}) };
  if (current.mode !== "emojis" || !current.clueGiverId) return plain;
  if (viewerId === current.clueGiverId) return { ...plain, answer };
  return { ...plain, prompt: "Your teammate is describing something using only emojis. What is it?" };
}
function viewerEmojiRole(current, viewerId, viewerPairId) {
  if (!current || current.mode !== "emojis" || !current.activePairId || !viewerId) return null;
  if (viewerId === current.clueGiverId) return "clueGiver";
  if (viewerId === current.guesserId) return "guesser";
  if (!viewerPairId || viewerPairId === current.activePairId) return null;
  if (current.stealClaimerId === viewerId) return "stealing";
  if ((current.stealAttempted || []).includes(viewerPairId)) return "stealSpent";
  if (current.stealOpen && !current.stealClaimedBy) return "stealAvailable";
  if (current.stealOpen) return "stealBlocked";
  return "spectating";
}
function viewerInTheMixRole(current, viewerId, viewerPairId) {
  if (!current || current.mode !== "in-the-mix" || !current.activePairId || !viewerId) return null;
  if (viewerId === current.clueGiverId) return "mixClueGiver";
  if (viewerId === current.guesserId) return "mixGuesser";
  if (!viewerPairId || viewerPairId === current.activePairId) return "mixSpectator";
  return current.distractors?.[viewerPairId] ? "mixDistractorSubmitted" : "mixDistractor";
}
function viewerOutOfMixRole(current, viewerId, viewerPairId) {
  if (!current || current.mode !== "out-of-the-mix" || !current.activePairId || !viewerId) return null;
  if (viewerId === current.clueGiverId) return "outMixClueGiver";
  if (viewerId === current.guesserId) return "outMixGuesser";
  if (!viewerPairId || viewerPairId === current.activePairId) return "outMixSpectator";
  return current.blocks?.[viewerPairId] ? "outMixBlockerSubmitted" : "outMixBlocker";
}
function viewerInTheMix2Role(current, viewerId, viewerPairId) {
  if (!current || current.mode !== "in-the-mix-2" || !current.activePairId || !viewerId) return null;
  if (viewerId === current.clueGiverId) return "mix2ClueGiver";
  if (viewerId === current.guesserId) return "mix2Guesser";
  if (!viewerPairId || viewerPairId === current.activePairId) return "mix2Spectator";
  return current.options?.[viewerPairId] ? "mix2OptionSubmitted" : "mix2Option";
}
export function publicState(room, viewerId) {
  const hasResponse = id => Boolean(room.current?.responses && Object.prototype.hasOwnProperty.call(room.current.responses, id));
  const viewerPairId = viewerId ? getPlayer(room, viewerId)?.pairId : null;
  return { code: room.code, hostId: room.hostId, phase: room.phase,
    players: room.players.map(({resumeToken,response,...p})=>({...p, submitted: hasResponse(p.id)})),
    pairs: room.pairs.map(p=>{const memberNames=p.memberIds.map(id=>getPlayer(room,id)?.name).filter(Boolean);return {...p, members:p.memberIds, memberNames, name:memberNames.join(" + ")};}),
    settings: room.settings, qIndex: room.qIndex,
    current: room.current ? redactCurrentForViewer(room.current, viewerId, viewerPairId) : null,
    currentQuestion: room.current ? redactCurrentForViewer(room.current, viewerId, viewerPairId) : null,
    lastResult: room.phase === "reveal" || room.phase === "over" ? room.lastResult : null,
    winnerPairIds: room.winnerPairIds,
    viewerRole: room.current ? (viewerInTheMixRole(room.current, viewerId, viewerPairId) || viewerOutOfMixRole(room.current, viewerId, viewerPairId) || viewerInTheMix2Role(room.current, viewerId, viewerPairId) || viewerEmojiRole(room.current, viewerId, viewerPairId)) : null };
}
