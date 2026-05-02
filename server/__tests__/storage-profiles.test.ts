import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";

import { db } from "../db";
import { DatabaseStorage } from "../storage";
import { registerRoutes } from "../routes";
import {
  categories,
  questions,
  questionStates,
  type DbQuestion,
  type Category,
} from "@shared/schema";

const TEST_CATEGORY_NAME = "test_profile_isolation_cat";
const TEST_QUESTION_MARKER = "__profile_isolation_test__";

const PROFILE_A = "profile-A-test";
const PROFILE_B = "profile-B-test";

let storage: DatabaseStorage;
let testCategory: Category;
let testQuestions: DbQuestion[];

async function deleteTestData() {
  if (testQuestions?.length) {
    const ids = testQuestions.map((q) => q.id);
    await db.delete(questionStates).where(inArray(questionStates.questionId, ids));
    await db.delete(questions).where(inArray(questions.id, ids));
  } else {
    const existingTestQs = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.question, TEST_QUESTION_MARKER));
    if (existingTestQs.length) {
      const ids = existingTestQs.map((r) => r.id);
      await db.delete(questionStates).where(inArray(questionStates.questionId, ids));
      await db.delete(questions).where(inArray(questions.id, ids));
    }
  }
  if (testCategory) {
    await db.delete(categories).where(eq(categories.id, testCategory.id));
  } else {
    await db.delete(categories).where(eq(categories.name, TEST_CATEGORY_NAME));
  }
}

async function clearTestQuestionStates() {
  if (!testQuestions?.length) return;
  const ids = testQuestions.map((q) => q.id);
  await db.delete(questionStates).where(inArray(questionStates.questionId, ids));
}

