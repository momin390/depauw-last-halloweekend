import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localPool } from "../scripts/local-store";
import { RoomStore } from "../server/store";
import { api } from "../server/api";
import type { Action, PublicRoom } from "../shared/types";
import type { Item } from "../shared/content";
const token = () => randomBytes(32).toString("hex");
test("API/database integration: independent sessions, concurrency, persistence and a complete campaign", async (t) => {
  const path = await mkdtemp(join(tmpdir(), "halloweekend-"));
  let db = await localPool(path);
  let store = new RoomStore(db.pool);
  let handle = api(store);
  async function request(auth: string, body: Record<string, unknown>) {
    const response = await handle(
      new Request("http://game.test/.netlify/functions/game", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, ...(await response.json()) } as {
      status: number;
      room: PublicRoom;
      playerId: string;
      error?: string;
    };
  }
  const a = token(),
    b = token();
  const createId = randomUUID();
  const first = await request(a, {
    op: "create",
    name: "Alex",
    requestId: createId,
  });
  assert.equal(first.status, 200);
  let r = first.room;
  const code = r.code;
  await t.test(
    "create retries are idempotent; join persists two distinct players",
    async () => {
      assert.equal(
        (await request(a, { op: "create", name: "Alex", requestId: createId }))
          .room.code,
        code,
      );
      const joined = await request(b, { op: "join", code, name: "Blair" });
      assert.equal(joined.status, 200);
      assert.equal(joined.room.players.length, 2);
      assert.notEqual(first.playerId, joined.playerId);
      assert.equal(
        (await request(b, { op: "join", code, name: "Blair" })).room.players
          .length,
        2,
      );
      assert.equal((await request(token(), { op: "state", code })).status, 403);
    },
  );
  await t.test(
    "host start and repeated action ID only mutate once",
    async () => {
      assert.equal(
        (await request(b, { op: "start", code, requestId: randomUUID() }))
          .status,
        400,
      );
      const started = await request(a, {
        op: "start",
        code,
        requestId: randomUUID(),
      });
      r = started.room;
      assert.equal(r.phase, "playing");
      const id = randomUUID();
      const payload = {
        op: "action",
        code,
        requestId: id,
        round: r.totalRound,
        run: r.run,
        action: { type: "take", item: "wood" },
      };
      const [one, two] = await Promise.all([
        request(a, payload),
        request(a, payload),
      ]);
      assert.equal(one.status, 200);
      assert.equal(two.status, 200);
      assert.equal(two.room.players[0].inventory.wood, 1);
      assert.equal(two.room.loot.humbert.wood, 7);
      assert.equal(
        (await request(a, { ...payload, requestId: randomUUID() })).status,
        400,
      );
      r = (
        await request(b, {
          op: "action",
          code,
          requestId: randomUUID(),
          round: r.totalRound,
          run: r.run,
          action: { type: "take", item: "wood" },
        })
      ).room;
    },
  );
  await t.test(
    "simultaneous distinct turns preserve both inventories and advance once",
    async () => {
      const args = {
        op: "action",
        code,
        round: r.totalRound,
        run: r.run,
        action: { type: "take", item: "tape" },
      };
      const res = await Promise.all([
        request(a, { ...args, requestId: randomUUID() }),
        request(b, { ...args, requestId: randomUUID() }),
      ]);
      assert.ok(res.every((x) => x.status === 200));
      r = (await request(a, { op: "state", code })).room;
      assert.equal(r.totalRound, 2);
      assert.equal(r.loot.humbert.tape, 6);
      assert.ok(r.players.every((p) => p.inventory.tape === 1));
    },
  );
  await t.test(
    "database restart and session refresh preserve campaign",
    async () => {
      await db.close();
      db = await localPool(path);
      store = new RoomStore(db.pool);
      handle = api(store);
      const rejoined = await request(b, { op: "state", code });
      assert.equal(rejoined.status, 200);
      assert.equal(rejoined.room.totalRound, 2);
      assert.equal(rejoined.room.players[1].inventory.wood, 1);
      r = rejoined.room;
    },
  );
  await t.test(
    "two independent API players complete all chapters and final scoreboard",
    async () => {
      const take = (item: Item, quantity = 1): Action => ({
          type: "take",
          item,
          quantity,
        }),
        move = (target: string): Action => ({ type: "move", target }),
        craft = (target: string): Action => ({ type: "craft", target }),
        wait: Action = { type: "wait" };
      async function one(auth: string, action: Action) {
        const res = await request(auth, {
          op: "action",
          code,
          run: r.run,
          round: r.totalRound,
          requestId: randomUUID(),
          action,
        });
        assert.equal(
          res.status,
          200,
          JSON.stringify({ action, error: res.error }),
        );
        r = res.room;
      }
      async function pair(aa: Action, bb: Action, reverse = false) {
        if (reverse) {
          await one(b, bb);
          await one(a, aa);
        } else {
          await one(a, aa);
          await one(b, bb);
        }
      }
      await pair(craft("bat"), craft("bat"));
      await pair(move("ubben"), move("ubben"));
      await pair(
        { type: "attack", target: "quad" },
        { type: "attack", target: "quad" },
      );
      await pair(move("hoover"), move("hoover"));
      await pair(take("ration", 3), take("ration", 3));
      await pair(move("union"), move("union"));
      await pair(take("planks"), take("nails"));
      await pair(
        wait,
        { type: "trade", item: "nails", target: r.players[0].id },
        true,
      );
      await pair(craft("barricade"), wait, true);
      assert.equal(r.night, 2);
      await pair(move("hoover"), move("hoover"));
      await pair(move("library"), move("library"));
      await pair(move("julian"), move("julian"));
      await pair(
        { type: "attack", target: "runner" },
        { type: "attack", target: "runner" },
      );
      await pair({ type: "investigate" }, take("battery", 2));
      await pair(
        take("board"),
        { type: "trade", item: "battery", target: r.players[0].id },
        true,
      );
      await pair(move("library"), move("bowman"));
      await pair({ type: "investigate" }, move("green"));
      await pair({ type: "investigate" }, take("speaker"));
      await pair(take("antenna"), craft("decoy"));
      await pair(move("lilly"), move("bowman"));
      await pair({ type: "defend" }, move("julian"));
      await pair({ type: "defend" }, move("lilly"));
      await pair({ type: "rescue" }, { type: "distract" }, true);
      await pair(craft("transmitter"), wait, true);
      await pair(move("east"), move("east"));
      await pair({ type: "bypass" }, { type: "distract" }, true);
      await pair({ type: "signal" }, { type: "rest" });
      await pair(move("library"), move("library"));
      await pair(move("lilly"), move("lilly"));
      await pair(move("nature"), move("nature"));
      await pair({ type: "escape" }, { type: "escape" });
      assert.equal(r.phase, "victory");
      assert.equal(r.perfect, true);
      assert.equal(r.players[0].score, 3975);
      assert.equal(r.players[1].score, 3535);
      assert.equal(r.players[0].health, 58);
      assert.equal(r.players[1].health, 70);
      assert.equal(
        (await request(b, { op: "state", code })).room.phase,
        "victory",
      );
      assert.ok(!JSON.stringify(r).includes("tokenHash"));
    },
  );
  await t.test(
    "play again retains identities, resets progress and rejects old rounds",
    async () => {
      const restarted = await request(a, {
        op: "again",
        code,
        requestId: randomUUID(),
      });
      assert.equal(restarted.status, 200);
      assert.equal(restarted.room.run, 2);
      assert.equal(restarted.room.phase, "lobby");
      assert.equal(restarted.room.players[0].id, first.playerId);
      assert.equal(restarted.room.players[0].score, 0);
    },
  );
  await t.test("eight players can join; ninth is rejected", async () => {
    const host = token();
    const created = await request(host, {
      op: "create",
      name: "P1",
      requestId: randomUUID(),
    });
    const result = await Promise.all(
      Array.from({ length: 7 }, (_, i) =>
        request(token(), {
          op: "join",
          code: created.room.code,
          name: "P" + (i + 2),
        }),
      ),
    );
    assert.ok(result.every((x) => x.status === 200));
    const full = await request(host, { op: "state", code: created.room.code });
    assert.equal(full.room.players.length, 8);
    assert.equal(
      (
        await request(token(), {
          op: "join",
          code: created.room.code,
          name: "P9",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(host, {
          op: "start",
          code: created.room.code,
          requestId: randomUUID(),
        })
      ).status,
      200,
    );
  });
  await t.test(
    "contested final loot yields one winner; failed crafting rolls back",
    async () => {
      const x = token(),
        y = token();
      const c = await request(x, {
        op: "create",
        name: "X",
        requestId: randomUUID(),
      });
      const k = c.room.code;
      await request(y, { op: "join", code: k, name: "Y" });
      await request(x, { op: "start", code: k, requestId: randomUUID() });
      await store.transact(k, (r) => {
        r.loot.humbert.wood = 1;
      });
      const params = {
        op: "action",
        code: k,
        run: 1,
        round: 0,
        action: { type: "take", item: "wood" },
      };
      const results = await Promise.all([
        request(x, { ...params, requestId: randomUUID() }),
        request(y, { ...params, requestId: randomUUID() }),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
      const state = (await request(x, { op: "state", code: k })).room;
      assert.equal(
        state.players.reduce((n, p) => n + (p.inventory.wood || 0), 0),
        1,
      );
      assert.equal(state.loot.humbert.wood, undefined);
      const failed = await request(y, {
        op: "action",
        code: k,
        run: 1,
        round: 0,
        requestId: randomUUID(),
        action: { type: "craft", target: "shield" },
      });
      assert.equal(failed.status, 400);
    },
  );
  await db.close();
  await rm(path, { recursive: true, force: true });
});
