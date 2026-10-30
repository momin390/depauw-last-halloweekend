import type { Room } from "../shared/types";
import { GameError } from "./engine";
export interface Client {
  query(sql: string, values?: unknown[]): Promise<{ rows: any[] }>;
  release(): void;
}
export interface Pool {
  connect(): Promise<Client>;
}
export class RoomStore {
  constructor(private pool: Pool) {}
  async create(r: Room, key: string) {
    const c = await this.pool.connect();
    try {
      const out = await c.query(
        "INSERT INTO game_rooms (code,create_key,state,expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT (create_key) DO UPDATE SET create_key=EXCLUDED.create_key RETURNING state",
        [r.code, key, JSON.stringify(r), new Date(r.expiresAt)],
      );
      return out.rows[0].state as Room;
    } finally {
      c.release();
    }
  }
  async transact<T>(code: string, fn: (r: Room) => T): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout = '8s'");
      const res = await c.query(
        "SELECT state FROM game_rooms WHERE code=$1 AND expires_at > NOW() FOR UPDATE",
        [code],
      );
      if (!res.rows.length)
        throw new GameError(
          "Room not found or expired. Check the six-letter code.",
          404,
        );
      const r = res.rows[0].state as Room;
      const before = JSON.stringify(r);
      const result = fn(r);
      if (JSON.stringify(r) !== before) {
        r.version++;
        await c.query("UPDATE game_rooms SET state=$2 WHERE code=$1", [
          code,
          JSON.stringify(r),
        ]);
      }
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
