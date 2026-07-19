// Pure Party of Two rules engine. No DOM, persistence, timers, or networking.
import { questionsForModes } from './questions.js';
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const MODES = ["averages", "emojis", "in-the-mix", "out-of-the-mix", "two-words", "timeline", "in-the-mix-2"];
export const PHASES = ["lobby", "pairing", "question", "reveal", "over"];

const clean = (v, max = 40) => String(v ?? "").trim().slice(0, max);
const token = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function createRoom(code, hostId) {
  return { code: clean(code, 12).toUpperCase(), hostId, phase: "lobby", players: [], pairs: [], deck: [], qIndex: 0,
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
// requiredIds is a snapshot of who must answer, taken once when the
// question is dealt -- NOT re-derived from live `.connected` status on
// every submission. A player's connection blipping mid-question (screen
// lock, a moment of bad signal -- routine on mobile) must not shrink the
// quorum and trigger an early reveal before they actually got to answer.
function createQuestion(room, q) { const entry = q || room.deck[0] || { mode: room.settings.modes[0], prompt: "", answer: null, points: 1 }; return { ...entry, mode: entry.mode || room.settings.modes[0], responses: {}, startedAt: Date.now(), requiredIds: room.players.filter(p => p.connected).map(p => p.id) }; }
export function currentQuestion(room) { return room.current || room.deck[room.qIndex] || null; }
export function submitResponse(room, playerId, response) {
  if (room.phase !== "question") return { error: "No question is open" }; const p = getPlayer(room, playerId); if (!p || !p.connected) return { error: "Player is unavailable" }; if (room.current.responses[playerId] !== undefined) return { error: "Response already locked" };
  room.current.responses[playerId] = response; p.response = response; return { ok: true };
}
export function allPlayersSubmitted(room) { const requiredIds = room.current?.requiredIds || []; return room.phase === "question" && requiredIds.length > 0 && requiredIds.every(id => Object.prototype.hasOwnProperty.call(room.current?.responses || {}, id)); }
// Pure, deterministic (given an injected `now`) so the host's polling loop
// in main.js can call this on a plain interval without game.js touching
// timers itself -- same convention as this repo's sibling party games.
export function questionTimeRemainingMs(room, now = Date.now()) { if (room.phase !== "question" || !room.settings.timerSeconds) return null; const deadline = (room.current?.startedAt || now) + room.settings.timerSeconds * 1000; return Math.max(0, deadline - now); }
export function questionTimerExpired(room, now = Date.now()) { const remaining = questionTimeRemainingMs(room, now); return remaining !== null && remaining <= 0; }
const norm = v => String(v ?? "").trim().toLowerCase();
function pairVals(q, players) { return players.map(p => q.responses[p.id]).filter(v => v !== undefined); }
// two-words / everything else: judged independently, one pair at a time.
function resolvePair(q, pair, players) { const vals = pairVals(q, players); if (!vals.length) return false; if (q.mode === "two-words") return vals.length === 2 && vals.map(norm).sort().join("|") === (q.answers || []).map(norm).sort().join("|"); return vals.some(v => norm(v) === norm(q.answer)) || (q.accepted || []).map(norm).includes(norm(vals[vals.length - 1])); }
export function resolveQuestion(room, now = Date.now()) {
  if (room.phase !== "question") return { error: "Question is not open" }; const q = room.current || currentQuestion(room); const results = [];
  // averages is a House of Games "On Average"-style round: pairs are
  // judged AGAINST EACH OTHER, not against a fixed exact target. Only
  // whichever pair's combined average lands closest to the true answer
  // scores -- landing on it exactly (the old rule) is a near-impossible
  // bar real guesses almost never clear, so it never actually paid out.
  let closestPairIds = null;
  if (q.mode === "averages" && q.answer != null) {
    const distances = room.pairs.map((pair) => { const members = pair.memberIds.map(id => getPlayer(room,id)).filter(Boolean); const vals = pairVals(q, members); if (!vals.length) return { pairId: pair.id, distance: Infinity }; const avg = vals.reduce((a,v)=>a+Number(v),0)/vals.length; return { pairId: pair.id, distance: Math.abs(avg - Number(q.answer)) }; });
    const minDistance = Math.min(...distances.map(d => d.distance));
    closestPairIds = new Set(Number.isFinite(minDistance) ? distances.filter(d => d.distance === minDistance).map(d => d.pairId) : []);
  }
  for (const pair of room.pairs) { const members = pair.memberIds.map(id => getPlayer(room,id)).filter(Boolean); const correct = closestPairIds ? closestPairIds.has(pair.id) : resolvePair(q, pair, members); const points = correct ? Number(q.points || 1) : 0; pair.score += points; members.forEach(p => { p.score += points / members.length; p.response = null; }); results.push({ pairId: pair.id, correct, points }); }
  room.lastResult = { answer: q.answer ?? null, results, at: now }; room.phase = "reveal"; return room.lastResult;
}
// createQuestion(room) with no second argument falls back to
// room.deck[0] every time -- passing room.deck[room.qIndex] explicitly
// is what actually advances through the round instead of re-dealing the
// first card of the deck for the rest of the show.
export function advance(room) { if (room.phase !== "reveal") return { error: "Reveal is not open" }; room.qIndex++; if (room.qIndex >= room.deck.length) { room.phase = "over"; const max = Math.max(...room.pairs.map(p=>p.score), 0); room.winnerPairIds = room.pairs.filter(p=>p.score===max).map(p=>p.id); return { done: true }; } room.current = createQuestion(room, room.deck[room.qIndex]); room.phase = "question"; return { done: false, question: room.current }; }
export function rematch(room, byId, retainPairs = true) { if (byId !== room.hostId || room.phase !== "over") return { error: "Only the host can rematch" }; room.players = room.players.filter(p=>p.connected); room.players.forEach(p=>{p.score=0;p.response=null;if(!retainPairs)p.pairId=null;}); room.pairs.forEach(p=>p.score=0); if(!retainPairs)room.pairs=[]; room.phase = retainPairs ? "pairing" : "lobby"; return {}; }
export function publicState(room) { const hasResponse = id => Boolean(room.current?.responses && Object.prototype.hasOwnProperty.call(room.current.responses, id)); return { code: room.code, hostId: room.hostId, phase: room.phase, players: room.players.map(({resumeToken,response,...p})=>({...p, submitted: hasResponse(p.id)})), pairs: room.pairs.map(p=>{const memberNames=p.memberIds.map(id=>getPlayer(room,id)?.name).filter(Boolean);return {...p, members:p.memberIds, memberNames, name:memberNames.join(" + ")};}), settings: room.settings, qIndex: room.qIndex, current: room.current ? (({answer, responses, ...q})=>q)(room.current) : null, currentQuestion: room.current ? (({answer, responses, ...q})=>q)(room.current) : null, lastResult: room.phase === "reveal" || room.phase === "over" ? room.lastResult : null, winnerPairIds: room.winnerPairIds };
}
