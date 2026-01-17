# French Maze Adventure

A kid-friendly web game where answering French questions reveals and navigates through a hidden maze. Designed for short learning sessions (5-10 minutes) with clear progress and minimal parent setup.

## Overview

This is an educational game that combines French language learning with maze exploration. Players answer French vocabulary, conjugation, and fill-in-the-blank questions to earn rewards that help them navigate through a fog-of-war maze.

## Core Game Mechanics

### Game Loop
1. Player starts at the Entrance tile
2. Each turn, player answers 1 French question
3. **If correct:** Player chooses a reward:
   - **Move:** Take up to 3 steps through the maze (configurable)
   - **Reveal:** Reveal tiles within configurable radius
4. **If incorrect:** Show explanation + correct answer, reveal 1 tile nearby
5. **Win condition:** Reach the Exit tile

### Maze System
- 30x30 grid with walls generated using randomized DFS algorithm (configurable size)
- Fog-of-war: Only nearby tiles (radius 4) are visible (configurable)
- Tile types: wall, path, entrance, exit
- Fog states: hidden, seen, visible
- Smaller tiles with thinner walls for better gameplay experience
- Dynamic viewport (11 tiles visible at once)

### Question System
- Database-backed question storage with PostgreSQL
- Types: Multiple Choice (MCQ), Fill-in, Conjugation, Grammar
- Categories: Greetings, Colors, Numbers, Animals, Food, Family, Days/Months, Verbs, Body Parts, Introductions
- Proficiency levels: Beginner, Elementary, Intermediate, Advanced
- Conjugation packs for verb groups (être, avoir, aller, faire, manger, parler, finir, venir)
- Spaced repetition algorithm prioritizes questions with low streak and not recently seen
- OpenAI integration for dynamic question generation (uses Replit AI Integrations - no API key needed)

## Project Structure

```
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── game/       # Game-specific components
│   │   │   │   ├── GameHeader.tsx
│   │   │   │   ├── MazeGrid.tsx
│   │   │   │   ├── QuestionPanel.tsx
│   │   │   │   ├── FeedbackModal.tsx
│   │   │   │   ├── RewardChoice.tsx
│   │   │   │   ├── WinScreen.tsx
│   │   │   │   └── StartScreen.tsx
│   │   │   ├── ui/         # Shadcn UI components
│   │   │   └── ThemeProvider.tsx
│   │   ├── lib/
│   │   │   ├── mazeGenerator.ts  # Maze generation and visibility logic
│   │   │   └── queryClient.ts
│   │   ├── pages/
│   │   │   ├── Game.tsx    # Main game page with all game logic
│   │   │   └── Dashboard.tsx # Parent dashboard for configuration
│   │   └── App.tsx
├── server/                  # Express backend
│   ├── questionGenerator.ts # OpenAI-powered question generation
│   ├── seed.ts             # Database seeding with initial data
│   ├── storage.ts          # DatabaseStorage class with CRUD operations
│   └── routes.ts           # API endpoints
├── shared/
│   └── schema.ts           # TypeScript types, Zod schemas, and Drizzle schema
└── design_guidelines.md    # Design system documentation
```

## Database Schema

- **categories**: Question categories (Greetings, Colors, etc.)
- **questions**: French questions with type, difficulty, category, correct answer
- **conjugation_packs**: Verb conjugation packs (être, avoir, etc.)
- **question_states**: Spaced repetition state (streak, last seen)
- **game_settings**: Configurable game settings (maze size, visibility, etc.)

## API Endpoints

### Questions
- `GET /api/questions/next` - Get the next question (uses spaced repetition)
- `POST /api/questions/answer` - Submit an answer, returns result with feedback

### Settings & Configuration
- `GET /api/settings` - Get current game settings
- `PATCH /api/settings` - Update game settings

### Categories
- `GET /api/categories` - List all categories with enabled status
- `GET /api/categories/:id` - Get specific category

### Conjugation Packs
- `GET /api/conjugation-packs` - List all conjugation packs
- `PATCH /api/conjugation-packs/:id/toggle` - Toggle pack enabled status
- `POST /api/conjugation-packs/generate` - Generate new verb packs using OpenAI (ordered by frequency)

### Question Generation
- `POST /api/questions/generate` - Generate questions using OpenAI

## Design System

- **Fonts:** Nunito (body), Fredoka (headings/display)
- **Colors:** Kid-friendly playful palette with purple primary, pink secondary, teal accent
- **Dark mode:** Fully supported with toggle in header
- **Animations:** Confetti on correct answers and winning, smooth transitions

## Running the Application

The application runs with `npm run dev` which starts both the Express server and Vite development server on port 5000.

## Parent Dashboard

Access the parent dashboard via the settings icon in the game header. Features:
- **Question Types:** Toggle MCQ, Fill-in, Conjugation, Grammar questions
- **Categories:** Enable/disable specific vocabulary categories
- **Levels:** Choose proficiency levels (Beginner, Elementary, etc.)
- **Conjugation:** Enable/disable verb conjugation packs, generate new verb packs
- **Generate Questions:** AI-powered question generation by category and difficulty
- **Generate Verbs:** Add new verb conjugation packs ordered by frequency of usage

## User Preferences

- Kid-friendly design prioritized
- Short sessions (5-10 minutes)
- Clear visual feedback for all actions
- Encouraging, supportive feedback messages
- Game state is ephemeral - navigating away resets the game

## Technical Notes

- Relations in Drizzle schema must be defined after all tables to avoid TDZ errors
- Category mapping in seed uses explicit displayName-to-key mapping
- Settings button uses browser history for back navigation
- OpenAI integration uses Replit AI Integrations - no user API key required
