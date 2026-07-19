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
- [ ] Implement Averages numeric validation, mean, distance, and tie handling.
- [ ] Implement Emojis clue/guess validation and timeout steal flow.
- [ ] Implement In the Mix clue mixing and Out of the Mix word removal.
- [ ] Implement Two Words pair-only split-answer validation.
- [ ] Implement Timeline ordering and In the Mix 2 option construction.
- [ ] Add deterministic role rotation and timer behavior for every mode.
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
- [x] Add Host controls for round flow, reveal, and rematch; timer/steal remain
      follow-up controls.
- [ ] Render the final pair leaderboard in the visual direction of the
      supplied mockup, with accessible rank and score text.

## Networking and validation

- [x] Adapt the `game-house` PeerJS room wrapper and public-state snapshots.
- [x] Add reconnect/rejoin and offline-seat handling to the browser flow.
- [x] Add engine and storage tests for the MVP pairing invariants.
- [x] Run `node --test tests/*.test.mjs` and module syntax checks locally.
- [ ] Browser smoke-test odd roster rejection, mutual pairing, all modes,
      reveal privacy, reconnect, rematch, and tied winners.

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
