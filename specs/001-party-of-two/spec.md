# Feature Specification: Party of Two

**Feature branch**: `001-party-of-two`  
**Status**: Draft  
**Created**: 2026-07-19

## Overview

Party of Two is a browser-based team party game where every contestant is
paired with exactly one teammate. A Host creates a room, players join from
their own phones, select their teammate during setup, and play a sequence of
short collaborative and adversarial quiz rounds. Scores belong to pairs, and
the highest-scoring pair wins.

The concept deck demonstrates Tokyo Olympics examples, five-question round
screens, private clue/answer entry, reveal states, team scoreboards, and a
ranked leaderboard. The game is intentionally close to `game-house` in its
room, privacy, reconnect, rematch, and Host-authority model.

## User stories

### US-1: Create, join, and rejoin a room

As a player, I can create or join a room with a short code so that everyone
can play from their own device.

Acceptance criteria:

- The creator is the authoritative Host and may also be a contestant, unless
  they choose a display-only Host mode.
- The room supports 2–12 contestants; the contestant count must be even.
- A private per-room resume token lets a refreshed browser reclaim its seat,
  pair assignment, score, and any locked response.
- Resume tokens and private responses never appear in public state.
- A room URL may prefill the code and begin the same join/rejoin flow as
  entering the code manually.

### US-2: Select pairs before the game

As a player, I can choose my teammate during setup so that the game reflects
the pairs people want to play in.

Acceptance criteria:

- Pair selection is a visible setup phase after joining and before the first
  question.
- A player proposes an available teammate; a pair forms only after mutual
  selection or explicit Host confirmation.
- A player cannot belong to more than one pair, pair with themself, or pair
  with a disconnected/non-contestant seat.
- The lobby shows proposed, confirmed, and unpaired seats, including partner
  names once a pair is confirmed.
- The Host may approve, clear, or override pair proposals, but cannot start
  until every contestant belongs to exactly one pair.
- Start is rejected unless there are at least two connected contestants, the
  count is even, and all pair assignments are valid.
- Pair IDs remain stable through questions, rejoin, reveal, and rematch;
  rematch resets scores and allows the Host to re-pair if desired.

### US-3: Configure a show

As the Host, I can choose the round sequence, question count, timers, and
reveal pacing so the show fits the group.

Acceptance criteria:

- A show contains a Host-selected sequence of 3–7 round types and 3–5
  questions per round. The default sequence is Averages, Emojis, In the Mix,
  Out of the Mix, and a final selected round.
- The Host can enable or disable available round types only before Start.
- Question timers may be off or configured per show. A timeout follows the
  round's steal/no-steal rule and never exposes a private response early.
- The Host can advance reveals manually; automatic reveal pacing is an
  optional follow-up to the first implementation.
- Questions used by the Host's local history are not reused until history is
  reset.

### US-4: Play pair-based rounds

As a pair, we can collaborate under different constraints while other pairs
can interfere or steal when the round allows it.

The initial round catalog is:

| Round | Core interaction | Scoring / resolution |
| --- | --- | --- |
| **Averages** | Every member submits a numeric answer privately. The pair answer is the arithmetic mean of its two answers. | Closest pair to the correct number wins the question; exact ties share the point unless the Host resolves a declared tie rule. |
| **Emojis** | One assigned member describes an event, film, or subject using emojis only; the partner guesses. | The pair gets the point for a correct guess. If time expires, other pairs may steal in Host-defined order. |
| **In the Mix** | One member submits exactly three clue words; opposing pairs each add one confusing word. The teammate guesses from the mixed clues. | Correct pair guess scores; the clue-giver's three words remain associated with the answer. |
| **Out of the Mix** | One member submits three clue words; opposing pairs each submit one word. Matching opponent words are removed from the clue set. | The teammate guesses from the remaining words; the pair scores if correct. |
| **Two Words** | The answer has two words. Each teammate privately supplies one word. | Pair-only round: both words must be correct and assigned to different teammates. |
| **Timeline** | The pair receives two events and places them chronologically relative to a reference event. | The pair scores when the submitted order is correct. |
| **In the Mix 2** | One member gives three clue words; opposing pairs add one multiple-choice option each. The teammate selects the answer. | Correct selection scores for the pair; the Host reveals the answer and options. |

