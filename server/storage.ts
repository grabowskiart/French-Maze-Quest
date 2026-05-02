import type { Question, PublicQuestion, QuestionType, ProficiencyLevel, Category, ConjugationPack, GameSettings, DbQuestion, QuestionState as DbQuestionState, StatsResponse } from "@shared/schema";
import { categories, conjugationPacks, questions, questionStates, gameSettings } from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql, desc, asc, or, isNull } from "drizzle-orm";
import { questionBank, checkAnswer } from "./questionBank";

function profileMatches(column: typeof questionStates.profileId, profileId: string | null) {
  return profileId === null ? isNull(column) : eq(column, profileId);
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface QuestionStateMap {
  streak: number;
  lastSeen: number | null;
}

export interface IStorage {
  getNextQuestion(profileId?: string | null): Promise<PublicQuestion>;
  submitAnswer(questionId: string, answer: string, profileId?: string | null): Promise<{
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
  getStats(profileId?: string): Promise<StatsResponse>;
  resetStats(profileId?: string): Promise<void>;
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
  async getNextQuestion(profileId: string | null = null): Promise<PublicQuestion> {
    const settings = await this.getSettings();

    // Resolve default category / pack lists in parallel when settings don't
    // provide explicit selections — saves a round trip on every question fetch.
    const [enabledCategories, enabledConjPacks] = await Promise.all([
      settings.enabledCategoryIds?.length
        ? Promise.resolve(settings.enabledCategoryIds)
        : db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.isActive, true))
            .then((rows) => rows.map((c) => c.id)),
      settings.enabledConjugationPackIds?.length
        ? Promise.resolve(settings.enabledConjugationPackIds)
        : db
            .select({ id: conjugationPacks.id })
            .from(conjugationPacks)
            .where(eq(conjugationPacks.isActive, true))
            .then((rows) => rows.map((p) => p.id)),
    ]);

    const enabledTenses = settings.enabledTenses ?? ["present", "imparfait", "passé_composé", "futur"];

    // Push the spaced-repetition scoring into a single SQL query so we don't
    // have to ship every question + state row to the app and score in JS.
    // The DB computes the score per row, sorts by (in_cooldown, score) and
    // streams back just the winner, keeping latency flat as the bank grows.
    const minutesSinceLastSeen = sql<number>`EXTRACT(EPOCH FROM (now() - ${questionStates.lastSeen})) / 60`;

    const inCooldownExpr = sql<boolean>`(
      ${questionStates.lastSeen} IS NOT NULL
      AND ${questionStates.lastSeen} > now() - interval '60 seconds'
    )`;

    // Mirrors the previous JS scoring formula exactly.
    const scoreExpr = sql<number>`(
      100
      - COALESCE(${questionStates.streak}, 0) * 20
      + CASE
          WHEN ${questionStates.lastSeen} IS NULL THEN 80
          WHEN ${minutesSinceLastSeen} < 2 THEN -150
          WHEN ${minutesSinceLastSeen} < 5 THEN -80
          WHEN ${minutesSinceLastSeen} < 10 THEN -40
          ELSE LEAST(${minutesSinceLastSeen} / 60 * 10, 50)
        END
      + (3 - ${questions.difficulty}) * 10
      + random() * 100
    )`;

    const [row] = await db
      .select({
        question: questions,
        state: questionStates,
        categoryName: categories.displayName,
      })
      .from(questions)
      .leftJoin(
        questionStates,
        and(
          eq(questions.id, questionStates.questionId),
          profileMatches(questionStates.profileId, profileId),
        ),
      )
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
              : sql`true`,
          ),
          // Filter conjugation questions by enabled tenses; non-conjugation rows pass through
          or(
            sql`${questions.type} != 'conjugation'`,
            enabledTenses.length
              ? or(
                  inArray(questions.tense, enabledTenses),
                  isNull(questions.tense),
                )
              : sql`false`,
          ),
        ),
      )
      // Prefer non-cooldown rows (in_cooldown=false sorts before true), then
      // by descending score. If only cooldown rows exist, the best one is
      // still returned — matching the prior JS fallback behavior.
      .orderBy(asc(inCooldownExpr), desc(scoreExpr))
      .limit(1);

    if (!row) {
      return toPublicQuestion(questionBank[Math.floor(Math.random() * questionBank.length)]);
    }

    return toPublicQuestion(
      dbQuestionToQuestion(row.question, row.state, row.categoryName ?? undefined),
    );
  }

  async submitAnswer(questionId: string, answer: string, profileId: string | null = null): Promise<{
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

    const [existingState] = await db
      .select()
      .from(questionStates)
      .where(
        and(
          eq(questionStates.questionId, qId),
          profileMatches(questionStates.profileId, profileId),
        ),
      )
      .limit(1);
    
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
        profileId,
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

  async getStats(profileId?: string): Promise<StatsResponse> {
    // Push the aggregation into SQL: instead of pulling every active question
    // and every question_states row into Node and grouping in JS, let the DB
    // do the GROUP BY. Two parallel queries — one for per-category rollups
    // (which also yields the overall summary), one for the bottom-10 needs-
    // practice list — keep this endpoint flat as history grows.
    const profileFilter = profileId
      ? sql`profile_id = ${profileId}`
      : sql`true`;

    const [byCategoryResult, needsPracticeResult] = await Promise.all([
      db.execute<{
      category_id: number | null;
      category_name: string | null;
      total_questions: number;
      attempted_questions: number;
      total_answers: number;
      total_correct: number;
      mastered_questions: number;
    }>(sql`
      WITH agg AS (
        SELECT
          question_id,
          SUM(times_answered)::int AS times_answered,
          SUM(times_correct)::int AS times_correct,
          MAX(streak)::int AS max_streak
        FROM ${questionStates}
        WHERE ${profileFilter}
        GROUP BY question_id
      )
      SELECT
        q.category_id AS category_id,
        c.display_name AS category_name,
        COUNT(*)::int AS total_questions,
        COUNT(*) FILTER (WHERE COALESCE(a.times_answered, 0) > 0)::int AS attempted_questions,
        COALESCE(SUM(a.times_answered), 0)::int AS total_answers,
        COALESCE(SUM(a.times_correct), 0)::int AS total_correct,
        COUNT(*) FILTER (WHERE COALESCE(a.max_streak, 0) >= 3)::int AS mastered_questions
      FROM ${questions} q
      LEFT JOIN agg a ON a.question_id = q.id
      LEFT JOIN ${categories} c ON c.id = q.category_id
      WHERE q.is_active = true
      GROUP BY q.category_id, c.display_name
    `),
      db.execute<{
      id: number;
      question: string;
      type: string;
      category_id: number | null;
      category_name: string | null;
      times_answered: number;
      times_correct: number;
      max_streak: number;
      accuracy: number;
    }>(sql`
      WITH agg AS (
        SELECT
          question_id,
          SUM(times_answered)::int AS times_answered,
          SUM(times_correct)::int AS times_correct,
          MAX(streak)::int AS max_streak
        FROM ${questionStates}
        WHERE ${profileFilter}
        GROUP BY question_id
        HAVING SUM(times_answered) > 0 AND SUM(times_correct) < SUM(times_answered)
      )
      SELECT
        q.id AS id,
        q.question AS question,
        q.type AS type,
        q.category_id AS category_id,
        c.display_name AS category_name,
        a.times_answered AS times_answered,
        a.times_correct AS times_correct,
        a.max_streak AS max_streak,
        (a.times_correct::float / NULLIF(a.times_answered, 0)) AS accuracy
      FROM agg a
      JOIN ${questions} q ON q.id = a.question_id AND q.is_active = true
      LEFT JOIN ${categories} c ON c.id = q.category_id
      ORDER BY accuracy ASC, a.times_answered DESC, q.id ASC
      LIMIT 10
    `),
    ]);

    let totalQuestions = 0;
    let attemptedQuestions = 0;
    let totalAnswers = 0;
    let totalCorrect = 0;
    let masteredQuestions = 0;

    const byCategory = byCategoryResult.rows
      .map((r) => {
        const id = r.category_id ?? null;
        const name = id !== null
          ? (r.category_name ?? "Unknown")
          : "Verbs (Conjugation)";
        const catTotalQuestions = Number(r.total_questions);
        const catAttempted = Number(r.attempted_questions);
        const catAnswers = Number(r.total_answers);
        const catCorrect = Number(r.total_correct);
        const catMastered = Number(r.mastered_questions);

        totalQuestions += catTotalQuestions;
        attemptedQuestions += catAttempted;
        totalAnswers += catAnswers;
        totalCorrect += catCorrect;
        masteredQuestions += catMastered;

        return {
          categoryId: id,
          categoryName: name,
          totalAnswers: catAnswers,
          totalCorrect: catCorrect,
          totalIncorrect: catAnswers - catCorrect,
          attemptedQuestions: catAttempted,
          totalQuestions: catTotalQuestions,
        };
      })
      .sort((a, b) =>
        b.totalAnswers - a.totalAnswers || a.categoryName.localeCompare(b.categoryName),
      );

    const totalIncorrect = totalAnswers - totalCorrect;
    const accuracy = totalAnswers > 0 ? totalCorrect / totalAnswers : 0;

    const needsPractice = needsPracticeResult.rows.map((r) => {
      const text = r.question ?? "";
      const trimmed = text.length > 120 ? text.slice(0, 117) + "…" : text;
      const name = r.category_id !== null
        ? (r.category_name ?? "General")
        : "Verbs";
      return {
        id: Number(r.id),
        question: trimmed,
        type: r.type as QuestionType,
        categoryName: name,
        timesAnswered: Number(r.times_answered),
        timesCorrect: Number(r.times_correct),
        streak: Number(r.max_streak),
        accuracy: Number(r.accuracy),
      };
    });

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

  async resetStats(profileId?: string): Promise<void> {
    const update = db
      .update(questionStates)
      .set({
        streak: 0,
        timesAnswered: 0,
        timesCorrect: 0,
        lastSeen: null,
      });
    if (profileId) {
      await update.where(eq(questionStates.profileId, profileId));
    } else {
      await update;
    }
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

  async getNextQuestion(_profileId: string | null = null): Promise<PublicQuestion> {
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

  async submitAnswer(questionId: string, answer: string, _profileId: string | null = null): Promise<{
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
  async resetStats(_profileId: string | null = null): Promise<void> {
    for (const id of Array.from(this.questionStates.keys())) {
      this.questionStates.set(id, { streak: 0, lastSeen: null });
    }
  }
  async getStats(_profileId: string | null = null): Promise<StatsResponse> {
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
