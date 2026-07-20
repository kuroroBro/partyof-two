# Tasks: Party of Two

**Specification**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Specification and content

- [x] Capture the seven concept modes: Averages, Emojis, In the Mix, Out of
      the Mix, Two Words, Timeline, and In the Mix 2.
- [x] Define even-player and exactly-two-per-pair constraints.
- [x] Define mutual player-selected pairing with Host confirmation/override.
- [x] Define pair-level scoring, reveal, rematch, privacy, and reconnect.
- [x] Add an initial original question deck and mode metadata for the MVP.

## Rules engine

- [x] Create `js/game.js` room phases and Host authorization guards.
- [x] Implement player lifecycle, connected/offline seats, and resume-token
      rejoin while preserving pair and locked-response state.
- [x] Implement pair proposals, mutual confirmation, Host override, clear,
      lock, and start validation.
- [x] Implement pair-level scores, ties, question reveal, rematch, and winner
      calculation.
- [x] Implement Averages numeric validation, mean, distance, and tie
      handling (see Bugfixes below — the shipped version had scored an
      exact match to the target instead).
- [x] Implement Emojis clue/guess validation and timeout steal flow (see
      Bugfixes below — previously this mode had no role split at all).
- [x] Implement In the Mix clue mixing, role-specific privacy, opponent
      distractors, and active-pair scoring.
- [x] Implement Out of the Mix word removal. Mirrors In the Mix's
      clue-giver/guesser split, but inverted: opposing pairs guess a
      word BLIND (never shown the real clue words, unlike In the Mix's
      distractor stage) and any accidental match is removed from what
      the guesser sees, instead of being added as a lookalike
      distractor. 7 new regression tests; live-verified with 6 real
      browser contexts over PeerJS — confirmed opposing pairs' pages
      never contain the real clue words at any stage, a matching blind
      guess was actually removed, an unmatched guess left the set
      untouched, and the guesser only ever saw the survivors.
- [x] Implement Two Words pair-only split-answer validation -- already
      covered by `resolvePair`'s dedicated `two-words` branch (each
      teammate's private word must be one of the two required words,
      and both must be present between them); regression-tested since
      the very first commit, the checkbox was simply stale.
