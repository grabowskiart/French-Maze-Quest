import type { Question, PublicQuestion, QuestionType, ProficiencyLevel, Category, ConjugationPack, GameSettings, DbQuestion, QuestionState as DbQuestionState, StatsResponse } from "@shared/schema";
import { categories, conjugationPacks, questions, questionStates, gameSettings } from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql, desc, asc, or, isNull } from "drizzle-orm";
import { questionBank, checkAnswer } from "./questionBank";

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface QuestionStateMap {
  streak: number;
  lastSeen: number | null;
}

export interface IStorage {
  getNextQuestion(): Promise<PublicQuestion>;
  submitAnswer(questionId: string, answer: string): Promise<{
    correct: boolean;
    correctAnswer: string;
    explanation: string;
    hint: string;
  }>;
  getCategories(): Promise<Category[]>;
  getConjugationPacks(): Promise<ConjugationPack[]>;
  getSettings(): Promise<GameSettings>;
  updateSettings(settings: Partial<GameSettings>): Promise<GameSettings>;
  toggleCategory(categoryId: number, isActive: boolean): Promise<void>;
  toggleConjugationPack(packId: number, isActive: boolean): Promise<void>;
  getStats(): Promise<StatsResponse>;
}

function dbQuestionToQuestion(dbQ: DbQuestion, state?: DbQuestionState | null, categoryName?: string): Question {
  return {
    id: dbQ.id.toString(),
    type: dbQ.type as QuestionType,
    question: dbQ.question,
    correctAnswer: dbQ.correctAnswer,
    options: dbQ.options as string[] | undefined,
    hint: dbQ.hint,
    explanation: dbQ.explanation,
    difficulty: dbQ.difficulty,
    streak: state?.streak ?? 0,
    lastSeen: state?.lastSeen ? state.lastSeen.getTime() : null,
    category: categoryName || "General",
    proficiencyLevel: dbQ.proficiencyLevel as ProficiencyLevel,
  };
}

function toPublicQuestion(question: Question): PublicQuestion {
  const { id, type, question: prompt, options, difficulty, streak, lastSeen, category, proficiencyLevel } = question;
  return {
    id,
    type,
    question: prompt,
    options,
    difficulty,
    streak,
    lastSeen,
    category,
    proficiencyLevel,
  };
}

