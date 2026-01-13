# French Maze Adventure

A kid-friendly web game where answering French questions reveals and navigates through a hidden maze. Designed for short learning sessions (5-10 minutes) with clear progress and minimal parent setup.

## Overview

This is an educational game that combines French language learning with maze exploration. Players answer French vocabulary, conjugation, and fill-in-the-blank questions to earn rewards that help them navigate through a fog-of-war maze.

## Core Game Mechanics

### Game Loop
1. Player starts at the Entrance tile
2. Each turn, player answers 1 French question
3. **If correct:** Player chooses a reward:
   - **Move:** Take up to 3 steps through the maze
   - **Reveal:** Reveal tiles within 5 steps radius
4. **If incorrect:** Show explanation + correct answer, reveal 1 tile nearby
5. **Win condition:** Reach the Exit tile

### Maze System
- 15x15 grid with walls generated using randomized DFS algorithm
- Fog-of-war: Only nearby tiles (radius 2) are visible
- Tile types: wall, path, entrance, exit
- Fog states: hidden, seen, visible

### Question System
- 30 French questions in the bank
- Types: Multiple Choice (MCQ), Fill-in, Conjugation
- Categories: Greetings, Colors, Numbers, Animals, Verbs, etc.
- Simple spaced repetition prioritizes questions with low streak and not recently seen

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
│   │   │   └── Game.tsx    # Main game page with all game logic
│   │   └── App.tsx
├── server/                  # Express backend
│   ├── questionBank.ts     # 30 French questions with spaced repetition
│   ├── storage.ts          # In-memory storage for question states
│   └── routes.ts           # API endpoints
├── shared/
│   └── schema.ts           # TypeScript types and Zod schemas
└── design_guidelines.md    # Design system documentation
```

## API Endpoints

- `GET /api/questions/next` - Get the next question (uses spaced repetition)
- `POST /api/questions/answer` - Submit an answer, returns result with feedback

## Design System

- **Fonts:** Nunito (body), Fredoka (headings/display)
- **Colors:** Kid-friendly playful palette with purple primary, pink secondary, teal accent
- **Dark mode:** Fully supported with toggle in header
- **Animations:** Confetti on correct answers and winning, smooth transitions

## Running the Application

The application runs with `npm run dev` which starts both the Express server and Vite development server on port 5000.

## User Preferences

- Kid-friendly design prioritized
- Short sessions (5-10 minutes)
- Clear visual feedback for all actions
- Encouraging, supportive feedback messages