- Every role-based question assigns a deterministic clue-giver/guesser. Roles
  rotate between the two teammates across questions when the round permits.
- A pair cannot see its teammate's private answer before its own submission
  window closes, except where the round explicitly requires sequential entry.
- Opposing clues, options, and steal answers are attributed to pairs, not
  exposed with private player identity before reveal.
- The Host may skip a question. Skips award no point and advance according to
  the configured reveal flow.

### US-5: Score, reveal, and finish

As a group, we see which pair won each question and who won the show.

Acceptance criteria:

- Pair scores are the canonical scores shown during play; member rows show
  each pair's two names.
- Every question enters a reveal state before the next question.
- The reveal shows the correct answer, accepted responses, scoring decision,
  and updated pair leaderboard.
- No contestant is eliminated. A pair wins by total score; tied pairs are
  declared joint winners.
- The final screen supports the visual direction in the mockup: ranked rows,
  score emphasis, pair/member names, and optional avatars or progress bars.
  Persistent games-played statistics are not required for the first release.

### US-6: Rematch

As the Host, I can start another show with the same room without making every
player rejoin.

Acceptance criteria:

- Only the Host can trigger a rematch from the final state.
- Connected seats and resume tokens remain; offline seats are removed.
- Scores, round progress, locked answers, and question state reset.
- Existing pairs are shown for confirmation and can be retained or cleared
  for a new pairing pass before Start.

### US-7: Disconnect handling

As a group, one dropped phone should not permanently stall the show.

Acceptance criteria:

- An offline seat remains visible with its pair and can reclaim the same seat.
- An offline unanswered player does not block resolution once all connected
  eligible players have submitted; its response counts as missing according
  to the round's scoring rule.
- A rejoining player retains pair membership, score, role rotation state, and
  any response already locked for the current question.
- Closing the Host tab ends the room; Host migration is out of scope.

## Functional requirements

- **FR-1** Static HTML/CSS/ES modules only; no backend or build step required.
- **FR-2** Rules live in a pure, testable `js/game.js` module.
- **FR-3** PeerJS/WebRTC is Host-authoritative: clients submit intents and
  render redacted state snapshots.
- **FR-4** Start validation enforces 2–12 contestants, an even count, and one
  valid pair assignment per contestant.
- **FR-5** Public state includes pair membership and pair scores but excludes
  resume tokens, unrevealed answers, pending private responses, and correct
  answer indexes.
- **FR-6** Every accepted response is attributable to a player internally and
  scored at pair level.
- **FR-7** The UI is mobile-first, keyboard accessible, and does not rely only
  on color to communicate pair, timer, lock, or result status.
- **FR-8** No accounts, ads, analytics, tracking, or real-money stakes.

## Core entities

- **Player**: `id`, `name`, `connected`, private `resumeToken`, `pairId`,
  current role, score contribution, and private pending response.
- **Pair**: stable `id`, member player IDs, display name/color, score, and
  confirmed/locked pairing status.
- **QuestionEntry**: mode, prompt, answer, accepted answer data, round,
  difficulty, explanation, and points.
- **RoundState**: mode, question index, role assignment, timer, private
  responses, public clues/options, reveal result, and steal status.
- **Room**: code, Host ID, phase (`lobby → pairing → question → reveal →
  over`), players, pairs, deck, settings, and winner pair IDs.

## Non-goals

- Host migration, persistent cloud rooms, accounts, matchmaking, or
  cross-device identity recovery.
- More than two members in a pair or odd-sized contestant rosters.
- Free-text automatic judging, speech recognition, or AI adjudication.
- Persistent global leaderboard statistics in the first release; the mockup's
  ranked final screen is a session result.
- Real-time spectator chat, wagering, or elimination/lives mechanics.
