import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GameHeader } from "@/components/game/GameHeader";
import { MazeGrid } from "@/components/game/MazeGrid";
import { QuestionPanel } from "@/components/game/QuestionPanel";
import { FeedbackModal } from "@/components/game/FeedbackModal";
import { WinScreen } from "@/components/game/WinScreen";
import { StartScreen } from "@/components/game/StartScreen";
import { generateMaze, updateVisibility } from "@/lib/mazeGenerator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { GameState, PublicQuestion, AnswerResult, Position, GameSettings, Maze } from "@shared/schema";
import { BOSS_CREATURE, CREATURE_ROSTER, scaleCreatureMaxHp, getCreatureDifficultyBadge, type ActiveEncounter, type DifficultyBadge } from "@/lib/creatures";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { playMoveSound, playEncounterSound, playPickupSound, playHitSound, playLoseLifeSound } from "@/lib/sounds";
import { PickupIcon } from "@/components/game/PickupIcon";
import { clearSavedRun, loadSavedRun, persistSavedRun, type SavedRun } from "@/lib/saveGame";

const DEFAULT_MAZE_SIZE = 30;
const DEFAULT_VISIBILITY_RADIUS = 1;

const WEAPON_POOL = [
  { name: "Rusty Sword", damage: 1, description: "An old blade that still bites." },
  { name: "Knight's Blade", damage: 2, description: "Balanced steel forged for true heroes." },
  { name: "War Axe", damage: 2, description: "Heavy chops that crack through armor." },
  { name: "Spiked Mace", damage: 2, description: "Brutal spikes leave a nasty bruise." },
  { name: "Moon Lance", damage: 3, description: "A glowing spear blessed by moonlight." },
  { name: "Flame Saber", damage: 3, description: "A fiery curve that scorches enemies." },
  { name: "Dragonfang Spear", damage: 3, description: "Forged from a true dragon's tooth." },
] as const;

type Weapon = { name: string; damage: number; description: string };

type Pickup =
  | { kind: "heart" }
  | { kind: "potion" }
  | { kind: "weapon"; weapon: Weapon };

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function posKey(pos: Position) {
  return `${pos.x},${pos.y}`;
}

function pickPathPositions(maze: Maze, count: number, excluded: Set<string>) {
  const paths: Position[] = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const tile = maze.tiles[y][x];
      if (tile.type === "path" && !excluded.has(`${x},${y}`)) {
        paths.push({ x, y });
      }
    }
  }
  for (let i = paths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [paths[i], paths[j]] = [paths[j], paths[i]];
  }
  return paths.slice(0, count);
}

function buildPickups(maze: Maze): Record<string, Pickup> {
  const pickups: Record<string, Pickup> = {};
  const excluded = new Set<string>([posKey(maze.entrance), posKey(maze.exit)]);

  const heartTiles = pickPathPositions(maze, 5, excluded);
  for (const pos of heartTiles) {
    pickups[posKey(pos)] = { kind: "heart" };
    excluded.add(posKey(pos));
  }

  const potionTiles = pickPathPositions(maze, 5, excluded);
  for (const pos of potionTiles) {
    pickups[posKey(pos)] = { kind: "potion" };
    excluded.add(posKey(pos));
  }

  const weaponTiles = pickPathPositions(maze, 7, excluded);
  for (let i = 0; i < weaponTiles.length; i++) {
    const pos = weaponTiles[i];
    pickups[posKey(pos)] = { kind: "weapon", weapon: WEAPON_POOL[i % WEAPON_POOL.length] };
    excluded.add(posKey(pos));
  }

  return pickups;
}


function revealArea(maze: Maze, center: Position, radius: number): Maze {
  const newTiles = maze.tiles.map((row) => row.map((tile) => ({ ...tile })));

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;

      if (x >= 0 && x < maze.width && y >= 0 && y < maze.height) {
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= radius && newTiles[y][x].fog === "hidden") {
          newTiles[y][x].fog = "seen";
        }
      }
    }
  }

  return {
    ...maze,
    tiles: newTiles,
  };
}

const DEFAULT_WEAPON: Weapon = { name: "Bare Hands", damage: 1, description: "Just your fists. Better than nothing." };

