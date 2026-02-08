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
import type { GameState, PublicQuestion, AnswerResult, Position, GameSettings } from "@shared/schema";

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

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomEncounter() {
  return {
    name: CREATURES[Math.floor(Math.random() * CREATURES.length)],
    maxHp: randomInt(1, 5),
  };
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
      setFeedbackResult(result);
      if (!gameState || gameState.gamePhase !== "combat" || !encounter) return;

      const newStreak = result.correct ? gameState.streak + 1 : 0;
      setMaxStreak((prev) => Math.max(prev, newStreak));

      setGameState({
        ...gameState,
        streak: newStreak,
        questionsAnswered: gameState.questionsAnswered + 1,
        correctAnswers: result.correct ? gameState.correctAnswers + 1 : gameState.correctAnswers,
        lastAnswerCorrect: result.correct,
      });

      if (result.correct) {
        const nextHp = encounter.hp - 1;
        setCombatMessage(`Direct hit! ${encounter.name} has ${Math.max(nextHp, 0)} HP left.`);
        if (nextHp <= 0) {
          setEncounter(null);
          setGameState((prev) => prev ? { ...prev, gamePhase: "exploring" } : prev);
          setNextEncounterAt(randomInt(3, 5));
          setStepsSinceEncounter(0);
          queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
        } else {
          setEncounter({ ...encounter, hp: nextHp });
          refetchQuestion();
        }
      } else {
        const nextHearts = hearts - 1;
        setHearts(nextHearts);

        if (nextHearts <= 0) {
          if (!gameState) return;
          const stepsBackIndex = Math.max(0, pathHistory.length - 1 - 10);
          const respawnPosition = pathHistory[stepsBackIndex] ?? gameState.maze.entrance;
          const respawnHistory = pathHistory.slice(0, stepsBackIndex + 1);
          const respawnMaze = updateVisibility(gameState.maze, respawnPosition, settingsRef.current.visibilityRadius);

          setPathHistory(respawnHistory.length ? respawnHistory : [respawnPosition]);
          setHearts(3);
          setEncounter(null);
          setGameState({
            ...gameState,
            maze: respawnMaze,
            playerPosition: respawnPosition,
            gamePhase: "exploring",
            remainingSteps: 1,
          });
          setStepsSinceEncounter(0);
          setNextEncounterAt(randomInt(3, 5));
          setCombatMessage("You were defeated! You respawned 10 steps back with 3 hearts.");
        } else {
          setCombatMessage(`${encounter.name} hit you! Hearts left: ${nextHearts}.`);
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

  const handleTileClick = (x: number, y: number) => {
    if (!gameState || gameState.gamePhase !== "exploring") return;

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
      if (!gameState || gameState.gamePhase !== "exploring") return;

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
  }, [gameState, stepsSinceEncounter, nextEncounterAt, pathHistory]);

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
        <div className="mb-4 rounded-lg border bg-card p-4 text-sm">
          <p className="font-semibold">Hearts: {"❤️".repeat(hearts)} ({hearts}/3)</p>
          <p className="text-muted-foreground">{combatMessage}</p>
          {gameState.gamePhase === "exploring" && (
            <p className="text-muted-foreground">Next encounter in {Math.max(0, nextEncounterAt - stepsSinceEncounter)} step(s).</p>
          )}
          {encounter && (
            <p className="font-medium">{encounter.name}: {encounter.hp}/{encounter.maxHp} HP</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="order-2 lg:order-1">
            <MazeGrid
              maze={gameState.maze}
              playerPosition={gameState.playerPosition}
              isMoving={gameState.gamePhase === "exploring"}
              remainingSteps={gameState.gamePhase === "exploring" ? 1 : 0}
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
        <FeedbackModal result={feedbackResult} onContinue={handleFeedbackContinue} />
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
