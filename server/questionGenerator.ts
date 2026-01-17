import OpenAI from "openai";
import { db } from "./db";
import { questions, categories, conjugationPacks } from "@shared/schema";
import type { QuestionType, ProficiencyLevel, Conjugations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const generatedQuestionSchema = z.object({
  type: z.enum(["mcq", "fill", "conjugation", "grammar"]),
  question: z.string(),
  correctAnswer: z.string(),
  options: z.array(z.string()).optional(),
  hint: z.string(),
  explanation: z.string(),
  difficulty: z.number().min(1).max(3),
});

type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export async function generateQuestions(
  count: number = 5,
  categoryName?: string,
  proficiencyLevel: ProficiencyLevel = "beginner",
  questionType?: QuestionType
): Promise<GeneratedQuestion[]> {
  const typePrompt = questionType 
    ? `Generate ${questionType} questions only.` 
    : "Generate a mix of MCQ (multiple choice), fill-in-the-blank, and conjugation questions.";
    
  const categoryPrompt = categoryName 
    ? `Focus on the category: ${categoryName}.` 
    : "Cover various vocabulary and grammar topics.";

  const levelDescriptions: Record<ProficiencyLevel, string> = {
    beginner: "Use simple vocabulary suitable for children learning basic French (numbers, colors, greetings, animals, family).",
    intermediate: "Use moderate vocabulary including common verbs, simple sentences, and basic grammar.",
    advanced: "Include complex grammar, verb tenses (passé composé, imparfait), and more sophisticated vocabulary.",
  };

  const prompt = `Generate ${count} French learning questions for ${proficiencyLevel} level students (primarily children ages 6-12).

${typePrompt}
${categoryPrompt}
${levelDescriptions[proficiencyLevel]}

For each question, provide:
- type: "mcq" (multiple choice), "fill" (fill in the blank), "conjugation", or "grammar"
- question: The question text in English asking about French
- correctAnswer: The correct answer
- options: For MCQ only, provide exactly 4 options including the correct answer
- hint: A helpful, encouraging hint for kids
- explanation: A clear, kid-friendly explanation of the answer
- difficulty: 1 (easy), 2 (medium), or 3 (hard)

Important rules:
- Make hints encouraging and age-appropriate
- Explanations should be clear and educational
- For MCQ, always include exactly 4 options
- For fill-in-blank, the correctAnswer should be a single word or short phrase
- For conjugation, ask about conjugating specific verbs for specific pronouns

Return a JSON array of question objects.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a French language teacher creating educational content for children. Generate engaging, age-appropriate French learning questions. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    const questionsArray = parsed.questions || parsed;
    
    if (!Array.isArray(questionsArray)) {
      throw new Error("Response is not an array");
    }

    const validatedQuestions: GeneratedQuestion[] = [];
    for (const q of questionsArray) {
      try {
        const validated = generatedQuestionSchema.parse(q);
        validatedQuestions.push(validated);
      } catch (e) {
        console.warn("Skipping invalid question:", e);
      }
    }

    return validatedQuestions;
  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
}

export async function generateAndSaveQuestions(
  count: number = 5,
  categoryId?: number,
  proficiencyLevel: ProficiencyLevel = "beginner",
  questionType?: QuestionType
): Promise<number> {
  let categoryName: string | undefined;
  if (categoryId) {
    const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    categoryName = category?.displayName;
  }

  const generated = await generateQuestions(count, categoryName, proficiencyLevel, questionType);
  
  let savedCount = 0;
  for (const q of generated) {
    try {
      await db.insert(questions).values({
        type: q.type,
        question: q.question,
        correctAnswer: q.correctAnswer,
        options: q.options || null,
        hint: q.hint,
        explanation: q.explanation,
        difficulty: q.difficulty,
        proficiencyLevel,
        categoryId: categoryId || null,
        isGenerated: true,
        isActive: true,
      });
      savedCount++;
    } catch (error) {
      console.error("Error saving question:", error);
    }
  }

  return savedCount;
}

export async function generateConjugationQuestions(
  packId: number,
  count: number = 6
): Promise<number> {
  const [pack] = await db.select().from(conjugationPacks).where(eq(conjugationPacks.id, packId)).limit(1);
  
  if (!pack) {
    throw new Error("Conjugation pack not found");
  }

  const conjugations = pack.conjugations as Conjugations;
  const pronouns = ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];
  const tenses = Object.keys(conjugations) as (keyof Conjugations)[];
  
  const questionsToInsert: Array<{
    type: QuestionType;
    question: string;
    correctAnswer: string;
    hint: string;
    explanation: string;
    difficulty: number;
    proficiencyLevel: ProficiencyLevel;
    conjugationPackId: number;
    isGenerated: boolean;
    isActive: boolean;
  }> = [];

  for (let i = 0; i < count && i < pronouns.length; i++) {
    const pronoun = pronouns[i];
    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    const conjugation = conjugations[tense];
    
    if (!conjugation) continue;
    
    const pronounKey = pronoun.replace("/elle", "").replace("/elles", "") as keyof typeof conjugation;
    const answer = conjugation[pronounKey];
    
    if (!answer) continue;
    
    const tenseDisplay = tense === "passé_composé" ? "passé composé" : tense;
    
    questionsToInsert.push({
      type: "conjugation",
      question: `Conjugate '${pack.verbInfinitive}' (${pack.verbEnglish}) for '${pronoun}' in ${tenseDisplay}`,
      correctAnswer: answer,
      hint: `Remember the ${tenseDisplay} conjugation pattern for ${pack.verbInfinitive}!`,
      explanation: `'${pronoun.charAt(0).toUpperCase() + pronoun.slice(1)} ${answer}' is the ${tenseDisplay} form of ${pack.verbInfinitive} (${pack.verbEnglish}).`,
      difficulty: tense === "present" ? 1 : 2,
      proficiencyLevel: tense === "present" ? "beginner" : "intermediate",
      conjugationPackId: packId,
      isGenerated: true,
      isActive: true,
    });
  }

  let savedCount = 0;
  for (const q of questionsToInsert) {
    try {
      await db.insert(questions).values(q);
      savedCount++;
    } catch (error) {
      console.error("Error saving conjugation question:", error);
    }
  }

  return savedCount;
}