function DifficultyBadgeView({ badge, testId }: { badge: DifficultyBadge; testId: string }) {
  const palette: Record<DifficultyBadge["tier"], string> = {
    tough: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700",
    elite: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-700",
    champion: "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/40 dark:text-red-100 dark:border-red-700",
  };
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${palette[badge.tier]}`}
      data-testid={testId}
      title={`This creature has been scaled to roughly ${badge.stars === 1 ? "1.3×" : badge.stars === 2 ? "1.6×" : "1.9×"} its base toughness`}
    >
      {Array.from({ length: badge.stars }).map((_, i) => (
        <Star key={i} className="h-3 w-3 fill-current" aria-hidden="true" />
      ))}
      <span>{badge.label}</span>
    </Badge>
  );
}

export default function Game() {
  const [savedRun, setSavedRun] = useState<SavedRun | null>(() => loadSavedRun());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [feedbackResult, setFeedbackResult] = useState<AnswerResult | null>(null);
  const [maxStreak, setMaxStreak] = useState(0);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [pickupModal, setPickupModal] = useState<{ title: string; description: string } | null>(null);
  const [defeatedCreatureModal, setDefeatedCreatureModal] = useState<{ name: string; image: string; isBoss: boolean } | null>(null);
  const [bossDefeated, setBossDefeated] = useState(false);

  const [hearts, setHearts] = useState(3);
  const [pathHistory, setPathHistory] = useState<Position[]>([]);
  const [stepsSinceEncounter, setStepsSinceEncounter] = useState(0);
  const [nextEncounterAt, setNextEncounterAt] = useState(randomInt(3, 5));
  const [encounter, setEncounter] = useState<ActiveEncounter | null>(null);
  const [combatMessage, setCombatMessage] = useState<string>("Move through the maze to find your first enemy.");

  const [pickups, setPickups] = useState<Record<string, Pickup>>({});
  const [potions, setPotions] = useState(0);
  const [weaponInventory, setWeaponInventory] = useState<Array<Weapon>>([]);
  const [equippedWeapon, setEquippedWeapon] = useState<Weapon>(DEFAULT_WEAPON);
  const [weaponChoice, setWeaponChoice] = useState<{ key: string; weapon: Weapon } | null>(null);
  const [isRevealQuestionMode, setIsRevealQuestionMode] = useState(false);

  const heartsRef = useRef(hearts);
  heartsRef.current = hearts;
  const pathHistoryRef = useRef(pathHistory);
  pathHistoryRef.current = pathHistory;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const encounterRef = useRef(encounter);
  encounterRef.current = encounter;
  const weaponRef = useRef(equippedWeapon);
  weaponRef.current = equippedWeapon;
  const revealQuestionModeRef = useRef(isRevealQuestionMode);
  revealQuestionModeRef.current = isRevealQuestionMode;

  const { data: settings } = useQuery<GameSettings>({
    queryKey: ["/api/settings"],
    staleTime: 60000,
  });

  const mazeWidth = settings?.mazeWidth ?? DEFAULT_MAZE_SIZE;
  const mazeHeight = settings?.mazeHeight ?? DEFAULT_MAZE_SIZE;
  const visibilityRadius = settings?.visibilityRadius ?? DEFAULT_VISIBILITY_RADIUS;

  const settingsRef = useRef({ visibilityRadius });
  settingsRef.current = { visibilityRadius };

  const { data: currentQuestion, refetch: refetchQuestion, isFetching: isLoadingQuestion } = useQuery<PublicQuestion>({
    queryKey: ["/api/questions/next"],
    enabled: gameState?.gamePhase === "combat" || isRevealQuestionMode,
    staleTime: 0,
    gcTime: 0,
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      const res = await apiRequest("POST", "/api/questions/answer", { questionId, answer });
      return res.json() as Promise<AnswerResult>;
    },
    onSuccess: (result) => {
      const activeState = gameStateRef.current;
      if (!activeState) return;

      if (revealQuestionModeRef.current) {
        setFeedbackResult(result);
        if (result.correct) {
          const updatedMaze = revealArea(activeState.maze, activeState.playerPosition, 5);
          setGameState((prev) => prev ? { ...prev, maze: updatedMaze } : prev);
          setCombatMessage("Great! You revealed a 5-tile radius around your position.");
        } else {
          setCombatMessage("Reveal question was incorrect. No tiles were revealed.");
        }
        setIsRevealQuestionMode(false);
        return;
      }

      if (activeState.gamePhase !== "combat" || !encounterRef.current) return;

      setFeedbackResult(result);

      const newStreak = result.correct ? activeState.streak + 1 : 0;
      setMaxStreak((prev) => Math.max(prev, newStreak));

      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          streak: newStreak,
          questionsAnswered: prev.questionsAnswered + 1,
          correctAnswers: result.correct ? prev.correctAnswers + 1 : prev.correctAnswers,
          lastAnswerCorrect: result.correct,
        };
      });

      if (result.correct) {
        playHitSound();
        const dmg = Math.max(1, weaponRef.current.damage);
        const nextHp = encounterRef.current.hp - dmg;
        setCombatMessage(`Direct hit with ${weaponRef.current.name}! ${encounterRef.current.name} has ${Math.max(nextHp, 0)} HP left.`);
        if (nextHp <= 0) {
          const defeated = encounterRef.current;
          setEncounter(null);
          setDefeatedCreatureModal({ name: defeated.name, image: defeated.defeatedImage, isBoss: defeated.isBoss });
          if (defeated.isBoss) {
            setBossDefeated(true);
            setGameState((prev) => prev ? { ...prev, gamePhase: "won" } : prev);
            setCombatMessage("The Dragon Warden is defeated! You claim the chest of gold.");
          } else {
            setGameState((prev) => prev ? { ...prev, gamePhase: "exploring" } : prev);
            setNextEncounterAt(randomInt(3, 5));
            setStepsSinceEncounter(0);
            queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
          }
        } else {
          setEncounter({ ...encounterRef.current, hp: nextHp });
          refetchQuestion();
        }
      } else {
        playLoseLifeSound();
        const nextHearts = heartsRef.current - 1;
        setHearts(nextHearts);

        if (nextHearts <= 0) {
          const history = pathHistoryRef.current;
          const stepsBackIndex = Math.max(0, history.length - 1 - 10);
          const respawnPosition = history[stepsBackIndex] ?? activeState.maze.entrance;
          const respawnHistory = history.slice(0, stepsBackIndex + 1);
          const respawnMaze = updateVisibility(activeState.maze, respawnPosition, settingsRef.current.visibilityRadius);

          setPathHistory(respawnHistory.length ? respawnHistory : [respawnPosition]);
          setHearts(3);
          setEncounter(null);
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              maze: respawnMaze,
              playerPosition: respawnPosition,
              gamePhase: "exploring",
              remainingSteps: 1,
            };
          });
          setStepsSinceEncounter(0);
          setNextEncounterAt(randomInt(3, 5));
          setCombatMessage("You were defeated! You respawned 10 steps back with 3 hearts.");
          setShowDeathModal(true);
        } else {
          setCombatMessage(`${encounterRef.current.name} hit you! Hearts left: ${nextHearts}.`);
          refetchQuestion();
        }
      }
    },
  });

  useEffect(() => {
    if (gameState && gameState.gamePhase !== "start" && gameState.gamePhase !== "won") {
      const interval = setInterval(() => {
        setSessionTime(Date.now() - gameState.sessionStartTime);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.sessionStartTime, gameState?.gamePhase]);

  const startGame = useCallback(() => {
    let maze = generateMaze(mazeWidth, mazeHeight);
    maze = updateVisibility(maze, maze.entrance, settingsRef.current.visibilityRadius);

    setGameState({
      maze,
      playerPosition: maze.entrance,
      currentQuestion: null,
      streak: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      sessionStartTime: Date.now(),
      gamePhase: "exploring",
      remainingSteps: 1,
      lastAnswerCorrect: null,
    });
    setPathHistory([maze.entrance]);
    setHearts(3);
    setEncounter(null);
    setStepsSinceEncounter(0);
    setNextEncounterAt(randomInt(3, 5));
    setCombatMessage("Move through the maze. Creatures are lurking nearby.");
    setSessionTime(0);
    setMaxStreak(0);
    setFeedbackResult(null);
    setShowDeathModal(false);
    setPickupModal(null);
    setDefeatedCreatureModal(null);
    setBossDefeated(false);

    setPickups(buildPickups(maze));
    setPotions(0);
    setWeaponInventory([]);
    setEquippedWeapon(DEFAULT_WEAPON);
    setWeaponChoice(null);
    setIsRevealQuestionMode(false);

    clearSavedRun();
    setSavedRun(null);

    queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
  }, [mazeWidth, mazeHeight]);

  const continueGame = useCallback(() => {
    const saved = loadSavedRun();
    if (!saved) return;

    const restoredSessionStart = Date.now() - Math.max(0, saved.elapsedMs);
    const restoredGameState: GameState = {
      ...saved.gameState,
      sessionStartTime: restoredSessionStart,
    };

    setGameState(restoredGameState);
    setHearts(saved.hearts);
    setPathHistory(saved.pathHistory.length ? saved.pathHistory : [restoredGameState.playerPosition]);
    setStepsSinceEncounter(saved.stepsSinceEncounter);
    setNextEncounterAt(saved.nextEncounterAt);
    setEncounter(saved.encounter);
    setPickups(saved.pickups as Record<string, Pickup>);
    setPotions(saved.potions);
    setWeaponInventory(saved.weaponInventory);
    setEquippedWeapon(saved.equippedWeapon);
    setWeaponChoice(saved.weaponChoice);
    setBossDefeated(saved.bossDefeated);
    setMaxStreak(saved.maxStreak);
    setCombatMessage(saved.combatMessage);
    setIsRevealQuestionMode(saved.isRevealQuestionMode);
    setSessionTime(Math.max(0, saved.elapsedMs));
    setFeedbackResult(null);
    setShowDeathModal(false);
    setPickupModal(null);
    setDefeatedCreatureModal(null);

    queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
  }, []);

  const buildSnapshotRef = useRef<(() => SavedRun | null) | null>(null);
  buildSnapshotRef.current = () => {
    if (!gameState) return null;
    if (gameState.gamePhase === "start" || gameState.gamePhase === "won") return null;
    const elapsedMs = Date.now() - gameState.sessionStartTime;
    return {
      version: 1,
      savedAt: Date.now(),
      elapsedMs,
      gameState,
      hearts,
      pathHistory,
      stepsSinceEncounter,
      nextEncounterAt,
      encounter,
      pickups,
      potions,
      weaponInventory,
      equippedWeapon,
      weaponChoice,
      bossDefeated,
      maxStreak,
      combatMessage,
      isRevealQuestionMode,
    };
  };

  useEffect(() => {
    const snapshot = buildSnapshotRef.current?.();
    if (snapshot) persistSavedRun(snapshot);
  }, [
    gameState,
    sessionTime,
    hearts,
    pathHistory,
    stepsSinceEncounter,
    nextEncounterAt,
    encounter,
    pickups,
    potions,
    weaponInventory,
    equippedWeapon,
    weaponChoice,
    bossDefeated,
    maxStreak,
    combatMessage,
    isRevealQuestionMode,
  ]);

  useEffect(() => {
    const flush = () => {
      const snapshot = buildSnapshotRef.current?.();
      if (snapshot) persistSavedRun(snapshot);
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  useEffect(() => {
    if (gameState?.gamePhase === "won") {
      clearSavedRun();
      setSavedRun(null);
    }
  }, [gameState?.gamePhase]);

  const handleAnswerSubmit = (answer: string) => {
    if (currentQuestion && (gameState?.gamePhase === "combat" || isRevealQuestionMode)) {
      submitAnswerMutation.mutate({
        questionId: currentQuestion.id,
        answer,
      });
    }
  };

  const handleFeedbackContinue = () => {
    setFeedbackResult(null);
  };

  const isFeedbackModalOpen = Boolean(feedbackResult);
  const isRevealQuestionActive = Boolean(weaponChoice);
  const isDeathModalOpen = showDeathModal;
  const isPickupModalOpen = Boolean(pickupModal);
  const isDefeatedCreatureModalOpen = Boolean(defeatedCreatureModal);

  const pickupMarkers = Object.fromEntries(
    Object.entries(pickups).map(([key, value]) => [key, value.kind])
  ) as Record<string, "heart" | "potion" | "weapon">;

  const handleStartRevealQuestion = () => {
    if (!gameState || gameState.gamePhase !== "exploring" || isFeedbackModalOpen || isRevealQuestionActive || isRevealQuestionMode || isDeathModalOpen || isPickupModalOpen || isDefeatedCreatureModalOpen) return;
    setIsRevealQuestionMode(true);
    setCombatMessage("Answer a French question correctly to reveal a 5-tile radius.");
    queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
  };
  const handleUsePotion = () => {
    if (!encounter || potions <= 0 || !gameState || gameState.gamePhase !== "combat") return;
    setPotions((prev) => prev - 1);

    if (encounter.isBoss) {
      const potionDamage = Math.max(1, Math.ceil(encounter.maxHp * 0.2));
      const nextHp = Math.max(0, encounter.hp - potionDamage);
      if (nextHp <= 0) {
        setEncounter(null);
        setBossDefeated(true);
        setDefeatedCreatureModal({ name: encounter.name, image: encounter.defeatedImage, isBoss: true });
        setGameState({ ...gameState, gamePhase: "won" });
        setCombatMessage("The dragon collapses! The treasure is yours.");
      } else {
        setEncounter({ ...encounter, hp: nextHp });
        setCombatMessage(`Potion burns the dragon for ${potionDamage} damage. ${nextHp} HP remains.`);
        refetchQuestion();
      }
      return;
    }

    setEncounter(null);
    setDefeatedCreatureModal({ name: encounter.name, image: encounter.defeatedImage, isBoss: false });
    setGameState({ ...gameState, gamePhase: "exploring" });
    setStepsSinceEncounter(0);
    setNextEncounterAt(randomInt(3, 5));
    setCombatMessage(`You used a potion and instantly defeated ${encounter.name}!`);
  };

  const handleTileClick = (x: number, y: number) => {
    if (!gameState || gameState.gamePhase !== "exploring" || isRevealQuestionActive || isFeedbackModalOpen || isRevealQuestionMode || isDeathModalOpen || isPickupModalOpen || isDefeatedCreatureModalOpen) return;

    const dx = Math.abs(x - gameState.playerPosition.x);
    const dy = Math.abs(y - gameState.playerPosition.y);
    if (!((dx === 1 && dy === 0) || (dx === 0 && dy === 1))) return;

    const tile = gameState.maze.tiles[y][x];
    if (tile.type === "wall" || tile.fog === "hidden") return;

    const newPosition: Position = { x, y };
    const updatedMaze = updateVisibility(gameState.maze, newPosition, settingsRef.current.visibilityRadius);

    if (tile.type === "exit") {
      if (bossDefeated) {
        setGameState({
          ...gameState,
          maze: updatedMaze,
          playerPosition: newPosition,
          gamePhase: "won",
          remainingSteps: 0,
        });
      } else {
        setEncounter({ ...BOSS_CREATURE, hp: BOSS_CREATURE.maxHp, isBoss: true });
        setCombatMessage("The Dragon Warden blocks the treasure! Defeat it to claim the chest of gold.");
        setGameState({
          ...gameState,
          maze: updatedMaze,
          playerPosition: newPosition,
          gamePhase: "combat",
          remainingSteps: 0,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
        playEncounterSound();
      }
      return;
    }

    const movedSteps = stepsSinceEncounter + 1;
    const newHistory = [...pathHistory, newPosition];
    setPathHistory(newHistory);

    const pickupKey = posKey(newPosition);
    const pickup = pickups[pickupKey];
    if (pickup?.kind === "heart") {
      setHearts((prev) => prev + 1);
      setCombatMessage("You found a heart! +1 life.");
      setPickupModal({
        title: "Extra Life Collected",
        description: "You picked up a heart and gained +1 life.",
      });
      setPickups((prev) => {
        const next = { ...prev };
        delete next[pickupKey];
        return next;
      });
      playPickupSound();
    } else if (pickup?.kind === "potion") {
      setPotions((prev) => prev + 1);
      setCombatMessage("You found a magic potion! It can instantly defeat one creature.");
      setPickupModal({
        title: "Potion Collected",
        description: "You picked up a potion. Use it in combat for an instant creature defeat.",
      });
      setPickups((prev) => {
        const next = { ...prev };
        delete next[pickupKey];
        return next;
      });
      playPickupSound();
    } else if (pickup?.kind === "weapon") {
      setWeaponChoice({ key: pickupKey, weapon: pickup.weapon });
      setCombatMessage(`You found ${pickup.weapon.name}. Choose to pick it up or leave it.`);
      playPickupSound();
    }

    if (movedSteps >= nextEncounterAt) {
      const next = CREATURE_ROSTER[Math.floor(Math.random() * CREATURE_ROSTER.length)];
      const scaledMaxHp = scaleCreatureMaxHp(next, newPosition, gameState.maze.entrance, gameState.maze.exit);
      setEncounter({ ...next, maxHp: scaledMaxHp, hp: scaledMaxHp, isBoss: false });
      setCombatMessage(`A ${next.name} appears! Answer French questions to defeat it.`);
      setGameState({
        ...gameState,
        maze: updatedMaze,
        playerPosition: newPosition,
        gamePhase: "combat",
        remainingSteps: 0,
      });
      setStepsSinceEncounter(0);
      queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
      playEncounterSound();
    } else {
      setStepsSinceEncounter(movedSteps);
      setGameState({
        ...gameState,
        maze: updatedMaze,
        playerPosition: newPosition,
        remainingSteps: 1,
      });
      playMoveSound();
    }
  };

  const handleMove = (direction: "up" | "down" | "left" | "right") => {
    if (!gameState || isFeedbackModalOpen || isRevealQuestionActive || isRevealQuestionMode || isDeathModalOpen || isPickupModalOpen || isDefeatedCreatureModalOpen) return;
    const { x, y } = gameState.playerPosition;
    let newX = x;
    let newY = y;

    switch (direction) {
      case "up": newY = y - 1; break;
      case "down": newY = y + 1; break;
      case "left": newX = x - 1; break;
      case "right": newX = x + 1; break;
    }

    if (newX >= 0 && newX < gameState.maze.width && newY >= 0 && newY < gameState.maze.height) {
      handleTileClick(newX, newY);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState || gameState.gamePhase !== "exploring" || isRevealQuestionActive || isFeedbackModalOpen || isRevealQuestionMode || isDeathModalOpen || isPickupModalOpen || isDefeatedCreatureModalOpen) return;

      const { x, y } = gameState.playerPosition;
      let newX = x;
      let newY = y;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          newY = y - 1;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          newY = y + 1;
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          newX = x - 1;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          newX = x + 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      if (newX >= 0 && newX < gameState.maze.width && newY >= 0 && newY < gameState.maze.height) {
        handleTileClick(newX, newY);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, isRevealQuestionActive, isFeedbackModalOpen, isRevealQuestionMode, isDeathModalOpen, isPickupModalOpen, isDefeatedCreatureModalOpen, stepsSinceEncounter, nextEncounterAt, pathHistory, pickups]);

  if (!gameState || gameState.gamePhase === "start") {
    return (
      <StartScreen
        onStart={startGame}
        hasSave={Boolean(savedRun)}
        onContinue={savedRun ? continueGame : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GameHeader
        streak={gameState.streak}
        questionsAnswered={gameState.questionsAnswered}
        sessionTime={sessionTime}
      />

      <main className="max-w-6xl mx-auto px-3 py-4 sm:px-4 sm:py-8">
        <div className="mb-4 rounded-lg border bg-card p-3 sm:p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold" data-testid="status-hearts">
            <PickupIcon kind="heart" size="md" />
            <span>Hearts: {"❤️".repeat(hearts)} ({hearts})</span>
          </div>
          <div className="flex items-center gap-2 font-semibold" data-testid="status-potions">
            <PickupIcon kind="potion" size="md" />
            <span>Potions: {potions}</span>
          </div>
          <div className="flex items-start gap-2 font-semibold" data-testid="status-weapon">
            <PickupIcon kind="weapon" size="md" className="mt-0.5" />
            <div className="flex-1">
              <div>
                <span data-testid="text-weapon-name">{equippedWeapon.name}</span>
                <span className="ml-2 text-muted-foreground font-normal" data-testid="text-weapon-damage">Damage {equippedWeapon.damage}</span>
              </div>
              <p className="text-xs text-muted-foreground font-normal" data-testid="text-weapon-description">{equippedWeapon.description}</p>
            </div>
          </div>
          <p className="text-muted-foreground">{combatMessage}</p>
          {gameState.gamePhase === "exploring" && (
            <p className="text-muted-foreground">Next encounter in {Math.max(0, nextEncounterAt - stepsSinceEncounter)} step(s).</p>
          )}
          {encounter && (() => {
            const statusBadge = getCreatureDifficultyBadge(encounter);
            return (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{encounter.name}</p>
                  {statusBadge && (
                    <DifficultyBadgeView badge={statusBadge} testId={`badge-difficulty-status-${statusBadge.tier}`} />
                  )}
                </div>
                <Progress value={(encounter.hp / encounter.maxHp) * 100} className="h-3" />
                <p className="text-xs text-muted-foreground">{encounter.hp}/{encounter.maxHp} HP</p>
              </div>
            );
          })()}
          {weaponInventory.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>Inventory:</span>
              {weaponInventory.map((w, idx) => (
                <span key={`${w.name}-${idx}`} className="inline-flex items-center gap-1" data-testid={`inventory-weapon-${idx}`}>
                  <PickupIcon kind="weapon" size="sm" />
                  <span>{w.name}({w.damage})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {weaponChoice && (
          <div className="mb-4 rounded-lg border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <PickupIcon kind="weapon" size="lg" />
            <div className="flex-1">
              <p>Found <strong>{weaponChoice.weapon.name}</strong> (Damage {weaponChoice.weapon.damage}). Pick it up?</p>
              <p className="text-xs text-muted-foreground" data-testid="text-weapon-choice-description">{weaponChoice.weapon.description}</p>
            </div>
            <Button
              onClick={() => {
                setWeaponInventory((prev) => [...prev, weaponChoice.weapon]);
                setEquippedWeapon((prev) => prev.damage >= weaponChoice.weapon.damage ? prev : weaponChoice.weapon);
                setPickups((prev) => {
                  const next = { ...prev };
                  delete next[weaponChoice.key];
                  return next;
                });
                setCombatMessage(`Picked up ${weaponChoice.weapon.name}.`);
                setPickupModal({
                  title: "Weapon Collected",
                  description: `You picked up ${weaponChoice.weapon.name} (Damage ${weaponChoice.weapon.damage}).`,
                });
                setWeaponChoice(null);
              }}
              data-testid="button-pick-weapon"
            >
              Pick up
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPickups((prev) => {
                  const next = { ...prev };
                  delete next[weaponChoice.key];
                  return next;
                });
                setCombatMessage(`You left ${weaponChoice.weapon.name} behind.`);
                setWeaponChoice(null);
              }}
              data-testid="button-leave-weapon"
            >
              Leave
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="order-2 lg:order-1">
            <MazeGrid
              maze={gameState.maze}
              playerPosition={gameState.playerPosition}
              isMoving={gameState.gamePhase === "exploring"}
              remainingSteps={0}
              hasStepLimit={false}
              pickupMarkers={pickupMarkers}
              onTileClick={handleTileClick}
              onMove={handleMove}
            />
            <div className="mt-4 flex justify-center">
              <Button
                onClick={handleStartRevealQuestion}
                variant="secondary"
                disabled={gameState.gamePhase !== "exploring" || isFeedbackModalOpen || isRevealQuestionActive || isRevealQuestionMode || isDeathModalOpen || isPickupModalOpen || isDefeatedCreatureModalOpen}
                data-testid="button-reveal-challenge"
              >
                Reveal 5 Tiles (Answer Question)
              </Button>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            {gameState.gamePhase === "combat" && encounter && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-bold">⚔️ {encounter.name}</h2>
                    {(() => {
                      const cardBadge = getCreatureDifficultyBadge(encounter);
                      return cardBadge ? (
                        <DifficultyBadgeView badge={cardBadge} testId={`badge-difficulty-card-${cardBadge.tier}`} />
                      ) : null;
                    })()}
                  </div>
                  <p className="text-muted-foreground">Defeat it by answering French questions correctly.</p>
                  <div className="mt-3 overflow-hidden rounded-lg border border-border bg-black/50">
                    <img
                      src={encounter.image}
                      alt={encounter.name}
                      className={`w-full object-contain ${encounter.isBoss ? "h-[260px] sm:h-[360px] lg:h-[420px]" : "h-[240px] sm:h-[340px] lg:h-[400px]"}` }
                    />
                  </div>
                  <div className="mt-3 space-y-1">
                    <Progress value={(encounter.hp / encounter.maxHp) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground">{encounter.hp}/{encounter.maxHp} HP</p>
                  </div>
                  {potions > 0 && (
                    <Button className="mt-3" variant="secondary" onClick={handleUsePotion} data-testid="button-use-potion">
                      Use Potion
                    </Button>
                  )}
                </div>
                {currentQuestion && !isLoadingQuestion && (
                  <QuestionPanel
                    question={currentQuestion}
                    onSubmit={handleAnswerSubmit}
                    isSubmitting={submitAnswerMutation.isPending}
                  />
                )}
              </div>
            )}

            {isRevealQuestionMode && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4">
                  <h2 className="font-display text-2xl font-bold">🧭 Reveal Challenge</h2>
                  <p className="text-muted-foreground">Answer correctly to reveal a 5-tile radius around your position.</p>
                </div>
                {currentQuestion && !isLoadingQuestion && (
                  <QuestionPanel
                    question={currentQuestion}
                    onSubmit={handleAnswerSubmit}
                    isSubmitting={submitAnswerMutation.isPending}
                  />
                )}
              </div>
            )}

            {((gameState.gamePhase === "combat" || isRevealQuestionMode) && isLoadingQuestion) && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
              </div>
            )}

            {gameState.gamePhase === "exploring" && !isRevealQuestionMode && (
              <div className="text-center py-12">
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">Explore the Dungeon</h2>
                <p className="text-muted-foreground">Move with arrow buttons or keyboard arrows. Reach the exit to face the Dragon Warden boss.</p>
              </div>
            )}
          </div>
        </div>
      </main>


      {isDeathModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-red-600/35 animate-pulse" />
          <div className="relative w-full max-w-md rounded-xl border-2 border-red-500 bg-card p-6 shadow-2xl text-center space-y-3">
            <h2 className="font-display text-3xl font-bold text-red-600">You Died</h2>
            <p className="text-muted-foreground">
              The creature defeated you. You have been re-spawned 10 steps earlier in your quest with 3 hearts.
            </p>
            <Button onClick={() => setShowDeathModal(false)} data-testid="button-death-continue">
              Continue Adventure
            </Button>
          </div>
        </div>
      )}


      {isPickupModalOpen && pickupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-xl border-2 border-primary/40 bg-card p-6 shadow-2xl text-center space-y-3">
            <h2 className="font-display text-2xl font-bold text-primary">{pickupModal.title}</h2>
            <p className="text-muted-foreground">{pickupModal.description}</p>
            <Button onClick={() => setPickupModal(null)} data-testid="button-pickup-continue">
              Continue
            </Button>
          </div>
        </div>
      )}

      {isDefeatedCreatureModalOpen && defeatedCreatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl rounded-xl border-2 border-red-500/60 bg-card p-6 shadow-2xl text-center space-y-4">
            <h2 className="font-display text-3xl font-bold text-red-500">
              {defeatedCreatureModal.isBoss ? "Dragon Defeated" : `${defeatedCreatureModal.name} Defeated`}
            </h2>
            <img
              src={defeatedCreatureModal.image}
              alt={`${defeatedCreatureModal.name} defeated`}
              className="mx-auto h-[240px] sm:h-[320px] lg:h-[360px] w-full max-w-[400px] rounded-lg border object-contain bg-black/50"
            />
            <Button onClick={() => setDefeatedCreatureModal(null)} data-testid="button-defeated-creature-continue">
              Continue
            </Button>
          </div>
        </div>
      )}

      {feedbackResult && (
        <FeedbackModal
          result={feedbackResult}
          onContinue={handleFeedbackContinue}
        />
      )}

      {gameState.gamePhase === "won" && (
        <WinScreen
          questionsAnswered={gameState.questionsAnswered}
          correctAnswers={gameState.correctAnswers}
          sessionTime={sessionTime}
          streak={maxStreak}
          showDragonVictoryScene={bossDefeated}
          onPlayAgain={startGame}
        />
      )}
    </div>
  );
}
