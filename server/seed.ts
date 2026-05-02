import { db } from "./db";
import { categories, conjugationPacks, questions, gameSettings } from "@shared/schema";
import type { Conjugations } from "@shared/schema";
import { questionBank } from "./questionBank";

const initialCategories = [
  { name: "greetings", displayName: "Greetings", description: "Common French greetings and farewells", icon: "hand-wave" },
  { name: "colors", displayName: "Colors", description: "Learn colors in French", icon: "palette" },
  { name: "numbers", displayName: "Numbers", description: "Numbers 1-100 in French", icon: "hash" },
  { name: "animals", displayName: "Animals", description: "Common animals in French", icon: "paw-print" },
  { name: "food", displayName: "Food & Drinks", description: "Food and beverage vocabulary", icon: "utensils" },
  { name: "family", displayName: "Family", description: "Family member vocabulary", icon: "users" },
  { name: "verbs", displayName: "Verbs", description: "Common French verbs", icon: "zap" },
  { name: "conjugation", displayName: "Conjugation", description: "Verb conjugation practice", icon: "book-open" },
  { name: "politeness", displayName: "Politeness", description: "Polite expressions", icon: "heart" },
  { name: "basics", displayName: "Basics", description: "Essential French words", icon: "star" },
  { name: "objects", displayName: "Objects", description: "Common objects", icon: "box" },
  { name: "places", displayName: "Places", description: "Locations and buildings", icon: "map-pin" },
  { name: "nature", displayName: "Nature", description: "Nature vocabulary", icon: "tree" },
  { name: "people", displayName: "People", description: "People and professions", icon: "user" },
  { name: "introductions", displayName: "Introductions", description: "Introducing yourself", icon: "message-circle" },
  { name: "expressions", displayName: "Expressions", description: "Common expressions", icon: "speech" },
];

const categoryDisplayNameToKey: Record<string, string> = {
  "Greetings": "greetings",
  "Colors": "colors",
  "Numbers": "numbers",
  "Animals": "animals",
  "Food": "food",
  "Food & Drinks": "food",
  "Family": "family",
  "Verbs": "verbs",
  "Conjugation": "conjugation",
  "Politeness": "politeness",
  "Basics": "basics",
  "Objects": "objects",
  "Places": "places",
  "Nature": "nature",
  "People": "people",
  "Introductions": "introductions",
  "Expressions": "expressions",
};

