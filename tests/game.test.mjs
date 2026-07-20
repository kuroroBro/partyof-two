import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, proposePair, startGame, submitResponse, submitMixClues, submitMixDistractor, submitMixGuess, submitOutMixClues, submitOutMixBlock, submitOutMixGuess, submitMix2Clues, submitMix2Option, submitMix2Choice, resolveQuestion, publicState, rejoinPlayer, allPlayersSubmitted, removePlayer, questionTimeRemainingMs, questionTimerExpired, advance, claimSteal, submitStealResponse } from '../js/game.js';
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
    { mode: 'generic', prompt: 'first', answer: 'a', points: 1 },
    { mode: 'generic', prompt: 'second', answer: 'b', points: 1 },
    { mode: 'generic', prompt: 'third', answer: 'c', points: 1 },
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

// ---------- in the mix: clues, opposing distractors, then one guess ----------
function mixRoom(builder = room) { const r = builder(); startGame(r, 'p1', { deck: [{ mode: 'in-the-mix', prompt: 'Describe the secret subject.', answer: 'Pizza', points: 1 }] }); return r; }

test('in the mix: assigns one active pair and keeps the target secret from the guesser and opponents', () => {
  const r = mixRoom();
  const { clueGiverId, guesserId, activePairId } = r.current;
  const opponent = r.players.find((p) => p.pairId !== activePairId);
  assert.equal(r.current.stage, 'clues');
  assert.equal(publicState(r, clueGiverId).current.answer, 'Pizza');
  assert.equal(publicState(r, clueGiverId).viewerRole, 'mixClueGiver');
  assert.equal(publicState(r, guesserId).current.answer, undefined);
  assert.equal(publicState(r, guesserId).current.clueWords, undefined);
  assert.equal(publicState(r, guesserId).viewerRole, 'mixGuesser');
  assert.equal(publicState(r, opponent.id).current.answer, undefined);
  assert.equal(publicState(r, opponent.id).viewerRole, 'mixDistractor');
});

test('in the mix: validates exactly three distinct one-word clues from the designated clue-giver', () => {
  const r = mixRoom();
  assert.match(submitMixClues(r, r.current.guesserId, ['hot', 'cheesy', 'round']).error, /clue-giver/);
  assert.match(submitMixClues(r, r.current.clueGiverId, ['hot', 'very cheesy', 'round']).error, /one word/);
  assert.match(submitMixClues(r, r.current.clueGiverId, ['hot', 'Hot', 'round']).error, /different/);
  const result = submitMixClues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round'], 1000);
  assert.equal(result.stage, 'distractors');
  assert.deepEqual(r.current.clueWords, ['hot', 'cheesy', 'round']);
  assert.equal(r.current.stageStartedAt, 1000);
});

test('in the mix: each opposing pair adds one unique distractor and the guesser alone receives the stable mix', () => {
  const r = mixRoom(room3);
  const { activePairId, clueGiverId, guesserId } = r.current;
  submitMixClues(r, clueGiverId, ['hot', 'cheesy', 'round']);
  const opposingPairs = r.pairs.filter((pair) => pair.id !== activePairId);
  const first = r.players.find((p) => p.pairId === opposingPairs[0].id);
  const firstPartner = r.players.find((p) => p.pairId === first.pairId && p.id !== first.id);
  const second = r.players.find((p) => p.pairId === opposingPairs[1].id);
  assert.equal(submitMixDistractor(r, first.id, 'Moon').stage, 'distractors');
  assert.match(submitMixDistractor(r, firstPartner.id, 'plate').error, /already submitted/);
  assert.match(submitMixDistractor(r, second.id, 'HOT').error, /already in the mix/);
  assert.equal(submitMixDistractor(r, second.id, 'plate').stage, 'guessing');
  assert.deepEqual(new Set(r.current.mixedWords.map((word) => word.toLowerCase())), new Set(['hot', 'cheesy', 'round', 'moon', 'plate']));
  assert.deepEqual(publicState(r, guesserId).current.mixedWords, r.current.mixedWords);
  assert.deepEqual(publicState(r, clueGiverId).current.mixedWords, r.current.mixedWords);
  assert.equal(publicState(r, first.id).current.mixedWords, undefined);
  assert.equal(publicState(r, guesserId).current.clueWords, undefined, 'the guesser sees only the shuffled mix, not which words were genuine');
});

