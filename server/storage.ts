import type { Question, QuestionType, ProficiencyLevel, Category, ConjugationPack, GameSettings, DbQuestion, QuestionState as DbQuestionState } from "@shared/schema";
import { categories, conjugationPacks, questions, questionStates, gameSettings } from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql, desc, asc, or } from "drizzle-orm";
import { questionBank, checkAnswer } from "./questionBank";

interface QuestionStateMap {
  streak: number;
  lastSeen: number | null;
}

export interface IStorage {
  getNextQuestion(): Promise<Question>;
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

export class DatabaseStorage implements IStorage {
  async getNextQuestion(): Promise<Question> {
    const settings = await this.getSettings();
    const now = new Date();
    
    const enabledCategories = settings.enabledCategoryIds?.length 
      ? settings.enabledCategoryIds 
      : (await db.select({ id: categories.id }).from(categories).where(eq(categories.isActive, true))).map(c => c.id);
    
    const enabledConjPacks = settings.enabledConjugationPackIds?.length
      ? settings.enabledConjugationPackIds
      : (await db.select({ id: conjugationPacks.id }).from(conjugationPacks).where(eq(conjugationPacks.isActive, true))).map(p => p.id);
    
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
            ? inArray(questions.categoryId, enabledCategories)
            : sql`true`,
          or(
            sql`${questions.type} != 'conjugation'`,
            sql`${questions.conjugationPackId} IS NULL`,
            enabledConjPacks.length
              ? inArray(questions.conjugationPackId, enabledConjPacks)
              : sql`true`
          )
        )
      )
      .limit(50);

    if (dbQuestions.length === 0) {
      return questionBank[Math.floor(Math.random() * questionBank.length)];
    }

    const scoredQuestions = dbQuestions.map(row => {
      const q = row.questions;
      const state = row.question_states;
      let score = 100;
      
      score -= (state?.streak || 0) * 30;
      
      if (state?.lastSeen) {
        const minutesSinceLastSeen = (now.getTime() - state.lastSeen.getTime()) / (1000 * 60);
        if (minutesSinceLastSeen < 2) {
          score -= 200;
        } else if (minutesSinceLastSeen < 5) {
          score -= 100;
        } else if (minutesSinceLastSeen < 10) {
          score -= 50;
        } else {
          const hoursSinceLastSeen = minutesSinceLastSeen / 60;
          score += Math.min(hoursSinceLastSeen * 10, 50);
        }
      } else {
        score += 50;
      }
      
      score += (3 - q.difficulty) * 10;
      score += Math.random() * 40;
      
      return { 
        question: dbQuestionToQuestion(q, state, row.categories?.displayName),
        score 
      };
    });

    scoredQuestions.sort((a, b) => b.score - a.score);
    return scoredQuestions[0].question;
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
    
    const normalizedAnswer = answer.toLowerCase().trim();
    const normalizedCorrect = dbQuestion.correctAnswer.toLowerCase().trim();
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
      visibilityRadius: 4,
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
}

export class MemStorage implements IStorage {
  private questionStates: Map<string, QuestionStateMap>;

  constructor() {
    this.questionStates = new Map();
    
    questionBank.forEach((q) => {
      this.questionStates.set(q.id, { streak: 0, lastSeen: null });
    });
  }

  async getNextQuestion(): Promise<Question> {
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
    
    return scoredQuestions[0].question;
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
      mazeWidth: 30,
      mazeHeight: 30,
      visibilityRadius: 4,
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
}

export const storage = new DatabaseStorage();