export class DatabaseStorage implements IStorage {
  async getNextQuestion(): Promise<PublicQuestion> {
    const settings = await this.getSettings();
    const now = new Date();
    
    const enabledCategories = settings.enabledCategoryIds?.length 
      ? settings.enabledCategoryIds 
      : (await db.select({ id: categories.id }).from(categories).where(eq(categories.isActive, true))).map(c => c.id);
    
    const enabledConjPacks = settings.enabledConjugationPackIds?.length
      ? settings.enabledConjugationPackIds
      : (await db.select({ id: conjugationPacks.id }).from(conjugationPacks).where(eq(conjugationPacks.isActive, true))).map(p => p.id);

    const enabledTenses = settings.enabledTenses ?? ["present", "imparfait", "passé_composé", "futur"];

    const dbQuestions = await db.select()
      .from(questions)
      .leftJoin(questionStates, eq(questions.id, questionStates.questionId))
      .leftJoin(categories, eq(questions.categoryId, categories.id))
      .where(
        and(
          eq(questions.isActive, true),
          settings.enabledQuestionTypes?.length 
            ? inArray(questions.type, settings.enabledQuestionTypes)
            : sql`true`,
          settings.enabledProficiencyLevels?.length
            ? inArray(questions.proficiencyLevel, settings.enabledProficiencyLevels)
            : sql`true`,
          enabledCategories.length 
            ? or(inArray(questions.categoryId, enabledCategories), isNull(questions.categoryId))
            : sql`true`,
          or(
            sql`${questions.type} != 'conjugation'`,
            sql`${questions.conjugationPackId} IS NULL`,
            enabledConjPacks.length
              ? inArray(questions.conjugationPackId, enabledConjPacks)
              : sql`true`
          ),
          // Filter conjugation questions by enabled tenses; non-conjugation rows pass through
          or(
            sql`${questions.type} != 'conjugation'`,
            enabledTenses.length
              ? or(
                  inArray(questions.tense, enabledTenses),
                  isNull(questions.tense)
                )
              : sql`false`
          )
        )
      );

    if (dbQuestions.length === 0) {
      return toPublicQuestion(questionBank[Math.floor(Math.random() * questionBank.length)]);
    }

    // First, separate questions into "available" (not seen in last 30 seconds) and "cooldown"
    const cooldownMs = 60 * 1000; // 60 seconds hard cooldown
    const availableQuestions: typeof dbQuestions = [];
    const cooldownQuestions: typeof dbQuestions = [];
    
    for (const row of dbQuestions) {
      const lastSeen = row.question_states?.lastSeen;
      if (lastSeen && (now.getTime() - lastSeen.getTime()) < cooldownMs) {
        cooldownQuestions.push(row);
      } else {
        availableQuestions.push(row);
      }
    }
    
    // Use available questions if we have any, otherwise fall back to cooldown questions
    const questionsToScore = availableQuestions.length > 0 ? availableQuestions : cooldownQuestions;
    
    const scoredQuestions = questionsToScore.map(row => {
      const q = row.questions;
      const state = row.question_states;
      let score = 100;
      
      // Penalize based on streak (mastered questions should appear less)
      score -= (state?.streak || 0) * 20;
      
      if (state?.lastSeen) {
        const minutesSinceLastSeen = (now.getTime() - state.lastSeen.getTime()) / (1000 * 60);
        if (minutesSinceLastSeen < 2) {
          score -= 150;
        } else if (minutesSinceLastSeen < 5) {
          score -= 80;
        } else if (minutesSinceLastSeen < 10) {
          score -= 40;
        } else {
          // Bonus for not recently seen
          const hoursSinceLastSeen = minutesSinceLastSeen / 60;
          score += Math.min(hoursSinceLastSeen * 10, 50);
        }
      } else {
        // Never seen questions get priority
        score += 80;
      }
      
      score += (3 - q.difficulty) * 10;
      // Larger random factor to ensure variety
      score += Math.random() * 100;
      
      return { 
        question: dbQuestionToQuestion(q, state, row.categories?.displayName),
        score 
      };
    });

    scoredQuestions.sort((a, b) => b.score - a.score);
    return toPublicQuestion(scoredQuestions[0].question);
  }

  async submitAnswer(questionId: string, answer: string): Promise<{
    correct: boolean;
    correctAnswer: string;
    explanation: string;
    hint: string;
  }> {
    const qId = parseInt(questionId);
    
    const [dbQuestion] = await db.select().from(questions).where(eq(questions.id, qId)).limit(1);
    
    if (!dbQuestion) {
      const fallbackQ = questionBank.find(q => q.id === questionId);
      if (!fallbackQ) throw new Error("Question not found");
      
      const isCorrect = checkAnswer(fallbackQ, answer);
      return {
        correct: isCorrect,
        correctAnswer: fallbackQ.correctAnswer,
        explanation: fallbackQ.explanation,
        hint: fallbackQ.hint,
      };
    }
    
    const normalizedAnswer = removeAccents(answer.toLowerCase().trim());
    const normalizedCorrect = removeAccents(dbQuestion.correctAnswer.toLowerCase().trim());
    const isCorrect = normalizedAnswer === normalizedCorrect;

    const [existingState] = await db.select().from(questionStates).where(eq(questionStates.questionId, qId)).limit(1);
    
    if (existingState) {
      await db.update(questionStates)
        .set({
          streak: isCorrect ? existingState.streak + 1 : 0,
          timesAnswered: existingState.timesAnswered + 1,
          timesCorrect: isCorrect ? existingState.timesCorrect + 1 : existingState.timesCorrect,
          lastSeen: new Date(),
        })
        .where(eq(questionStates.id, existingState.id));
    } else {
      await db.insert(questionStates).values({
        questionId: qId,
        streak: isCorrect ? 1 : 0,
        timesAnswered: 1,
        timesCorrect: isCorrect ? 1 : 0,
        lastSeen: new Date(),
      });
    }

    return {
      correct: isCorrect,
      correctAnswer: dbQuestion.correctAnswer,
      explanation: dbQuestion.explanation,
      hint: dbQuestion.hint,
    };
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(asc(categories.displayName));
  }