test('in the mix: only the designated guesser can answer and only the active pair scores', () => {
  const r = mixRoom();
  const { activePairId, clueGiverId, guesserId } = r.current;
  submitMixClues(r, clueGiverId, ['hot', 'cheesy', 'round']);
  const opponent = r.players.find((p) => p.pairId !== activePairId);
  submitMixDistractor(r, opponent.id, 'moon');
  assert.match(submitMixGuess(r, opponent.id, 'Pizza').error, /designated guesser/);
  const result = submitMixGuess(r, guesserId, 'pizza');
  assert.equal(r.phase, 'reveal');
  assert.equal(result.results.find((entry) => entry.pairId === activePairId).correct, true);
  assert.equal(r.pairs.find((pair) => pair.id === activePairId).score, 1);
  assert.equal(r.pairs.find((pair) => pair.id !== activePairId).score, 0);
  assert.deepEqual(r.lastResult.clueWords, ['hot', 'cheesy', 'round']);
  assert.equal(Object.values(r.lastResult.distractors)[0].word, 'moon');
});

test('in the mix: distractor timeout advances to guessing and resets the stage timer', () => {
  const r = mixRoom(room3);
  submitMixClues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round'], 1000);
  const result = resolveQuestion(r, 5000);
  assert.equal(result.stage, 'guessing');
  assert.equal(r.phase, 'question');
  assert.equal(r.current.stageStartedAt, 5000);
  assert.deepEqual(new Set(r.current.mixedWords), new Set(['hot', 'cheesy', 'round']));
});

test('in the mix: real deck prompts never reveal their target text', () => {
  for (const question of questionsForModes(['in-the-mix'])) {
    assert.equal(question.prompt.toLowerCase().includes(String(question.answer).toLowerCase()), false, `${question.id} leaks its answer in the prompt`);
  }
});

test('in the mix: active pairs rotate and teammates swap clue-giver roles when their pair returns', () => {
  const r = room();
  const deck = ['Pizza', 'Beach', 'Coffee'].map((answer, index) => ({ mode: 'in-the-mix', prompt: `mix ${index}`, answer, points: 1 }));
  startGame(r, 'p1', { deck });
  const first = { pairId: r.current.activePairId, clueGiverId: r.current.clueGiverId };
  const play = () => {
    submitMixClues(r, r.current.clueGiverId, ['bright', 'happy', 'round']);
    const opponent = r.players.find((player) => player.pairId !== r.current.activePairId);
    submitMixDistractor(r, opponent.id, 'cloud');
    submitMixGuess(r, r.current.guesserId, 'wrong');
  };
  play(); advance(r);
  assert.notEqual(r.current.activePairId, first.pairId);
  play(); advance(r);
  assert.equal(r.current.activePairId, first.pairId);
  assert.notEqual(r.current.clueGiverId, first.clueGiverId);
});

// ---------- out of the mix: clues, blind opponent blocks, then one guess ----------
function outMixRoom(builder = room) { const r = builder(); startGame(r, 'p1', { deck: [{ mode: 'out-of-the-mix', prompt: 'Describe the secret subject.', answer: 'Pizza', points: 1 }] }); return r; }

test('out of the mix: assigns one active pair and never shows the clue words to opposing pairs', () => {
  const r = outMixRoom(room3);
  const { clueGiverId, guesserId, activePairId } = r.current;
  const opponent = r.players.find((p) => p.pairId !== activePairId);
  assert.equal(r.current.stage, 'clues');
  assert.equal(publicState(r, clueGiverId).current.answer, 'Pizza');
  assert.equal(publicState(r, clueGiverId).viewerRole, 'outMixClueGiver');
  assert.equal(publicState(r, guesserId).current.answer, undefined);
  assert.equal(publicState(r, guesserId).viewerRole, 'outMixGuesser');
  assert.equal(publicState(r, opponent.id).viewerRole, 'outMixBlocker');
  assert.equal(publicState(r, opponent.id).current.clueWords, undefined);
  submitOutMixClues(r, clueGiverId, ['hot', 'cheesy', 'round']);
  // Blind guessing: opposing pairs must never see the real clue words,
  // at any stage -- unlike In the Mix's distractor stage, which shows
  // them on purpose so the fake word can blend in.
  assert.equal(publicState(r, opponent.id).current.clueWords, undefined);
  assert.equal(publicState(r, guesserId).current.clueWords, undefined);
});

