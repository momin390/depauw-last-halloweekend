import test from "node:test";
import assert from "node:assert/strict";
import {
  act,
  player,
  room,
  start,
  resolveRound,
  tick,
  publicRoom,
} from "../server/engine";
import { BUDGETS, LOCATIONS, RECIPES, type Item } from "../shared/content";
import type { Action } from "../shared/types";
const now = Date.now();
function setup() {
  const a = player("a", "Alex", "secret-a", now),
    b = player("b", "Blair", "secret-b", now);
  const r = room("ABC234", a, now);
  r.players.push(b);
  start(r, a, now);
  return { r, a, b };
}
test("lobby requires host and two players; secrets never appear in public state", () => {
  const a = player("a", "A", "secret", now),
    r = room("ABC234", a, now);
  assert.throws(() => start(r, a, now), /two/);
  r.players.push(player("b", "B", "secret2", now));
  assert.throws(() => start(r, r.players[1], now), /host/);
  assert.ok(!JSON.stringify(publicRoom(r)).includes("tokenHash"));
});
test("all eleven campus locations form a connected symmetric graph", () => {
  const seen = new Set<string>();
  const todo = ["humbert"];
  while (todo.length) {
    const id = todo.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const to of LOCATIONS[id as keyof typeof LOCATIONS].links) {
      assert.ok(LOCATIONS[to].links.includes(id as any));
      todo.push(to);
    }
  }
  assert.equal(seen.size, 11);
});
test("each player gets one action per shared round; independent positions", () => {
  const { r, a, b } = setup();
  act(r, a, { type: "move", target: "green" }, now);
  assert.equal(a.location, "green");
  assert.equal(b.location, "humbert");
  assert.equal(r.round, 0);
  assert.throws(() => act(r, a, { type: "rest" }, now), /already/);
  act(r, b, { type: "wait" }, now);
  assert.equal(r.round, 1);
  assert.equal(a.acted, false);
});
test("server rejects remote enemies, impossible movement and downed actions", () => {
  const { r, a } = setup();
  assert.throws(
    () => act(r, a, { type: "attack", target: "runner" }, now),
    /location/,
  );
  assert.throws(
    () => act(r, a, { type: "move", target: "nature" }, now),
    /connected/,
  );
  a.status = "down";
  assert.throws(() => act(r, a, { type: "wait" }, now), /active survivors/);
});
test("crafting consumes exact materials, blocks missing resources and slot overflow", () => {
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const { r, a } = setup();
    a.inventory = { ...recipe.needs };
    if (id === "barricade") a.location = "union";
    if (id === "transmitter") r.clues = ["waveform", "archive", "protocol"];
    act(r, a, { type: "craft", target: id }, now);
    assert.deepEqual(a.inventory, recipe.gives ? { [recipe.gives]: 1 } : {});
  }
  const { r, a } = setup();
  assert.throws(
    () => act(r, a, { type: "craft", target: "bat" }, now),
    /Not enough/,
  );
  a.inventory = {
    ration: 1,
    bandages: 1,
    tape: 1,
    tray: 1,
    straps: 1,
    speaker: 1,
  };
  assert.throws(() => act(r, a, { type: "take", item: "wood" }, now), /Six/);
  assert.equal(r.loot.humbert.wood, 8);
  assert.equal(a.acted, false);
});
test("trade requires co-location and space; loot cannot become negative", () => {
  const { r, a, b } = setup();
  act(r, a, { type: "trade", item: "ration", target: b.id }, now);
  assert.equal(a.inventory.ration, 1);
  assert.equal(b.inventory.ration, 3);
  act(r, b, { type: "wait" }, now);
  b.location = "green";
  assert.throws(
    () => act(r, a, { type: "trade", item: "ration", target: b.id }, now),
    /location/,
  );
  assert.throws(
    () => act(r, a, { type: "take", item: "antenna" }, now),
    /taken/,
  );
});
test("bat damage, defend, shield, runner pursuit and flee are consistent", () => {
  const { r, a, b } = setup();
  a.location = "julian";
  a.inventory.bat = 1;
  act(r, a, { type: "attack", target: "runner" }, now);
  assert.equal(r.enemies[1].health, 27);
  assert.equal(a.stamina, 90);
  assert.equal(a.health, 88);
  act(r, b, { type: "wait" }, now);
  a.inventory.shield = 1;
  act(r, a, { type: "defend" }, now);
  assert.equal(a.health, 88);
  act(r, b, { type: "wait" }, now);
  act(r, a, { type: "move", target: "library" }, now);
  assert.equal(r.enemies[1].location, "library");
  act(r, b, { type: "wait" }, now);
  act(r, a, { type: "flee", target: "hoover" }, now);
  assert.equal(r.enemies[1].location, "library");
});
test("revival, spectator loot recovery and defeat work", () => {
  const { r, a, b } = setup();
  a.status = "down";
  a.health = 0;
  a.downRound = 0;
  b.inventory.medkit = 1;
  act(r, b, { type: "revive", target: "a" }, now);
  assert.equal(a.health, 40);
  assert.equal(a.status, "alive");
  assert.equal(b.score, 175);
  a.status = "down";
  a.health = 0;
  a.downRound = r.totalRound;
  for (let i = 0; i < 3; i++) resolveRound(r, now);
  assert.equal(a.status, "spectator");
  assert.equal(r.ground.humbert.ration, 2);
  b.status = "down";
  b.health = 0;
  resolveRound(r, now);
  assert.equal(r.phase, "defeat");
});
test("clock defeat, disconnect pause and inactive passes", () => {
  const { r, a } = setup();
  r.deadline = now - 1;
  a.lastSeen = now - 100000;
  r.players[1].lastSeen = now - 100000;
  tick(r, now);
  assert.equal(r.round, 0);
  a.lastSeen = now;
  a.acted = true;
  r.deadline = now - 1;
  tick(r, now);
  assert.equal(r.round, 1);
  r.round = BUDGETS[1] - 1;
  resolveRound(r, now);
  assert.equal(r.phase, "defeat");
});
test("essential recovery works only when all existing copies are gone", () => {
  const { r, a } = setup();
  a.location = "library";
  assert.throws(
    () => act(r, a, { type: "recover", item: "antenna" }, now),
    /still exists/,
  );
  delete r.loot.library.antenna;
  act(r, a, { type: "recover", item: "antenna" }, now);
  assert.equal(r.loot.library.antenna, 1);
});
test("discovery and craft awards cannot be farmed", () => {
  const { r, a, b } = setup();
  const old = a.score;
  act(r, a, { type: "move", target: "green" }, now);
  act(r, b, { type: "wait" }, now);
  act(r, a, { type: "move", target: "humbert" }, now);
  act(r, b, { type: "wait" }, now);
  act(r, a, { type: "move", target: "green" }, now);
  assert.equal(a.score, old + 25);
});
test("two-player complete campaign, optional rescue and perfect victory within budgets", () => {
  const { r, a, b } = setup();
  const rounds: number[] = [];
  const take = (item: Item, quantity = 1): Action => ({
    type: "take",
    item,
    quantity,
  });
  const move = (target: string): Action => ({ type: "move", target });
  const craft = (target: string): Action => ({ type: "craft", target });
  const wait: Action = { type: "wait" };
  function pair(aa: Action, bb: Action, reverse = false) {
    const before = r.night;
    const used = r.round;
    if (reverse) {
      act(r, b, bb, now);
      act(r, a, aa, now);
    } else {
      act(r, a, aa, now);
      act(r, b, bb, now);
    }
    if (r.night !== before) rounds.push(used + 1);
    assert.notEqual(r.phase, "defeat");
  }
  pair(take("wood"), take("wood"));
  pair(take("tape"), take("tape"));
  pair(craft("bat"), craft("bat"));
  pair(move("ubben"), move("ubben"));
  pair({ type: "attack", target: "quad" }, { type: "attack", target: "quad" });
  pair(move("hoover"), move("hoover"));
  pair(take("ration", 3), take("ration", 3));
  pair(move("union"), move("union"));
  pair(take("planks"), take("nails"));
  pair(wait, { type: "trade", item: "nails", target: "a" }, true);
  pair(craft("barricade"), wait, true);
  assert.equal(r.night, 2);
  pair(move("hoover"), move("hoover"));
  pair(move("library"), move("library"));
  pair(move("julian"), move("julian"));
  pair(
    { type: "attack", target: "runner" },
    { type: "attack", target: "runner" },
  );
  pair({ type: "investigate" }, take("battery", 2));
  pair(take("board"), { type: "trade", item: "battery", target: "a" }, true);
  pair(move("library"), move("bowman"));
  pair({ type: "investigate" }, move("green"));
  pair({ type: "investigate" }, take("speaker"));
  pair(take("antenna"), craft("decoy"));
  pair(move("lilly"), move("bowman"));
  pair({ type: "defend" }, move("julian"));
  pair({ type: "defend" }, move("lilly"));
  pair({ type: "rescue" }, { type: "distract" }, true);
  pair(craft("transmitter"), wait, true);
  assert.equal(r.night, 3);
  pair(move("east"), move("east"));
  pair({ type: "bypass" }, { type: "distract" }, true);
  pair({ type: "signal" }, { type: "rest" });
  pair(move("library"), move("library"));
  pair(move("lilly"), move("lilly"));
  pair(move("nature"), move("nature"));
  pair({ type: "escape" }, { type: "escape" });
  rounds.push(r.round);
  assert.equal(r.phase, "victory");
  assert.equal(r.perfect, true);
  assert.ok(
    r.players.every(
      (p) => p.status === "escaped" && p.nights === 3 && p.score > 1000,
    ),
  );
  assert.ok(rounds.every((n, i) => n < BUDGETS[i + 1]));
  console.log(
    "Full campaign round usage:",
    rounds,
    "Final scores:",
    r.players.map((p) => ({ name: p.name, score: p.score, health: p.health })),
  );
});
test("Bellkeeper can be defeated by teamwork; first escape preserves victory at timeout", () => {
  const { r, a, b } = setup();
  r.night = 3;
  r.enemies = [
    {
      id: "bellkeeper",
      type: "Bellkeeper",
      location: "east",
      health: 180,
      maxHealth: 180,
      damage: 22,
      distractedUntil: -1,
    },
  ];
  a.location = b.location = "east";
  a.inventory = { bat: 1, shield: 1, medkit: 3, transmitter: 1 };
  b.inventory = { bat: 1, shield: 1, decoy: 1 };
  for (let i = 0; i < 7; i++) {
    act(r, b, { type: "distract" }, now);
    act(r, a, { type: "attack", target: "bellkeeper" }, now);
  }
  assert.equal(r.enemies[0].health, 0);
  act(r, a, { type: "signal" }, now);
  act(r, b, { type: "wait" }, now);
  a.location = "nature";
  act(r, a, { type: "escape" }, now);
  act(r, b, { type: "wait" }, now);
  r.round = BUDGETS[3] - 1;
  resolveRound(r, now);
  assert.equal(r.phase, "victory");
  assert.equal(r.perfect, false);
});

test("chapter transitions invalidate stale round requests and preserve a fresh budget", () => {
  const { r, a, b } = setup();
  r.foodFound = 6;
  a.visited.push("hoover");
  a.location = "union";
  a.inventory = { planks: 1, nails: 1 };
  b.acted = true;
  const before = r.totalRound;
  act(r, a, { type: "craft", target: "barricade" }, now);
  assert.equal(r.night, 2);
  assert.equal(r.totalRound, before + 1);
  assert.equal(r.round, 0);
  assert.ok(r.players.every((p) => !p.acted));
});
test("new incapacitation permits three full subsequent revival rounds", () => {
  const { r, a, b } = setup();
  a.location = "ubben";
  a.health = 1;
  act(r, a, { type: "wait" }, now);
  assert.equal(a.status, "down");
  act(r, b, { type: "wait" }, now);
  assert.equal(a.status, "down");
  resolveRound(r, now);
  resolveRound(r, now);
  assert.equal(a.status, "down");
  resolveRound(r, now);
  assert.equal(a.status, "spectator");
});