  async getConjugationPacks(): Promise<ConjugationPack[]> {
    return db.select().from(conjugationPacks).orderBy(asc(conjugationPacks.verbInfinitive));
  }

  async getSettings(): Promise<GameSettings> {
    const [settings] = await db.select().from(gameSettings).limit(1);
    if (settings) return settings;
    
    const [newSettings] = await db.insert(gameSettings).values({
      enabledQuestionTypes: ["mcq", "fill", "conjugation"],
      enabledProficiencyLevels: ["beginner"],
      enabledCategoryIds: [],
      enabledConjugationPackIds: [],
      mazeWidth: 30,
      mazeHeight: 30,
      visibilityRadius: 1,
      revealRadius: 6,
      maxStepsOnCorrect: 3,
      autoGenerateQuestions: true,
    }).returning();
    
    return newSettings;
  }

  async updateSettings(updates: Partial<GameSettings>): Promise<GameSettings> {
    const current = await this.getSettings();
    const [updated] = await db.update(gameSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(gameSettings.id, current.id))
      .returning();
    return updated;
  }

  async toggleCategory(categoryId: number, isActive: boolean): Promise<void> {
    await db.update(categories)
      .set({ isActive })
      .where(eq(categories.id, categoryId));
  }

  async toggleConjugationPack(packId: number, isActive: boolean): Promise<void> {
    await db.update(conjugationPacks)
      .set({ isActive })
      .where(eq(conjugationPacks.id, packId));
  }

  async getStats(): Promise<StatsResponse> {
    const allCategories = await db.select().from(categories);
    const categoryNameById = new Map<number, string>();
    for (const c of allCategories) categoryNameById.set(c.id, c.displayName);

    const rows = await db
      .select({
        questionId: questions.id,
        questionText: questions.question,
        type: questions.type,
        categoryId: questions.categoryId,
        isActive: questions.isActive,
        timesAnswered: questionStates.timesAnswered,
        timesCorrect: questionStates.timesCorrect,
        streak: questionStates.streak,
      })
      .from(questions)
      .leftJoin(questionStates, eq(questionStates.questionId, questions.id))
      .where(eq(questions.isActive, true));

    let totalQuestions = 0;
    let attemptedQuestions = 0;
    let totalAnswers = 0;
    let totalCorrect = 0;
    let masteredQuestions = 0;

    type CatAgg = { totalAnswers: number; totalCorrect: number; attempted: number; total: number };
    const catAggById = new Map<number | null, CatAgg>();
    const ensureCat = (id: number | null) => {
      const key = id ?? -1;
      if (!catAggById.has(key)) {
        catAggById.set(key, { totalAnswers: 0, totalCorrect: 0, attempted: 0, total: 0 });
      }
      return catAggById.get(key)!;
    };

    const needsPracticeCandidates: Array<{
      id: number;
      question: string;
      type: QuestionType;
      categoryName: string;
      timesAnswered: number;
      timesCorrect: number;
      streak: number;
      accuracy: number;
    }> = [];

    for (const row of rows) {
      totalQuestions += 1;
      const answered = row.timesAnswered ?? 0;
      const correct = row.timesCorrect ?? 0;
      const streak = row.streak ?? 0;
      totalAnswers += answered;
      totalCorrect += correct;
      if (answered > 0) attemptedQuestions += 1;
      if (streak >= 3) masteredQuestions += 1;

      const catKey = row.categoryId ?? null;
      const agg = ensureCat(catKey);
      agg.total += 1;
      agg.totalAnswers += answered;
      agg.totalCorrect += correct;
      if (answered > 0) agg.attempted += 1;

      if (answered > 0 && correct < answered) {
        const accuracy = correct / answered;
        const text = row.questionText ?? "";
        const trimmed = text.length > 120 ? text.slice(0, 117) + "…" : text;
        needsPracticeCandidates.push({
          id: row.questionId,
          question: trimmed,
          type: row.type as QuestionType,
          categoryName: row.categoryId ? (categoryNameById.get(row.categoryId) ?? "General") : "Verbs",
          timesAnswered: answered,
          timesCorrect: correct,
          streak,
          accuracy,
        });
      }
    }

    const totalIncorrect = totalAnswers - totalCorrect;
    const accuracy = totalAnswers > 0 ? totalCorrect / totalAnswers : 0;

    const byCategory = Array.from(catAggById.entries()).map(([key, agg]) => {
      const id = key === -1 ? null : (key as number);
      const name = id !== null ? (categoryNameById.get(id) ?? "Unknown") : "Verbs (Conjugation)";
      return {
        categoryId: id,
        categoryName: name,
        totalAnswers: agg.totalAnswers,
        totalCorrect: agg.totalCorrect,
        totalIncorrect: agg.totalAnswers - agg.totalCorrect,
        attemptedQuestions: agg.attempted,
        totalQuestions: agg.total,
      };
    }).sort((a, b) => b.totalAnswers - a.totalAnswers || a.categoryName.localeCompare(b.categoryName));

    needsPracticeCandidates.sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.timesAnswered - a.timesAnswered;
    });
    const needsPractice = needsPracticeCandidates.slice(0, 10);

    return {
      summary: {
        totalQuestions,
        attemptedQuestions,
        totalAnswers,
        totalCorrect,
        totalIncorrect,
        accuracy,
        masteredQuestions,
      },
      byCategory,
      needsPractice,
    };
  }
}

