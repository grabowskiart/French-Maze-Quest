import type { Request, Response, NextFunction } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import * as cookie from "cookie";
import * as cookieSignature from "cookie-signature";
import { storage } from "./storage";
import { AI_USAGE_LIMIT } from "@shared/schema";

const VISITOR_COOKIE = "visitor_id";
const ADMIN_COOKIE = "admin";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set for AI rate limiting");
  }
  return secret;
}

function readSignedCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  let parsed: Record<string, string | undefined>;
  try {
    parsed = cookie.parse(header);
  } catch {
    return null;
  }
  const raw = parsed[name];
  if (!raw) return null;
  const unsigned = cookieSignature.unsign(raw, getSecret());
  return unsigned === false ? null : unsigned;
}

function writeSignedCookie(res: Response, name: string, value: string, maxAgeSeconds: number) {
  const signed = cookieSignature.sign(value, getSecret());
  const isProd = process.env.NODE_ENV === "production";
  const serialized = cookie.serialize(name, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: maxAgeSeconds,
  });
  // Append to any existing Set-Cookie headers so we can issue both visitor + admin cookies if needed.
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", serialized);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, serialized]);
  } else {
    res.setHeader("Set-Cookie", [String(existing), serialized]);
  }
}

/**
 * Returns the visitor id from the signed cookie, or issues a new one and
 * writes the Set-Cookie header. Always returns a valid id.
 */
export function ensureVisitorId(req: Request, res: Response): string {
  const existing = readSignedCookie(req, VISITOR_COOKIE);
  if (existing) return existing;
  const fresh = randomBytes(24).toString("base64url"); // ~32 chars, fits within varchar(64)
  writeSignedCookie(res, VISITOR_COOKIE, fresh, ONE_YEAR_SECONDS);
  return fresh;
}

export function isAdmin(req: Request): boolean {
  const value = readSignedCookie(req, ADMIN_COOKIE);
  return value === "1";
}

/**
 * Compares a candidate password against ADMIN_PASSWORD in constant time.
 * Fails closed: returns false if the env var is unset or empty.
 */
export function verifyAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length === 0) return false;
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Still do a constant-time compare against b to avoid leaking length via timing.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function setAdminCookie(res: Response) {
  writeSignedCookie(res, ADMIN_COOKIE, "1", ONE_YEAR_SECONDS);
}

/**
 * Brute-force protection for /api/admin/unlock. In-memory per-visitor counter
 * with a temporary lockout. Resets on server restart, which is fine for our
 * scope (the goal is to slow online guessing, not survive process crashes).
 */
const UNLOCK_MAX_ATTEMPTS = 10;
const UNLOCK_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const unlockAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkUnlockRateLimit(visitorId: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = unlockAttempts.get(visitorId);
  if (entry && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

export function recordUnlockFailure(visitorId: string): void {
  const now = Date.now();
  const entry = unlockAttempts.get(visitorId);
  if (!entry || entry.lockedUntil <= now) {
    unlockAttempts.set(visitorId, { count: 1, lockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= UNLOCK_MAX_ATTEMPTS) {
    entry.lockedUntil = now + UNLOCK_LOCKOUT_MS;
  }
  unlockAttempts.set(visitorId, entry);
}

export function clearUnlockFailures(visitorId: string): void {
  unlockAttempts.delete(visitorId);
}

/**
 * Express middleware that enforces a 5-per-visitor lifetime cap on the
 * downstream AI generation endpoint. Admin cookie bypasses the cap entirely.
 * Counts attempts (not successful generations) so a flaky OpenAI call still
 * burns one of the 5 tries — keeps the gate simple and abuse-resistant.
 */
export async function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (isAdmin(req)) {
      return next();
    }
    const visitorId = ensureVisitorId(req, res);
    const result = await storage.tryConsumeAiUsage(visitorId, AI_USAGE_LIMIT);
    if (!result.allowed) {
      return res.status(429).json({
        error: "ai_limit_reached",
        used: result.used,
        limit: AI_USAGE_LIMIT,
      });
    }
    next();
  } catch (error) {
    console.error("AI rate limit middleware error:", error);
    res.status(500).json({ error: "Failed to verify AI usage" });
  }
}
