# DEPAUW: THE LAST HALLOWEEKEND

A complete browser-based cooperative text survival game for 2–8 players. All outbreak events, emergency alerts, research, and characters are fictional. This is an unofficial campus-inspired game.

## Status

The game is public at https://depauw-last-halloweekend.netlify.app/. All three chapters and multiplayer persistence are implemented. 24 local tests and 8 live production checks passed, including a complete two-player Perfect Victory campaign. Separate browser sessions verified synchronization and refresh recovery. See TEST_REPORT.md, DEPLOYMENT.json, and PROGRESS.md.

## Quick local play

Use Node.js 22.12+ (Node 24 also tested).

```sh
npm ci
npm run dev
```

Open the URL printed by the server (normally http://localhost:5173). The local server builds and serves the production frontend and runs the same API/game engine against a persistent PGlite database in `.local-db/`. Open two browser profiles, or use the lobby’s **Open a separate survivor session** link, to control two different players. Create a room, join its code, and start as host.

`npm run dev:hot` uses Vite for source development. `npm run netlify:dev` uses Netlify’s local development environment after the project is linked and its database migration is applied. The PGlite server is for development only; it is never deployed as the production backend.

## Publish on Netlify

A Netlify account on a current credit-based plan is required. A Free plan can host the game within its limits; no separate database service or manually supplied API keys are needed. Free allowances are finite. Polling, Functions, database compute, and bandwidth consume allowance. No paid subscription is required by the code.

From this project folder:

```sh
npm ci
npx netlify login
npx netlify deploy --prod --site 5edb36b5-1bf1-46ad-9914-57815c42ee36
```

The pinned CLI builds by default when running `netlify deploy --prod`. Follow its prompts to create a project in your Netlify team or link an existing one. The CLI reads `netlify.toml`, builds `dist`, bundles `netlify/functions/game.ts`, provisions Netlify Database through the installed `@netlify/database` dependency, and applies the SQL migration in `netlify/database/migrations/` as part of the supported deployment lifecycle. The command prints the actual public URL. If you already have a project, `npx netlify link` selects it before deploying.

Alternatively, push this project to a Git repository and import it into Netlify. Build command: `npm run build`; publish directory: `dist`; functions directory: `netlify/functions`. The tracked configuration provides these settings. Netlify’s Git deployment lifecycle handles the database provisioning and migration.

If the platform reports that the database has not been provisioned, open the linked project’s **Data & Storage → Database**, create its database, and redeploy. Use a credit-based plan with Netlify Database support. Do not paste database credentials into frontend code.

**Do not upload this source ZIP to Netlify Drop and expect a working multiplayer backend.** Static drag-and-drop hosting does not perform the required source build/database deployment workflow. The included `deployment-bundle/` contains the already-built frontend and a verified packaged Function for inspection; deploy from the source project with the CLI or Git flow above so configuration and migrations are included.

After publication:

1. Open the public HTTPS URL in two independent browser profiles or devices.
2. Player A creates a room; Player B joins its six-character code.
3. Host starts; move the two players independently and verify both event feeds update.
4. Refresh one device and verify its position, stats, and inventory remain.
5. Complete the campaign, checking the final scoreboard. `tests/api.test.ts` documents a full winning route.
6. Run `node --import tsx scripts/verify-live.ts https://depauw-last-halloweekend.netlify.app/` for automated production checks in fresh test rooms. The current deployment has passed these checks and separate-browser smoke testing; physical-device human playtesting is additional.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Engine tests and database/API integration tests, including complete campaigns |
| `npm run build` | TypeScript type check and production Vite build |
| `npm run package:functions` | Bundle the standard Netlify game Function into `.netlify/functions/game.zip` |
| `npm run dev` | Build and run a persistent local multiplayer server |
| `npm run dev:hot` | Source-development server |
| `npm run netlify:dev` | Netlify CLI development environment |
| `npm run deploy` | Build and publish to the authorized Netlify project |

## Architecture

- **Frontend:** React + TypeScript + Vite, responsive CSS, original SVG campus silhouette; no third-party fonts or assets are fetched at runtime.
- **API:** modern standard Netlify Function at `/.netlify/functions/game`, using Request/Response. Helper modules remain outside `netlify/functions`.
- **Production persistence:** automatically configured Netlify Database (managed PostgreSQL). A room is a bounded JSONB aggregate. Updates use one connection, `BEGIN`, `SELECT ... FOR UPDATE`, validation, update, and `COMMIT`; exceptions roll back. Room creation has a unique idempotency key. Duplicate action receipts are stored inside the same transaction as their results.
- **Why not Blobs:** Netlify’s current guidance explicitly directs transactional inventories, counters, and sessions to Database. Blobs ETag preconditions do not replace database transactions. This architecture adjustment was approved before implementation.
- **Development persistence:** PGlite, a PostgreSQL-compatible embedded database. A serialized connection adapter supplies the same repository interface. Local concurrency tests verify application behavior under simultaneous requests; they are not a live multi-instance Netlify/Postgres load test.
- **Sessions:** cryptographically random 256-bit browser-held bearer tokens. Only SHA-256 hashes are stored on the server. Public room snapshots omit token hashes and request receipts. Nicknames are rendered as text by React. Room codes have 30 bits of cryptographically generated entropy.
- **Synchronization:** approximately two-second polling in visible tabs, ten seconds in hidden tabs. Heartbeats are coalesced. The client refuses older state versions and retains failed action IDs for safe retry. Request schemas reject unknown fields and validate identifiers, actions, quantities, and current run/round.
- **Clock:** one accepted action per living survivor per round. Each action ends that survivor’s turn immediately; other players observe the outcome while choosing. Round resolution waits for everyone or a 90-second inactivity deadline after at least one action. Nobody can advance rounds through repeated clicks. Fully disconnected rooms pause; a request resumes them. No background server or scheduled worker is required.
- **Privacy/limits:** room membership is required to read state; browser-generated tokens are sent in Authorization headers, never URL parameters. Same-origin checks and a restrictive production CSP are included. Netlify Function rate-limit config allows 600 requests per IP/domain per minute, enough for eight active players behind one connection. Rooms become inaccessible after seven days. Expired records remain until administrative deletion; this version has no scheduled cleanup job.

## Campaign and rules

The complete field guide is in the application’s **How to play** screen. All actions are available through buttons and menus.

- Night 1: reach Hoover Hall, collect six fresh pantry rations as a team, and build a Union barricade.
- Night 2: investigate Julian, recover two library records, discover the fictional acoustic cause, and build the transmitter. Optional rescue: Sam at Lilly Center.
- Night 3: defeat or distract/bypass the Bellkeeper, send the rescue signal at East College, and escape at the Nature Park.
- Budgets: 40 / 40 / 36 rounds, ten in-game minutes per round. An optimized tested two-player route used 11 / 15 / 7 rounds, including the rescue.
- Starting stats: 100 health, hunger, stamina; zero noise; six inventory slots; two rations and one bandage.
- Each item type occupies one slot; stacks cap at 24. Collect 1–3 units per turn. Trade/drop one through the UI. Crafting validates capacity after consuming ingredients.
- Essential items stay in shared ground loot when dropped or when a survivor is eliminated. Recoverable reserves prevent total ingredient loss. Radio components require their three-clue recipe; recovered transmitters are allowed only after one was crafted.
- Downed players have three full subsequent shared rounds for a teammate to revive them. A first-aid kit restores 40 health on revival. If nobody can act, the team cannot rescue itself and loses.
- The first successful escape secures victory, while remaining survivors can finish extracting until dawn. All-player extraction plus Sam’s rescue yields Perfect Victory.
- Scoring awards are deduplicated by discovery, recipe, teammate, clue, enemy, and objective. The final screen lists individual scores, status, kills, crafts, rescues, nights survived, and the highest-scoring Ultimate Survivor (shared on ties).

## Source layout

```
src/                         React UI and responsive styles
shared/content.ts            Map, items, recipes, clues, chapter budgets
shared/types.ts              State and action types
server/engine.ts             Authoritative rules and state transitions
server/api.ts                Authentication, validation, idempotency, transport
server/store.ts              PostgreSQL room transactions
netlify/functions/game.ts     Production Function entrypoint
netlify/database/migrations/  Schema migration
scripts/                     Local server, local database, Function packaging
tests/                       Rules and complete API campaign tests
public/                      Static assets directory (currently empty)
dist/                        Built frontend
netlify.toml                 Build, functions, headers, SPA routing
```

## Sources checked October 28, 2026

- Official campus map: https://www.depauw.edu/files/resources/dpu_campus-map_with-nature-park_1-22.pdf
- Netlify Database API and transaction examples: https://docs.netlify.com/build/data-and-storage/netlify-database/api/
- Database setup: https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/
- Database migrations: https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/
- Database plan limits: https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/
- Blobs concurrency guidance: https://www.netlify.com/knowledge-base/how-to-store-files-and-objects-with-netlify-blobs/
- Functions API: https://docs.netlify.com/build/functions/api/
- CLI deployment: https://cli.netlify.com/commands/deploy/

The graph preserves recognizable relative campus placement but compresses walking routes for play. The western Nature Park trail has an extra stamina cost. This is not a navigation or emergency-response tool.
