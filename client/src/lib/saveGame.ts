import type { GameState, Position } from "@shared/schema";
import type { ActiveEncounter } from "./creatures";

const SAVE_KEY = "french-maze:save:v1";
const SAVE_VERSION = 1 as const;

export type SavedWeapon = { name: string; damage: number; description: string };
export type SavedPickup =
  | { kind: "heart" }
  | { kind: "potion" }
  | { kind: "weapon"; weapon: SavedWeapon };

export interface SavedRun {
  version: typeof SAVE_VERSION;
  savedAt: number;
  elapsedMs: number;
  gameState: GameState;
  hearts: number;
  pathHistory: Position[];
  stepsSinceEncounter: number;
  nextEncounterAt: number;
  encounter: ActiveEncounter | null;
  pickups: Record<string, SavedPickup>;
  potions: number;
  weaponInventory: SavedWeapon[];
  equippedWeapon: SavedWeapon;
  weaponChoice: { key: string; weapon: SavedWeapon } | null;
  bossDefeated: boolean;
  maxStreak: number;
  combatMessage: string;
  isRevealQuestionMode: boolean;
}

export function loadSavedRun(): SavedRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedRun;
    if (!parsed || parsed.version !== SAVE_VERSION) return null;
    if (!parsed.gameState || !parsed.gameState.maze) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistSavedRun(run: SavedRun): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(run));
  } catch {
    // localStorage may be full or unavailable; fail silently so the game keeps running
  }
}

export function clearSavedRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function hasSavedRun(): boolean {
  return loadSavedRun() !== null;
}
