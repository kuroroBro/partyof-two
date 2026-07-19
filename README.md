# Party of Two

Party of Two is a browser party-game MVP built around paired players.
It follows the same host-authoritative, peer-to-peer shape as
[`game-house`](../game-house): one Host owns the room state, every contestant
uses a phone, and the game is served as a static GitHub Pages site.

The concept and mockups are in [Party of 2 Game.odp](./Party%20of%202%20Game.odp).
The implementation SDD is in [`specs/001-party-of-two/`](specs/001-party-of-two/):

- [spec.md](specs/001-party-of-two/spec.md) — product behavior and acceptance criteria
- [plan.md](specs/001-party-of-two/plan.md) — architecture and decisions
- [tasks.md](specs/001-party-of-two/tasks.md) — implementation checklist

The central rule is structural: contestant count must be even, and every
contestant must belong to exactly one pair before the Host can start.

## Run locally

From this directory, start a static server (for example `python3 -m http.server
8123`) and open `http://127.0.0.1:8123/`. The Host creates a room and shares the
generated QR code or room code; contestants join from their phones.

The current MVP includes the lobby, even-roster validation, player pairing,
PeerJS room transport, QR invite, private answer submission, question/reveal
flow, pair scoring, reconnect tokens, final standings, and rematch flow. The
seven concept modes are represented in the question deck and use the shared
response engine; richer mode-specific controls and steal/timer rules remain
follow-up work tracked in `tasks.md`.

Run the automated checks with:

```sh
node --test tests/*.test.mjs
```
