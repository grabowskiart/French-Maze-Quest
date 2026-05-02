export interface CreatureTemplate {
  id: string;
  name: string;
  maxHp: number;
  image: string;
  defeatedImage: string;
  taunts: string[];
}

export interface ActiveEncounter extends CreatureTemplate {
  hp: number;
  isBoss: boolean;
  currentTaunt: string;
}

export const CREATURE_ROSTER: CreatureTemplate[] = [
  {
    id: "skeleton-scout",
    name: "Skeleton Scout",
    maxHp: 3,
    image: "/images/creatures/skeleton-scout-alive.png",
    defeatedImage: "/images/creatures/skeleton-scout-defeated.png",
    taunts: [
      "Clack-clack! You can't out-rattle me!",
      "I see you with my empty eye sockets...",
      "My bones are old, but my tricks are new!",
    ],
  },
  {
    id: "goblin-raider",
    name: "Goblin Raider",
    maxHp: 3,
    image: "/images/creatures/goblin-raider-alive.png",
    defeatedImage: "/images/creatures/goblin-raider-defeated.png",
    taunts: [
      "Hand over your snacks, hero!",
      "Heehee, this maze is MINE!",
      "Goblins one, brave kid zero!",
    ],
  },
  {
    id: "cave-troll",
    name: "Cave Troll",
    maxHp: 5,
    image: "/images/creatures/cave-troll-alive.png",
    defeatedImage: "/images/creatures/cave-troll-defeated.png",
    taunts: [
      "Troll smash tiny adventurer!",
      "You smell like lunch...",
      "Big club. Small brain. Bad day for you!",
    ],
  },
  {
    id: "basilisk-spawn",
    name: "Basilisk Spawn",
    maxHp: 4,
    image: "/images/creatures/basilisk-spawn-alive.png",
    defeatedImage: "/images/creatures/basilisk-spawn-defeated.png",
    taunts: [
      "Don't look into my eyes... too late!",
      "Hissss! One peek and you're stone!",
      "Slither, sneak, strike!",
    ],
  },
  {
    id: "shadow-wraith",
    name: "Shadow Wraith",
    maxHp: 4,
    image: "/images/creatures/shadow-wraith-alive.png",
    defeatedImage: "/images/creatures/shadow-wraith-defeated.png",
    taunts: [
      "Boooo! Did I scare you?",
      "I am the chill on the back of your neck...",
      "Shadows never miss, little one.",
    ],
  },
  {
    id: "crypt-ghoul",
    name: "Crypt Ghoul",
    maxHp: 4,
    image: "/images/creatures/crypt-ghoul-alive.png",
    defeatedImage: "/images/creatures/crypt-ghoul-defeated.png",
    taunts: [
      "Fresh visitors! How delightfully crunchy.",
      "You woke me from a lovely nap. Bad idea.",
      "Grrraaah! Stay a while... forever!",
    ],
  },
  {
    id: "stone-gargoyle",
    name: "Stone Gargoyle",
    maxHp: 5,
    image: "/images/creatures/stone-gargoyle-alive.png",
    defeatedImage: "/images/creatures/stone-gargoyle-defeated.png",
    taunts: [
      "I've waited a hundred years for a fight!",
      "Rock solid, baby!",
      "Try to chip me. I dare you.",
    ],
  },
  {
    id: "bone-knight",
    name: "Bone Knight",
    maxHp: 5,
    image: "/images/creatures/bone-knight-alive.png",
    defeatedImage: "/images/creatures/bone-knight-defeated.png",
    taunts: [
      "En garde, little hero!",
      "My armor is bone, my heart is iron!",
      "Honor demands a duel. Draw your wits!",
    ],
  },
  {
    id: "swamp-hag",
    name: "Swamp Hag",
    maxHp: 4,
    image: "/images/creatures/swamp-hag-alive.png",
    defeatedImage: "/images/creatures/swamp-hag-defeated.png",
    taunts: [
      "Cackle cackle! Care for some toad stew?",
      "Got any toes? I'm collecting!",
      "My swamp, my rules, dearie!",
    ],
  },
  {
    id: "infernal-imp",
    name: "Infernal Imp",
    maxHp: 3,
    image: "/images/creatures/infernal-imp-alive.png",
    defeatedImage: "/images/creatures/infernal-imp-defeated.png",
    taunts: [
      "Tee-hee, want to play with fire?",
      "Catch me if you can, slowpoke!",
      "Spicy little me, coming through!",
    ],
  },
  {
    id: "dungeon-minotaur",
    name: "Dungeon Minotaur",
    maxHp: 6,
    image: "/images/creatures/dungeon-minotaur-alive.png",
    defeatedImage: "/images/creatures/dungeon-minotaur-defeated.png",
    taunts: [
      "SNORT! You picked the wrong hallway!",
      "I never lose my way. You did.",
      "Charge first, ask questions never!",
    ],
  },
  {
    id: "nightmare-hound",
    name: "Nightmare Hound",
    maxHp: 4,
    image: "/images/creatures/nightmare-hound-alive.png",
    defeatedImage: "/images/creatures/nightmare-hound-defeated.png",
    taunts: [
      "Grrrr... bad dreams, coming right up!",
      "I bite first and bark later.",
      "Sweet nightmares, little one!",
    ],
  },
  {
    id: "cursed-mimic",
    name: "Cursed Mimic",
    maxHp: 4,
    image: "/images/creatures/cursed-mimic-alive.png",
    defeatedImage: "/images/creatures/cursed-mimic-defeated.png",
    taunts: [
      "Snicker... thought I was a treasure chest, huh?",
      "All this gold? It's mine. Always was.",
      "Open me! I dare you. Hehehe!",
    ],
  },
  {
    id: "spider-brood",
    name: "Spider Brood",
    maxHp: 3,
    image: "/images/creatures/spider-brood-alive.png",
    defeatedImage: "/images/creatures/spider-brood-defeated.png",
    taunts: [
      "Skitter skitter! So many little legs!",
      "Welcome to the web, friend.",
      "We are many. You are one. Math is fun.",
    ],
  },
  {
    id: "lich-apprentice",
    name: "Lich Apprentice",
    maxHp: 5,
    image: "/images/creatures/lich-apprentice-alive.png",
    defeatedImage: "/images/creatures/lich-apprentice-defeated.png",
    taunts: [
      "Watch closely. I just learned this spell!",
      "Abra-ka-doom-bra!",
      "My master would be SO proud of this.",
    ],
  },
  {
    id: "mossy-slime",
    name: "Mossy Slime",
    maxHp: 3,
    image: "/images/creatures/mossy-slime-alive.png",
    defeatedImage: "/images/creatures/mossy-slime-defeated.png",
    taunts: [
      "Glub glub... squish squish...",
      "I'm gooey AND grumpy. Watch out!",
      "Step closer. I want a hug. A sticky hug.",
    ],
  },
  {
    id: "rune-golem",
    name: "Rune Golem",
    maxHp: 6,
    image: "/images/creatures/rune-golem-alive.png",
    defeatedImage: "/images/creatures/rune-golem-defeated.png",
    taunts: [
      "INTRUDER. ANSWER. OR. CRUMBLE.",
      "My runes glow when I am cross.",
      "Built by wizards. Powered by puzzles.",
    ],
  },
];

