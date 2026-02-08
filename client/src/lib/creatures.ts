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
  { id: "skeleton-scout", name: "Skeleton Scout", maxHp: 3, image: "/images/creatures/skeleton-scout.svg", defeatedImage: "/images/creatures/skeleton-scout-defeated.svg" },
  { id: "goblin-raider", name: "Goblin Raider", maxHp: 3, image: "/images/creatures/goblin-raider.svg", defeatedImage: "/images/creatures/goblin-raider-defeated.svg" },
  { id: "cave-troll", name: "Cave Troll", maxHp: 5, image: "/images/creatures/cave-troll.svg", defeatedImage: "/images/creatures/cave-troll-defeated.svg" },
  { id: "basilisk-spawn", name: "Basilisk Spawn", maxHp: 4, image: "/images/creatures/basilisk-spawn.svg", defeatedImage: "/images/creatures/basilisk-spawn-defeated.svg" },
  { id: "shadow-wraith", name: "Shadow Wraith", maxHp: 4, image: "/images/creatures/shadow-wraith.svg", defeatedImage: "/images/creatures/shadow-wraith-defeated.svg" },
  { id: "crypt-ghoul", name: "Crypt Ghoul", maxHp: 4, image: "/images/creatures/crypt-ghoul.svg", defeatedImage: "/images/creatures/crypt-ghoul-defeated.svg" },
  { id: "stone-gargoyle", name: "Stone Gargoyle", maxHp: 5, image: "/images/creatures/stone-gargoyle.svg", defeatedImage: "/images/creatures/stone-gargoyle-defeated.svg" },
  { id: "bone-knight", name: "Bone Knight", maxHp: 5, image: "/images/creatures/bone-knight.svg", defeatedImage: "/images/creatures/bone-knight-defeated.svg" },
  { id: "swamp-hag", name: "Swamp Hag", maxHp: 4, image: "/images/creatures/swamp-hag.svg", defeatedImage: "/images/creatures/swamp-hag-defeated.svg" },
  { id: "infernal-imp", name: "Infernal Imp", maxHp: 3, image: "/images/creatures/infernal-imp.svg", defeatedImage: "/images/creatures/infernal-imp-defeated.svg" },
  { id: "dungeon-minotaur", name: "Dungeon Minotaur", maxHp: 6, image: "/images/creatures/dungeon-minotaur.svg", defeatedImage: "/images/creatures/dungeon-minotaur-defeated.svg" },
  { id: "nightmare-hound", name: "Nightmare Hound", maxHp: 4, image: "/images/creatures/nightmare-hound.svg", defeatedImage: "/images/creatures/nightmare-hound-defeated.svg" },
];

const maxNormalHp = Math.max(...CREATURE_ROSTER.map((creature) => creature.maxHp));

export const BOSS_CREATURE: CreatureTemplate = {
  id: "dragon-warden",
  name: "Dragon Warden",
  maxHp: maxNormalHp * 3,
  image: "/images/creatures/dragon-warden.svg",
  defeatedImage: "/images/creatures/dragon-warden-defeated.svg",
};
