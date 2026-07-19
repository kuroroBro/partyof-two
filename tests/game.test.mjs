import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, proposePair, startGame, submitResponse, resolveQuestion, publicState, rejoinPlayer, allPlayersSubmitted, removePlayer, questionTimeRemainingMs, questionTimerExpired, advance, claimSteal, submitStealResponse } from '../js/game.js';
import { MODES, QUESTIONS, questionsForModes } from '../js/questions.js';

function room() { const r = createRoom('ab12','p1'); for (let i=1;i<=4;i++) addPlayer(r,`p${i}`,`Player ${i}`,`t${i}`); proposePair(r,'p1','p2'); proposePair(r,'p2','p1'); proposePair(r,'p3','p4'); proposePair(r,'p4','p3'); return r; }
// 3 pairs (6 players) -- the minimum needed to test "one steal attempt
// misses, the window stays open for the remaining pair" rather than
// immediately exhausting after a single attempt.
function room3() { const r = createRoom('ab12','p1'); for (let i=1;i<=6;i++) addPlayer(r,`p${i}`,`Player ${i}`,`t${i}`); proposePair(r,'p1','p2'); proposePair(r,'p2','p1'); proposePair(r,'p3','p4'); proposePair(r,'p4','p3'); proposePair(r,'p5','p6'); proposePair(r,'p6','p5'); return r; }
test('requires even paired roster', () => { const r=createRoom('x','h'); addPlayer(r,'h','Host'); assert.match(startGame(r,'h',{deck:[]}).error,/even/); });
test('pairing and scoring', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'two-words',answer:'x',answers:['a','b'],prompt:'?',points:2}]}); submitResponse(r,'p1','a'); submitResponse(r,'p2','b'); resolveQuestion(r); assert.equal(r.pairs[0].score,2); assert.equal(publicState(r).current.answer,undefined); });
test('public state shows submission status without leaking the answer', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'generic',answer:'x',prompt:'?',points:1}]}); assert.equal(publicState(r).players.find(p=>p.id==='p1').submitted,false); submitResponse(r,'p1','private answer'); const state=publicState(r); assert.equal(state.players.find(p=>p.id==='p1').submitted,true); assert.equal(state.current.responses,undefined); });
test('detects when every connected player has submitted', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'generic',answer:'x',prompt:'?',points:1}]}); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p1','a'); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p2','b'); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p3','c'); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p4','d'); assert.equal(allPlayersSubmitted(r),true); });
test('rejoin keeps seat', () => { const r=room(); const p=r.players[0]; p.connected=false; assert.equal(rejoinPlayer(r,'new',p.resumeToken).player.pairId,p.pairId); });
test('a player\'s connection blipping mid-question does not shrink the quorum (no premature reveal)', () => {
  const r=room(); startGame(r,'p1',{deck:[{mode:'generic',answer:'x',prompt:'?',points:1}]});
  submitResponse(r,'p1','a');
  // p2's WebRTC connection drops for a moment -- routine on mobile (screen
  // lock, a bad signal) -- while they're still mid-question, not having
  // left the game.
  removePlayer(r,'p2');
  assert.equal(allPlayersSubmitted(r), false, 'p2 blipping must not excuse them from needing to answer');
  submitResponse(r,'p3','c');
  assert.equal(allPlayersSubmitted(r), false, 'p2 and p4 still have not answered');
});
test('timer expiry is computed from the question\'s own startedAt, not wall-clock drift', () => {
  const r=room(); startGame(r,'p1',{deck:[{mode:'generic',answer:'x',prompt:'?',points:1}],timerSeconds:20});
  const start=r.current.startedAt;
  assert.equal(questionTimerExpired(r, start), false);
  assert.equal(questionTimeRemainingMs(r, start), 20000);
  assert.equal(questionTimeRemainingMs(r, start + 5000), 15000);
  assert.equal(questionTimerExpired(r, start + 19999), false);
  assert.equal(questionTimerExpired(r, start + 20000), true);
  assert.equal(questionTimeRemainingMs(r, start + 45000), 0, 'never goes negative');
});
test('no timer configured means no expiry, ever', () => {
  const r=room(); startGame(r,'p1',{deck:[{mode:'generic',answer:'x',prompt:'?',points:1}],timerSeconds:0});
  assert.equal(questionTimeRemainingMs(r), null);
  assert.equal(questionTimerExpired(r, r.current.startedAt + 999999), false);
});
test('every mode has enough distinct content for a full round without repeats', () => {
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length, 'question ids must be unique');
  assert.equal(new Set(QUESTIONS.map((q) => q.prompt)).size, QUESTIONS.length, 'prompts must not repeat');
  for (const mode of MODES) assert.ok(questionsForModes([mode]).length >= 10, `${mode} needs enough content for a 5-question round plus a rematch`);
});
test('starting a real (non-stubbed) deck draws distinct questions per mode instead of cloning one', () => {
  const r = room();
  const seeded = (() => { let i = 0; const seq = [0.1, 0.9, 0.3, 0.7, 0.5]; return () => seq[i++ % seq.length]; })();
  startGame(r, 'p1', { modes: ['timeline'], questionsPerRound: 5, rng: seeded });
  const prompts = r.deck.map((q) => q.prompt);
  assert.equal(r.deck.length, 5);
  assert.equal(new Set(prompts).size, 5, 'a single mode\'s round must not repeat the same prompt');
  assert.ok(r.deck.every((q) => q.mode === 'timeline'));
});
test('advance() walks through the deck instead of re-dealing the first card forever', () => {
  const r = room();
  const deck = [
    { mode: 'timeline', prompt: 'first', answer: 'a', points: 1 },
    { mode: 'timeline', prompt: 'second', answer: 'b', points: 1 },
    { mode: 'timeline', prompt: 'third', answer: 'c', points: 1 },
  ];
  startGame(r, 'p1', { deck });
  assert.equal(r.current.prompt, 'first');
  submitResponse(r, 'p1', 'a'); submitResponse(r, 'p2', 'a'); submitResponse(r, 'p3', 'a'); submitResponse(r, 'p4', 'a');
  resolveQuestion(r);
  advance(r);
  assert.equal(r.current.prompt, 'second', 'must move to deck[1], not re-deal deck[0]');
  submitResponse(r, 'p1', 'b'); submitResponse(r, 'p2', 'b'); submitResponse(r, 'p3', 'b'); submitResponse(r, 'p4', 'b');
  resolveQuestion(r);
  advance(r);
  assert.equal(r.current.prompt, 'third', 'must move to deck[2], not re-deal deck[0]');
});
test('averages mode: closest combined average wins, not whoever hits the exact number', () => {
  const r = room();
  startGame(r, 'p1', { deck: [{ mode: 'averages', prompt: '?', answer: 50, points: 1 }] });
  // Neither pair hits 50 exactly -- pair p1+p2 averages 49 (off by 1),
  // pair p3+p4 averages 30 (off by 20). p1+p2 should win despite not
  // landing on the exact target; the old exact-match rule would have
  // scored both pairs zero.
  submitResponse(r, 'p1', 48); submitResponse(r, 'p2', 50);
  submitResponse(r, 'p3', 30); submitResponse(r, 'p4', 30);
  const result = resolveQuestion(r);
  const p1pair = r.players.find((p) => p.id === 'p1').pairId;
  const p3pair = r.players.find((p) => p.id === 'p3').pairId;
  assert.equal(result.results.find((x) => x.pairId === p1pair).correct, true);
  assert.equal(result.results.find((x) => x.pairId === p3pair).correct, false);
  assert.equal(r.pairs.find((p) => p.id === p1pair).score, 1);
  assert.equal(r.pairs.find((p) => p.id === p3pair).score, 0);
});
test('averages mode: a tied distance awards the point to every pair tied for closest', () => {
  const r = room();
  startGame(r, 'p1', { deck: [{ mode: 'averages', prompt: '?', answer: 50, points: 1 }] });
  submitResponse(r, 'p1', 45); submitResponse(r, 'p2', 55); // avg 50, exact
  submitResponse(r, 'p3', 40); submitResponse(r, 'p4', 60); // avg 50, exact
  const result = resolveQuestion(r);
  assert.ok(result.results.every((x) => x.correct === true), 'both pairs tied for closest (both exact) should score');
});
test('averages mode: a pair that never answers cannot beat a pair that guessed imperfectly', () => {
  const r = room();
  startGame(r, 'p1', { deck: [{ mode: 'averages', prompt: '?', answer: 50, points: 1 }] });
  submitResponse(r, 'p1', 48); submitResponse(r, 'p2', 52); // avg 50, exact
  // p3/p4 submit nothing at all.
  const result = resolveQuestion(r);
  const p1pair = r.players.find((p) => p.id === 'p1').pairId;
  const p3pair = r.players.find((p) => p.id === 'p3').pairId;
  assert.equal(result.results.find((x) => x.pairId === p1pair).correct, true);
  assert.equal(result.results.find((x) => x.pairId === p3pair).correct, false);
});
test('already-used questions are skipped on the next start while enough fresh ones remain', () => {
  const r = room();
  startGame(r, 'p1', { modes: ['timeline'], questionsPerRound: 5, rng: Math.random });
  const firstRoundIds = r.deck.map((q) => q.id);
  const r2 = room();
  startGame(r2, 'p1', { modes: ['timeline'], questionsPerRound: 5, usedIds: firstRoundIds, rng: Math.random });
  const secondRoundIds = r2.deck.map((q) => q.id);
  assert.equal(secondRoundIds.some((id) => firstRoundIds.includes(id)), false, 'a fresh start should avoid ids already marked used');
});