const initialConjugationPacks: { verbInfinitive: string; verbEnglish: string; group: number; conjugations: Conjugations }[] = [
  {
    verbInfinitive: "être",
    verbEnglish: "to be",
    group: 3,
    conjugations: {
      present: { je: "suis", tu: "es", il: "est", nous: "sommes", vous: "êtes", ils: "sont" },
      passé_composé: { je: "ai été", tu: "as été", il: "a été", nous: "avons été", vous: "avez été", ils: "ont été" },
      imparfait: { je: "étais", tu: "étais", il: "était", nous: "étions", vous: "étiez", ils: "étaient" },
      futur: { je: "serai", tu: "seras", il: "sera", nous: "serons", vous: "serez", ils: "seront" },
    },
  },
  {
    verbInfinitive: "avoir",
    verbEnglish: "to have",
    group: 3,
    conjugations: {
      present: { je: "ai", tu: "as", il: "a", nous: "avons", vous: "avez", ils: "ont" },
      passé_composé: { je: "ai eu", tu: "as eu", il: "a eu", nous: "avons eu", vous: "avez eu", ils: "ont eu" },
      imparfait: { je: "avais", tu: "avais", il: "avait", nous: "avions", vous: "aviez", ils: "avaient" },
      futur: { je: "aurai", tu: "auras", il: "aura", nous: "aurons", vous: "aurez", ils: "auront" },
    },
  },
  {
    verbInfinitive: "aller",
    verbEnglish: "to go",
    group: 3,
    conjugations: {
      present: { je: "vais", tu: "vas", il: "va", nous: "allons", vous: "allez", ils: "vont" },
      passé_composé: { je: "suis allé", tu: "es allé", il: "est allé", nous: "sommes allés", vous: "êtes allés", ils: "sont allés" },
      imparfait: { je: "allais", tu: "allais", il: "allait", nous: "allions", vous: "alliez", ils: "allaient" },
      futur: { je: "irai", tu: "iras", il: "ira", nous: "irons", vous: "irez", ils: "iront" },
    },
  },
  {
    verbInfinitive: "faire",
    verbEnglish: "to do/make",
    group: 3,
    conjugations: {
      present: { je: "fais", tu: "fais", il: "fait", nous: "faisons", vous: "faites", ils: "font" },
      passé_composé: { je: "ai fait", tu: "as fait", il: "a fait", nous: "avons fait", vous: "avez fait", ils: "ont fait" },
      imparfait: { je: "faisais", tu: "faisais", il: "faisait", nous: "faisions", vous: "faisiez", ils: "faisaient" },
      futur: { je: "ferai", tu: "feras", il: "fera", nous: "ferons", vous: "ferez", ils: "feront" },
    },
  },
  {
    verbInfinitive: "manger",
    verbEnglish: "to eat",
    group: 1,
    conjugations: {
      present: { je: "mange", tu: "manges", il: "mange", nous: "mangeons", vous: "mangez", ils: "mangent" },
      passé_composé: { je: "ai mangé", tu: "as mangé", il: "a mangé", nous: "avons mangé", vous: "avez mangé", ils: "ont mangé" },
      imparfait: { je: "mangeais", tu: "mangeais", il: "mangeait", nous: "mangions", vous: "mangiez", ils: "mangeaient" },
      futur: { je: "mangerai", tu: "mangeras", il: "mangera", nous: "mangerons", vous: "mangerez", ils: "mangeront" },
    },
  },
  {
    verbInfinitive: "parler",
    verbEnglish: "to speak",
    group: 1,
    conjugations: {
      present: { je: "parle", tu: "parles", il: "parle", nous: "parlons", vous: "parlez", ils: "parlent" },
      passé_composé: { je: "ai parlé", tu: "as parlé", il: "a parlé", nous: "avons parlé", vous: "avez parlé", ils: "ont parlé" },
      imparfait: { je: "parlais", tu: "parlais", il: "parlait", nous: "parlions", vous: "parliez", ils: "parlaient" },
      futur: { je: "parlerai", tu: "parleras", il: "parlera", nous: "parlerons", vous: "parlerez", ils: "parleront" },
    },
  },
  {
    verbInfinitive: "finir",
    verbEnglish: "to finish",
    group: 2,
    conjugations: {
      present: { je: "finis", tu: "finis", il: "finit", nous: "finissons", vous: "finissez", ils: "finissent" },
      passé_composé: { je: "ai fini", tu: "as fini", il: "a fini", nous: "avons fini", vous: "avez fini", ils: "ont fini" },
      imparfait: { je: "finissais", tu: "finissais", il: "finissait", nous: "finissions", vous: "finissiez", ils: "finissaient" },
      futur: { je: "finirai", tu: "finiras", il: "finira", nous: "finirons", vous: "finirez", ils: "finiront" },
    },
  },
  {
    verbInfinitive: "venir",
    verbEnglish: "to come",
    group: 3,
    conjugations: {
      present: { je: "viens", tu: "viens", il: "vient", nous: "venons", vous: "venez", ils: "viennent" },
      passé_composé: { je: "suis venu", tu: "es venu", il: "est venu", nous: "sommes venus", vous: "êtes venus", ils: "sont venus" },
      imparfait: { je: "venais", tu: "venais", il: "venait", nous: "venions", vous: "veniez", ils: "venaient" },
      futur: { je: "viendrai", tu: "viendras", il: "viendra", nous: "viendrons", vous: "viendrez", ils: "viendront" },
    },
  },
];

async function seed() {
  console.log("Seeding database...");

  const existingCategories = await db.select().from(categories);
  if (existingCategories.length === 0) {
    console.log("Adding categories...");
    const insertedCategories = await db.insert(categories).values(initialCategories).returning();
    
    const categoryMap = new Map(insertedCategories.map(c => [c.name, c.id]));

    console.log("Adding questions from question bank...");
    // Single bulk INSERT instead of one round trip per question — orders of
    // magnitude faster on first-time database seeding.
    const questionRows = questionBank.map((q) => {
      const categoryKey = categoryDisplayNameToKey[q.category] || "basics";
      const categoryId = categoryMap.get(categoryKey) || categoryMap.get("basics");
      return {
        type: q.type,
        question: q.question,
        correctAnswer: q.correctAnswer,
        options: q.options,
        hint: q.hint,
        explanation: q.explanation,
        difficulty: q.difficulty,
        proficiencyLevel: q.proficiencyLevel,
        categoryId: categoryId,
        isGenerated: false,
        isActive: true,
      };
    });
    if (questionRows.length > 0) {
      await db.insert(questions).values(questionRows);
    }
    console.log(`Added ${questionBank.length} questions`);
  } else {
    console.log("Categories already exist, skipping category and question seeding");
  }

  const existingPacks = await db.select().from(conjugationPacks);
  if (existingPacks.length === 0) {
    console.log("Adding conjugation packs...");
    await db.insert(conjugationPacks).values(initialConjugationPacks);
    console.log(`Added ${initialConjugationPacks.length} conjugation packs`);
  } else {
    console.log("Conjugation packs already exist, skipping");
  }

  const existingSettings = await db.select().from(gameSettings);
  if (existingSettings.length === 0) {
    console.log("Creating default game settings...");
    await db.insert(gameSettings).values({
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
    });
    console.log("Default settings created");
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