const maxNormalHp = Math.max(...CREATURE_ROSTER.map((creature) => creature.maxHp));

export const BOSS_CREATURE: CreatureTemplate = {
  id: "dragon-warden",
  name: "Dragon Warden",
  maxHp: maxNormalHp * 3,
  image: "/images/creatures/dragon-warden-alive.png",
  defeatedImage: "/images/creatures/dragon-warden-defeated.png",
  taunts: [
    "ROAR! None shall pass the Dragon Warden!",
    "My treasure. My maze. My RULES.",
    "Brave little hero... prepare to be toasted!",
  ],
};

export function pickRandomTaunt(template: CreatureTemplate): string {
  if (!template.taunts || template.taunts.length === 0) return "";
  return template.taunts[Math.floor(Math.random() * template.taunts.length)];
}

type Pos = { x: number; y: number };

export function scaleCreatureMaxHp(
  template: CreatureTemplate,
  playerPos: Pos,
  entrance: Pos,
  exit: Pos,
): number {
  const totalDistance = Math.abs(entrance.x - exit.x) + Math.abs(entrance.y - exit.y);
  if (totalDistance <= 0) return template.maxHp;
  const remaining = Math.abs(playerPos.x - exit.x) + Math.abs(playerPos.y - exit.y);
  const progress = Math.max(0, Math.min(1, 1 - remaining / totalDistance));
  const multiplier = 1 + progress;
  return Math.max(template.maxHp, Math.ceil(template.maxHp * multiplier));
}

export type DifficultyTier = "tough" | "elite" | "champion";

export interface DifficultyBadge {
  tier: DifficultyTier;
  label: string;
  stars: number;
}

export function getCreatureDifficultyBadge(encounter: ActiveEncounter): DifficultyBadge | null {
  if (encounter.isBoss) return null;
  const base = CREATURE_ROSTER.find((c) => c.id === encounter.id);
  if (!base || base.maxHp <= 0) return null;
  const ratio = encounter.maxHp / base.maxHp;
  if (ratio >= 1.9) return { tier: "champion", label: "Champion!", stars: 3 };
  if (ratio >= 1.6) return { tier: "elite", label: "Elite!", stars: 2 };
  if (ratio >= 1.3) return { tier: "tough", label: "Tough!", stars: 1 };
  return null;
}