test('out of the mix: validates exactly three distinct one-word clues from the designated clue-giver', () => {
  const r = outMixRoom();
  assert.match(submitOutMixClues(r, r.current.guesserId, ['hot', 'cheesy', 'round']).error, /clue-giver/);
  assert.match(submitOutMixClues(r, r.current.clueGiverId, ['hot', 'very cheesy', 'round']).error, /one word/);
  assert.match(submitOutMixClues(r, r.current.clueGiverId, ['hot', 'Hot', 'round']).error, /different/);
  const result = submitOutMixClues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round'], 1000);
  assert.equal(result.stage, 'blocking');
  assert.deepEqual(r.current.clueWords, ['hot', 'cheesy', 'round']);
  assert.equal(r.current.stageStartedAt, 1000);
});

test('out of the mix: a matched blind guess removes that word; an unmatched guess removes nothing', () => {
  const r = outMixRoom(room3);
  const { activePairId, guesserId } = r.current;
  submitOutMixClues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round']);
  const opposingPairs = r.pairs.filter((pair) => pair.id !== activePairId);
  const first = r.players.find((p) => p.pairId === opposingPairs[0].id);
  const firstPartner = r.players.find((p) => p.pairId === first.pairId && p.id !== first.id);
  const second = r.players.find((p) => p.pairId === opposingPairs[1].id);
  assert.equal(submitOutMixBlock(r, first.id, 'HOT').stage, 'blocking'); // matches -- will be removed
  assert.match(submitOutMixBlock(r, firstPartner.id, 'plate').error, /already submitted/);
  assert.equal(submitOutMixBlock(r, second.id, 'plate').stage, 'guessing'); // no match -- nothing removed by this guess
  assert.deepEqual(r.current.remainingWords, ['cheesy', 'round'], 'the matched word "hot" is gone; the others survive');
  assert.deepEqual(publicState(r, guesserId).current.remainingWords, ['cheesy', 'round']);
});

test('out of the mix: only the designated guesser can answer, using the surviving words, and only the active pair scores', () => {
  const r = outMixRoom();
  const { activePairId, guesserId } = r.current;
  submitOutMixClues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round']);
  const opponent = r.players.find((p) => p.pairId !== activePairId);
  submitOutMixBlock(r, opponent.id, 'nope');
  assert.match(submitOutMixGuess(r, opponent.id, 'Pizza').error, /designated guesser/);
  const result = submitOutMixGuess(r, guesserId, 'pizza');
  assert.equal(r.phase, 'reveal');
  assert.equal(result.results.find((entry) => entry.pairId === activePairId).correct, true);
  assert.equal(r.pairs.find((pair) => pair.id === activePairId).score, 1);
  assert.equal(r.pairs.find((pair) => pair.id !== activePairId).score, 0);
  assert.deepEqual(r.lastResult.clueWords, ['hot', 'cheesy', 'round']);
  assert.deepEqual(r.lastResult.remainingWords, ['hot', 'cheesy', 'round']);
});

test('out of the mix: blocking timeout advances to guessing with whatever guesses actually arrived', () => {
  const r = outMixRoom(room3);
  submitOutMixClues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round'], 1000);
  const opponent = r.players.find((p) => p.pairId !== r.current.activePairId);
  submitOutMixBlock(r, opponent.id, 'cheesy');
  const result = resolveQuestion(r, 5000);
  assert.equal(result.stage, 'guessing');
  assert.equal(r.phase, 'question');
  assert.equal(r.current.stageStartedAt, 5000);
  assert.deepEqual(r.current.remainingWords, ['hot', 'round']);
});

test('out of the mix: real deck prompts never reveal their target text', () => {
  for (const question of questionsForModes(['out-of-the-mix'])) {
    assert.equal(question.prompt.toLowerCase().includes(String(question.answer).toLowerCase()), false, `${question.id} leaks its answer in the prompt`);
  }
});