describe("DatabaseStorage profile isolation", () => {
  beforeAll(async () => {
    storage = new DatabaseStorage();

    // Best-effort cleanup of any leftover test rows from prior failed runs.
    // Order matters: question_states -> questions (FK to categories) -> categories.
    const leftoverQs = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.question, TEST_QUESTION_MARKER));
    if (leftoverQs.length) {
      const ids = leftoverQs.map((r) => r.id);
      await db.delete(questionStates).where(inArray(questionStates.questionId, ids));
      await db.delete(questions).where(inArray(questions.id, ids));
    }
    await db.delete(categories).where(eq(categories.name, TEST_CATEGORY_NAME));

    const [cat] = await db
      .insert(categories)
      .values({
        name: TEST_CATEGORY_NAME,
        displayName: "Profile Isolation Test",
        description: "test fixture",
        isActive: true,
      })
      .returning();
    testCategory = cat;

    const inserted = await db
      .insert(questions)
      .values([
        {
          type: "fill",
          question: TEST_QUESTION_MARKER,
          correctAnswer: "alpha",
          hint: "hint-a",
          explanation: "explanation-a",
          difficulty: 1,
          proficiencyLevel: "beginner",
          categoryId: testCategory.id,
          isActive: true,
        },
        {
          type: "fill",
          question: TEST_QUESTION_MARKER,
          correctAnswer: "beta",
          hint: "hint-b",
          explanation: "explanation-b",
          difficulty: 1,
          proficiencyLevel: "beginner",
          categoryId: testCategory.id,
          isActive: true,
        },
      ])
      .returning();
    testQuestions = inserted;
  });

  beforeEach(async () => {
    await clearTestQuestionStates();
  });

  afterAll(async () => {
    await deleteTestData();
  });

  it("submitAnswer with profile A and profile B records two independent rows", async () => {
    const q = testQuestions[0];

    await storage.submitAnswer(q.id.toString(), "alpha", PROFILE_A); // correct
    await storage.submitAnswer(q.id.toString(), "wrong", PROFILE_B); // incorrect

    const rows = await db
      .select()
      .from(questionStates)
      .where(eq(questionStates.questionId, q.id));

    expect(rows).toHaveLength(2);

    const aRow = rows.find((r) => r.profileId === PROFILE_A);
    const bRow = rows.find((r) => r.profileId === PROFILE_B);

    expect(aRow).toBeDefined();
    expect(bRow).toBeDefined();
    expect(aRow!.timesAnswered).toBe(1);
    expect(aRow!.timesCorrect).toBe(1);
    expect(aRow!.streak).toBe(1);
    expect(bRow!.timesAnswered).toBe(1);
    expect(bRow!.timesCorrect).toBe(0);
    expect(bRow!.streak).toBe(0);
    expect(aRow!.id).not.toBe(bRow!.id);

    // A second answer for profile A should update the same row, not create a third
    await storage.submitAnswer(q.id.toString(), "alpha", PROFILE_A);
    const rowsAfter = await db
      .select()
      .from(questionStates)
      .where(eq(questionStates.questionId, q.id));
    expect(rowsAfter).toHaveLength(2);
    const aRowAfter = rowsAfter.find((r) => r.profileId === PROFILE_A)!;
    expect(aRowAfter.timesAnswered).toBe(2);
    expect(aRowAfter.timesCorrect).toBe(2);
    expect(aRowAfter.streak).toBe(2);
  });

  it("submitAnswer with no profileId stores in the null bucket separately", async () => {
    const q = testQuestions[0];

    await storage.submitAnswer(q.id.toString(), "alpha", PROFILE_A);
    await storage.submitAnswer(q.id.toString(), "alpha", null);

    const rows = await db
      .select()
      .from(questionStates)
      .where(eq(questionStates.questionId, q.id));
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.profileId === PROFILE_A)).toBeDefined();
    expect(rows.find((r) => r.profileId === null)).toBeDefined();
  });

  it("getStats(A) excludes profile B's answers and vice versa", async () => {
    const q1 = testQuestions[0];
    const q2 = testQuestions[1];

    // Profile A: q1 correct twice, q2 wrong once
    await storage.submitAnswer(q1.id.toString(), "alpha", PROFILE_A);
    await storage.submitAnswer(q1.id.toString(), "alpha", PROFILE_A);
    await storage.submitAnswer(q2.id.toString(), "wrong", PROFILE_A);

    // Profile B: q2 correct once
    await storage.submitAnswer(q2.id.toString(), "beta", PROFILE_B);

    const statsA = await storage.getStats(PROFILE_A);
    const statsB = await storage.getStats(PROFILE_B);

    const testQIds = new Set(testQuestions.map((q) => q.id));
    const npA = statsA.needsPractice.filter((n) => testQIds.has(n.id));
    const npB = statsB.needsPractice.filter((n) => testQIds.has(n.id));

    // Profile A: q2 was answered once and missed -> should be in needsPractice
    expect(npA.find((n) => n.id === q2.id)).toBeDefined();
    expect(npA.find((n) => n.id === q2.id)!.timesAnswered).toBe(1);
    expect(npA.find((n) => n.id === q2.id)!.timesCorrect).toBe(0);
    // q1 was answered correctly twice, not in needsPractice
    expect(npA.find((n) => n.id === q1.id)).toBeUndefined();

    // Profile B should not see profile A's failed q2
    expect(npB.find((n) => n.id === q2.id)).toBeUndefined();
    expect(npB.find((n) => n.id === q1.id)).toBeUndefined();

    // Verify category aggregation reflects only the active profile's data
    const catStatA = statsA.byCategory.find((c) => c.categoryId === testCategory.id);
    const catStatB = statsB.byCategory.find((c) => c.categoryId === testCategory.id);
    expect(catStatA).toBeDefined();
    expect(catStatA!.totalAnswers).toBe(3); // 2 correct on q1 + 1 wrong on q2
    expect(catStatA!.totalCorrect).toBe(2);
    expect(catStatA!.attemptedQuestions).toBe(2);

    expect(catStatB).toBeDefined();
    expect(catStatB!.totalAnswers).toBe(1); // 1 correct on q2
    expect(catStatB!.totalCorrect).toBe(1);
    expect(catStatB!.attemptedQuestions).toBe(1);
  });

  it("resetStats(A) does not affect profile B or the null/aggregate bucket", async () => {
    const q1 = testQuestions[0];
    const q2 = testQuestions[1];

    await storage.submitAnswer(q1.id.toString(), "alpha", PROFILE_A);
    await storage.submitAnswer(q2.id.toString(), "beta", PROFILE_B);
    await storage.submitAnswer(q1.id.toString(), "alpha", null);

    await storage.resetStats(PROFILE_A);

    const rows = await db
      .select()
      .from(questionStates)
      .where(inArray(questionStates.questionId, [q1.id, q2.id]));

    const aRow = rows.find((r) => r.profileId === PROFILE_A);
    const bRow = rows.find((r) => r.profileId === PROFILE_B);
    const nullRow = rows.find((r) => r.profileId === null);

    expect(aRow).toBeDefined();
    // A's row should be zeroed out, but the row itself remains
    expect(aRow!.timesAnswered).toBe(0);
    expect(aRow!.timesCorrect).toBe(0);
    expect(aRow!.streak).toBe(0);
    expect(aRow!.lastSeen).toBeNull();

    // B's row should be untouched
    expect(bRow).toBeDefined();
    expect(bRow!.timesAnswered).toBe(1);
    expect(bRow!.timesCorrect).toBe(1);
    expect(bRow!.streak).toBe(1);

    // Null/aggregate bucket should be untouched too
    expect(nullRow).toBeDefined();
    expect(nullRow!.timesAnswered).toBe(1);
    expect(nullRow!.timesCorrect).toBe(1);
    expect(nullRow!.streak).toBe(1);
  });
});

describe("routes profileId validation", () => {
  let app: Express;
  let httpServer: Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    httpServer = createServer(app);
    await registerRoutes(httpServer, app);
  });

  it("GET /api/stats/:profileId returns 400 for an invalid profileId", async () => {
    const res = await request(app).get("/api/stats/has spaces!");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/stats/:profileId returns 400 for an over-long profileId", async () => {
    const tooLong = "a".repeat(65);
    const res = await request(app).get(`/api/stats/${tooLong}`);
    expect(res.status).toBe(400);
  });

  it("GET /api/questions/next/:profileId returns 400 for an invalid profileId", async () => {
    const res = await request(app).get("/api/questions/next/bad*id");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/questions/answer returns 400 for an invalid profileId", async () => {
    const res = await request(app)
      .post("/api/questions/answer")
      .send({ questionId: "1", answer: "x", profileId: "no spaces allowed" });
    expect(res.status).toBe(400);
  });

  it("POST /api/stats/reset returns 400 for an invalid profileId", async () => {
    const res = await request(app)
      .post("/api/stats/reset")
      .send({ profileId: "bad/id" });
    expect(res.status).toBe(400);
  });

  it("POST /api/stats/reset rejects a non-string profileId", async () => {
    const res = await request(app)
      .post("/api/stats/reset")
      .send({ profileId: 123 });
    expect(res.status).toBe(400);
  });
});
