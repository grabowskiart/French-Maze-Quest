import type { GameState, Position } from "@shared/schema";
import type { ActiveEncounter } from "./creatures";

const LEGACY_SAVE_KEY = "french-maze:save:v1";
const SAVE_KEY_PREFIX = "french-maze:save:v1:";
const PROFILES_KEY = "french-maze:profiles:v1";
const ACTIVE_PROFILE_KEY = "french-maze:activeProfile:v1";
const BESTIARY_SEEN_KEY_PREFIX = "french-maze:bestiarySeen:v1:";
const SAVE_VERSION = 1 as const;

export const BESTIARY_SEEN_EVENT = "french-maze:bestiarySeen:changed";

export const MAX_PROFILES = 6;

export interface ChildProfile {
  id: string;
  name: string;
}

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

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function saveKey(profileId: string): string {
  return `${SAVE_KEY_PREFIX}${profileId}`;
}

function generateProfileId(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function readProfilesRaw(): ChildProfile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is ChildProfile =>
          p && typeof p.id === "string" && typeof p.name === "string",
      )
      .slice(0, MAX_PROFILES);
  } catch {
    return [];
  }
}

function writeProfilesRaw(profiles: ChildProfile[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // ignore
  }
}

function migrateLegacySaveIfNeeded(): void {
  if (!isBrowser()) return;
  const existing = readProfilesRaw();
  if (existing.length > 0) return;
  let legacyRaw: string | null = null;
  try {
    legacyRaw = window.localStorage.getItem(LEGACY_SAVE_KEY);
  } catch {
    legacyRaw = null;
  }
  if (!legacyRaw) return;
  const defaultProfile: ChildProfile = {
    id: generateProfileId(),
    name: "Player 1",
  };
  writeProfilesRaw([defaultProfile]);
  try {
    window.localStorage.setItem(saveKey(defaultProfile.id), legacyRaw);
    window.localStorage.removeItem(LEGACY_SAVE_KEY);
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, defaultProfile.id);
  } catch {
    // ignore
  }
}

export function loadProfiles(): ChildProfile[] {
  if (!isBrowser()) return [];
  migrateLegacySaveIfNeeded();
  return readProfilesRaw();
}

export function getActiveProfileId(): string | null {
  if (!isBrowser()) return null;
  migrateLegacySaveIfNeeded();
  try {
    const id = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!id) return null;
    const profiles = readProfilesRaw();
    return profiles.some((p) => p.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function setActiveProfileId(id: string | null): void {
  if (!isBrowser()) return;
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  } catch {
    // ignore
  }
}

export interface AddProfileResult {
  profile: ChildProfile | null;
  error?: "limit" | "empty" | "duplicate";
}

export function addProfile(name: string): AddProfileResult {
  const trimmed = name.trim();
  if (!trimmed) return { profile: null, error: "empty" };
  const profiles = loadProfiles();
  if (profiles.length >= MAX_PROFILES) {
    return { profile: null, error: "limit" };
  }
  const lower = trimmed.toLocaleLowerCase();
  if (profiles.some((p) => p.name.trim().toLocaleLowerCase() === lower)) {
    return { profile: null, error: "duplicate" };
  }
  const profile: ChildProfile = { id: generateProfileId(), name: trimmed };
  writeProfilesRaw([...profiles, profile]);
  return { profile };
}

export interface RenameProfileResult {
  profile: ChildProfile | null;
  error?: "empty" | "duplicate" | "not_found";
}

export function renameProfile(id: string, name: string): RenameProfileResult {
  const trimmed = name.trim();
  if (!trimmed) return { profile: null, error: "empty" };
  const profiles = loadProfiles();
  const target = profiles.find((p) => p.id === id);
  if (!target) return { profile: null, error: "not_found" };
  const lower = trimmed.toLocaleLowerCase();
  if (
    profiles.some(
      (p) => p.id !== id && p.name.trim().toLocaleLowerCase() === lower,
    )
  ) {
    return { profile: null, error: "duplicate" };
  }
  const updated = profiles.map((p) =>
    p.id === id ? { ...p, name: trimmed } : p,
  );
  writeProfilesRaw(updated);
  return { profile: { ...target, name: trimmed } };
}

export function removeProfile(id: string): void {
  if (!isBrowser()) return;
  const profiles = loadProfiles();
  if (!profiles.some((p) => p.id === id)) return;
  writeProfilesRaw(profiles.filter((p) => p.id !== id));
  try {
    window.localStorage.removeItem(saveKey(id));
  } catch {
    // ignore
  }
  if (getActiveProfileId() === id) {
    setActiveProfileId(null);
  }
}

export function loadSavedRun(profileId: string | null): SavedRun | null {
  if (!isBrowser() || !profileId) return null;
  try {
    const raw = window.localStorage.getItem(saveKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedRun;
    if (!parsed || parsed.version !== SAVE_VERSION) return null;
    if (!parsed.gameState || !parsed.gameState.maze) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistSavedRun(profileId: string | null, run: SavedRun): void {
  if (!isBrowser() || !profileId) return;
  try {
    window.localStorage.setItem(saveKey(profileId), JSON.stringify(run));
  } catch {
    // localStorage may be full or unavailable; fail silently so the game keeps running
  }
}

export function clearSavedRun(profileId: string | null): void {
  if (!isBrowser() || !profileId) return;
  try {
    window.localStorage.removeItem(saveKey(profileId));
  } catch {
    // ignore
  }
}

export function hasSavedRun(profileId: string | null): boolean {
  return loadSavedRun(profileId) !== null;
}

function bestiarySeenKey(profileId: string): string {
  return `${BESTIARY_SEEN_KEY_PREFIX}${profileId}`;
}

export function loadSeenCreatureIds(profileId: string | null): string[] {
  if (!isBrowser() || !profileId) return [];
  try {
    const raw = window.localStorage.getItem(bestiarySeenKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function markCreaturesSeen(
  profileId: string | null,
  ids: readonly string[],
): void {
  if (!isBrowser() || !profileId || ids.length === 0) return;
  try {
    const existing = new Set(loadSeenCreatureIds(profileId));
    let changed = false;
    for (const id of ids) {
      if (!existing.has(id)) {
        existing.add(id);
        changed = true;
      }
    }
    if (!changed) return;
    window.localStorage.setItem(
      bestiarySeenKey(profileId),
      JSON.stringify(Array.from(existing)),
    );
    window.dispatchEvent(
      new CustomEvent(BESTIARY_SEEN_EVENT, { detail: { profileId } }),
    );
  } catch {
    // ignore
  }
}