// ---------- emojis: one pair up, others may steal ----------
function emojiRoom(builder = room) { const r = builder(); startGame(r, 'p1', { deck: [{ mode: 'emojis', prompt: 'describe it', answer: 'titanic', points: 1 }] }); return r; }

test('emojis: only the clue-giver sees the real answer; the guesser and everyone else get a redacted prompt', () => {
  const r = emojiRoom();
  const { clueGiverId, guesserId } = r.current;
  const otherPairPlayer = r.players.find((p) => ![clueGiverId, guesserId].includes(p.id));
  assert.equal(publicState(r, clueGiverId).current.answer, 'titanic');
  assert.equal(publicState(r, guesserId).current.answer, undefined);
  assert.notEqual(publicState(r, guesserId).current.prompt, r.current.prompt, 'the guesser must not see the answer baked into the prompt text');
  assert.equal(publicState(r, otherPairPlayer.id).current.answer, undefined);
  assert.equal(publicState(r, clueGiverId).viewerRole, 'clueGiver');
  assert.equal(publicState(r, guesserId).viewerRole, 'guesser');
});

test('emojis: the clue-giver cannot submit a response -- only the designated guesser can', () => {
  const r = emojiRoom();
  const res = submitResponse(r, r.current.clueGiverId, 'anything');
  assert.match(res.error, /not answering/);
});