export class MemStorage implements IStorage {
  private questionStates: Map<string, QuestionStateMap>;

  constructor() {
    this.questionStates = new Map();
    
    questionBank.forEach((q) => {
      this.questionStates.set(q.id, { streak: 0, lastSeen: null });
    });
  }

  async getNextQuestion(): Promise<PublicQuestion> {
    const now = Date.now();
    
    const scoredQuestions = questionBank.map((q) => {
      const state = this.questionStates.get(q.id) || { streak: 0, lastSeen: null };
      
      let score = 100;
      score -= state.streak * 20;
      
      if (state.lastSeen) {
        const hoursSinceLastSeen = (now - state.lastSeen) / (1000 * 60 * 60);
        score += Math.min(hoursSinceLastSeen * 5, 50);
      } else {
        score += 30;
      }
      
      score += (3 - q.difficulty) * 10;
      score += Math.random() * 20;
      
      return { question: q, score };
    });
    
    scoredQuestions.sort((a, b) => b.score - a.score);
    
    return toPublicQuestion(scoredQuestions[0].question);
  }

  async submitAnswer(questionId: string, answer: string): Promise<{
    correct: boolean;
    correctAnswer: string;
    explanation: string;
    hint: string;
  }> {
    const question = questionBank.find(q => q.id === questionId);
    
    if (!question) {
      throw new Error("Question not found");
    }
    
    const isCorrect = checkAnswer(question, answer);
    const state = this.questionStates.get(questionId) || { streak: 0, lastSeen: null };
    
    if (isCorrect) {
      state.streak += 1;
    } else {
      state.streak = 0;
    }
    state.lastSeen = Date.now();
    this.questionStates.set(questionId, state);
    
    return {
      correct: isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      hint: question.hint,
    };
  }

  async getCategories(): Promise<Category[]> {
    return [];
  }

  async getConjugationPacks(): Promise<ConjugationPack[]> {
    return [];
  }

  async getSettings(): Promise<GameSettings> {
    return {
      id: 1,
      enabledQuestionTypes: ["mcq", "fill", "conjugation"],
      enabledProficiencyLevels: ["beginner"],
      enabledCategoryIds: [],
      enabledConjugationPackIds: [],
      enabledTenses: ["present", "imparfait", "passé_composé", "futur"],
      mazeWidth: 30,
      mazeHeight: 30,
      visibilityRadius: 1,
      revealRadius: 6,
      maxStepsOnCorrect: 3,
      autoGenerateQuestions: true,
      updatedAt: new Date(),
    };
  }

  async updateSettings(): Promise<GameSettings> {
    return this.getSettings();
  }

  async toggleCategory(): Promise<void> {}
  async toggleConjugationPack(): Promise<void> {}
  async getStats(): Promise<StatsResponse> {
    return {
      summary: {
        totalQuestions: 0,
        attemptedQuestions: 0,
        totalAnswers: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        accuracy: 0,
        masteredQuestions: 0,
      },
      byCategory: [],
      needsPractice: [],
    };
  }
}

export const storage = new DatabaseStorage();
