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
- **question_states**: Spaced repetition state (streak, last seen) — keyed by `(questionId, profileId)` so each child profile has its own per-question history. `profileId` is nullable for legacy/aggregated entries.
- **game_settings**: Configurable game settings (maze size, visibility, etc.)
- **ai_usage**: Per-visitor lifetime counter (`visitor_id` → `calls_used`) backing the 5-per-visitor cap on AI generation endpoints

## API Endpoints

### Questions
- `GET /api/questions/next/:profileId?` - Get the next question; spaced repetition uses the given profile's history (or aggregated when omitted)
- `POST /api/questions/answer` - Submit an answer (`{ questionId, answer, profileId? }`), returns result with feedback and records state under that profile

### Settings & Configuration
- `GET /api/settings` - Get current game settings
- `PATCH /api/settings` - Update game settings

### Statistics
- `GET /api/stats/:profileId?` - Answer statistics filtered by profile (or aggregated when omitted): overall summary, per-category correct/incorrect counts, and top 10 questions that need more practice
- `POST /api/stats/reset` - Reset question streaks/counts/last-seen; body `{ profileId? }` resets a single profile (or aggregated when omitted)

### Categories
- `GET /api/categories` - List all categories with enabled status
- `GET /api/categories/:id` - Get specific category

### Conjugation Packs
- `GET /api/conjugation-packs` - List all conjugation packs
- `PATCH /api/conjugation-packs/:id/toggle` - Toggle pack enabled status
- `POST /api/conjugation-packs/generate` - Generate new verb packs using OpenAI (ordered by frequency)

### Question Generation
- `POST /api/questions/generate` - Generate questions using OpenAI

### AI Usage Limits & Admin
- AI-powered generation endpoints are capped at **5 lifetime calls per browser visitor** to prevent OpenAI bill abuse from public visitors. The cap covers: `POST /api/questions/generate`, `POST /api/conjugation-packs/:id/generate`, `POST /api/conjugation-packs/generate`, and `POST /api/conjugation-packs/add-verb`. Gameplay endpoints are unaffected.
- Visitor identity is a signed `HttpOnly` cookie (`visitor_id`) issued automatically; the counter lives in the `ai_usage` table. Counts attempts (not successful generations).
- A parent can bypass the cap by entering the `ADMIN_PASSWORD` (env var) into the inline unlock form in the Parent Dashboard. Successful unlock sets a separate signed `admin` cookie on the same browser. Fails closed: if `ADMIN_PASSWORD` is unset, unlock always returns failure.
- The unlock endpoint is brute-force-protected: after 10 failed attempts on the same visitor cookie the endpoint locks out for 15 minutes (in-memory; resets on server restart).
- `GET /api/admin/usage` - returns `{ used, limit, isAdmin }` for the current visitor; issues the visitor cookie if missing.
- `POST /api/admin/unlock` - body `{ password }`; on success sets the admin cookie and returns `{ success: true }`. On failure returns 401 `{ success: false }`. After 10 failures returns 429 with a `Retry-After` header.

## Design System

- **Fonts:** Nunito (body), Fredoka (headings/display)
- **Colors:** Kid-friendly playful palette with purple primary, pink secondary, teal accent
- **Dark mode:** Fully supported with toggle in header
- **Animations:** Confetti on correct answers and winning, smooth transitions
- **Game art:** Painted dark-fantasy assets live under `client/public/images/`. Creature art under `creatures/`, maze textures and overlay sprites (wall, path, entrance/exit portals, player, heart, potion) under `maze/`, and per-weapon icons (one per `WEAPON_POOL` entry, looked up by name via `getWeaponImage` in `client/src/components/game/PickupIcon.tsx`) under `weapons/`.

## Running the Application

The application runs with `npm run dev` which starts both the Express server and Vite development server on port 5000.

## Parent Dashboard

Access the parent dashboard via the settings icon in the game header. Features:
- **Question Types:** Toggle MCQ, Fill-in, Conjugation, Grammar questions
- **Categories:** Enable/disable specific vocabulary categories
- **Levels:** Choose proficiency levels (Beginner, Elementary, etc.)
- **Conjugation:** Toggle which tenses to practice (Présent, Imparfait, Passé Composé, Futur), enable/disable verb conjugation packs, generate new verb packs, add specific verbs by name
- **Generate Questions:** AI-powered question generation by category and difficulty
- **Generate Verbs:** Add new verb conjugation packs ordered by frequency of usage, or add a specific verb (French or English)

## User Preferences

- Kid-friendly design prioritized
- Short sessions (5-10 minutes)
- Clear visual feedback for all actions
- Encouraging, supportive feedback messages
- Game progress is autosaved to browser localStorage so kids can resume after closing the tab; the start screen offers "Continue Adventure" when a saved run exists. The save is cleared on win.
- Non-boss creature HP scales with the player's distance toward the exit (1× at the entrance up to ~2× near the exit). The Dragon Warden boss is unaffected.
- Scaled creatures display a small kid-friendly difficulty badge ("Tough!", "Elite!", "Champion!" with star icons) in both the encounter status panel and the combat card when their HP is noticeably above base (≥1.3×, ≥1.6×, ≥1.9× respectively). Logic lives in `client/src/lib/creatures.ts` (`getCreatureDifficultyBadge`).

## Technical Notes

- Relations in Drizzle schema must be defined after all tables to avoid TDZ errors
- Category mapping in seed uses explicit displayName-to-key mapping
- Settings button uses browser history for back navigation
- OpenAI integration uses Replit AI Integrations - no user API key required