test('emojis: a correct guess from the active pair scores immediately, no steal window', () => {
  const r = emojiRoom();
  submitResponse(r, r.current.guesserId, 'Titanic');
  const result = resolveQuestion(r);
  assert.equal(result.results.find((x) => x.pairId === r.current.activePairId)?.correct, true);
  assert.equal(r.phase, 'reveal');
  const activePair = r.pairs.find((p) => p.id === r.lastResult.results.find((x) => x.correct).pairId);
  assert.equal(activePair.score, 1);
});

test('emojis: a wrong guess opens the steal window instead of ending the question', () => {
  const r = emojiRoom();
  submitResponse(r, r.current.guesserId, 'wrong guess');
  const result = resolveQuestion(r);
  assert.equal(result.stealOpen, true);
  assert.equal(r.phase, 'question', 'the question stays open for the steal window, not reveal');
  assert.equal(r.current.stealOpen, true);
});

test('emojis: the active pair cannot steal their own missed question', () => {
  const r = emojiRoom();
  submitResponse(r, r.current.guesserId, 'wrong guess');
  resolveQuestion(r);
  const claim = claimSteal(r, r.current.clueGiverId);
  assert.match(claim.error, /already had a turn/);
});

test('emojis: any other pair can claim the steal, first come first served', () => {
  const r = emojiRoom();
  const activeIds = [r.current.clueGiverId, r.current.guesserId];
  const stealer = r.players.find((p) => !activeIds.includes(p.id));
  submitResponse(r, r.current.guesserId, 'wrong guess');
  resolveQuestion(r);
  const claimed = claimSteal(r, stealer.id);
  assert.equal(claimed.ok, true);
  const partner = r.players.find((p) => p.pairId === stealer.pairId && p.id !== stealer.id);
  const blocked = claimSteal(r, partner.id);
  assert.match(blocked.error, /already claimed/);
});

