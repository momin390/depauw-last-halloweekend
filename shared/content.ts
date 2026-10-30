export const TITLE = "DEPAUW: THE LAST HALLOWEEKEND";
export const OPENING =
  "Your phone vibrates.\n\nDEPAUW EMERGENCY ALERT:\nCampus lockdown in effect. Avoid East College.\n\nFrom your window, you see a student running across Ubben Quad. Something is following him.\n\nThen the lights go out.\n\nThree nights. One campus. No way out.";
export const CHAPTERS = ["", "The Lockdown", "The Infection", "The Last Bell"];
export const BUDGETS = [0, 40, 40, 36];
export type LocationId =
  | "humbert"
  | "ubben"
  | "hoover"
  | "union"
  | "julian"
  | "library"
  | "east"
  | "lilly"
  | "bowman"
  | "green"
  | "nature";
export type Item =
  | "ration"
  | "wood"
  | "tape"
  | "tray"
  | "straps"
  | "bandages"
  | "antiseptic"
  | "battery"
  | "speaker"
  | "board"
  | "antenna"
  | "planks"
  | "nails"
  | "bat"
  | "shield"
  | "medkit"
  | "decoy"
  | "transmitter";
export const ITEMS: Record<
  Item,
  { name: string; essential?: boolean; description: string }
> = {
  ration: { name: "Food ration", description: "Eat to restore 38 hunger." },
  wood: { name: "Wood", description: "A broken chair leg. Combine with tape." },
  tape: { name: "Tape", description: "Keeps a makeshift bat together." },
  tray: {
    name: "Metal tray",
    description: "A dining tray. Combine with straps.",
  },
  straps: { name: "Straps", description: "Secure a reinforced shield." },
  bandages: {
    name: "Bandages",
    description: "Heal 15 health, or craft first aid.",
  },
  antiseptic: { name: "Antiseptic", description: "Combine with bandages." },
  battery: {
    name: "Battery",
    essential: true,
    description:
      "Powers a transmitter or decoy. A reserve can be recovered at Julian.",
  },
  speaker: {
    name: "Speaker",
    description: "Combine with a battery for a reusable noise decoy.",
  },
  board: {
    name: "Circuit board",
    essential: true,
    description: "Transmitter component. Recoverable at Julian.",
  },
  antenna: {
    name: "Antenna",
    essential: true,
    description: "Transmitter component. Recoverable at the library.",
  },
  planks: {
    name: "Planks",
    essential: true,
    description: "Barricade the Union with nails.",
  },
  nails: {
    name: "Nails",
    essential: true,
    description: "Barricade the Union with planks.",
  },
  bat: {
    name: "Makeshift bat",
    description: "Attack for 28 damage instead of 12.",
  },
  shield: {
    name: "Reinforced shield",
    description: "Passive damage reduction of 4. Defending blocks another 12.",
  },
  medkit: {
    name: "First-aid kit",
    description: "Heal 45 health or revive a co-located teammate to 40 health.",
  },
  decoy: {
    name: "Noise decoy",
    description: "Distract enemies for two rounds. Reusable.",
  },
  transmitter: {
    name: "Radio transmitter",
    essential: true,
    description:
      "Activate at East College after clearing or bypassing the Bellkeeper.",
  },
};
export const RECIPES: Record<
  string,
  { name: string; needs: Partial<Record<Item, number>>; gives?: Item }
> = {
  bat: { name: "Makeshift bat", needs: { wood: 1, tape: 1 }, gives: "bat" },
  shield: {
    name: "Reinforced shield",
    needs: { tray: 1, straps: 1 },
    gives: "shield",
  },
  medkit: {
    name: "First-aid kit",
    needs: { bandages: 1, antiseptic: 1 },
    gives: "medkit",
  },
  decoy: {
    name: "Noise decoy",
    needs: { battery: 1, speaker: 1 },
    gives: "decoy",
  },
  transmitter: {
    name: "Radio transmitter",
    needs: { board: 1, battery: 1, antenna: 1 },
    gives: "transmitter",
  },
  barricade: { name: "Safehouse barricade", needs: { planks: 1, nails: 1 } },
};
export const LOCATIONS: Record<
  LocationId,
  {
    name: string;
    short: string;
    x: number;
    y: number;
    links: LocationId[];
    description: string;
    hint: string;
    risk: string;
    loot: Partial<Record<Item, number>>;
  }
