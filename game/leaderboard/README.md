# Shared orbit leaderboard

Dependency-free Node service, intended for one process with a persistent writable
directory. GitHub Pages cannot execute this backend. Deploy it separately on a
Node host, or run on a server behind an HTTPS reverse proxy.

## Run

Use a supported Node LTS release. Create a private data directory outside the
published website, then run from the repository root:

```sh
DATA_DIR=/absolute/path/to/private/orbit-data SITE_ORIGIN=https://kmcgregor-1.github.io node game/leaderboard/server.cjs
```

The default address is `127.0.0.1:8080`. Set `HOST=0.0.0.0` and `PORT` when a
container host requires it. Mount persistent storage at `DATA_DIR`; do not use
ephemeral storage. Run only one process against a data directory.

Terminate TLS at the hosting platform or reverse proxy. Set the proxy's maximum
request body to 512 bytes, request timeout to 10 seconds, and rotate/cap its
access/error logs. The app itself does not log requests. Do not expose DATA_DIR
through a static file server. Back up only the current score file, with bounded
retention; do not create a backup on every write.

Set `window.ORBIT_SCORE_API` in `docs/games/orbit/config.js` to the deployed HTTPS
service origin, e.g. `https://scores.example.org`, then rebuild the MkDocs site.
Until configured, the existing browser-local leaderboard remains active.

## API and storage

- `GET /scores` returns the leaderboard.
- `POST /sessions` with `{}` issues a random game token at Start.
- `POST /scores` with `{ "name": "ABC", "score": 123, "token": "…" }`
  consumes a token and updates `fastest-times.txt` (use a score from 1 to 999).
- File format: `ABC<TAB>123`, one completion time in seconds per line, fastest first.
- Only completed runs qualify in the game. Active play time excludes pauses and
  is rounded up to whole seconds. At 999 seconds an unfinished run times out.
- The new filename and browser storage key separate times from legacy point
  scores; existing point-score files are left untouched.

Only 100 rows are retained, each at most 10 bytes: the file is at most 1,000 bytes.
The service additionally enforces a 4 KiB file limit. Atomic replacement uses one
temporary file; it never appends a submission history. Oversized or malformed
existing files cause startup to fail rather than being loaded or overwritten.

## Abuse controls and limits

- Three ASCII letters; integer completion time between 1 and 999; JSON body ≤512 bytes.
- One-use, IP-bound random session tokens; five-second minimum game duration;
  one-hour expiry; at most 1,000 active sessions.
- At most 12 POST attempts per address per ten minutes, 10 successful writes per
  minute globally, and 600 requests per minute globally.
- At most 10,000 address buckets, 100 connections, short request/header timeouts.
- Exact origin allowlist for browsers. Origin checks are not bot authentication.
- Forwarded IP headers are deliberately ignored. Behind a proxy, all users may
  share its rate bucket. For larger traffic, use host-level trusted client-IP
  rate limiting; do not blindly trust public `X-Forwarded-For` headers.

These controls bound disk growth even if bots forge requests. They do **not**
prove that a submitted score was earned: the simulation runs in the browser.
Competitive anti-cheat would require server-verified replay or authoritative
simulation. Distributed denial-of-service protection belongs at the hosting
edge. In-memory limits and active sessions reset when the service restarts;
the top-100 file cap does not.

## Test

```sh
node --test game/leaderboard/server.test.cjs
```
