# Implementation Plan: Party of Two

**Spec**: [spec.md](./spec.md)

## Technical context

| Area | Choice | Rationale |
| --- | --- | --- |
| Runtime | Vanilla ES modules, HTML, CSS | Same static GitHub Pages shape as `game-house`; no build step. |
| Multiplayer | PeerJS over WebRTC | Public broker handles signaling; the Host owns authoritative state. |
| Persistence | `localStorage` | Settings, used-question history, and private per-room resume tokens. |
| Tests | Node built-in test runner | Pure pairing, round, scoring, privacy, and storage tests. |
| Layout | Mobile contestant screens + shared Host/leaderboard views | Players need private response entry while the Host controls pacing. |

## Architecture

```text
index.html                         home, pairing lobby, question, reveal, final screens
css/style.css                      responsive paired-team visual system
js/game.js                         pure room, pair, deck, round, score, privacy rules
js/questions.js                    original categorized questions and round data
js/room.js                         PeerJS host/client transport
js/storage.js                      settings, used questions, resume tokens
js/main.js                         DOM rendering and Host-authoritative routing
tests/game.test.mjs                pairing, round, scoring, timer, privacy tests
tests/storage.test.mjs              persistence tests
specs/001-party-of-two/{spec,plan,tasks}.md
```

## Room and pairing lifecycle

The room phases are `lobby`, `pairing`, `question`, `reveal`, and `over`.
Joining creates a contestant seat; the Host may instead create a display-only
room. The Host opens pairing setup once the roster is ready.

Each contestant selects one available teammate. The engine stores proposals
separately from confirmed `pairId`s. A pair becomes confirmed when both players
select one another, or when the Host explicitly confirms/overrides the pair.
The start guard checks all of the following:

```text
connected contestants >= 2
connected contestants % 2 === 0
every contestant has exactly one pairId
every pair has exactly two distinct contestants
no pair references a spectator or offline-only seat
```

Pair assignments are part of authoritative state, not a client-only UI
choice. A reconnecting player retains the same pair ID. On rematch, the Host
can keep confirmed pairs or clear them and return to pairing.

## Round engine

`buildDeck()` samples the configured round sequence and question count while
avoiding locally used question keys. Each deck card carries a mode-specific
payload but uses a common lifecycle:

1. Assign clue-giver/guesser roles deterministically from pair membership and
   question index.
2. Open private response entry; only the fields needed by the current role
   are shown to each player.
3. Resolve when all connected eligible inputs arrive or the timer expires.
4. Apply the mode's scoring function to pair-level results.
5. Enter `reveal`, publish safe answers/results, then advance.

The mode functions should be pure and independently testable:

- `resolveAverages()` validates two numeric answers, computes the pair mean,
  and ranks distance from the correct value.
- `resolveEmojis()` validates emoji-only clue input and teammate guess; on
  timeout it opens the configured steal path for opposing pairs.
- `resolveInTheMix()` and `resolveOutOfTheMix()` normalize exactly three clue
  words plus one opposing word per pair and produce the public clue set.
- `resolveTwoWords()` requires two distinct teammate submissions and checks
  the two-word answer without allowing one player to submit both halves.
- `resolveTimeline()` validates the pair's ordering of two events around the
  reference event.
- `resolveInTheMix2()` builds answer choices from the correct answer plus one
  option supplied by each opposing pair.

The initial implementation may use Host-confirmed text for answers, but all
validation and scoring must still be centralized in `game.js`, not DOM event
handlers.

## Privacy and reconnect

Open questions may contain the correct answer, accepted answer, opponent
clues, or steal choices. `toPublicState(viewerId)` must redact any field that
would let a player solve the current question before their role permits it.
Player resume tokens are bearer secrets stored only in the owning browser and
private Host state. A rejoin rebinds the peer ID while preserving pair, score,
role rotation, and locked response; references to a rejoined player are
updated before resolution.

## Scoring and leaderboard

Scores are stored on pairs. A question result records pair-level points and a
player-level audit trail for the final reveal. The final view ranks pairs by
score, shows both member names, and supports the mockup's large score bars and
rank labels. No global account-backed games-played metric is required.

## Validation

- `node --test tests/*.test.mjs` — pairing guards, all seven mode resolvers,
  scoring, timer/steal behavior, redaction, reconnect, rematch, and storage.
- `node --check js/*.js` — browser module syntax/import smoke check.
- Browser smoke test: create room, join an even roster, form pairs, reject an
  odd/unpaired start, play one question in each mode, reveal, reconnect one
  player, rematch, and verify final pair standings.