- [x] Implement Timeline ordering. Not role-split like the other Mix
      modes -- a shared pair task, same "all pairs answer in parallel"
      shape as Averages/generic. Content now carries a `reference`
      (label + known year) plus two mystery `events` (label only); the
      pair taps all three into what they believe is chronological order.
      The two mystery years are stripped from every viewer's payload
      until reveal (game.js's `redactCurrentForViewer`) -- previously
      the "content" was just plain "what year did X happen" trivia with
      no ordering mechanic at all. 3 new regression tests; live-verified
      with 2 real browser contexts over PeerJS.
- [x] Implement In the Mix 2 option construction. Same clue-giver/guesser
      split as In the Mix (and opposing pairs see the real clue words,
      same privacy model, so they can write a plausible decoy), but
      opponents each submit a full decoy ANSWER instead of one lookalike
      word, and the guesser taps a shuffled multiple-choice list instead
      of typing free text. The correct choice's id is never sent to any
      viewer pre-reveal (not even the clue-giver, who already knows via
      `answer`) -- only `lastResult.correctChoiceId` reveals it. 5 new
      regression tests; live-verified with 6 real browser contexts over
      PeerJS.
- [x] Add question-level timer behavior: a shared deadline set when the
      question is dealt, force-resolving on expiry regardless of who has
      answered (see Bugfixes below). Per-mode role rotation is now also
      implemented for every role-split mode (Emojis, In the Mix, Out of
      the Mix, In the Mix 2), each with its own rotation counter so
      every pair takes a turn and every player gets both roles.
- [x] Add viewer-specific redaction for answers, clues, options, and pending
      private responses.

## Content and persistence

- [x] Add `js/questions.js` with an initial deck covering all seven modes.
- [x] Persist settings, used-question history, and per-room resume tokens.
- [x] Add malformed-storage fallbacks.

## Browser application

- [x] Build home, join, pairing, question, reveal, final, and rematch screens.
- [x] Show even-count/pairing readiness clearly; explain every blocked Start
      action in plain language.
- [ ] Give each pair a stable name/color and show partner identity throughout
      the show without leaking private answers.
- [ ] Build private response controls for numeric, emoji, word, order, and
      multiple-choice modes.
- [x] Add Host controls for round flow, reveal, and rematch; steal remains a
      follow-up control (timer is implemented — see Bugfixes below).
- [ ] Render the final pair leaderboard in the visual direction of the
      supplied mockup, with accessible rank and score text.

## Networking and validation

- [x] Adapt the `game-house` PeerJS room wrapper and public-state snapshots.
- [x] Add reconnect/rejoin and offline-seat handling to the browser flow.
- [x] Add engine and storage tests for the MVP pairing invariants.
- [x] Run `node --test tests/*.test.mjs` and module syntax checks locally.
- [ ] Browser smoke-test odd roster rejection, mutual pairing, all modes,
      reveal privacy, reconnect, rematch, and tied winners.

## Bugfixes (2026-07-20)

- [x] **Submitting an answer stole focus from every other player still
      typing.** `renderQuestion()` tore down and recreated the answer
      `<input>`/`<button>` on every state broadcast, including ones
      triggered by someone else's submission. A freshly created DOM node
      has no focus, and on mobile that silently dismisses the on-screen
      keyboard mid-thought. Fixed by reusing the existing input/button
      across re-renders and only rebuilding them when the question itself
      changes (`js/main.js`).
- [x] **Reveal could fire before everyone had actually answered.**
      `allPlayersSubmitted` re-derived "who must answer" from live
      `.connected` status on every submission. A player's WebRTC
      connection blipping mid-question (screen lock, a moment of bad
      signal — routine on mobile) silently dropped them from the quorum,
      so their partner's submission alone could trigger an early reveal.
      Fixed by snapshotting `requiredIds` once when the question is
      dealt (`createQuestion`) and checking submissions against that
      fixed list instead (`js/game.js`).
- [x] **The round timer did nothing.** `timerSeconds` was collected at
      setup and stored in `room.settings`, but nothing ever read it again
      — no countdown UI, no expiry, no auto-resolve. Added
      `questionTimeRemainingMs`/`questionTimerExpired` (pure, `game.js`)
      plus a 250ms client-side repaint loop and a Host-only expiry check
      that force-resolves the question when time runs out
      (`js/main.js`).
- Added regression tests for the quorum and timer fixes in
  `tests/game.test.mjs` (9/9 passing); live-verified all three fixes via
  Playwright with two real browser contexts over an actual PeerJS
  connection (focus preservation, timer countdown + force-resolve with
  zero submissions, and the normal both-answered happy path still
  resolving promptly).

## Bugfixes (2026-07-20, part 2 — "same questions keep repeating")

- [x] **`startGame` cloned a single question `perRound` times per mode.**
      `js/questions.js` only had one question per mode to begin with, and
      the deck builder took `source.find(q => q.mode === mode)` — the
      first match — and repeated *that exact object* `perRound` times
      with only the `id` suffix changing. Fixed by authoring 15 distinct
      questions per mode (105 total, up from 7) and rewriting the deck
      builder to shuffle and draw `perRound` distinct questions per mode,
      preferring ones not yet used on this device (new
      `usedIds`/`markQuestionsUsed` plumbing in `js/storage.js`, mirrored
      after this portfolio's other question-bank games).
- [x] **Even with a diverse deck, `advance()` never actually advanced.**
      Separately, and more directly responsible for "the same question
      repeats within one game": `advance()` called
      `createQuestion(room)` with no second argument, and
      `createQuestion`'s fallback (`q || room.deck[0]`) means every round
      after the first re-dealt `deck[0]` again, forever, regardless of
      `room.qIndex`. Fixed by passing `room.deck[room.qIndex]` explicitly.
- [x] **Averages mode scored an exact match instead of "closest pair
      wins."** Per spec.md's own Averages row ("closest pair to the
      correct number wins... exact ties share the point"), this is a
      House of Games "On Average"-style round: pairs are judged against
      *each other*, not against a fixed target. The shipped
      `resolvePair` instead required a pair's average to equal the
      target within `1e-9` — a bar real human guesses essentially never
      clear, so the mode never paid out regardless of how close a pair
      got. Rewrote `resolveQuestion` to compute every pair's distance
      from the target for `averages` questions, award the point to
      whichever pair(s) are tied for closest, and leave every other
      mode's independent per-pair judging (`resolvePair`) unchanged.
- Added regression tests: content-bank size/uniqueness per mode, a real
  (non-stubbed) `startGame` producing distinct prompts within one mode,
  `advance()` walking the deck instead of re-dealing card zero,
  `usedIds` filtering across a rematch, and three averages-scoring cases
  (closest-wins over an imperfect-but-closer guess, a tied distance
  paying out both pairs, and a non-answering pair losing to an
  imperfect one). 16/16 passing. Live-verified via Playwright: a full
  5-round single-mode show showed 5 distinct prompts, and a 4-player/
  2-pair game confirmed the pair with the genuinely closer (not exact)
  average was the one who actually scored.

## Feature (2026-07-20, part 3) — Emojis clue-giver/guesser/steal flow

Per spec.md's Emojis row, this is a House of Games-style "one pair up,
others may steal" format — structurally different from every other
mode (which has ALL pairs answering the SAME question in parallel).
Previously it had no role split at all: both partners saw the identical
free-text input, and either one's matching guess scored the pair, same
as any generic mode.

- [x] **Role assignment**: `assignEmojiRoles` (`js/game.js`) round-robins
      which pair is "up" across consecutive Emojis questions
      (`room.nextActivePairIndex`), and alternates clue-giver/guesser
      within that pair each time via a per-pair `nextClueGiverSlot` flag
      — everyone gets a turn at both roles across a show. Needs at least
      2 pairs to mean anything; with fewer, falls back to the generic
      all-pairs-answer path untouched.
- [x] **Per-viewer privacy**: `publicState(room, viewerId)` now takes a
      viewer id. Only the clue-giver's snapshot includes the real
      `answer`; everyone else's `current.prompt` is replaced with a
      generic non-spoiling line — necessary because the authored prompts
      name the answer outright ("describe the movie Titanic"), so
      redacting only `answer` and leaving `prompt` untouched would have
      leaked it anyway. `main.js`'s broadcast switched from
      `transport.broadcast` (one shared payload) to the
      already-present-but-unused `transport.broadcastEach` (per-recipient
      payloads) to actually deliver this.
- [x] **Steal flow**: a wrong guess or a timeout opens `stealOpen` (via
      `resolveQuestion`, which now branches per-mode instead of one path
      for everything). Any player on a pair other than the one up may
      `claimSteal` — first tap wins the buzzer-style race, and the
      button disappears for everyone else. `submitStealResponse`: correct
      awards that pair the normal point value (same as a clean win, per
      owner decision); wrong marks that pair as having tried and reopens
      for the remaining eligible pairs; once every other pair has missed,
      the question resolves with nobody scoring. No separate timer for
      the steal window — it stays open until resolved or the Host
      manually advances.
- [x] `js/main.js`: new per-viewer-role rendering (`clueGiver` /
      `guesser` / `stealAvailable` / `stealing` / `stealBlocked` /
      `stealSpent` / `spectating`, precomputed server-side as
      `state.viewerRole`), reusing the same focus-preserving text-input
      pattern from the earlier bugfix for both the guesser's answer and
      a steal attempt.
- Added 10 regression tests covering role assignment, privacy redaction,
  the clue-giver being blocked from submitting, correct/wrong guesses,
  steal claiming (including blocking the active pair and re-claims),
  the multi-pair reopen-until-exhausted sequence, role/pair rotation
  across consecutive questions, and the <2-pairs fallback. 26/26
  passing. Live-verified with 6 real browser contexts (3 pairs) over an
  actual PeerJS connection: confirmed the guesser's prompt never matches
  the clue-giver's (no leaked answer), the Steal button appeared only
  for the two non-active pairs, and a missed steal correctly reopened
  the window for the last remaining pair instead of ending the round.

## Open decisions before implementation

- [ ] Confirm whether the Host may also be a contestant in Party of Two or
      whether every room requires a separate display-only Host.
- [ ] Confirm default round sequence and whether the Host may reorder all
      seven modes or only choose a subset.
- [ ] Confirm whether steal attempts are simultaneous, ordered by Host, or
      limited to one opposing pair.
- [ ] Confirm exact points per mode and whether closest-answer ties share or
      split a point.
- [ ] Confirm whether the final leaderboard is pair-ranked only or also needs
      persistent player games-played statistics.
