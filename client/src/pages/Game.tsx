import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GameHeader } from "@/components/game/GameHeader";
import { MazeGrid } from "@/components/game/MazeGrid";
import { QuestionPanel } from "@/components/game/QuestionPanel";
import { FeedbackModal } from "@/components/game/FeedbackModal";
import { WinScreen } from "@/components/game/WinScreen";
import { StartScreen } from "@/components/game/StartScreen";
import { generateMaze, revealTiles, updateVisibility } from "@/lib/mazeGenerator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { GameState, PublicQuestion, AnswerResult, Position, GameSettings, Maze } from "@shared/schema";

const DEFAULT_MAZE_SIZE = 30;
const DEFAULT_VISIBILITY_RADIUS = 1;

const CREATURES = [
  "Skeleton Scout",
  "Goblin Raider",
  "Cave Troll",
  "Basilisk Spawn",
  "Shadow Wraith",
  "Crypt Ghoul",
  "Stone Gargoyle",
  "Bone Knight",
  "Swamp Hag",
  "Infernal Imp",
  "Dungeon Minotaur",
  "Nightmare Hound",
] as const;

const WEAPON_POOL = [
  { name: "Rusty Sword", damage: 1 },
  { name: "Knight's Blade", damage: 2 },
  { name: "War Axe", damage: 2 },
  { name: "Spiked Mace", damage: 2 },
  { name: "Moon Lance", damage: 3 },
  { name: "Flame Saber", damage: 3 },
  { name: "Dragonfang Spear", damage: 3 },
] as const;

