export interface CreatureTemplate {
  id: string;
  name: string;
  maxHp: number;
  image: string;
  defeatedImage: string;
}

export interface ActiveEncounter extends CreatureTemplate {
  hp: number;
  isBoss: boolean;
}

export const CREATURE_ROSTER: CreatureTemplate[] = [
  { id: "skeleton-scout", name: "Skeleton Scout", maxHp: 3, image: "/images/creatures/skeleton-scout-alive.png", defeatedImage: "/images/creatures/skeleton-scout-defeated.png" },
  { id: "goblin-raider", name: "Goblin Raider", maxHp: 3, image: "/images/creatures/goblin-raider-alive.png", defeatedImage: "/images/creatures/goblin-raider-defeated.png" },
  { id: "cave-troll", name: "Cave Troll", maxHp: 5, image: "/images/creatures/cave-troll-alive.png", defeatedImage: "/images/creatures/cave-troll-defeated.png" },
  { id: "basilisk-spawn", name: "Basilisk Spawn", maxHp: 4, image: "/images/creatures/basilisk-spawn-alive.png", defeatedImage: "/images/creatures/basilisk-spawn-defeated.png" },
  { id: "shadow-wraith", name: "Shadow Wraith", maxHp: 4, image: "/images/creatures/shadow-wraith-alive.png", defeatedImage: "/images/creatures/shadow-wraith-defeated.png" },
  { id: "crypt-ghoul", name: "Crypt Ghoul", maxHp: 4, image: "/images/creatures/crypt-ghoul-alive.png", defeatedImage: "/images/creatures/crypt-ghoul-defeated.png" },
  { id: "stone-gargoyle", name: "Stone Gargoyle", maxHp: 5, image: "/images/creatures/stone-gargoyle-alive.png", defeatedImage: "/images/creatures/stone-gargoyle-defeated.png" },
  { id: "bone-knight", name: "Bone Knight", maxHp: 5, image: "/images/creatures/bone-knight-alive.png", defeatedImage: "/images/creatures/bone-knight-defeated.png" },
  { id: "swamp-hag", name: "Swamp Hag", maxHp: 4, image: "/images/creatures/swamp-hag-alive.png", defeatedImage: "/images/creatures/swamp-hag-defeated.png" },
  { id: "infernal-imp", name: "Infernal Imp", maxHp: 3, image: "/images/creatures/infernal-imp-alive.png", defeatedImage: "/images/creatures/infernal-imp-defeated.png" },
  { id: "dungeon-minotaur", name: "Dungeon Minotaur", maxHp: 6, image: "/images/creatures/dungeon-minotaur-alive.png", defeatedImage: "/images/creatures/dungeon-minotaur-defeated.png" },
  { id: "nightmare-hound", name: "Nightmare Hound", maxHp: 4, image: "/images/creatures/nightmare-hound-alive.png", defeatedImage: "/images/creatures/nightmare-hound-defeated.png" },
];

const maxNormalHp = Math.max(...CREATURE_ROSTER.map((creature) => creature.maxHp));

export const BOSS_CREATURE: CreatureTemplate = {
  id: "dragon-warden",
  name: "Dragon Warden",
  maxHp: maxNormalHp * 3,
  image: "/images/creatures/dragon-warden-alive.png",
  defeatedImage: "/images/creatures/dragon-warden-defeated.png",
};

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