> = {
  humbert: {
    name: "Humbert Hall",
    short: "Humbert",
    x: 78,
    y: 84,
    links: ["ubben", "green"],
    description:
      "Doors stand open along a silent residence hall corridor. A jack-o’-lantern flickers beside the stairwell. Outside, a shoe scrapes the pavement, then stops.",
    hint: "Prepare a bat before heading into the quad.",
    risk: "Sheltered",
    loot: { wood: 8, tape: 8, bandages: 8 },
  },
  ubben: {
    name: "Ubben Quad",
    short: "Ubben Quad",
    x: 74,
    y: 62,
    links: ["humbert", "hoover", "union", "east"],
    description:
      "Costume glitter shines in the wet grass between the residence halls. The student you saw from your window is gone. His phone keeps ringing.",
    hint: "The dining hall lies west. The Union can become a safehouse.",
    risk: "Wanderer territory",
    loot: { battery: 2, straps: 4 },
  },
  hoover: {
    name: "Hoover Hall",
    short: "Hoover",
    x: 51,
    y: 57,
    links: ["ubben", "union", "library", "bowman"],
    description:
      "The dining hall is dark, but the emergency pantry is intact. Six sealed emergency rations sit beneath a handwritten note: TAKE WHAT YOU NEED. LEAVE A LIGHT ON.",
    hint: "Collect six pantry rations together. Picking up dropped rations does not count twice.",
    risk: "Sheltered",
    loot: { ration: 24, tray: 8 },
  },
  union: {
    name: "Memorial Student Union",
    short: "Memorial Union",
    x: 76,
    y: 43,
    links: ["ubben", "hoover", "east"],
    description:
      "The Memorial Union doors tremble in their frames. Inside, overturned tables form the beginnings of a shelter. Someone has left nails and planks beside the entrance.",
    hint: "Craft the barricade here after gathering food.",
    risk: "Safe when barricaded",
    loot: { planks: 2, nails: 2, antiseptic: 8, ration: 16 },
  },
  library: {
    name: "Roy O. West Library",
    short: "Roy O. West",
    x: 37,
    y: 35,
    links: ["hoover", "julian", "east", "lilly"],
    description:
      "Books form narrow islands beneath the library’s dead lights. An archive terminal blinks beside a locked cabinet. Between the shelves, you hear a breath that is not yours.",
    hint: "Two research records and an antenna await. Read Julian’s log to unlock the second record.",
    risk: "Quiet; noise matters",
    loot: { antenna: 1, ration: 8, bandages: 8 },
  },
  julian: {
    name: "Julian Science Center",
    short: "Julian",
    x: 33,
    y: 63,
    links: ["library", "bowman", "lilly"],
    description:
      "Blue emergency lamps wash the science center stairwell. A lab monitor repeats a waveform shaped like a bell. The experiment is still running, though the researchers are gone.",
    hint: "Investigate the lab. Radio spares are stored here.",
    risk: "Runner territory",
    loot: { board: 1, battery: 8, antiseptic: 8 },
  },
  east: {
    name: "East College",
    short: "East College",
    x: 57,
    y: 27,
    links: ["union", "library", "ubben"],
    description:
      "The clock tower rises above the empty lawn. Its hands point to 11:47. Something enormous waits beneath the bell, listening for a sound only it can hear.",
    hint: "Night 3: defeat the Bellkeeper, or distract it and use the service stairs. Signal rescue here.",
    risk: "Bellkeeper on Night 3",
    loot: { speaker: 2, bandages: 4 },
  },
  lilly: {
    name: "Lilly Center",
    short: "Lilly",
    x: 12,
    y: 38,
    links: ["julian", "library", "nature"],
    description:
      "An evacuation route is chalked on the gym floor. Beyond the locked equipment cage, a survivor taps three times against a pipe. Three taps. A pause. Three taps.",
    hint: "Optional: rescue the trapped student from Night 2 onward.",
    risk: "Wanderer territory",
    loot: { straps: 8, medkit: 4, ration: 16 },
  },
  bowman: {
    name: "Bowman Park",
    short: "Bowman Park",
    x: 40,
    y: 83,
    links: ["julian", "hoover", "green"],
    description:
      "Leaves move through Bowman Park without a wind. A string of Halloween lights swings from a branch, illuminating a trail toward the performing arts center.",
    hint: "A quieter route between Julian and the Green Center.",
    risk: "Exposed ground",
    loot: { wood: 8, ration: 8 },
  },
  green: {
    name: "Green Center",
    short: "Green Center",
    x: 57,
    y: 87,
    links: ["humbert", "bowman"],
    description:
      "A rehearsal score is open beneath the stage lights. The final measure is circled: REST. In the wings, an amplifier hisses with the same rhythm as the bell.",
    hint: "Find a speaker to build the Bellkeeper distraction.",
    risk: "Sheltered",
    loot: { speaker: 8, tape: 8, battery: 2 },
  },
  nature: {
    name: "DePauw Nature Park",
    short: "Nature Park",
    x: 9,
    y: 12,
    links: ["lilly"],
    description:
      "West of campus, the trail opens onto the Nature Park. Beyond the trees, a rescue vehicle waits without lights. It will move only after receiving the emergency signal.",
    hint: "Evacuation point. The longer western trail costs 12 stamina.",
    risk: "Remote; extraction after signal",
    loot: { ration: 8, bandages: 8 },
  },
};
export const CLUES = [
  {
    id: "waveform",
    at: "julian",
    title: "The resonance log",
    text: "An experimental acoustic transmitter repeated a low-frequency signal through the campus bell system. The exposure left listeners disoriented, then violently reactive. The source is sound, not a bite.",
  },
  {
    id: "archive",
    at: "library",
    title: "The archived warning",
    text: "An earlier trial was halted after test subjects began following rhythmic sounds. The archive describes a counter-frequency that interrupts the response.",
  },
  {
    id: "protocol",
    at: "library",
    title: "The shutdown protocol",
    text: "The lab waveform unlocks the final record: broadcast the counter-frequency from East College, then transmit the emergency beacon. The maintenance stairs bypass the bell chamber if its guardian is distracted.",
  },
];
export const ORIGINS: Partial<Record<Item, LocationId>> = {
  board: "julian",
  battery: "julian",
  antenna: "library",
  planks: "union",
  nails: "union",
  transmitter: "east",
};
