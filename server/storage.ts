import type { Question } from "@shared/schema";
import { questionBank, selectNextQuestion, checkAnswer, getQuestionById } from "./questionBank";

interface QuestionState {
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
}

export class MemStorage implements IStorage {
  private questionStates: Map<string, QuestionState>;

  constructor() {
    this.questionStates = new Map();
    
    questionBank.forEach((q) => {
      this.questionStates.set(q.id, { streak: 0, lastSeen: null });
    });
  }

  async getNextQuestion(): Promise<Question> {
    return selectNextQuestion(this.questionStates);
  }

  async submitAnswer(questionId: string, answer: string): Promise<{
    correct: boolean;
    correctAnswer: string;
    explanation: string;
    hint: string;
  }> {
    const question = getQuestionById(questionId);
    
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
}

export const storage = new MemStorage();
