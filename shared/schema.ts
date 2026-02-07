import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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

export type QuestionType = "mcq" | "fill" | "conjugation" | "grammar";
export type ProficiencyLevel = "beginner" | "intermediate" | "advanced";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conjugationPacks = pgTable("conjugation_packs", {
  id: serial("id").primaryKey(),
  verbInfinitive: varchar("verb_infinitive", { length: 50 }).notNull(),
  verbEnglish: varchar("verb_english", { length: 100 }).notNull(),
  group: integer("group").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  conjugations: jsonb("conjugations").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull().$type<QuestionType>(),
  question: text("question").notNull(),
  correctAnswer: varchar("correct_answer", { length: 255 }).notNull(),
  options: jsonb("options").$type<string[]>(),
  hint: text("hint").notNull(),
  explanation: text("explanation").notNull(),
  difficulty: integer("difficulty").default(1).notNull(),
  proficiencyLevel: varchar("proficiency_level", { length: 20 }).default("beginner").notNull().$type<ProficiencyLevel>(),
  categoryId: integer("category_id").references(() => categories.id),
  conjugationPackId: integer("conjugation_pack_id").references(() => conjugationPacks.id),
  isGenerated: boolean("is_generated").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueQuestion: uniqueIndex("questions_unique_idx").on(table.question, table.type, table.correctAnswer),
}));

export const questionStates = pgTable("question_states", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  streak: integer("streak").default(0).notNull(),
  timesAnswered: integer("times_answered").default(0).notNull(),
  timesCorrect: integer("times_correct").default(0).notNull(),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameSettings = pgTable("game_settings", {
  id: serial("id").primaryKey(),
  enabledQuestionTypes: jsonb("enabled_question_types").default(["mcq", "fill", "conjugation"]).notNull().$type<QuestionType[]>(),
  enabledProficiencyLevels: jsonb("enabled_proficiency_levels").default(["beginner"]).notNull().$type<ProficiencyLevel[]>(),
  enabledCategoryIds: jsonb("enabled_category_ids").default([]).notNull().$type<number[]>(),
  enabledConjugationPackIds: jsonb("enabled_conjugation_pack_ids").default([]).notNull().$type<number[]>(),
  mazeWidth: integer("maze_width").default(30).notNull(),
  mazeHeight: integer("maze_height").default(30).notNull(),
  visibilityRadius: integer("visibility_radius").default(1).notNull(),
  revealRadius: integer("reveal_radius").default(6).notNull(),
  maxStepsOnCorrect: integer("max_steps_on_correct").default(3).notNull(),
  autoGenerateQuestions: boolean("auto_generate_questions").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertConjugationPackSchema = createInsertSchema(conjugationPacks).omit({ id: true, createdAt: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true, createdAt: true });
export const insertQuestionStateSchema = createInsertSchema(questionStates).omit({ id: true, createdAt: true });
export const insertGameSettingsSchema = createInsertSchema(gameSettings).omit({ id: true, updatedAt: true });

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type ConjugationPack = typeof conjugationPacks.$inferSelect;
export type InsertConjugationPack = z.infer<typeof insertConjugationPackSchema>;
export type DbQuestion = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type QuestionState = typeof questionStates.$inferSelect;
export type InsertQuestionState = z.infer<typeof insertQuestionStateSchema>;
export type GameSettings = typeof gameSettings.$inferSelect;
export type InsertGameSettings = z.infer<typeof insertGameSettingsSchema>;

export interface Conjugations {
  present: {
    je: string;
    tu: string;
    il: string;
    nous: string;
    vous: string;
    ils: string;
  };
  passé_composé?: {
    je: string;
    tu: string;
    il: string;
    nous: string;
    vous: string;
    ils: string;
  };
  imparfait?: {
    je: string;
    tu: string;
    il: string;
    nous: string;
    vous: string;
    ils: string;
  };
  futur?: {
    je: string;
    tu: string;
    il: string;
    nous: string;
    vous: string;
    ils: string;
  };
}

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
  proficiencyLevel: ProficiencyLevel;
}

// Safe subset for client delivery. Excludes answer/feedback fields that can reveal solutions.
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  difficulty: number;
  streak: number;
  lastSeen: number | null;
  category: string;
  proficiencyLevel: ProficiencyLevel;
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
  mazeWidth: z.number().min(10).max(50).default(30),
  mazeHeight: z.number().min(10).max(50).default(30),
  revealOnIncorrect: z.boolean().default(true),
  visibilityRadius: z.number().min(2).max(8).default(4),
  revealRadius: z.number().min(4).max(10).default(6),
  maxStepsOnCorrect: z.number().min(1).max(5).default(3),
});

export type GameConfig = z.infer<typeof gameConfigSchema>;

export const updateGameSettingsSchema = z.object({
  enabledQuestionTypes: z.array(z.enum(["mcq", "fill", "conjugation", "grammar"])).optional(),
  enabledProficiencyLevels: z.array(z.enum(["beginner", "intermediate", "advanced"])).optional(),
  enabledCategoryIds: z.array(z.number()).optional(),
  enabledConjugationPackIds: z.array(z.number()).optional(),
  mazeWidth: z.number().min(10).max(50).optional(),
  mazeHeight: z.number().min(10).max(50).optional(),
  visibilityRadius: z.number().min(2).max(8).optional(),
  revealRadius: z.number().min(4).max(10).optional(),
  maxStepsOnCorrect: z.number().min(1).max(5).optional(),
  autoGenerateQuestions: z.boolean().optional(),
});

export type UpdateGameSettings = z.infer<typeof updateGameSettingsSchema>;

export const categoriesRelations = relations(categories, ({ many }) => ({
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  category: one(categories, {
    fields: [questions.categoryId],
    references: [categories.id],
  }),
  conjugationPack: one(conjugationPacks, {
    fields: [questions.conjugationPackId],
    references: [conjugationPacks.id],
  }),
}));

export const questionStatesRelations = relations(questionStates, ({ one }) => ({
  question: one(questions, {
    fields: [questionStates.questionId],
    references: [questions.id],
  }),
}));
