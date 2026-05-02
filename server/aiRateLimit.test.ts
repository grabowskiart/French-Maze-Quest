import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Server } from "http";
import { createServer } from "http";

vi.mock("./questionGenerator", () => ({
  generateAndSaveQuestions: vi.fn(async () => 0),
  generateConjugationQuestions: vi.fn(async () => 0),
  generateConjugationPacks: vi.fn(async () => 0),
  generateConjugationPackForVerb: vi.fn(async () => ({
    verbInfinitive: null,
    questionsGenerated: 0,
    alreadyExists: true,
  })),
}));

const { memStorage } = vi.hoisted(() => {
  // Lazy holder; populated in beforeAll once dynamic import is allowed.
  return { memStorage: { instance: null as any } };
});

vi.mock("./storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  if (!memStorage.instance) {
    memStorage.instance = new actual.MemStorage();
  }
  return {
    ...actual,
    storage: memStorage.instance,
  };
});

const ORIGINAL_ENV = { ...process.env };
process.env.SESSION_SECRET = "test-session-secret-please-do-not-use-in-prod";
process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";

let app: express.Express;
let httpServer: Server;

beforeAll(async () => {
  const { registerRoutes } = await import("./routes");
  app = express();
  app.use(express.json());
  httpServer = createServer(app);
  await registerRoutes(httpServer, app);
});

afterAll(() => {
  httpServer.close();
  process.env = { ...ORIGINAL_ENV };
});

beforeEach(() => {
  // Reset in-memory counter on the singleton MemStorage between tests.
  memStorage.instance.aiUsageMap = new Map();
  process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
});