test('out of the mix: active pairs rotate and teammates swap clue-giver roles when their pair returns', () => {
  const r = room();
  const deck = ['Pizza', 'Beach', 'Coffee'].map((answer, index) => ({ mode: 'out-of-the-mix', prompt: `mix ${index}`, answer, points: 1 }));
  startGame(r, 'p1', { deck });
  const first = { pairId: r.current.activePairId, clueGiverId: r.current.clueGiverId };
  const play = () => {
    submitOutMixClues(r, r.current.clueGiverId, ['bright', 'happy', 'round']);
    const opponent = r.players.find((player) => player.pairId !== r.current.activePairId);
    submitOutMixBlock(r, opponent.id, 'cloud');
    submitOutMixGuess(r, r.current.guesserId, 'wrong');
  };
  play(); advance(r);
  assert.notEqual(r.current.activePairId, first.pairId);
  play(); advance(r);
  assert.equal(r.current.activePairId, first.pairId);
  assert.notEqual(r.current.clueGiverId, first.clueGiverId);
});

// ---------- timeline: reference + two mystery events, ordered by the pair ----------
function timelineQ() { return { mode: 'timeline', prompt: '?', reference: { id: 'ref', label: 'Reference', year: 2000 }, events: [{ id: 'e1', label: 'Earlier', year: 1990 }, { id: 'e2', label: 'Later', year: 2010 }], points: 1 }; }

test('timeline: mystery event years are hidden from every viewer before reveal, but the reference year is shown', () => {
  const r = room();
  startGame(r, 'p1', { deck: [timelineQ()] });
  const seen = publicState(r, 'p1').current;
  assert.equal(seen.reference.year, 2000, 'the reference year is the given anchor, always visible');
  assert.equal(seen.events.every((e) => e.year === undefined), true, 'mystery event years must not leak before reveal');
  assert.deepEqual(seen.events.map((e) => e.id).sort(), ['e1', 'e2']);
});

test('timeline: rejects a submission that is not a full permutation of all three event ids', () => {
  const r = room();
  startGame(r, 'p1', { deck: [timelineQ()] });
  assert.match(submitResponse(r, 'p1', ['ref', 'e1']).error, /full ordering/, 'missing an id');
  assert.match(submitResponse(r, 'p1', ['ref', 'e1', 'e1']).error, /full ordering/, 'duplicate id instead of the third');
  assert.match(submitResponse(r, 'p1', ['ref', 'e1', 'nope']).error, /full ordering/, 'unknown id');
  assert.equal(submitResponse(r, 'p1', ['e1', 'ref', 'e2']).ok, true, 'a valid permutation is accepted');
});

test('timeline: a pair scores only when either teammate submits the true chronological order', () => {
  const r = room();
  startGame(r, 'p1', { deck: [timelineQ()] }); // true order: e1 (1990) -> ref (2000) -> e2 (2010)
  submitResponse(r, 'p1', ['e1', 'ref', 'e2']); // p1+p2 pair: correct
  submitResponse(r, 'p2', ['ref', 'e1', 'e2']); // p2 individually wrong, but p1 already got it right
  submitResponse(r, 'p3', ['ref', 'e1', 'e2']); // p3+p4 pair: wrong order
  submitResponse(r, 'p4', ['e2', 'e1', 'ref']); // also wrong
  const result = resolveQuestion(r);
  const p1pair = r.players.find((p) => p.id === 'p1').pairId;
  const p3pair = r.players.find((p) => p.id === 'p3').pairId;
  assert.equal(result.results.find((x) => x.pairId === p1pair).correct, true);
  assert.equal(result.results.find((x) => x.pairId === p3pair).correct, false);
  assert.deepEqual(r.lastResult.correctOrder, ['e1', 'ref', 'e2']);
  assert.equal(r.lastResult.events.find((e) => e.id === 'e1').year, 1990, 'years are revealed once resolved');
});

// ---------- in the mix 2: clues, opposing multiple-choice decoys, then a tap-to-pick guess ----------
function mix2Room(builder = room) { const r = builder(); startGame(r, 'p1', { deck: [{ mode: 'in-the-mix-2', prompt: 'Describe the secret subject.', answer: 'Pizza', points: 1 }] }); return r; }

