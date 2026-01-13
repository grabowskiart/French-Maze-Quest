import { z } from "zod";

export type TileType = "wall" | "path" | "entrance" | "exit";
export type FogState = "hidden" | "seen" | "visible";

export interface Tile {
  type: TileType;
  fog: FogState;
  x: number;
  y: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Maze {
  width: number;
  height: number;
  tiles: Tile[][];
  entrance: Position;
  exit: Position;
}

export type QuestionType = "mcq" | "fill" | "conjugation";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  correctAnswer: string;
  options?: string[];
  hint: string;
  explanation: string;
  difficulty: number;
  streak: number;
  lastSeen: number | null;
  category: string;
}

export interface GameState {
  maze: Maze;
  playerPosition: Position;
  currentQuestion: Question | null;
  streak: number;
  questionsAnswered: number;
  correctAnswers: number;
  sessionStartTime: number;
  gamePhase: "question" | "reward" | "moving" | "won" | "start";
  remainingSteps: number;
  lastAnswerCorrect: boolean | null;
}

export const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
});

export type AnswerSubmission = z.infer<typeof answerSchema>;

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  hint: string;
}

export const gameConfigSchema = z.object({
  mazeWidth: z.number().min(5).max(25).default(15),
  mazeHeight: z.number().min(5).max(25).default(15),
  revealOnIncorrect: z.boolean().default(true),
  visibilityRadius: z.number().min(1).max(5).default(2),
  revealRadius: z.number().min(3).max(7).default(5),
  maxStepsOnCorrect: z.number().min(1).max(5).default(3),
});

export type GameConfig = z.infer<typeof gameConfigSchema>;

export const users = null;
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
