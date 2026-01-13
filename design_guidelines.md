# French Maze Game - Design Guidelines

## Design Approach

**Reference-Based Approach** drawing from successful educational games:
- **Duolingo**: Gamification patterns, progress streaks, encouraging feedback
- **Khan Academy Kids**: Kid-friendly visual language, clear CTAs, reward systems
- **Monument Valley**: Clean geometric aesthetics, calming puzzle atmosphere
- **Pokémon Games**: Fog-of-war exploration, discovery rewards

**Core Principles:**
- Playful without overwhelming
- Immediate visual feedback for every action
- Encourage exploration and learning through delight
- Large, touch-friendly interface elements
- High contrast for young readers

---

## Typography

**Font Families:**
- Primary (UI/Questions): Nunito (Google Fonts) - rounded, friendly, highly legible
- Secondary (Headings/Rewards): Fredoka One (Google Fonts) - playful, celebratory

**Hierarchy:**
- Headings: 32-40px, Fredoka One, bold
- Questions: 24-28px, Nunito, 600 weight
- Body/Answers: 18-20px, Nunito, 400 weight
- Feedback text: 16-18px, Nunito, 400-600 weight
- UI labels: 14-16px, Nunito, 500 weight

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16**
- Consistent padding: p-4 (small), p-8 (medium), p-12 (large)
- Gaps between elements: gap-4 for tight grouping, gap-8 for sections
- Margins for separation: mb-6, mt-8 for content flow

**Grid Structure:**
- Game container: max-w-6xl centered
- Two-column desktop layout (60/40 split): Maze area (left) + Question panel (right)
- Single column mobile: Question panel stacks above maze
- Maze grid: Square tiles, responsive sizing (maintains aspect ratio)

---

## Component Library

### 1. Game Header
- **Layout:** Full-width bar with rounded bottom corners
- **Elements:**
  - Left: Game logo/title with small French flag icon (Heroicons)
  - Center: Progress indicator (current session time or question count)
  - Right: Streak counter with flame icon, settings button
- **Structure:** Flex container, space-between, p-4, sticky top-0

### 2. Maze Grid
- **Container:** Aspect-ratio square, shadow-2xl, rounded-2xl, overflow-hidden
- **Tiles:** Individual divs in CSS Grid
  - Wall tiles: Solid fill with subtle texture pattern
  - Path tiles: Lighter fill with soft shadow
  - Entrance: Star/door icon (Heroicons - home)
  - Exit: Trophy icon (Heroicons - trophy)
  - Player: Animated character avatar (circle with simple face or beret icon)
  - Fog: Semi-transparent overlay with gradient fade
- **Visible tiles:** Bright, crisp
- **Seen tiles:** Slightly desaturated
- **Hidden tiles:** Dark overlay with subtle pattern

### 3. Question Panel
- **Container:** Rounded-3xl card with shadow-xl, p-8
- **Structure:**
  - Question text area (large, centered)
  - Answer options (for MCQ): Grid of 2 columns, gap-4
    - Each option: Rounded-xl button, min-h-20, text-lg, hover lift effect
  - Fill-in input: Large rounded-xl text input, text-center, text-2xl
  - Submit button: Large, prominent, rounded-full, px-12 py-4

### 4. Feedback Modal/Overlay
- **Correct Answer:**
  - Large checkmark icon (Heroicons - check-circle), animated scale-in
  - "Correct!" heading in Fredoka One
  - Brief explanation text
  - Reward choice buttons: "Move Up to 3" vs "Reveal 5 Tiles" (side-by-side, icons included)
- **Incorrect Answer:**
  - Gentle X icon (Heroicons - x-circle), soft bounce animation
  - "Not quite!" friendly heading
  - Correct answer display with arrow icon
  - Quick tip in smaller text
  - "Continue" button

### 5. Progress Indicators
- **Streak Display:**
  - Flame icon with number badge
  - Grows/animates on correct streaks
- **Session Timer:** Circular progress ring or simple MM:SS display
- **Questions Answered:** Mini progress bar showing total completed

### 6. Navigation Controls (Mobile)
- **Movement Controls:** Directional arrow buttons around maze (up, down, left, right)
- **Action Button:** Floating "Reveal" button (when applicable) with radius icon

---

## Animations

**Strategic Use Only:**

1. **Fog Reveal:** Fade-out transition (300ms) when tiles become visible
2. **Player Movement:** Smooth slide transition (400ms) between tiles
3. **Correct Answer:** Gentle confetti burst (particle effect library: canvas-confetti), checkmark scale-in
4. **Incorrect Answer:** Subtle shake animation on feedback modal (200ms)
5. **Tile Discovery:** Pulse effect on newly revealed exit/special tiles
6. **Streak Milestone:** Flame icon bounce at 3, 5, 10 streak

**No hover animations** - keep interface stable and predictable for kids.

---

## Responsive Behavior

**Desktop (1024px+):**
- Side-by-side layout: Maze 60%, Question panel 40%
- Maze: 600x600px optimal size

**Tablet (768-1023px):**
- Stacked layout: Question panel above, maze below
- Maze: 80vw max-width

**Mobile (< 768px):**
- Full-width components with p-4
- Maze: 90vw, touch-friendly directional controls
- Answer buttons: Single column, full-width
- Larger tap targets (min 48x48px)

---

## Images

**No hero image required** - this is a game interface, not a marketing page.

**Visual Assets:**
- Player avatar: Simple, kid-friendly character icon (could be customizable beret-wearing figure)
- Achievement badges: Small illustrated icons for milestones
- Background pattern: Subtle geometric French-themed pattern (Eiffel Tower silhouettes, very faint)

---

## Accessibility

- High contrast ratios (WCAG AAA for kids)
- Keyboard navigation support (arrow keys for movement)
- Screen reader announcements for game state changes
- Focus indicators on all interactive elements (ring-4 with offset)
- Large touch targets (minimum 48x48px)
- Clear error states with supportive language