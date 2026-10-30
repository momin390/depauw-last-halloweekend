import type { Item, LocationId } from "./content";
export type Inventory = Partial<Record<Item, number>>;
export type Action = {
  type:
    | "move"
    | "sprint"
    | "take"
    | "drop"
    | "trade"
    | "craft"
    | "eat"
    | "heal"
    | "revive"
    | "attack"
    | "defend"
    | "distract"
    | "flee"
    | "rest"
    | "wait"
    | "investigate"
    | "rescue"
    | "bypass"
    | "signal"
    | "escape"
    | "recover";
  target?: string;
  item?: Item;
  quantity?: number;
};
export interface Player {
  id: string;
  name: string;
  tokenHash: string;
  location: LocationId;
  health: number;
  hunger: number;
  stamina: number;
  noise: number;
  inventory: Inventory;
  status: "alive" | "down" | "spectator" | "escaped";
  downRound: number | null;
  score: number;
  kills: number;
  crafted: number;
  rescues: number;
  nights: number;
  visited: LocationId[];
  awards: string[];
  acted: boolean;
  lastSeen: number;
}
export interface Enemy {
  id: string;
  type: "Wanderer" | "Runner" | "Bellkeeper";
  location: LocationId;
  health: number;
  maxHealth: number;
  damage: number;
  distractedUntil: number;
}
export interface Room {
  code: string;
  host: string;
  phase: "lobby" | "playing" | "victory" | "defeat";
  version: number;
  run: number;
  night: number;
  round: number;
  totalRound: number;
  deadline: number;
  lastActivity: number;
  players: Player[];
  loot: Record<LocationId, Inventory>;
  ground: Record<LocationId, Inventory>;
  enemies: Enemy[];
  foodFound: number;
  clues: string[];
  barricade: boolean;
  transmitterBuilt: boolean;
  bossBypassed: boolean;
  signal: boolean;
  npcRescued: boolean;
  awards: string[];
  events: { id: number; text: string; night: number; round: number }[];
  eventSeq: number;
  reason: string;
  perfect: boolean;
  receipts: string[];
  expiresAt: number;
}
export type PublicPlayer = Omit<Player, "tokenHash">;
export type PublicRoom = Omit<Room, "players" | "receipts"> & {
  players: PublicPlayer[];
};
