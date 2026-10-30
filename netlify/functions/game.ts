import { getDatabase } from "@netlify/database";
import { api } from "../../server/api";
import { RoomStore, type Pool } from "../../server/store";
// Netlify's modern Request/Response API supplies database credentials automatically.
export default async function game(req: Request) {
  const db = getDatabase();
  return api(new RoomStore(db.pool as unknown as Pool))(req);
}

export const config = {
  rateLimit: {
    windowLimit: 600,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
    action: "rate_limit",
  },
};
