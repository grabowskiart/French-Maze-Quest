import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { answerSchema, updateGameSettingsSchema, questionStates } from "@shared/schema";
import { z } from "zod";
import { generateAndSaveQuestions, generateConjugationQuestions, generateConjugationPacks, generateConjugationPackForVerb } from "./questionGenerator";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/questions/next", async (req, res) => {
    try {
      const question = await storage.getNextQuestion();
      res.json(question);
    } catch (error) {
      console.error("Error fetching next question:", error);
      res.status(500).json({ error: "Failed to fetch question" });
    }
  });

  app.post("/api/questions/answer", async (req, res) => {
    try {
      const parsed = answerSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      
      const { questionId, answer } = parsed.data;
      const result = await storage.submitAnswer(questionId, answer);
      
      res.json(result);
    } catch (error) {
      console.error("Error submitting answer:", error);
      res.status(500).json({ error: "Failed to submit answer" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const categoriesList = await storage.getCategories();
      res.json(categoriesList);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.patch("/api/categories/:id/toggle", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
      await storage.toggleCategory(id, isActive);
      res.json({ success: true });
    } catch (error) {
      console.error("Error toggling category:", error);
      res.status(500).json({ error: "Failed to toggle category" });
    }
  });

  app.get("/api/conjugation-packs", async (req, res) => {
    try {
      const packs = await storage.getConjugationPacks();
      res.json(packs);
    } catch (error) {
      console.error("Error fetching conjugation packs:", error);
      res.status(500).json({ error: "Failed to fetch conjugation packs" });
    }
  });

  app.patch("/api/conjugation-packs/:id/toggle", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
      await storage.toggleConjugationPack(id, isActive);
      res.json({ success: true });
    } catch (error) {
      console.error("Error toggling conjugation pack:", error);
      res.status(500).json({ error: "Failed to toggle conjugation pack" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const parsed = updateGameSettingsSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error });
      }
      
      const updatedSettings = await storage.updateSettings(parsed.data);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/questions/generate", async (req, res) => {
    try {
      const schema = z.object({
        count: z.number().min(1).max(20).default(5),
        categoryId: z.number().optional(),
        proficiencyLevel: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
        questionType: z.enum(["mcq", "fill", "conjugation", "grammar"]).optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      
      const { count, categoryId, proficiencyLevel, questionType } = parsed.data;
      const savedCount = await generateAndSaveQuestions(count, categoryId, proficiencyLevel, questionType);
      
      res.json({ success: true, generatedCount: savedCount });
    } catch (error) {
      console.error("Error generating questions:", error);
      res.status(500).json({ error: "Failed to generate questions" });
    }
  });

  app.post("/api/conjugation-packs/:id/generate", async (req, res) => {
    try {
      const packId = parseInt(req.params.id);
      // Generates ALL possible conjugation questions for the pack (all pronouns × all tenses)
      const savedCount = await generateConjugationQuestions(packId);
      res.json({ success: true, generatedCount: savedCount });
    } catch (error) {
      console.error("Error generating conjugation questions:", error);
      res.status(500).json({ error: "Failed to generate conjugation questions" });
    }
  });

  app.post("/api/conjugation-packs/add-verb", async (req, res) => {
    try {
      const schema = z.object({
        verb: z.string().trim().min(1, "Verb cannot be empty").max(100),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid verb input" });
      }
      const result = await generateConjugationPackForVerb(parsed.data.verb);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error adding verb pack:", error);
      res.status(500).json({ error: "Failed to add verb pack" });
    }
  });

  app.post("/api/conjugation-packs/generate", async (req, res) => {
    try {
      const schema = z.object({
        count: z.number().min(1).max(10).default(3),
      });
      
      const parsed = schema.safeParse(req.body);
      const count = parsed.success ? parsed.data.count : 3;
      
      const savedCount = await generateConjugationPacks(count);
      res.json({ success: true, generatedCount: savedCount });
    } catch (error) {
      console.error("Error generating conjugation packs:", error);
      res.status(500).json({ error: "Failed to generate conjugation packs" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  app.post("/api/stats/reset", async (_req, res) => {
    try {
      await db.update(questionStates).set({
        streak: 0,
        timesAnswered: 0,
        timesCorrect: 0,
        lastSeen: null,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting stats:", error);
      res.status(500).json({ error: "Failed to reset statistics" });
    }
  });

  return httpServer;
}
