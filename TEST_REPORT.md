# Verification report — October 30, 2026 UTC

Production: https://depauw-last-halloweekend.netlify.app/
Deployment: 6ae40532cb14ee5517bc116a

## Local verification

24 automated tests passed. Engine and database/API checks cover complete campaigns, crafting and capacity, trading, combat, revival, critical-item recovery, timers, stale rounds, scoring, and connected map paths. TypeScript checking and the Vite production build passed. The Netlify Function packaged and deployed successfully.

## Live Netlify verification

Command: `node --import tsx scripts/verify-live.ts https://depauw-last-halloweekend.netlify.app/`

8 tests passed, zero failed (parent suite plus seven subtests):

- Idempotent room creation and two distinct player identities.
- Host start and duplicate action protection.
- Simultaneous distinct actions preserve both inventories and advance the round once.
- Fresh authenticated requests recover persisted state.
- Two independent API players complete all three chapters and the final scoreboard.
- Play again preserves identities, resets campaign state, and rejects stale rounds.
- Eight players can join; a ninth is rejected.

Complete campaign result: Perfect Victory, including Sam's rescue. Alex: score 3975, health 58. Blair: score 3535, health 70. The tested route used 11 / 15 / 7 rounds.

## Browser verification

The public HTTPS title screen opened without Netlify authentication. Two separate survivor sessions created/joined a room and started the campaign. Independent actions appeared on both screens, with consistent shared rounds and player stats. Refresh restored the first player's room and location. No application console errors were observed; unrelated browser-extension diagnostics were excluded. Earlier local visual checks covered the title and gameplay/map at 390px width.

These checks used automated independent authenticated clients and separate browser sessions. They were not a physical-device human playtest or a sustained load test. Production concurrent-action correctness was exercised against the deployed Netlify Database.
