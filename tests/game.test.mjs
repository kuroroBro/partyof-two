import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, proposePair, startGame, submitResponse, resolveQuestion, publicState, rejoinPlayer } from '../js/game.js';

function room() { const r = createRoom('ab12','p1'); for (let i=1;i<=4;i++) addPlayer(r,`p${i}`,`Player ${i}`,`t${i}`); proposePair(r,'p1','p2'); proposePair(r,'p2','p1'); proposePair(r,'p3','p4'); proposePair(r,'p4','p3'); return r; }
test('requires even paired roster', () => { const r=createRoom('x','h'); addPlayer(r,'h','Host'); assert.match(startGame(r,'h',{deck:[]}).error,/even/); });
test('pairing and scoring', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'two-words',answer:'x',answers:['a','b'],prompt:'?',points:2}]}); submitResponse(r,'p1','a'); submitResponse(r,'p2','b'); resolveQuestion(r); assert.equal(r.pairs[0].score,2); assert.equal(publicState(r).current.answer,undefined); });
test('public state shows submission status without leaking the answer', () => { const r=room(); startGame(r,'p1',{deck:[{mode:'emojis',answer:'x',prompt:'?',points:1}]}); assert.equal(publicState(r).players.find(p=>p.id==='p1').submitted,false); submitResponse(r,'p1','private answer'); const state=publicState(r); assert.equal(state.players.find(p=>p.id==='p1').submitted,true); assert.equal(state.current.responses,undefined); });
test('rejoin keeps seat', () => { const r=room(); const p=r.players[0]; p.connected=false; assert.equal(rejoinPlayer(r,'new',p.resumeToken).player.pairId,p.pairId); });
