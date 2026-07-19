import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, proposePair, startGame, submitResponse, resolveQuestion, publicState, rejoinPlayer, allPlayersSubmitted, removePlayer, questionTimeRemainingMs, questionTimerExpired } from '../js/game.js';

function room() { const r = createRoom('ab12','p1'); for (let i=1;i<=4;i++) addPlayer(r,`p${i}`,`Player ${i}`,`t${i}`); proposePair(r,'p1','p2'); proposePair(r,'p2','p1'); proposePair(r,'p3','p4'); proposePair(r,'p4','p3'); return r; }
test('requires even paired roster', () => { const r=createRoom('x','h'); addPlayer(r,'h','Host'); assert.match(startGame(r,'h',{deck:[]}).error,/even/); });
test('pairing and scoring', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'two-words',answer:'x',answers:['a','b'],prompt:'?',points:2}]}); submitResponse(r,'p1','a'); submitResponse(r,'p2','b'); resolveQuestion(r); assert.equal(r.pairs[0].score,2); assert.equal(publicState(r).current.answer,undefined); });
test('public state shows submission status without leaking the answer', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'emojis',answer:'x',prompt:'?',points:1}]}); assert.equal(publicState(r).players.find(p=>p.id==='p1').submitted,false); submitResponse(r,'p1','private answer'); const state=publicState(r); assert.equal(state.players.find(p=>p.id==='p1').submitted,true); assert.equal(state.current.responses,undefined); });
test('detects when every connected player has submitted', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'emojis',answer:'x',prompt:'?',points:1}]}); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p1','a'); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p2','b'); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p3','c'); assert.equal(allPlayersSubmitted(r),false); submitResponse(r,'p4','d'); assert.equal(allPlayersSubmitted(r),true); });
test('rejoin keeps seat', () => { const r=room(); const p=r.players[0]; p.connected=false; assert.equal(rejoinPlayer(r,'new',p.resumeToken).player.pairId,p.pairId); });
test('a player\'s connection blipping mid-question does not shrink the quorum (no premature reveal)', () => {
  const r=room(); startGame(r,'p1',{deck:[{mode:'emojis',answer:'x',prompt:'?',points:1}]});
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
  const r=room(); startGame(r,'p1',{deck:[{mode:'emojis',answer:'x',prompt:'?',points:1}],timerSeconds:20});
  const start=r.current.startedAt;
  assert.equal(questionTimerExpired(r, start), false);
  assert.equal(questionTimeRemainingMs(r, start), 20000);
  assert.equal(questionTimeRemainingMs(r, start + 5000), 15000);
  assert.equal(questionTimerExpired(r, start + 19999), false);
  assert.equal(questionTimerExpired(r, start + 20000), true);
  assert.equal(questionTimeRemainingMs(r, start + 45000), 0, 'never goes negative');
});
test('no timer configured means no expiry, ever', () => {
  const r=room(); startGame(r,'p1',{deck:[{mode:'emojis',answer:'x',prompt:'?',points:1}],timerSeconds:0});
  assert.equal(questionTimeRemainingMs(r), null);
  assert.equal(questionTimerExpired(r, r.current.startedAt + 999999), false);
});
