import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { RoomStore } from "./store";
import {
  act,
  GameError,
  log,
  need,
  player,
  publicRoom,
  room,
  start,
  tick,
} from "./engine";
import { ITEMS } from "../shared/content";
import type { Action, Room } from "../shared/types";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () =>
  Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
const actionSchema = z
  .object({
    type: z.enum([
      "move",
      "sprint",
      "take",
      "drop",
      "trade",
      "craft",
      "eat",
      "heal",
      "revive",
      "attack",
      "defend",
      "distract",
      "flee",
      "rest",
      "wait",
      "investigate",
      "rescue",
      "bypass",
      "signal",
      "escape",
      "recover",
    ]),
    target: z.string().max(64).optional(),
    item: z
      .string()
      .refine((v) => Object.hasOwn(ITEMS, v))
      .optional(),
    quantity: z.number().int().min(1).max(24).optional(),
  })
  .strict();
const bodySchema = z
  .object({
    op: z.enum(["create", "join", "state", "start", "action", "again"]),
    code: z
      .string()
      .regex(/^[A-Z2-9]{6}$/)
      .optional(),
    name: z.string().trim().min(1).max(20).optional(),
    requestId: z.string().uuid().optional(),
    run: z.number().int().optional(),
    round: z.number().int().optional(),
    action: actionSchema.optional(),
  })
  .strict();
export function api(store: RoomStore) {
  return async (req: Request): Promise<Response> => {
    const respond = (value: unknown, status = 200) =>
      Response.json(value, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    try {
      if (req.method !== "POST") return respond({ error: "Use POST." }, 405);
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== new URL(req.url).host)
        throw new GameError("Cross-origin requests are not allowed.", 403);
      if (Number(req.headers.get("content-length") || 0) > 8192)
        throw new GameError("Request too large.", 413);
      const raw = await req.text();
      if (raw.length > 8192) throw new GameError("Request too large.", 413);
      const parsed = bodySchema.safeParse(JSON.parse(raw));
      if (!parsed.success)
        throw new GameError("Invalid request. Refresh and try again.");
      const b = parsed.data;
      const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
      need(token && /^[a-f0-9]{64}$/.test(token), "Missing survivor session.");
      const tokenHash = hash(token);
      const now = Date.now();
      if (b.op === "create") {
        need(b.name && b.requestId, "A nickname and request ID are required.");
        const p = player(randomUUID(), b.name, tokenHash, now);
        let created: Room | undefined;
        for (let i = 0; i < 5; i++) {
          try {
            created = await store.create(
              room(code(), p, now),
              hash(token + b.requestId),
            );
            break;
          } catch (e) {
            if ((e as { code?: string }).code !== "23505") throw e;
          }
        }
        need(created, "Could not allocate a room. Try again.");
        return respond({
          room: publicRoom(created),
          playerId: created.players[0].id,
        });
      }
      need(b.code, "Enter a room code.");
      const result = await store.transact(b.code, (r) => {
        let p = r.players.find((p) => p.tokenHash === tokenHash);
        if (b.op === "join" && !p) {
          need(
            r.phase === "lobby",
            "This campaign has started. Only existing survivors can reconnect.",
          );
          need(r.players.length < 8, "This room already has eight survivors.");
          need(b.name, "Choose a nickname.");
          need(
            !r.players.some(
              (p) => p.name.toLowerCase() === b.name!.toLowerCase(),
            ),
            "That nickname is already in this room.",
          );
          p = player(randomUUID(), b.name, tokenHash, now);
          r.players.push(p);
          log(r, p.name + " joins the safehouse.");
        }
        if (!p)
          throw new GameError("This session is not a member of the room.", 403);
        const wasAbsent = now - r.lastActivity > 45000;
        if (wasAbsent && r.players.every((q) => now - q.lastSeen > 45000))
          r.deadline = now + 90000;
        // Coalesce heartbeats so polling does not write on every request.
        if (now - p.lastSeen > 15000) p.lastSeen = now;
        tick(r, now);
        if (b.op === "action" || b.op === "start" || b.op === "again") {
          need(b.requestId, "A unique request ID is required.");
          const receipt = p.id + ":" + b.requestId;
          if (!r.receipts.includes(receipt)) {
            if (b.op === "start") start(r, p, now);
            else if (b.op === "again") {
              need(p.id === r.host, "Only the host can restart.");
              need(
                r.phase === "victory" || r.phase === "defeat",
                "Finish the current campaign first.",
              );
              const next = room(
                r.code,
                player(
                  r.players[0].id,
                  r.players[0].name,
                  r.players[0].tokenHash,
                  now,
                ),
                now,
              );
              next.players = r.players.map((p) =>
                player(p.id, p.name, p.tokenHash, now),
              );
              next.host = r.host;
              next.run = r.run + 1;
              next.receipts = r.receipts;
              next.version = r.version;
              Object.assign(r, next);
              log(
                r,
                "A new Halloweekend begins. The host can start when everyone is ready.",
              );
            } else {
              need(b.action, "Choose an action.");
              need(
                b.run === r.run && b.round === r.totalRound,
                "The round changed. Review the latest state before acting.",
              );
              act(r, p, b.action as Action, now);
            }
            r.receipts.push(receipt);
            r.receipts = r.receipts.slice(-4096);
          }
        }
        return { room: r, playerId: p.id };
      });
      return respond({
        room: publicRoom(result.room),
        playerId: result.playerId,
      });
    } catch (e) {
      if (e instanceof GameError)
        return respond({ error: e.message }, e.status);
      if (e instanceof SyntaxError)
        return respond({ error: "Invalid JSON." }, 400);
      console.error(
        "Game request failed",
        e instanceof Error ? e.message : "unknown",
      );
      return respond(
        {
          error:
            "The server could not save this request. Retry with the same action ID.",
        },
        503,
      );
    }
  };
}
