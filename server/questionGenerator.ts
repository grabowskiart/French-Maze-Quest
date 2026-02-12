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
  const isVerbCategory = categoryName
    ? /\b(verb|conjugation)\b/i.test(categoryName)
    : false;

  const typePrompt = questionType 
    ? `Generate ${questionType} questions only.` 
    : isVerbCategory
      ? "Generate a mix of MCQ (multiple choice), fill-in-the-blank, and conjugation questions."
      : "Generate a mix of MCQ (multiple choice), fill-in-the-blank, and grammar questions. Do NOT generate conjugation questions.";
    
  const categoryPrompt = categoryName 
    ? `Focus on the category: ${categoryName}. All questions must be directly related to this category topic.` 
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
        if (validated.type === "conjugation" && !isVerbCategory) {
          console.warn("Skipping conjugation question generated for non-verb category");
          continue;
        }
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
  let assignedCategoryId: number | null = null;
  
  if (categoryId) {
    // Specific category requested
    const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    categoryName = category?.displayName;
    assignedCategoryId = categoryId;
  } else {
    // No specific category - get all active categories and pick randomly from them
    const activeCategories = await db.select().from(categories).where(eq(categories.isActive, true));
    
    if (activeCategories.length > 0) {
      // Create a comma-separated list of active category names for the prompt
      const categoryNames = activeCategories.map(c => c.displayName).join(", ");
      categoryName = categoryNames;
      
      // Pick a random category to assign the questions to
      const randomCategory = activeCategories[Math.floor(Math.random() * activeCategories.length)];
      assignedCategoryId = randomCategory.id;
    }
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
        categoryId: assignedCategoryId,
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

const tenseSchema = z.object({
  je: z.string(),
  tu: z.string(),
  il: z.string(),
  nous: z.string(),
  vous: z.string(),
  ils: z.string(),
});

const conjugationPackSchema = z.object({
  verbInfinitive: z.string(),
  verbEnglish: z.string(),
  group: z.number().min(1).max(3),
  conjugations: z.object({
    present: tenseSchema,
    imparfait: tenseSchema.optional(),
    "passé_composé": tenseSchema.optional(),
    futur: tenseSchema.optional(),
  }),
});

export async function generateConjugationPacks(count: number = 3): Promise<number> {
  const existingPacks = await db.select({ verbInfinitive: conjugationPacks.verbInfinitive }).from(conjugationPacks);
  const existingVerbs = existingPacks.map(p => p.verbInfinitive.toLowerCase());

  const prompt = `Generate ${count} French verb conjugation packs for the most commonly used French verbs that are NOT in this list: [${existingVerbs.join(", ")}].

Order them by frequency of usage in everyday French (most frequent first).

For each verb, provide:
- verbInfinitive: The verb in infinitive form (e.g., "pouvoir")
- verbEnglish: English translation (e.g., "to be able to/can")
- group: French verb group (1 for -er verbs, 2 for -ir verbs, 3 for irregular verbs)
- conjugations: Object with present, imparfait, passé_composé, and futur tenses
  - Each tense should have: je, tu, il, nous, vous, ils forms

Important:
- Only include verbs NOT already in the list above
- Order by real-world usage frequency (most common verbs first)
- Ensure all conjugations are accurate
- For passé composé, include the auxiliary verb (ai, as, a, avons, avez, ont OR suis, es, est, sommes, êtes, sont)

Return a JSON object with a "verbs" array containing the verb packs.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a French language expert. Generate accurate verb conjugations. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    const verbsArray = parsed.verbs || parsed;

    if (!Array.isArray(verbsArray)) {
      throw new Error("Response is not an array");
    }

    let savedCount = 0;
    const newPackIds: number[] = [];
    
    for (const verb of verbsArray) {
      try {
        const validated = conjugationPackSchema.parse(verb);
        
        if (existingVerbs.includes(validated.verbInfinitive.toLowerCase())) {
          console.log(`Skipping duplicate verb: ${validated.verbInfinitive}`);
          continue;
        }

        const [insertedPack] = await db.insert(conjugationPacks).values({
          verbInfinitive: validated.verbInfinitive,
          verbEnglish: validated.verbEnglish,
          group: validated.group,
          conjugations: validated.conjugations,
          isActive: true,
        }).returning({ id: conjugationPacks.id });
        
        if (insertedPack) {
          newPackIds.push(insertedPack.id);
        }
        
        existingVerbs.push(validated.verbInfinitive.toLowerCase());
        savedCount++;
      } catch (e) {
        console.warn("Skipping invalid conjugation pack:", e);
      }
    }

    // Automatically generate ALL conjugation questions for each new pack
    for (const packId of newPackIds) {
      try {
        const questionsGenerated = await generateConjugationQuestions(packId);
        console.log(`Generated ${questionsGenerated} conjugation questions for pack ${packId}`);
      } catch (e) {
        console.warn(`Failed to generate questions for pack ${packId}:`, e);
      }
    }

    return savedCount;
  } catch (error) {
    console.error("Error generating conjugation packs:", error);
    throw error;
  }
}

export async function generateConjugationQuestions(
  packId: number
): Promise<number> {
  const [pack] = await db.select().from(conjugationPacks).where(eq(conjugationPacks.id, packId)).limit(1);
  
  if (!pack) {
    throw new Error("Conjugation pack not found");
  }
  
  // Get the Conjugation category ID
  const [conjugationCategory] = await db.select().from(categories).where(eq(categories.name, "conjugation")).limit(1);
  const categoryId = conjugationCategory?.id || null;

  const conjugations = pack.conjugations as Conjugations;
  const pronounsMap = [
    { display: "je", key: "je" },
    { display: "tu", key: "tu" },
    { display: "il/elle", key: "il" },
    { display: "nous", key: "nous" },
    { display: "vous", key: "vous" },
    { display: "ils/elles", key: "ils" },
  ];
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
    categoryId: number | null;
    isGenerated: boolean;
    isActive: boolean;
  }> = [];

  // Generate ALL combinations of pronouns × tenses
  for (const tense of tenses) {
    const conjugation = conjugations[tense];
    if (!conjugation) continue;
    
    const tenseDisplay = tense === "passé_composé" ? "passé composé" : tense;
    
    for (const { display: pronoun, key: pronounKey } of pronounsMap) {
      const answer = conjugation[pronounKey as keyof typeof conjugation];
      if (!answer) continue;
      
      questionsToInsert.push({
        type: "conjugation",
        question: `Conjugate '${pack.verbInfinitive}' (${pack.verbEnglish}) for '${pronoun}' in ${tenseDisplay}`,
        correctAnswer: answer,
        hint: `Remember the ${tenseDisplay} conjugation pattern for ${pack.verbInfinitive}!`,
        explanation: `'${pronoun.charAt(0).toUpperCase() + pronoun.slice(1)} ${answer}' is the ${tenseDisplay} form of ${pack.verbInfinitive} (${pack.verbEnglish}).`,
        difficulty: tense === "present" ? 1 : 2,
        proficiencyLevel: tense === "present" ? "beginner" : "intermediate",
        conjugationPackId: packId,
        categoryId,
        isGenerated: true,
        isActive: true,
      });
    }
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