type Pickup =
  | { kind: "heart" }
  | { kind: "potion" }
  | { kind: "weapon"; weapon: { name: string; damage: number } };

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
      if ((tile.type === "path" || tile.type === "entrance") && !excluded.has(`${x},${y}`)) {
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

function getRandomEncounter() {
  return {
    name: CREATURES[Math.floor(Math.random() * CREATURES.length)],
    maxHp: randomInt(1, 5),
  };
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

export default function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [feedbackResult, setFeedbackResult] = useState<AnswerResult | null>(null);
  const [maxStreak, setMaxStreak] = useState(0);

  const [hearts, setHearts] = useState(3);
  const [pathHistory, setPathHistory] = useState<Position[]>([]);
  const [stepsSinceEncounter, setStepsSinceEncounter] = useState(0);
  const [nextEncounterAt, setNextEncounterAt] = useState(randomInt(3, 5));
  const [encounter, setEncounter] = useState<{ name: string; hp: number; maxHp: number } | null>(null);
  const [combatMessage, setCombatMessage] = useState<string>("Move through the maze to find your first enemy.");

  const [pickups, setPickups] = useState<Record<string, Pickup>>({});
  const [potions, setPotions] = useState(0);
  const [weaponInventory, setWeaponInventory] = useState<Array<{ name: string; damage: number }>>([]);
  const [equippedWeapon, setEquippedWeapon] = useState<{ name: string; damage: number }>({ name: "Bare Hands", damage: 1 });
  const [weaponChoice, setWeaponChoice] = useState<{ key: string; weapon: { name: string; damage: number } } | null>(null);

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
    enabled: gameState?.gamePhase === "combat",
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
      if (!activeState || activeState.gamePhase !== "combat" || !encounterRef.current) return;

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
        const dmg = Math.max(1, weaponRef.current.damage);
        const nextHp = encounterRef.current.hp - dmg;
        setCombatMessage(`Direct hit with ${weaponRef.current.name}! ${encounterRef.current.name} has ${Math.max(nextHp, 0)} HP left.`);
        if (nextHp <= 0) {
          setEncounter(null);
          setGameState((prev) => prev ? { ...prev, gamePhase: "exploring" } : prev);
          setNextEncounterAt(randomInt(3, 5));
          setStepsSinceEncounter(0);
          queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
        } else {
          setEncounter({ ...encounterRef.current, hp: nextHp });
          refetchQuestion();
        }
      } else {
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
    setCombatMessage("Move through the maze. A creature appears every 3-5 steps.");
    setSessionTime(0);
    setMaxStreak(0);
    setFeedbackResult(null);

    setPickups(buildPickups(maze));
    setPotions(0);
    setWeaponInventory([]);
    setEquippedWeapon({ name: "Bare Hands", damage: 1 });
    setWeaponChoice(null);

    queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
  }, [mazeWidth, mazeHeight]);

  const handleAnswerSubmit = (answer: string) => {
    if (currentQuestion && gameState?.gamePhase === "combat") {
      submitAnswerMutation.mutate({
        questionId: currentQuestion.id,
        answer,
      });
    }
  };

  const handleFeedbackContinue = () => {
    setFeedbackResult(null);
  };

  const handleRevealAreaBonus = () => {
    if (!gameState || !feedbackResult?.correct) return;
    const updatedMaze = revealTiles(gameState.maze, gameState.playerPosition, 5, false);
    setGameState((prev) => prev ? { ...prev, maze: updatedMaze } : prev);
    setCombatMessage("You used your reveal bonus and uncovered nearby tiles.");
    setFeedbackResult(null);
  };

  const handleUsePotion = () => {
    if (!encounter || potions <= 0 || !gameState || gameState.gamePhase !== "combat") return;
    setPotions((prev) => prev - 1);
    setEncounter(null);
    setGameState({ ...gameState, gamePhase: "exploring" });
    setStepsSinceEncounter(0);
    setNextEncounterAt(randomInt(3, 5));
    setCombatMessage(`You used a potion and instantly defeated ${encounter.name}!`);
  };

  const handleTileClick = (x: number, y: number) => {
    if (!gameState || gameState.gamePhase !== "exploring" || weaponChoice) return;

    const dx = Math.abs(x - gameState.playerPosition.x);
    const dy = Math.abs(y - gameState.playerPosition.y);
    if (!((dx === 1 && dy === 0) || (dx === 0 && dy === 1))) return;

    const tile = gameState.maze.tiles[y][x];
    if (tile.type === "wall" || tile.fog === "hidden") return;

    const newPosition: Position = { x, y };
    const updatedMaze = updateVisibility(gameState.maze, newPosition, settingsRef.current.visibilityRadius);

    if (tile.type === "exit") {
      setGameState({
        ...gameState,
        maze: updatedMaze,
        playerPosition: newPosition,
        gamePhase: "won",
        remainingSteps: 0,
      });
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
      setPickups((prev) => {
        const next = { ...prev };
        delete next[pickupKey];
        return next;
      });
    } else if (pickup?.kind === "potion") {
      setPotions((prev) => prev + 1);
      setCombatMessage("You found a magic potion! It can instantly defeat one creature.");
      setPickups((prev) => {
        const next = { ...prev };
        delete next[pickupKey];
        return next;
      });
    } else if (pickup?.kind === "weapon") {
      setWeaponChoice({ key: pickupKey, weapon: pickup.weapon });
      setCombatMessage(`You found ${pickup.weapon.name}. Choose to pick it up or leave it.`);
    }

    if (movedSteps >= nextEncounterAt) {
      const next = getRandomEncounter();
      setEncounter({ name: next.name, hp: next.maxHp, maxHp: next.maxHp });
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
    } else {
      setStepsSinceEncounter(movedSteps);
      setGameState({
        ...gameState,
        maze: updatedMaze,
        playerPosition: newPosition,
        remainingSteps: 1,
      });
    }
  };

  const handleMove = (direction: "up" | "down" | "left" | "right") => {
    if (!gameState) return;
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
      if (!gameState || gameState.gamePhase !== "exploring" || weaponChoice) return;

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
  }, [gameState, weaponChoice, stepsSinceEncounter, nextEncounterAt, pathHistory, pickups]);

  if (!gameState || gameState.gamePhase === "start") {
    return <StartScreen onStart={startGame} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <GameHeader
        streak={gameState.streak}
        questionsAnswered={gameState.questionsAnswered}
        sessionTime={sessionTime}
      />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4 rounded-lg border bg-card p-4 text-sm space-y-1">
          <p className="font-semibold">Hearts: {"❤️".repeat(hearts)} ({hearts})</p>
          <p className="font-semibold">Potions: 🧪 {potions}</p>
          <p className="font-semibold">Weapon: {equippedWeapon.name} (Damage {equippedWeapon.damage})</p>
          <p className="text-muted-foreground">{combatMessage}</p>
          {gameState.gamePhase === "exploring" && (
            <p className="text-muted-foreground">Next encounter in {Math.max(0, nextEncounterAt - stepsSinceEncounter)} step(s).</p>
          )}
          {encounter && (
            <div className="space-y-1">
              <p className="font-medium">{encounter.name}</p>
              <Progress value={(encounter.hp / encounter.maxHp) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground">{encounter.hp}/{encounter.maxHp} HP</p>
            </div>
          )}
          {weaponInventory.length > 0 && (
            <p className="text-muted-foreground">Inventory: {weaponInventory.map((w) => `${w.name}(${w.damage})`).join(", ")}</p>
          )}
        </div>

        {weaponChoice && (
          <div className="mb-4 rounded-lg border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">Found <strong>{weaponChoice.weapon.name}</strong> (Damage {weaponChoice.weapon.damage}). Pick it up?</p>
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
              onTileClick={handleTileClick}
              onMove={handleMove}
            />
          </div>

          <div className="order-1 lg:order-2">
            {gameState.gamePhase === "combat" && encounter && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4">
                  <h2 className="font-display text-2xl font-bold">⚔️ {encounter.name}</h2>
                  <p className="text-muted-foreground">Defeat it by answering French questions correctly.</p>
                  <div className="mt-3 space-y-1">
                    <Progress value={(encounter.hp / encounter.maxHp) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground">{encounter.hp}/{encounter.maxHp} HP</p>
                  </div>
                  {potions > 0 && (
                    <Button className="mt-3" variant="secondary" onClick={handleUsePotion} data-testid="button-use-potion">
                      Use Potion (Instant Defeat)
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

            {(gameState.gamePhase === "combat" && isLoadingQuestion) && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
              </div>
            )}

            {gameState.gamePhase === "exploring" && (
              <div className="text-center py-12">
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">Explore the Dungeon</h2>
                <p className="text-muted-foreground">Move with arrow buttons or keyboard arrows.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {feedbackResult && (
        <FeedbackModal
          result={feedbackResult}
          onContinue={handleFeedbackContinue}
          onRevealArea={feedbackResult.correct ? handleRevealAreaBonus : undefined}
        />
      )}

      {gameState.gamePhase === "won" && (
        <WinScreen
          questionsAnswered={gameState.questionsAnswered}
          correctAnswers={gameState.correctAnswers}
          sessionTime={sessionTime}
          streak={maxStreak}
          onPlayAgain={startGame}
        />
      )}
    </div>
  );
}