function getCookies(res: request.Response): string[] {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

function cookieHeader(cookies: string[]): string {
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

describe("AI rate limit + admin unlock", () => {
  it("issues a visitor cookie on /api/admin/usage and starts at 0", async () => {
    const res = await request(app).get("/api/admin/usage");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ used: 0, limit: 5, isAdmin: false });
    const cookies = getCookies(res);
    expect(cookies.some((c) => c.startsWith("visitor_id="))).toBe(true);
  });

  it("counts attempts even when downstream Zod validation fails", async () => {
    const initial = await request(app).get("/api/admin/usage");
    const cookies = cookieHeader(getCookies(initial));

    for (let i = 1; i <= 5; i += 1) {
      const res = await request(app)
        .post("/api/questions/generate")
        .set("Cookie", cookies)
        .send({ count: -1, proficiencyLevel: "beginner" });
      expect(res.status).toBe(400);
    }

    const usage = await request(app).get("/api/admin/usage").set("Cookie", cookies);
    expect(usage.body).toEqual({ used: 5, limit: 5, isAdmin: false });
  });

  it("returns 429 with structured body on the 6th attempt", async () => {
    const initial = await request(app).get("/api/admin/usage");
    const cookies = cookieHeader(getCookies(initial));

    for (let i = 1; i <= 5; i += 1) {
      await request(app)
        .post("/api/questions/generate")
        .set("Cookie", cookies)
        .send({ count: -1, proficiencyLevel: "beginner" });
    }

    const sixth = await request(app)
      .post("/api/questions/generate")
      .set("Cookie", cookies)
      .send({ count: -1, proficiencyLevel: "beginner" });
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ error: "ai_limit_reached", used: 5, limit: 5 });
  });

  it("isolates counters per visitor cookie", async () => {
    const visitorA = await request(app).get("/api/admin/usage");
    const visitorB = await request(app).get("/api/admin/usage");
    const cookiesA = cookieHeader(getCookies(visitorA));
    const cookiesB = cookieHeader(getCookies(visitorB));
    expect(cookiesA).not.toEqual(cookiesB);

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post("/api/questions/generate")
        .set("Cookie", cookiesA)
        .send({ count: -1, proficiencyLevel: "beginner" });
    }

    const usageA = await request(app).get("/api/admin/usage").set("Cookie", cookiesA);
    const usageB = await request(app).get("/api/admin/usage").set("Cookie", cookiesB);
    expect(usageA.body.used).toBe(5);
    expect(usageB.body.used).toBe(0);
  });

  it("rejects wrong admin password with 401 and does not set admin cookie", async () => {
    const initial = await request(app).get("/api/admin/usage");
    const cookies = cookieHeader(getCookies(initial));

    const res = await request(app)
      .post("/api/admin/unlock")
      .set("Cookie", cookies)
      .send({ password: "definitely-wrong" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false });

    const adminCookies = getCookies(res);
    expect(adminCookies.some((c) => c.startsWith("admin="))).toBe(false);
  });

  it("accepts correct admin password, sets admin cookie, and bypasses the cap", async () => {
    const initial = await request(app).get("/api/admin/usage");
    const baseCookies = cookieHeader(getCookies(initial));

    // Burn the limit first.
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post("/api/questions/generate")
        .set("Cookie", baseCookies)
        .send({ count: -1, proficiencyLevel: "beginner" });
    }
    const blocked = await request(app)
      .post("/api/questions/generate")
      .set("Cookie", baseCookies)
      .send({ count: -1, proficiencyLevel: "beginner" });
    expect(blocked.status).toBe(429);

    const unlock = await request(app)
      .post("/api/admin/unlock")
      .set("Cookie", baseCookies)
      .send({ password: "correct-horse-battery-staple" });
    expect(unlock.status).toBe(200);
    expect(unlock.body).toEqual({ success: true });
    const adminCookieLine = getCookies(unlock).find((c) => c.startsWith("admin="));
    expect(adminCookieLine).toBeDefined();

    const combined = cookieHeader([...getCookies(initial), adminCookieLine!]);
    const bypass = await request(app)
      .post("/api/questions/generate")
      .set("Cookie", combined)
      .send({ count: -1, proficiencyLevel: "beginner" });
    // Bypassed the rate limit; Zod still rejects with 400 (NOT 429).
    expect(bypass.status).toBe(400);

    const usageAfter = await request(app)
      .get("/api/admin/usage")
      .set("Cookie", combined);
    expect(usageAfter.body).toEqual({ used: 0, limit: 5, isAdmin: true });
  });

  it("fails closed: ignores admin cookie if ADMIN_PASSWORD is unset", async () => {
    const initial = await request(app).get("/api/admin/usage");
    const baseCookies = cookieHeader(getCookies(initial));

    const unlock = await request(app)
      .post("/api/admin/unlock")
      .set("Cookie", baseCookies)
      .send({ password: "correct-horse-battery-staple" });
    expect(unlock.status).toBe(200);
    const adminCookieLine = getCookies(unlock).find((c) => c.startsWith("admin="))!;
    const combined = cookieHeader([...getCookies(initial), adminCookieLine]);

    // Sanity: admin works while password is set.
    const usageWithPw = await request(app)
      .get("/api/admin/usage")
      .set("Cookie", combined);
    expect(usageWithPw.body.isAdmin).toBe(true);

    // Now remove the password — admin cookie must be ignored.
    delete process.env.ADMIN_PASSWORD;

    const usageNoPw = await request(app)
      .get("/api/admin/usage")
      .set("Cookie", combined);
    expect(usageNoPw.body.isAdmin).toBe(false);

    // Burn the limit and confirm gate enforces.
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post("/api/questions/generate")
        .set("Cookie", combined)
        .send({ count: -1, proficiencyLevel: "beginner" });
    }
    const sixth = await request(app)
      .post("/api/questions/generate")
      .set("Cookie", combined)
      .send({ count: -1, proficiencyLevel: "beginner" });
    expect(sixth.status).toBe(429);

    // Unlock attempt also fails closed.
    const unlockNoPw = await request(app)
      .post("/api/admin/unlock")
      .set("Cookie", combined)
      .send({ password: "correct-horse-battery-staple" });
    expect(unlockNoPw.status).toBe(401);
  });

  it("locks out /api/admin/unlock after 10 failed attempts with Retry-After", async () => {
    const initial = await request(app).get("/api/admin/usage");
    const cookies = cookieHeader(getCookies(initial));

    for (let i = 0; i < 9; i += 1) {
      const r = await request(app)
        .post("/api/admin/unlock")
        .set("Cookie", cookies)
        .send({ password: "wrong" });
      expect(r.status).toBe(401);
    }
    // 10th wrong attempt: still 401 but triggers the lockout.
    const tenth = await request(app)
      .post("/api/admin/unlock")
      .set("Cookie", cookies)
      .send({ password: "wrong" });
    expect(tenth.status).toBe(401);

    // 11th attempt (now locked out): 429 with Retry-After.
    const locked = await request(app)
      .post("/api/admin/unlock")
      .set("Cookie", cookies)
      .send({ password: "correct-horse-battery-staple" });
    expect(locked.status).toBe(429);
    expect(locked.body).toEqual({ success: false, error: "too_many_attempts" });
    expect(locked.headers["retry-after"]).toBeDefined();
  });
});
