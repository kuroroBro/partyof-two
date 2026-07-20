import * as game from './game.js';
import {hostRoom,joinRoom,normalizeCode} from './room.js';
import {createResumeToken,loadPlayerSession,savePlayerSession,loadUsedQuestionIds,markQuestionsUsed} from './storage.js';
const $=id=>document.getElementById(id), screens=['home','lobby','question','reveal','over']; let transport,state,myId,isHost=false,hostRoomState; const answerDrafts=new Map();
const show=s=>screens.forEach(x=>$(`screen-${x}`).classList.toggle('hidden',x!==s));
const me=()=>state?.players?.find(p=>p.id===myId); const call=(names,...args)=>{for(const n of names)if(typeof game[n]==='function')return game[n](...args);return null};
function invite(code){const url=`${location.origin}${location.pathname}?room=${code}`;$('room-invite-url').textContent=url;$('room-qr').replaceChildren();if(typeof qrcode==='function'){const qr=qrcode(0,'M');qr.addData(url);qr.make();$('room-qr').innerHTML=qr.createSvgTag({cellSize:3,margin:1})}return url}
// Emojis needs each player to see a DIFFERENT view of the same question
// (only the clue-giver may see the answer) -- publicState(room, viewerId)
// already computes that per-viewer, but broadcasting it usefully means
// sending each connection its OWN payload via broadcastEach, not one
// shared `broadcast` payload to everyone (which is all this used to do,
// so a stray answer field would have leaked identically to every device
// the instant Emojis roles existed).
function publish(){state=call(['toPublicState','publicState'],hostRoomState,myId)||hostRoomState;transport?.broadcastEach?.(viewerId=>({event:'state',payload:call(['toPublicState','publicState'],hostRoomState,viewerId)}));render()}
function hostMessage(id,event,payload){let r;if(event==='join'){r=payload.resumeToken?game.rejoinPlayer(hostRoomState,id,payload.resumeToken):{error:'No saved seat found'};if(r?.error)r=game.addPlayer(hostRoomState,id,payload.name,payload.resumeToken)}else if(event==='proposePair')r=game.proposePair(hostRoomState,id,payload.targetId);else if(event==='start'){r=game.startGame(hostRoomState,id,{...payload,usedIds:loadUsedQuestionIds()});if(!r?.error)markQuestionsUsed(hostRoomState.deck.map(q=>q.id))}else if(event==='submitResponse'){r=game.submitResponse(hostRoomState,id,payload.response);if(!r?.error&&game.allPlayersSubmitted(hostRoomState))game.resolveQuestion(hostRoomState)}else if(event==='submitMixClues')r=game.submitMixClues(hostRoomState,id,payload.words);else if(event==='submitMixDistractor')r=game.submitMixDistractor(hostRoomState,id,payload.word);else if(event==='submitMixGuess')r=game.submitMixGuess(hostRoomState,id,payload.response);else if(event==='submitOutMixClues')r=game.submitOutMixClues(hostRoomState,id,payload.words);else if(event==='submitOutMixBlock')r=game.submitOutMixBlock(hostRoomState,id,payload.word);else if(event==='submitOutMixGuess')r=game.submitOutMixGuess(hostRoomState,id,payload.response);else if(event==='submitMix2Clues')r=game.submitMix2Clues(hostRoomState,id,payload.words);else if(event==='submitMix2Option')r=game.submitMix2Option(hostRoomState,id,payload.text);else if(event==='submitMix2Choice')r=game.submitMix2Choice(hostRoomState,id,payload.choiceId);else if(event==='claimSteal')r=game.claimSteal(hostRoomState,id);else if(event==='submitSteal')r=game.submitStealResponse(hostRoomState,id,payload.response);else if(event==='next'){game.resolveQuestion(hostRoomState);r=game.advance(hostRoomState)}else if(event==='rematch')r=game.rematch(hostRoomState,id,true);publish();return {ok:!r?.error,error:r?.error,state:game.publicState(hostRoomState,id)}}
function hostClose(id){if(hostRoomState)game.removePlayer(hostRoomState,id);publish()}
async function create(){try{isHost=true;const name=$('name-input').value.trim()||'Host';transport=await hostRoom({onMessage:hostMessage,onPeerClose:hostClose,onError:e=>toast(e)});myId='host';hostRoomState=game.createRoom(transport.code,myId);if(!$('display-checkbox').checked)game.addPlayer(hostRoomState,myId,name);state=game.publicState(hostRoomState,myId);localStorage.setItem('partyofTwoLast',transport.code);render()}catch(e){$('home-error').textContent=e.message}}
async function join(){try{isHost=false;const code=normalizeCode($('code-input').value);if(code.length!==4)throw Error('Enter the four-letter room code.');const saved=loadPlayerSession(code);const resumeToken=saved?.resumeToken||createResumeToken();transport=await joinRoom(code,{onPush:(e,p)=>{if(e==='state'){state=p;render()}},onClose:e=>toast(e)});myId=transport.id;const result=await transport.send('join',{name:$('name-input').value.trim()||saved?.name||'Player',resumeToken});savePlayerSession(code,{resumeToken,name:$('name-input').value.trim()||saved?.name||'Player'});state=result?.state||state;render()}catch(e){$('home-error').textContent=e.message}}
function render(){if(!state)return;const phase=state.phase||'lobby';show(phase==='lobby'||phase==='pairing'?'lobby':phase);if(phase==='lobby'||phase==='pairing')renderLobby();if(phase==='question')renderQuestion();if(phase==='reveal')renderReveal();if(phase==='over')renderOver()}
function renderLobby(){ $('lobby-code').textContent=state.code||'----';invite(state.code);const players=state.players||[];$('lobby-players').replaceChildren(...players.map(p=>{const row=document.createElement('div');row.className='leader-row';row.innerHTML=`<span class="leader-rank">${p.pairId?'🤝':'?'}</span><span class="leader-name"></span><span class="leader-score">${p.pairId||'Unpaired'}</span>`;row.querySelector('.leader-name').textContent=`${p.name}${p.connected===false?' · offline':''}`;return row}));const self=me();$('pairing-controls').classList.toggle('hidden',!self||phaseNotPairing());const buttons=$('pair-buttons');buttons.replaceChildren(...players.filter(p=>p.id!==myId&&!p.pairId).map(p=>{const b=document.createElement('button');b.className='choice';b.textContent=`Pair with ${p.name}`;b.onclick=()=>act('proposePair',{targetId:p.id});return b}));$('host-settings').classList.toggle('hidden',!isHost);$('start-btn').classList.toggle('hidden',!isHost);$('start-btn').disabled=players.length<2||players.length%2===1||players.some(p=>!p.pairId);$('pair-status').textContent=`${players.length} players · ${players.length%2?'Need an even number · ':''}${players.filter(p=>!p.pairId).length} unpaired`;}
function phaseNotPairing(){return state.phase!=='pairing'&&state.phase!=='lobby'}
// Every submission (including a partner's, or anyone else's in the room)
// re-broadcasts state and re-renders this screen for everyone still
// waiting to answer. Rebuilding the <input>/<button> from scratch on
// every one of those renders -- as this used to -- tore out whichever
// player was mid-keystroke: a fresh DOM node has no focus, and on mobile
// that silently dismisses the on-screen keyboard out from under them.
// Reuse the existing nodes across renders; only rebuild when the
// question itself actually changes.
// Shared, focus-preserving text-answer control used by every path that
// needs one (the normal generic answer, the emojis guesser, and the
// emojis steal attempt): reuses the existing <input>/<button> across
// re-renders and only rebuilds them when `key` actually changes, so a
// partner's submission -- or anyone else's, in any of these modes --
// never steals focus/dismisses the on-screen keyboard mid-type.
function renderTextAnswerForm(form,key,placeholder,onSubmit,locked,statusText){
  let input=form.querySelector('input'),btn=form.querySelector('button'),note=form.querySelector('.answer-status');
  if(form.dataset.questionKey!==key||!input){
    form.replaceChildren();form.dataset.questionKey=key;
    input=document.createElement('input');input.placeholder=placeholder||'Your private answer';input.value=answerDrafts.get(key)||'';input.setAttribute('aria-label','Your answer');input.oninput=()=>answerDrafts.set(key,input.value);
    btn=document.createElement('button');btn.className='btn btn-primary';btn.onclick=()=>{answerDrafts.set(key,input.value);onSubmit(input.value)};
    note=document.createElement('small');note.className='answer-status';
    form.append(input,btn,note);
  }
  input.disabled=locked;btn.disabled=locked;btn.textContent=locked?'Submitted':'Lock answer';
  if(statusText!==undefined)note.textContent=statusText||'';
}
// Emojis is a "one pair up, others may steal" format (see game.js) --
// every player sees a different thing depending on their relationship to
// the current question. viewerRole comes precomputed from publicState;
// this just turns it into the right UI, distinct from the shared
// all-pairs-answer-in-parallel path every other mode uses.
function renderEmojiQuestion(form,q,role){
  const clueGiverName=state.players.find(p=>p.id===q.clueGiverId)?.name||'Their teammate';
  const guesserName=state.players.find(p=>p.id===q.guesserId)?.name||'Their teammate';
  const claimerName=q.stealClaimerId&&state.players.find(p=>p.id===q.stealClaimerId)?.name;
  const key=`${q.id||`question-${state.qIndex||0}`}:${role}`;
  const passive=(text)=>{form.replaceChildren();delete form.dataset.questionKey;const note=document.createElement('p');note.className='answer-status';note.textContent=text;form.append(note)};
  if(role==='clueGiver')return passive(`🤫 No talking -- emojis only! ${guesserName} is guessing.`);
  if(role==='guesser')return renderTextAnswerForm(form,key,'Your teammate is emoji-ing something…',(value)=>act('submitResponse',{response:value}),Boolean(me()?.submitted));
  if(role==='stealing')return renderTextAnswerForm(form,key,'One guess -- make it count!',(value)=>act('submitSteal',{response:value}),false);
  if(role==='stealAvailable'){form.replaceChildren();delete form.dataset.questionKey;const btn=document.createElement('button');btn.className='btn btn-primary';btn.textContent='🔔 Steal!';btn.onclick=()=>act('claimSteal',{});form.append(btn);return}
  if(role==='stealBlocked')return passive(`${claimerName||'Another pair'} is attempting to steal…`);
  if(role==='stealSpent')return passive('Your pair already tried stealing this one.');
  return passive(`${clueGiverName} & ${guesserName} are up this round.`); // spectating, steal not open yet
}
function renderMixWords(form,words){const list=document.createElement('div');list.className='mix-words';for(const word of words||[]){const chip=document.createElement('span');chip.className='mix-word';chip.textContent=word;list.append(chip)}form.append(list)}
function renderMixTextAnswer(form,key,words,placeholder,onSubmit,locked,statusText){let controls=form.querySelector('.mix-text-control');if(form.dataset.questionKey!==key||!controls){form.replaceChildren();form.dataset.questionKey=key;renderMixWords(form,words);controls=document.createElement('div');controls.className='mix-text-control';form.append(controls)}return renderTextAnswerForm(controls,key,placeholder,onSubmit,locked,statusText)}
function renderMixQuestion(form,q,role){
  const key=`${q.id||`question-${state.qIndex||0}`}:${q.stage}:${role}`;
  const passive=(text,words)=>{form.replaceChildren();delete form.dataset.questionKey;if(words?.length)renderMixWords(form,words);const note=document.createElement('p');note.className='answer-status';note.textContent=text;form.append(note)};
  const submittedPairs=q.submittedPairIds?.length||0;
  const opposingPairs=Math.max(0,(state.pairs?.length||0)-1);
  if(q.stage==='clues'){
    if(role!=='mixClueGiver')return passive('The clue-giver is choosing three secret words…');
    if(form.dataset.questionKey!==key){form.replaceChildren();form.dataset.questionKey=key;const fields=document.createElement('div');fields.className='mix-inputs';for(let i=0;i<3;i++){const input=document.createElement('input');input.placeholder=`Clue word ${i+1}`;input.maxLength=24;input.setAttribute('aria-label',`Clue word ${i+1}`);input.value=answerDrafts.get(`${key}:${i}`)||'';input.oninput=()=>answerDrafts.set(`${key}:${i}`,input.value);fields.append(input)}const btn=document.createElement('button');btn.className='btn btn-primary';btn.textContent='Lock three clues';btn.onclick=()=>act('submitMixClues',{words:[...fields.querySelectorAll('input')].map(input=>input.value)});form.append(fields,btn)}
    return;
  }
  if(q.stage==='distractors'){
    if(role==='mixDistractor'){
      return renderMixTextAnswer(form,key,q.clueWords,'Add one confusing word',(word)=>act('submitMixDistractor',{word}),false,`${submittedPairs} of ${opposingPairs} opposing pairs ready`);
    }
    if(role==='mixDistractorSubmitted')return passive(`Your pair's distractor is locked · ${submittedPairs} of ${opposingPairs} ready`,q.clueWords);
    return passive(`Opposing pairs are adding confusing words · ${submittedPairs} of ${opposingPairs} ready`);
  }
  if(q.stage==='guessing'){
    if(role==='mixGuesser')return renderMixTextAnswer(form,key,q.mixedWords,'What is the secret subject?',(response)=>act('submitMixGuess',{response}),Boolean(me()?.submitted));
    return passive('The guesser is studying the mix…',q.mixedWords);
  }
  return passive('Get ready for In the Mix.');
}
// Out of the Mix mirrors renderMixQuestion's structure, but opposing
// pairs guessing blind never see the clue words (game.js withholds them
// entirely from that role -- see redactCurrentForViewer), so their input
// stage never displays a word list the way In the Mix's distractor stage
// does.
function renderOutMixQuestion(form,q,role){
  const key=`${q.id||`question-${state.qIndex||0}`}:${q.stage}:${role}`;
  const passive=(text,words)=>{form.replaceChildren();delete form.dataset.questionKey;if(words?.length)renderMixWords(form,words);const note=document.createElement('p');note.className='answer-status';note.textContent=text;form.append(note)};
  const submittedPairs=q.submittedPairIds?.length||0;
  const opposingPairs=Math.max(0,(state.pairs?.length||0)-1);
  if(q.stage==='clues'){
    if(role!=='outMixClueGiver')return passive('The clue-giver is choosing three secret words…');
    if(form.dataset.questionKey!==key){form.replaceChildren();form.dataset.questionKey=key;const fields=document.createElement('div');fields.className='mix-inputs';for(let i=0;i<3;i++){const input=document.createElement('input');input.placeholder=`Clue word ${i+1}`;input.maxLength=24;input.setAttribute('aria-label',`Clue word ${i+1}`);input.value=answerDrafts.get(`${key}:${i}`)||'';input.oninput=()=>answerDrafts.set(`${key}:${i}`,input.value);fields.append(input)}const btn=document.createElement('button');btn.className='btn btn-primary';btn.textContent='Lock three clues';btn.onclick=()=>act('submitOutMixClues',{words:[...fields.querySelectorAll('input')].map(input=>input.value)});form.append(fields,btn)}
    return;
  }
  if(q.stage==='blocking'){
    if(role==='outMixBlocker'){
      return renderTextAnswerForm(form,key,'Guess one word they might have used…',(word)=>act('submitOutMixBlock',{word}),false,`${submittedPairs} of ${opposingPairs} opposing pairs guessed`);
    }
    if(role==='outMixBlockerSubmitted')return passive(`Your pair's guess is locked · ${submittedPairs} of ${opposingPairs} guessed`);
    return passive(`Opposing pairs are guessing blind, hoping to remove a clue word · ${submittedPairs} of ${opposingPairs} guessed`);
  }
  if(q.stage==='guessing'){
    if(role==='outMixGuesser')return renderMixTextAnswer(form,key,q.remainingWords,'What is the secret subject?',(response)=>act('submitOutMixGuess',{response}),Boolean(me()?.submitted));
    return passive('The guesser is studying the surviving clues…',q.remainingWords);
  }
  return passive('Get ready for Out of the Mix.');
}
// Timeline: a tap-to-order interface instead of free text. Not
// role-split -- every pair answers the same question in parallel, same
// as Averages/generic modes -- so this only needs to build a submission
// value for the existing submitResponse path, not a dedicated action.
// In the Mix 2 mirrors renderMixQuestion's clue/option stages (opposing
// pairs see the real clue words, same privacy model as In the Mix's
// distractor stage), but the guesser picks from tappable multiple-choice
// buttons instead of typing free text.
function renderInTheMix2Question(form,q,role){
  const key=`${q.id||`question-${state.qIndex||0}`}:${q.stage}:${role}`;
  const passive=(text,words)=>{form.replaceChildren();delete form.dataset.questionKey;if(words?.length)renderMixWords(form,words);const note=document.createElement('p');note.className='answer-status';note.textContent=text;form.append(note)};
  const submittedPairs=q.submittedPairIds?.length||0;
  const opposingPairs=Math.max(0,(state.pairs?.length||0)-1);
  if(q.stage==='clues'){
    if(role!=='mix2ClueGiver')return passive('The clue-giver is choosing three secret words…');
    if(form.dataset.questionKey!==key){form.replaceChildren();form.dataset.questionKey=key;const fields=document.createElement('div');fields.className='mix-inputs';for(let i=0;i<3;i++){const input=document.createElement('input');input.placeholder=`Clue word ${i+1}`;input.maxLength=24;input.setAttribute('aria-label',`Clue word ${i+1}`);input.value=answerDrafts.get(`${key}:${i}`)||'';input.oninput=()=>answerDrafts.set(`${key}:${i}`,input.value);fields.append(input)}const btn=document.createElement('button');btn.className='btn btn-primary';btn.textContent='Lock three clues';btn.onclick=()=>act('submitMix2Clues',{words:[...fields.querySelectorAll('input')].map(input=>input.value)});form.append(fields,btn)}
    return;
  }
  if(q.stage==='options'){
    if(role==='mix2Option'){
      return renderMixTextAnswer(form,key,q.clueWords,'Add one decoy answer…',(text)=>act('submitMix2Option',{text}),false,`${submittedPairs} of ${opposingPairs} opposing pairs ready`);
    }
    if(role==='mix2OptionSubmitted')return passive(`Your pair's decoy is locked · ${submittedPairs} of ${opposingPairs} ready`,q.clueWords);
    return passive(`Opposing pairs are writing decoy answers · ${submittedPairs} of ${opposingPairs} ready`);
  }
  if(q.stage==='choosing'){
    if(role==='mix2Guesser'){
      if(form.dataset.questionKey!==key){
        form.replaceChildren();form.dataset.questionKey=key;
        const list=document.createElement('div');list.className='choices';
        for(const choice of q.choices||[]){const b=document.createElement('button');b.className='choice';b.textContent=choice.text;b.onclick=()=>{list.querySelectorAll('.choice').forEach(c=>c.disabled=true);b.classList.add('locked');act('submitMix2Choice',{choiceId:choice.id})};list.append(b)}
        form.append(list);
      }
      if(Boolean(me()?.submitted))form.querySelectorAll('.choice').forEach(c=>c.disabled=true);
      return;
    }
    return passive('The guesser is picking an answer…');
  }
  return passive('Get ready for In the Mix 2.');
}
function renderTimelineQuestion(form,q,locked){
  const key=`${q.id||`question-${state.qIndex||0}`}:timeline`;
  if(form.dataset.questionKey!==key||!form.querySelector('.timeline-cards')){
    form.replaceChildren();form.dataset.questionKey=key;
    const items=[q.reference,...(q.events||[])];
    const order=[];
    const list=document.createElement('div');list.className='timeline-cards';
    const cardEls={};
    const btn=document.createElement('button');btn.className='btn btn-primary';btn.textContent='Lock order';btn.disabled=true;
    const renumber=()=>{
      for(const id of Object.keys(cardEls)){
        const idx=order.indexOf(id);
        cardEls[id].querySelector('.timeline-badge').textContent=idx===-1?'':String(idx+1);
        cardEls[id].classList.toggle('picked',idx!==-1);
      }
      btn.disabled=order.length!==items.length;
    };
    for(const item of items){
      const card=document.createElement('button');card.type='button';card.className='timeline-card';
      const badge=document.createElement('span');badge.className='timeline-badge';
      const label=document.createElement('span');label.className='timeline-label';label.textContent=item.label;
      card.append(badge,label);
      if(item.id===q.reference.id){const yr=document.createElement('span');yr.className='timeline-year';yr.textContent=item.year;card.append(yr)}
      card.onclick=()=>{const i=order.indexOf(item.id);if(i===-1)order.push(item.id);else order.splice(i,1);renumber()};
      cardEls[item.id]=card;list.append(card);
    }
    btn.onclick=()=>act('submitResponse',{response:order.slice()});
    form.append(list,btn);
    renumber();
  }
  const btn=form.querySelector('button.btn-primary');
  if(locked){form.querySelectorAll('.timeline-card').forEach(c=>c.disabled=true);btn.disabled=true;btn.textContent='Submitted'}
}
function renderQuestion(){
  const q=state.current||state.currentQuestion||{};
  $('question-progress').textContent=`Question ${(state.qIndex||0)+1}`;
  $('round-name').textContent=q.round||q.mode||'Pair challenge';
  $('score-pill').textContent=me()?.score!=null?`${me().score} pts`:'Host';
  const self=me();
  const form=$('answer-form');
  const role=state.viewerRole;
  if(q.mode==='in-the-mix'){
    const stageLabels={clues:'Choose three clues',distractors:'Add to the mix',guessing:'Make the guess'};
    $('question-text').textContent=role==='mixClueGiver'&&q.stage==='clues'?`Secret subject: ${q.answer}`:(stageLabels[q.stage]||q.prompt||'In the Mix');
    $('round-rule').textContent='Three real clues. One confusing word from every opposing pair.';
    renderMixQuestion(form,q,role);
  } else if(q.mode==='out-of-the-mix'){
    const stageLabels={clues:'Choose three clues',blocking:'Opponents guess blind',guessing:'Make the guess'};
    $('question-text').textContent=role==='outMixClueGiver'&&q.stage==='clues'?`Secret subject: ${q.answer}`:(stageLabels[q.stage]||q.prompt||'Out of the Mix');
    $('round-rule').textContent='Opposing pairs guess blind, trying to knock out one of your clue words.';
    renderOutMixQuestion(form,q,role);
  } else if(q.mode==='in-the-mix-2'){
    const stageLabels={clues:'Choose three clues',options:'Opponents add decoy answers',choosing:'Pick the real answer'};
    $('question-text').textContent=role==='mix2ClueGiver'&&q.stage==='clues'?`Secret subject: ${q.answer}`:(stageLabels[q.stage]||q.prompt||'In the Mix 2');
    $('round-rule').textContent='Opposing pairs each add one decoy answer. The guesser taps the real one.';
    renderInTheMix2Question(form,q,role);
  } else if(q.mode==='timeline'){
    $('round-rule').textContent='Tap the events in order, earliest first -- the reference event\'s year is given.';
    if(self)renderTimelineQuestion(form,q,Boolean(self.submitted));
    else{form.replaceChildren();delete form.dataset.questionKey}
  } else if(role){
    $('question-text').textContent=q.prompt||(role==='clueGiver'?'Describe this using only emojis!':'Your teammate is emoji-ing something. What is it?');
    $('round-rule').textContent='One pair is up. Other pairs can steal a miss.';
    renderEmojiQuestion(form,q,role);
  } else {
    $('question-text').textContent=q.prompt||q.question||'Your pair is up!';
    $('round-rule').textContent='Work with your teammate and lock your answer.';
    const pair=self?.pairId&&state.pairs?.find(p=>p.id===self.pairId);
    const partner=pair?.members?.map(id=>state.players.find(p=>p.id===id)).find(p=>p&&p.id!==myId);
    const status=partner?`You: ${self.submitted?'submitted':'thinking'} · ${partner.name}: ${partner.submitted?'submitted':'thinking'}`:self?`You: ${self.submitted?'submitted':'thinking'}`:'';
    if(self){const key=q.id||`question-${state.qIndex||0}`;renderTextAnswerForm(form,key,null,(value)=>act('submitResponse',{response:value}),Boolean(self.submitted),status)}
    else{form.replaceChildren();delete form.dataset.questionKey}
  }
  $('question-players').textContent=(state.players||[]).map(p=>`${p.name}${p.pairId?' 🤝':''}${p.submitted?' ✓':''}`).join(' · ');
  paintTimer();
}
// Both roles repaint their own countdown locally from the shared
// startedAt + timerSeconds deadline (no per-frame network traffic); only
// the Host's tick loop below is allowed to actually force a resolve.
function paintTimer(){const timerEl=$('question-timer');const total=(state.settings?.timerSeconds||0)*1000;if(!total||state.phase!=='question'){timerEl.classList.add('hidden');return}timerEl.classList.remove('hidden');const startedAt=state.current?.stageStartedAt||state.current?.startedAt||Date.now();const left=Math.max(0,startedAt+total-Date.now());$('question-timer-fill').style.transform=`scaleX(${(left/total).toFixed(4)})`;$('question-timer-label').textContent=`${Math.ceil(left/1000)}s`;timerEl.classList.toggle('danger',left>0&&left<=5000)}
function renderReveal(){const r=state.lastResult||{};$('reveal-question').textContent=r.prompt||'';$('reveal-answer').textContent=r.answer||r.correctAnswer||'—';const results=$('reveal-results');results.replaceChildren();if(r.mode==='in-the-mix'){const clues=document.createElement('p');clues.className='mix-reveal';clues.textContent=`Clues: ${(r.clueWords||[]).join(' · ')||'—'}${Object.values(r.distractors||{}).length?` | Distractors: ${Object.values(r.distractors).map(x=>x.word).join(' · ')}`:''}${r.guess?` | Guess: ${r.guess}`:''}`;results.append(clues)}if(r.mode==='out-of-the-mix'){const clues=document.createElement('p');clues.className='mix-reveal';clues.textContent=`Clues: ${(r.clueWords||[]).join(' · ')||'—'}${(r.blockedWords||[]).length?` | Blocked: ${r.blockedWords.join(' · ')}`:''} | Remaining: ${(r.remainingWords||[]).join(' · ')||'none'}${r.guess?` | Guess: ${r.guess}`:''}`;results.append(clues)}if(r.mode==='timeline'){const byId=Object.fromEntries([r.reference,...(r.events||[])].map(e=>[e.id,e]));const order=document.createElement('p');order.className='mix-reveal';order.textContent=`Correct order: ${(r.correctOrder||[]).map(id=>`${byId[id]?.label} (${byId[id]?.year})`).join(' → ')}`;results.append(order)}if(r.mode==='in-the-mix-2'){const correct=(r.choices||[]).find(c=>c.id===r.correctChoiceId);const chosen=(r.choices||[]).find(c=>c.id===r.chosenId);const mix2=document.createElement('p');mix2.className='mix-reveal';mix2.textContent=`Clues: ${(r.clueWords||[]).join(' · ')||'—'} | Answer: ${correct?.text||'—'}${chosen?` | Picked: ${chosen.text}`:''}`;results.append(mix2)}$('reveal-leaderboard').replaceChildren(...pairRows());$('next-btn').classList.toggle('hidden',!isHost);$('next-btn').onclick=()=>act('next')}
function pairRows(){return (state.pairs||[]).slice().sort((a,b)=>(b.score||0)-(a.score||0)).map(p=>{const d=document.createElement('div');d.className='leader-row';d.innerHTML=`<span class="leader-rank">🤝</span><span class="leader-name"></span><span class="leader-score">${p.score||0} pts</span>`;d.querySelector('.leader-name').textContent=p.name||p.members?.map(id=>state.players.find(x=>x.id===id)?.name).join(' + ')||'Pair';return d})}
function renderOver(){$('over-leaderboard').replaceChildren(...pairRows());const best=Math.max(...(state.pairs||[]).map(p=>p.score||0),0);$('over-winners').textContent=(state.pairs||[]).filter(p=>p.score===best).map(p=>p.name).join(' & ');$('rematch-btn').classList.toggle('hidden',!isHost);$('rematch-btn').onclick=()=>act('rematch')}
async function act(type,payload={}){if(isHost){const r=hostMessage(myId,type,payload);state=r.state||state;if(r?.error)toast(r.error);render()}else{const r=await transport.send(type,payload);if(r?.error)toast(r.error);if(r?.state){state=r.state;render()}}}
function toast(m){$('toast').textContent=m;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2500)}
// Repaints the countdown every 250ms on whichever role is active (state
// itself only changes on a broadcast, so without this the timer would
// only visibly move when someone else submits). Only the Host's own
// clock may actually force a resolve when time runs out -- previously
// nothing ever did, so a timer setting was collected at setup but never
// enforced or even displayed.
// Once emojis opens its steal window, room.phase stays "question" (see
// game.js) but the timer's deadline has already passed forever after --
// only publish when resolveQuestion actually changed something, or this
// would re-broadcast every 250ms for the rest of the steal phase.
setInterval(()=>{if(state?.phase==='question')paintTimer();if(isHost&&hostRoomState&&game.questionTimerExpired(hostRoomState)){const res=game.resolveQuestion(hostRoomState);if(!res?.error)publish()}},250);
$('create-btn').onclick=create;$('join-btn').onclick=join;$('code-input').oninput=e=>e.target.value=normalizeCode(e.target.value);$('copy-link-btn').onclick=()=>navigator.clipboard?.writeText(invite(state.code)).then(()=>toast('Invite link copied'));
$('start-btn').onclick=()=>act('start',{questionsPerRound:Number($('questions-select').value),timerSeconds:Number($('timer-select').value)});
const prefill=new URLSearchParams(location.search).get('room');if(prefill)$('code-input').value=normalizeCode(prefill);
