import {
  BUDGETS,
  CHAPTERS,
  CLUES,
  ITEMS,
  LOCATIONS,
  OPENING,
  ORIGINS,
  RECIPES,
  type Item,
  type LocationId,
} from "../shared/content";
import type {
  Action,
  Inventory,
  Player,
  PublicRoom,
  Room,
} from "../shared/types";
export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw new GameError(message);
}
export function log(r: Room, text: string) {
  r.events.push({ id: ++r.eventSeq, text, night: r.night, round: r.round });
  r.events = r.events.slice(-100);
}
export function player(
  id: string,
  name: string,
  tokenHash: string,
  now: number,
): Player {
  return {
    id,
    name,
    tokenHash,
    location: "humbert",
    health: 100,
    hunger: 100,
    stamina: 100,
    noise: 0,
    inventory: { ration: 2, bandages: 1 },
    status: "alive",
    downRound: null,
    score: 0,
    kills: 0,
    crafted: 0,
    rescues: 0,
    nights: 0,
    visited: [],
    awards: [],
    acted: false,
    lastSeen: now,
  };
}
export function room(code: string, p: Player, now: number): Room {
  return {
    code,
    host: p.id,
    phase: "lobby",
    version: 0,
    run: 1,
    night: 1,
    round: 0,
    totalRound: 0,
    deadline: now + 90000,
    lastActivity: now,
    players: [p],
    loot: Object.fromEntries(
      Object.entries(LOCATIONS).map(([k, v]) => [k, { ...v.loot }]),
    ) as Room["loot"],
    ground: Object.fromEntries(
      Object.keys(LOCATIONS).map((k) => [k, {}]),
    ) as Room["ground"],
    enemies: [],
    foodFound: 0,
    clues: [],
    barricade: false,
    transmitterBuilt: false,
    bossBypassed: false,
    signal: false,
    npcRescued: false,
    awards: [],
    events: [],
    eventSeq: 0,
    reason: "",
    perfect: false,
    receipts: [],
    expiresAt: now + 7 * 86400000,
  };
}
export function publicRoom(r: Room): PublicRoom {
  const { receipts, ...rest } = r;
  return { ...rest, players: r.players.map(({ tokenHash, ...p }) => p) };
}
function award(p: Player, key: string, n: number) {
  if (!p.awards.includes(key)) {
    p.awards.push(key);
    p.score += n;
  }
}
function objective(r: Room, key: string, text: string) {
  if (r.awards.includes(key)) return;
  r.awards.push(key);
  for (const p of r.players) if (p.status !== "spectator") award(p, key, 300);
  log(r, "OBJECTIVE COMPLETE · " + text + " · +300 each");
}
function discover(p: Player) {
  if (!p.visited.includes(p.location)) {
    p.visited.push(p.location);
    award(p, "visit:" + p.location, 25);
  }
}
export function start(r: Room, p: Player, now: number) {
  need(r.phase === "lobby", "The campaign has already started.");
  need(p.id === r.host, "Only the host can start.");
  need(r.players.length >= 2, "At least two survivors are required.");
  r.phase = "playing";
  r.deadline = now + 90000;
  for (const q of r.players) discover(q);
  r.enemies = [
    {
      id: "quad",
      type: "Wanderer",
      location: "ubben",
      health: 35,
      maxHealth: 35,
      damage: 8,
      distractedUntil: -1,
    },
    {
      id: "runner",
      type: "Runner",
      location: "julian",
      health: 55,
      maxHealth: 55,
      damage: 12,
      distractedUntil: -1,
    },
    {
      id: "gym",
      type: "Wanderer",
      location: "lilly",
      health: 35,
      maxHealth: 35,
      damage: 8,
      distractedUntil: -1,
    },
  ];
  log(r, OPENING);
}
function count(inv: Inventory, item: Item) {
  return inv[item] || 0;
}
function add(inv: Inventory, item: Item, n: number) {
  const next = count(inv, item) + n;
  need(next >= 0, "Not enough " + ITEMS[item].name + ".");
  if (next) inv[item] = next;
  else delete inv[item];
}
function capacity(inv: Inventory) {
  need(
    Object.keys(inv).length <= 6,
    "Six inventory slots full. Drop or trade an item first.",
  );
  need(
    Object.values(inv).every((n) => n! <= 24),
    "Maximum stack size is 24.",
  );
}
function enemyAt(r: Room, p: Player) {
  return r.enemies.filter((e) => e.location === p.location && e.health > 0);
}
function damage(r: Room, p: Player, n: number) {
  p.health = Math.max(0, p.health - n);
  if (p.health === 0 && p.status === "alive") {
    p.status = "down";
    p.downRound = r.totalRound + 1;
    log(r, p.name + " is incapacitated. Revive within three shared rounds.");
  }
}
function move(
  r: Room,
  p: Player,
  target: string | undefined,
  sprint = false,
  flee = false,
) {
  need(target && Object.hasOwn(LOCATIONS, target), "Choose a destination.");
  const dest = target as LocationId;
  need(
    LOCATIONS[p.location].links.includes(dest),
    "That destination is not connected.",
  );
  const threat = enemyAt(r, p);
  if (sprint || flee) {
    need(p.stamina >= 12, "Need 12 stamina to sprint or flee.");
    p.stamina -= 12;
    p.noise = Math.min(100, p.noise + 15);
  }
  if (dest === "nature") {
    need(p.stamina >= 12, "The western trail needs 12 stamina. Rest first.");
    p.stamina -= 12;
  }
  for (const e of threat) {
    if (
      e.type === "Runner" &&
      e.distractedUntil < r.totalRound &&
      !sprint &&
      !flee
    ) {
      e.location = dest;
      log(
        r,
        "The Runner follows " + p.name + " to " + LOCATIONS[dest].name + ".",
      );
    }
  }
  if (dest === "bowman" && p.noise >= 40) {
    damage(r, p, 4);
    log(
      r,
      p.name +
        " stumbles on the wet park steps while moving noisily. −4 health.",
    );
  }
  p.location = dest;
  discover(p);
  log(
    r,
    p.name +
      (flee ? " flees to " : sprint ? " sprints to " : " moves to ") +
      LOCATIONS[dest].name +
      ".",
  );
}
function remainingItem(r: Room, item: Item) {
  return (
    r.players.reduce((n, p) => n + count(p.inventory, item), 0) +
    Object.values(r.loot).reduce((n, l) => n + count(l, item), 0) +
    Object.values(r.ground).reduce((n, l) => n + count(l, item), 0)
  );
}
export function act(r: Room, p: Player, a: Action, now: number) {
  need(r.phase === "playing", "The campaign is not active.");
  need(p.status === "alive", "Only active survivors can act.");
  need(!p.acted, "You have already ended your turn. Wait for your team.");
  const enemies = enemyAt(r, p);
  let protectedThisRound = false;
  switch (a.type) {
    case "move":
    case "sprint":
    case "flee":
      move(r, p, a.target, a.type === "sprint", a.type === "flee");
      protectedThisRound = a.type !== "move";
      break;
    case "take": {
      const item = a.item!;
      need(ITEMS[item], "Choose an item.");
      const n = a.quantity ?? 1;
      need(
        Number.isInteger(n) && n >= 1 && n <= 3,
        "Take one to three items per turn.",
      );
      const loot = r.loot[p.location],
        ground = r.ground[p.location];
      need(
        count(loot, item) + count(ground, item) >= n,
        "That item has already been taken.",
      );
      const inv = { ...p.inventory };
      add(inv, item, n);
      capacity(inv);
      const fresh = Math.min(count(loot, item), n);
      add(loot, item, -fresh);
      add(ground, item, -(n - fresh));
      p.inventory = inv;
      if (p.location === "hoover" && item === "ration")
        r.foodFound = Math.min(6, r.foodFound + fresh);
      log(r, p.name + " collects " + n + " × " + ITEMS[item].name + ".");
      break;
    }
    case "drop":
    case "trade": {
      const item = a.item!;
      need(ITEMS[item], "Choose an item.");
      const n = a.quantity ?? 1;
      need(Number.isInteger(n) && n > 0 && n <= 24, "Invalid quantity.");
      need(count(p.inventory, item) >= n, "You do not have that item.");
      if (a.type === "trade") {
        const to = r.players.find((q) => q.id === a.target);
        need(
          to &&
            to.id !== p.id &&
            to.status === "alive" &&
            to.location === p.location,
          "Trade requires another living player at your location.",
        );
        const inv = { ...to.inventory };
        add(inv, item, n);
        capacity(inv);
        to.inventory = inv;
        log(
          r,
          p.name +
            " gives " +
            n +
            " × " +
            ITEMS[item].name +
            " to " +
            to.name +
            ".",
        );
      } else {
        add(r.ground[p.location], item, n);
        log(r, p.name + " leaves " + ITEMS[item].name + " on the ground.");
      }
      add(p.inventory, item, -n);
      break;
    }
    case "craft": {
      need(a.target && Object.hasOwn(RECIPES, a.target), "Unknown recipe.");
      const recipe = RECIPES[a.target];
      if (a.target === "barricade") {
        need(
          p.location === "union",
          "Build the barricade at the Memorial Union.",
        );
        need(!r.barricade, "The entrance is already barricaded.");
      }
      if (a.target === "transmitter")
        need(
          r.clues.length === 3,
          "Recover all three clues to learn the transmitter frequency.",
        );
      const inv = { ...p.inventory };
      for (const [i, n] of Object.entries(recipe.needs))
        add(inv, i as Item, -n!);
      if (recipe.gives) add(inv, recipe.gives, 1);
      capacity(inv);
      p.inventory = inv;
      if (a.target === "barricade") r.barricade = true;
      if (a.target === "transmitter") r.transmitterBuilt = true;
      p.crafted++;
      award(p, "craft:" + a.target, 50);
      log(r, p.name + " crafts " + recipe.name + ".");
      break;
    }
    case "eat":
      need(count(p.inventory, "ration") > 0, "You need a food ration.");
      add(p.inventory, "ration", -1);
      p.hunger = Math.min(100, p.hunger + 38);
      log(r, p.name + " eats a ration.");
      break;
    case "heal": {
      const i = a.item;
      need(
        i === "bandages" || i === "medkit",
        "Use bandages or a first-aid kit.",
      );
      need(count(p.inventory, i) > 0, "You do not have that medicine.");
      need(p.health < 100, "You are already at full health.");
      add(p.inventory, i, -1);
      p.health = Math.min(100, p.health + (i === "medkit" ? 45 : 15));
      log(r, p.name + " treats their wounds.");
      break;
    }
    case "revive": {
      const q = r.players.find((v) => v.id === a.target);
      need(
        q && q.status === "down" && q.location === p.location,
        "Reach an incapacitated teammate first.",
      );
      need(count(p.inventory, "medkit") > 0, "A first-aid kit is required.");
      add(p.inventory, "medkit", -1);
      q.health = 40;
      q.status = "alive";
      q.downRound = null;
      q.acted = true;
      award(p, "revive:" + q.id, 150);
      log(r, p.name + " revives " + q.name + ".");
      break;
    }
    case "attack": {
      const e = enemies.find((e) => e.id === a.target);
      need(e, "No living enemy with that ID at your location.");
      need(p.stamina >= 10, "Attacking requires 10 stamina.");
      p.stamina -= 10;
      p.noise = Math.min(100, p.noise + 20);
      const n = count(p.inventory, "bat") ? 28 : 12;
      e.health = Math.max(0, e.health - n);
      log(r, p.name + " strikes the " + e.type + " for " + n + " damage.");
      if (!e.health) {
        p.kills++;
        award(p, "kill:" + e.id, 30);
        log(r, "The " + e.type + " falls silent.");
      }
      break;
    }
    case "defend":
      protectedThisRound = true;
      p.stamina = Math.min(100, p.stamina + 6);
      log(r, p.name + " braces for an attack.");
      break;
    case "distract":
      need(enemies.length, "There is no enemy to distract here.");
      need(count(p.inventory, "decoy") > 0, "Craft a noise decoy first.");
      for (const e of enemies) e.distractedUntil = r.totalRound + 1;
      log(
        r,
        p.name +
          " sends a false heartbeat down the corridor. Enemies are distracted for this round and the next.",
      );
      break;
    case "rest":
      p.stamina = Math.min(100, p.stamina + 30);
      log(r, p.name + " catches their breath.");
      break;
    case "wait":
      log(r, p.name + " keeps watch.");
      break;
    case "investigate": {
      need(
        r.night >= 2,
        "Survive the lockdown before investigating the outbreak.",
      );
      const clue = CLUES.find(
        (c) => c.at === p.location && !r.clues.includes(c.id),
      );
      need(clue, "No unread research remains here.");
      if (clue.id === "protocol")
        need(
          r.clues.includes("waveform"),
          "The archive cabinet is locked. Julian’s resonance log contains the access code.",
        );
      r.clues.push(clue.id);
      award(p, "clue:" + clue.id, 100);
      log(r, clue.title.toUpperCase() + " · " + clue.text);
      break;
    }
    case "rescue":
      need(
        r.night >= 2 && p.location === "lilly",
        "The trapped survivor is at Lilly Center, from Night 2 onward.",
      );
      need(!r.npcRescued, "The student is already safe.");
      need(
        !enemies.some((e) => e.distractedUntil < r.totalRound),
        "Clear or distract the enemy before opening the cage.",
      );
      r.npcRescued = true;
      p.rescues++;
      award(p, "rescue", 200);
      log(
        r,
        p.name +
          " frees Sam, a student trapped in the equipment cage. Sam follows the marked route to the evacuation shelter.",
      );
      break;
    case "bypass":
      need(
        r.night === 3 && p.location === "east",
        "The maintenance stairs are at East College on Night 3.",
      );
      need(r.clues.length === 3, "Read the shutdown protocol first.");
      need(
        enemies.every((e) => e.distractedUntil >= r.totalRound),
        "Distract the Bellkeeper before slipping into the service stairs.",
      );
      r.bossBypassed = true;
      protectedThisRound = true;
      log(
        r,
        p.name +
          " opens the maintenance route. The team can now reach the transmitter platform.",
      );
      break;
    case "signal":
      need(
        r.night === 3 && p.location === "east",
        "Transmit from East College on Night 3.",
      );
      need(!r.signal, "The signal is already active.");
      need(
        count(p.inventory, "transmitter") > 0,
        "Bring the crafted transmitter.",
      );
      need(
        r.bossBypassed || !enemies.some((e) => e.type === "Bellkeeper"),
        "Defeat the Bellkeeper or use the maintenance stairs.",
      );
      r.signal = true;
      protectedThisRound = true;
      objective(r, "signal", "Rescue signal sent");
      log(
        r,
        "The counter-frequency cuts through the bell. A voice answers: “We hear you. Nature Park. Before sunrise.”",
      );
      break;
    case "escape":
      need(
        r.signal && p.location === "nature",
        "Reach the Nature Park after sending the rescue signal.",
      );
      p.status = "escaped";
      award(p, "escape", 500);
      award(p, "survive", 500);
      p.nights = 3;
      log(
        r,
        p.name +
          " reaches the evacuation vehicle. Team victory secured; remaining survivors can still escape before dawn.",
      );
      break;
    case "recover": {
      const i = a.item!;
      need(
        ORIGINS[i] === p.location,
        "Recover this essential item at its marked supply location.",
      );
      if (i === "transmitter")
        need(
          r.transmitterBuilt,
          "Craft a transmitter before requesting its recovery.",
        );
      need(
        remainingItem(r, i) === 0,
        "That item still exists in a backpack or at a marked location.",
      );
      if (i === "planks" || i === "nails")
        need(!r.barricade, "The barricade is already built.");
      add(r.loot[p.location], i, 1);
      log(
        r,
        "A sealed reserve supplies one " +
          ITEMS[i].name +
          ". Pick it up next turn.",
      );
      break;
    }
    default:
      throw new GameError("Unknown action.");
  }
  p.acted = true;
  p.lastSeen = now;
  r.lastActivity = now;
  // Enemy retaliation is tied to one accepted action, never polling or repeated clicks.
  if (
    p.status === "alive" &&
    !(p.location === "east" && (r.bossBypassed || r.signal))
  ) {
    for (const e of enemyAt(r, p)) {
      if (e.distractedUntil >= r.totalRound) continue;
      const reduction =
        (count(p.inventory, "shield") ? 4 : 0) + (protectedThisRound ? 12 : 0);
      const n = Math.max(
        0,
        e.damage + Math.floor(p.noise / 40) * 2 - reduction,
      );
      if (n) {
        damage(r, p, n);
        log(r, "The " + e.type + " hits " + p.name + " for " + n + ".");
      }
    }
  }
  checkObjectives(r);
  if (
    r.phase === "playing" &&
    r.players.filter((q) => q.status === "alive").every((q) => q.acted)
  )
    resolveRound(r, now);
  checkEnd(r);
}
function checkObjectives(r: Room) {
  if (r.night === 1) {
    if (r.players.some((p) => p.visited.includes("hoover")))
      objective(r, "hoover", "Reach Hoover Hall");
    if (r.foodFound >= 6) objective(r, "food", "Collect six emergency rations");
    if (r.barricade) objective(r, "shelter", "Establish the Union safehouse");
    if (r.foodFound >= 6 && r.barricade && r.awards.includes("hoover"))
      nextNight(r, 2);
  } else if (r.night === 2) {
    if (r.clues.includes("waveform"))
      objective(r, "lab", "Investigate Julian Science Center");
    if (r.clues.length === 3)
      objective(r, "research", "Recover all three research clues");
    if (r.transmitterBuilt) {
      objective(r, "radio", "Build the emergency transmitter");
      if (r.clues.length === 3) nextNight(r, 3);
    }
  }
}
function nextNight(r: Room, n: number) {
  for (const p of r.players) {
    if (p.status === "alive") {
      p.nights = n - 1;
      p.location = "union";
      discover(p);
      p.hunger = Math.max(85, p.hunger);
      p.stamina = 100;
      p.health = Math.min(100, p.health + 20);
      p.noise = 0;
    }
    p.acted = false;
  }
  r.totalRound++; // Invalidate requests submitted against the previous chapter.
  r.night = n;
  r.round = 0;
  r.deadline = r.lastActivity + 90000;
  if (n === 3)
    r.enemies.push({
      id: "bellkeeper",
      type: "Bellkeeper",
      location: "east",
      health: 180,
      maxHealth: 180,
      damage: 22,
      distractedUntil: -1,
    });
  log(
    r,
    n === 2
      ? "NIGHT 2 · THE INFECTION\nDaylight buys a few hours behind the barricade. Your supplies hold. At dusk, the bell starts again. Julian’s emergency monitor may explain why."
      : "NIGHT 3 · THE LAST BELL\nThe transmitter is ready. The night answers with a single bell. Something moves beneath East College. Find the tower, break its hold, and get everyone west before sunrise.",
  );
}
function eliminate(r: Room, p: Player) {
  p.status = "spectator";
  for (const [i, n] of Object.entries(p.inventory))
    add(r.ground[p.location], i as Item, n!);
  p.inventory = {};
  log(
    r,
    p.name +
      " can no longer continue. Their supplies remain at " +
      LOCATIONS[p.location].name +
      ".",
  );
}
export function resolveRound(r: Room, now: number) {
  if (r.phase !== "playing") return;
  r.round++;
  r.totalRound++;
  for (const p of r.players) {
    if (p.status === "alive") {
      p.hunger = Math.max(0, p.hunger - 2);
      p.noise = Math.max(0, p.noise - 6);
      if (p.hunger === 0) damage(r, p, 6);
    }
    if (
      p.status === "down" &&
      r.totalRound - (p.downRound ?? r.totalRound) >= 3
    )
      eliminate(r, p);
    p.acted = false;
  }
  r.deadline = now + 90000;
  checkEnd(r);
}
function checkEnd(r: Room) {
  const escaped = r.players.filter((p) => p.status === "escaped");
  const active = r.players.filter(
    (p) => p.status === "alive" || p.status === "down",
  );
  const expired = r.round >= BUDGETS[r.night];
  if (expired && r.night === 3) {
    for (const p of r.players)
      if (p.status === "alive") {
        p.nights = 3;
        award(p, "survive", 500);
      }
  }
  if (escaped.length && (!active.length || expired)) {
    r.phase = "victory";
    r.perfect = escaped.length === r.players.length && r.npcRescued;
    r.reason = r.perfect
      ? "Perfect Victory. Every survivor and Sam made it home."
      : "The rescue vehicle leaves before sunrise. Your signal saved lives.";
    log(r, r.reason);
  } else if (
    !escaped.length &&
    (expired || !r.players.some((p) => p.status === "alive"))
  ) {
    r.phase = "defeat";
    r.reason = expired
      ? "Sunrise arrives before the night’s objectives are complete."
      : "No survivor remains able to help the others.";
    log(r, r.reason);
  }
}
export function tick(r: Room, now: number) {
  if (r.phase !== "playing") return;
  if (now >= r.deadline) {
    const online = r.players.filter(
      (p) => p.status === "alive" && now - p.lastSeen < 45000,
    );
    if (!online.length) {
      r.deadline = now + 90000;
      return;
    }
    if (r.players.some((p) => p.acted)) {
      log(r, "The turn timer expires. Inactive survivors keep watch.");
      resolveRound(r, now);
    } else r.deadline = now + 90000;
  }
}
export function objectives(
  r: Pick<
    Room,
    | "night"
    | "foodFound"
    | "barricade"
    | "clues"
    | "transmitterBuilt"
    | "signal"
    | "players"
  >,
) {
  return r.night === 1
    ? [
        {
          text: "Reach Hoover Hall",
          done: r.players.some((p) => p.visited.includes("hoover")),
        },
        {
          text: `Collect pantry rations (${r.foodFound}/6)`,
          done: r.foodFound >= 6,
        },
        { text: "Barricade Memorial Student Union", done: r.barricade },
      ]
    : r.night === 2
      ? [
          {
            text: "Investigate Julian Science Center",
            done: r.clues.includes("waveform"),
          },
          {
            text: `Research clues (${r.clues.length}/3)`,
            done: r.clues.length === 3,
          },
          { text: "Craft the radio transmitter", done: r.transmitterBuilt },
        ]
      : [
          { text: "Send the signal at East College", done: r.signal },
          {
            text: "Escape through the Nature Park",
            done: r.players.some((p) => p.status === "escaped"),
          },
        ];
}