test('emojis: a correct steal awards the stealing pair, not the original pair', () => {
  const r = emojiRoom();
  const activeIds = [r.current.clueGiverId, r.current.guesserId];
  const stealer = r.players.find((p) => !activeIds.includes(p.id));
  submitResponse(r, r.current.guesserId, 'wrong guess');
  resolveQuestion(r);
  claimSteal(r, stealer.id);
  const result = submitStealResponse(r, stealer.id, 'Titanic');
  assert.equal(result.results.find((x) => x.pairId === stealer.pairId)?.correct, true);
  assert.equal(result.results.find((x) => x.pairId === r.current.activePairId)?.correct, false);
  assert.equal(r.pairs.find((p) => p.id === stealer.pairId).score, 1);
});

test('emojis: a wrong steal reopens the window for the remaining pair, then resolves with nobody scoring once all have tried', () => {
  const r = emojiRoom(room3);
  const activeIds = [r.current.clueGiverId, r.current.guesserId];
  const others = r.pairs.filter((p) => p.id !== r.current.activePairId);
  assert.equal(others.length, 2, 'room3 has 3 pairs total, so 2 others besides the active pair');
  submitResponse(r, r.current.guesserId, 'wrong guess');
  resolveQuestion(r);

  const firstStealer = r.players.find((p) => p.pairId === others[0].id);
  claimSteal(r, firstStealer.id);
  const firstAttempt = submitStealResponse(r, firstStealer.id, 'nope');
  assert.equal(firstAttempt.correct, false);
  assert.equal(r.phase, 'question', 'still open -- the other pair has not tried yet');

  const secondStealer = r.players.find((p) => p.pairId === others[1].id);
  const reclaim = claimSteal(r, firstStealer.id); // first pair already tried, cannot buzz in again
  assert.match(reclaim.error, /already tried/);
  claimSteal(r, secondStealer.id);
  const secondAttempt = submitStealResponse(r, secondStealer.id, 'still nope');
  assert.equal(secondAttempt.results.every((x) => x.correct === false), true, 'every pair has now missed -- nobody scores');
  assert.equal(r.phase, 'reveal');
});

test('emojis: role assignment alternates clue-giver/guesser within a pair, and rotates which pair is up, across consecutive questions', () => {
  const r = room3();
  const deck = [
    { mode: 'emojis', prompt: 'first', answer: 'a', points: 1 },
    { mode: 'emojis', prompt: 'second', answer: 'b', points: 1 },
    { mode: 'emojis', prompt: 'third', answer: 'c', points: 1 },
  ];
  startGame(r, 'p1', { deck });
  const round1 = { activePairId: r.current.activePairId, clueGiverId: r.current.clueGiverId, guesserId: r.current.guesserId };
  submitResponse(r, r.current.guesserId, 'a'); resolveQuestion(r); advance(r);
  const round2 = { activePairId: r.current.activePairId, clueGiverId: r.current.clueGiverId, guesserId: r.current.guesserId };
  assert.notEqual(round2.activePairId, round1.activePairId, 'a different pair should be up round 2 (round-robin)');
  submitResponse(r, r.current.guesserId, 'b'); resolveQuestion(r); advance(r);
  const round3 = { activePairId: r.current.activePairId, clueGiverId: r.current.clueGiverId, guesserId: r.current.guesserId };
  assert.notEqual(round3.activePairId, round2.activePairId);
});

test('emojis: with fewer than 2 pairs, falls back to the generic all-pairs-answer path (no role split, no steal)', () => {
  const r = createRoom('x', 'p1'); addPlayer(r, 'p1', 'A'); addPlayer(r, 'p2', 'B');
  proposePair(r, 'p1', 'p2'); proposePair(r, 'p2', 'p1');
  startGame(r, 'p1', { deck: [{ mode: 'emojis', prompt: 'describe it', answer: 'titanic', points: 1 }] });
  assert.equal(r.current.activePairId, undefined);
  assert.equal(r.current.guesserId, undefined);
  // Both players may answer directly, same as any generic mode.
  assert.equal(submitResponse(r, 'p1', 'titanic').ok, true);
});
