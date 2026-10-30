# Completed checkpoint — October 30, 2026 UTC

Game is publicly deployed at https://depauw-last-halloweekend.netlify.app/.

All three chapters, server-authoritative multiplayer for 2–8 players, persistence, crafting, combat, rescue, extraction, and scoring are implemented. Netlify Database was provisioned and its migration applied successfully. The user made the site public; unauthenticated browser access was verified.

24 local tests and 8 live production checks passed. Two separate browser sessions verified create/join/start, independent actions, shared updates, and refresh recovery. A complete live API campaign achieved Perfect Victory. See TEST_REPORT.md for scope and results.

Source, lockfile, database migration, built frontend, packaged Function, and the reusable live verification script are included in this archive. Credentials, browser tokens, dependency installations, and local databases are excluded.

## Resume development

1. Extract the archive and enter depauw-last-halloweekend.
2. Run `npm ci`, then `npm test`.
3. Run `npm run dev` for persistent local play.
4. After changes, deploy with `npx netlify deploy --prod --site 5edb36b5-1bf1-46ad-9914-57815c42ee36` using an authorized account.
5. Run `node --import tsx scripts/verify-live.ts https://depauw-last-halloweekend.netlify.app/` to create fresh test rooms and verify production.

Current deployment ID: 6ae40532cb14ee5517bc116a. No deployment blocker remains. Physical-device play with human participants was not part of automated acceptance.