test('in the mix 2: opposing pairs see the real clue words (to write a plausible decoy), but never the correct choice id', () => {
  const r = mix2Room(room3);
  const { clueGiverId, guesserId, activePairId } = r.current;
  const opponent = r.players.find((p) => p.pairId !== activePairId);
  assert.equal(r.current.stage, 'clues');
  assert.equal(publicState(r, clueGiverId).current.answer, 'Pizza');
  assert.equal(publicState(r, clueGiverId).viewerRole, 'mix2ClueGiver');
  assert.equal(publicState(r, guesserId).current.answer, undefined);
  assert.equal(publicState(r, guesserId).viewerRole, 'mix2Guesser');
  assert.equal(publicState(r, opponent.id).viewerRole, 'mix2Option');
  submitMix2Clues(r, clueGiverId, ['hot', 'cheesy', 'round']);
  assert.deepEqual(publicState(r, opponent.id).current.clueWords, ['hot', 'cheesy', 'round'], 'opponents see the clues -- they need them to write a believable decoy');
  assert.equal(publicState(r, opponent.id).current.correctChoiceId, undefined);
  assert.equal(publicState(r, guesserId).current.correctChoiceId, undefined);
  assert.equal(publicState(r, clueGiverId).current.correctChoiceId, undefined, 'not even the clue-giver gets the raw flag -- they already know via answer');
});

test('in the mix 2: each opposing pair adds one decoy option and the guesser sees a shuffled multiple-choice list', () => {
  const r = mix2Room(room3);
  const { activePairId, clueGiverId, guesserId } = r.current;
  submitMix2Clues(r, clueGiverId, ['hot', 'cheesy', 'round']);
  const opposingPairs = r.pairs.filter((pair) => pair.id !== activePairId);
  const first = r.players.find((p) => p.pairId === opposingPairs[0].id);
  const firstPartner = r.players.find((p) => p.pairId === first.pairId && p.id !== first.id);
  const second = r.players.find((p) => p.pairId === opposingPairs[1].id);
  assert.equal(submitMix2Option(r, first.id, 'Calzone').stage, 'options');
  assert.match(submitMix2Option(r, firstPartner.id, 'Bread').error, /already submitted/);
  assert.match(submitMix2Option(r, second.id, 'Pizza').error, /isn't already an option/, 'a decoy cannot literally be the real answer');
  assert.equal(submitMix2Option(r, second.id, 'Lasagna').stage, 'choosing');
  assert.equal(r.current.choices.length, 3, 'the true answer plus one decoy per opposing pair');
  assert.deepEqual(new Set(r.current.choices.map((c) => c.text)), new Set(['Pizza', 'Calzone', 'Lasagna']));
  assert.deepEqual(publicState(r, guesserId).current.choices.map((c) => c.text).sort(), ['Calzone', 'Lasagna', 'Pizza']);
  assert.equal(publicState(r, first.id).current.choices, undefined, 'opposing pairs do not see the final choice list');
});

test('in the mix 2: only the designated guesser can choose, and only a correct pick scores the active pair', () => {
  const r = mix2Room();
  const { activePairId, guesserId } = r.current;
  submitMix2Clues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round']);
  const opponent = r.players.find((p) => p.pairId !== activePairId);
  submitMix2Option(r, opponent.id, 'Calzone');
  const trueChoice = r.current.choices.find((c) => c.text === 'Pizza');
  assert.match(submitMix2Choice(r, opponent.id, trueChoice.id).error, /designated guesser/);
  assert.match(submitMix2Choice(r, guesserId, 'not-a-real-id').error, /listed options/);
  const result = submitMix2Choice(r, guesserId, trueChoice.id);
  assert.equal(r.phase, 'reveal');
  assert.equal(result.results.find((entry) => entry.pairId === activePairId).correct, true);
  assert.equal(r.pairs.find((pair) => pair.id === activePairId).score, 1);
  assert.equal(r.lastResult.chosenId, trueChoice.id);
  assert.equal(r.lastResult.correctChoiceId, trueChoice.id);
});

test('in the mix 2: picking a decoy does not score the active pair', () => {
  const r = mix2Room();
  const { activePairId, guesserId } = r.current;
  submitMix2Clues(r, r.current.clueGiverId, ['hot', 'cheesy', 'round']);
  const opponent = r.players.find((p) => p.pairId !== activePairId);
  submitMix2Option(r, opponent.id, 'Calzone');
  const decoy = r.current.choices.find((c) => c.text === 'Calzone');
  const result = submitMix2Choice(r, guesserId, decoy.id);
  assert.equal(result.results.find((entry) => entry.pairId === activePairId).correct, false);
  assert.equal(r.pairs.find((pair) => pair.id === activePairId).score, 0);
});

test('in the mix 2: real deck prompts never reveal their target text', () => {
  for (const question of questionsForModes(['in-the-mix-2'])) {
    assert.equal(question.prompt.toLowerCase().includes(String(question.answer).toLowerCase()), false, `${question.id} leaks its answer in the prompt`);
  }
});
