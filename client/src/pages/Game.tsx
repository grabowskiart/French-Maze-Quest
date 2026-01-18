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
import { Eye } from "lucide-react";
import type { GameState, Question, AnswerResult, Maze, Position, GameSettings } from "@shared/schema";

const DEFAULT_MAZE_SIZE = 30;
const DEFAULT_VISIBILITY_RADIUS = 3;
const DEFAULT_REVEAL_RADIUS = 3;
const DEFAULT_MAX_STEPS = 3;

export default function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [feedbackResult, setFeedbackResult] = useState<AnswerResult | null>(null);
  const [maxStreak, setMaxStreak] = useState(0);
  
  const { data: settings } = useQuery<GameSettings>({
    queryKey: ["/api/settings"],
    staleTime: 60000,
  });
  
  const mazeWidth = settings?.mazeWidth ?? DEFAULT_MAZE_SIZE;
  const mazeHeight = settings?.mazeHeight ?? DEFAULT_MAZE_SIZE;
  const visibilityRadius = settings?.visibilityRadius ?? DEFAULT_VISIBILITY_RADIUS;
  const revealRadius = settings?.revealRadius ?? DEFAULT_REVEAL_RADIUS;
  const maxSteps = settings?.maxStepsOnCorrect ?? DEFAULT_MAX_STEPS;
  
  const settingsRef = useRef({ visibilityRadius, revealRadius, maxSteps });
  settingsRef.current = { visibilityRadius, revealRadius, maxSteps };

  const { data: currentQuestion, refetch: refetchQuestion, isFetching: isLoadingQuestion } = useQuery<Question>({
    queryKey: ["/api/questions/next"],
    enabled: gameState?.gamePhase === "question",
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
      if (gameState) {
        const newStreak = result.correct ? gameState.streak + 1 : 0;
        setMaxStreak((prev) => Math.max(prev, newStreak));
        setGameState({
          ...gameState,
          streak: newStreak,
          questionsAnswered: gameState.questionsAnswered + 1,
          correctAnswers: result.correct ? gameState.correctAnswers + 1 : gameState.correctAnswers,
          lastAnswerCorrect: result.correct,
        });
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
      gamePhase: "question",
      remainingSteps: 0,
      lastAnswerCorrect: null,
    });
    setSessionTime(0);
    setMaxStreak(0);
    setFeedbackResult(null);
    queryClient.invalidateQueries({ queryKey: ["/api/questions/next"] });
  }, [mazeWidth, mazeHeight]);

  const handleAnswerSubmit = (answer: string) => {
    if (currentQuestion) {
      submitAnswerMutation.mutate({
        questionId: currentQuestion.id,
        answer,
      });
    }
  };

  const handleFeedbackContinue = () => {
    if (!gameState || !feedbackResult) return;

    if (feedbackResult.correct) {
      // Go directly to moving mode
      setGameState({
        ...gameState,
        gamePhase: "moving",
        remainingSteps: settingsRef.current.maxSteps,
      });
    } else {
      const updatedMaze = revealTiles(gameState.maze, gameState.playerPosition, 1, false);
      setGameState({
        ...gameState,
        maze: updatedMaze,
        gamePhase: "question",
      });
      refetchQuestion();
    }
    setFeedbackResult(null);
  };

  const handleRevealInstead = () => {
    if (!gameState) return;
    const updatedMaze = revealTiles(gameState.maze, gameState.playerPosition, settingsRef.current.revealRadius, false);
    setGameState({
      ...gameState,
      maze: updatedMaze,
      gamePhase: "question",
      remainingSteps: 0,
    });
    refetchQuestion();
  };

  const handleTileClick = (x: number, y: number) => {
    if (!gameState || gameState.gamePhase !== "moving" || gameState.remainingSteps <= 0) return;

    const dx = Math.abs(x - gameState.playerPosition.x);
    const dy = Math.abs(y - gameState.playerPosition.y);
    if (!((dx === 1 && dy === 0) || (dx === 0 && dy === 1))) return;

    const tile = gameState.maze.tiles[y][x];
    if (tile.type === "wall" || tile.fog === "hidden") return;

    const newPosition: Position = { x, y };
    let updatedMaze = updateVisibility(gameState.maze, newPosition, settingsRef.current.visibilityRadius);
    const newRemainingSteps = gameState.remainingSteps - 1;

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

    if (newRemainingSteps <= 0) {
      setGameState({
        ...gameState,
        maze: updatedMaze,
        playerPosition: newPosition,
        gamePhase: "question",
        remainingSteps: 0,
      });
      refetchQuestion();
    } else {
      setGameState({
        ...gameState,
        maze: updatedMaze,
        playerPosition: newPosition,
        remainingSteps: newRemainingSteps,
      });
    }
  };

  const handleFinishMoving = () => {
    if (!gameState) return;
    setGameState({
      ...gameState,
      gamePhase: "question",
      remainingSteps: 0,
    });
    refetchQuestion();
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
      if (!gameState || gameState.gamePhase !== "moving" || gameState.remainingSteps <= 0) return;

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
        case "Enter":
          handleFinishMoving();
          return;
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
  }, [gameState]);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="order-2 lg:order-1">
            <MazeGrid
              maze={gameState.maze}
              playerPosition={gameState.playerPosition}
              isMoving={gameState.gamePhase === "moving"}
              remainingSteps={gameState.remainingSteps}
              onTileClick={handleTileClick}
              onMove={handleMove}
            />

            {gameState.gamePhase === "moving" && gameState.remainingSteps > 0 && (
              <div className="mt-8 flex flex-col items-center gap-3">
                {gameState.remainingSteps === settingsRef.current.maxSteps && (
                  <Button
                    onClick={handleRevealInstead}
                    variant="secondary"
                    className="flex items-center gap-2"
                    data-testid="button-reveal-instead"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Reveal instead</span>
                  </Button>
                )}
                <button
                  onClick={handleFinishMoving}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                  data-testid="button-finish-moving"
                >
                  Done moving early
                </button>
              </div>
            )}
          </div>

          <div className="order-1 lg:order-2">
            {gameState.gamePhase === "question" && currentQuestion && !isLoadingQuestion && (
              <QuestionPanel
                question={currentQuestion}
                onSubmit={handleAnswerSubmit}
                isSubmitting={submitAnswerMutation.isPending}
              />
            )}

            {(gameState.gamePhase === "question" && isLoadingQuestion) && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
              </div>
            )}

            {gameState.gamePhase === "moving" && (
              <div className="text-center py-12">
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  Time to Move!
                </h2>
                <p className="text-muted-foreground mb-4">
                  Use the arrow buttons or keyboard arrows to navigate.
                </p>
                <p className="text-sm text-muted-foreground">
                  Press Enter or click "Done moving early" when finished.
                </p>
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
