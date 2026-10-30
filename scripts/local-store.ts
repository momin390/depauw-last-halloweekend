import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { Pool } from "../server/store";
export async function localPool(path?: string) {
  const db = new PGlite(path);
  await db.exec(
    await readFile(
      new URL(
        "../netlify/database/migrations/202610280001_game.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  let tail = Promise.resolve();
  const pool: Pool = {
    async connect() {
      let unlock!: () => void;
      const prior = tail;
      tail = new Promise<void>((r) => {
        unlock = r;
      });
      await prior;
      return {
        async query(sql, params) {
          const result = await db.query(sql, params);
          return { rows: result.rows };
        },
        release() {
          unlock();
        },
      };
    },
  };
  return { pool, close: () => db.close() };
}
