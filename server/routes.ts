import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { answerSchema } from "@shared/schema";

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

  return httpServer;
}
