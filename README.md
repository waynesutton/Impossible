# Impossible Word

A Convex-powered real-time word game with Neobrutalism design. Each player gets a unique, hard, AI-generated word. You have 3 attempts to guess the full word. After two failed attempts, you can request a hint. Invite friends to suggest words to try.

## How it works

- Goal: Guess the impossible word
- Attempts: You get 3 tries per game
- Hints: Available after 2 failed attempts
- Friends: Invite friends to suggest words
- Fresh: New impossible word every game

Notes:

- No per-letter resets. A full attempt is counted only when you submit a complete word.
- The letters are not reshuffled mid-game; you always see the fixed word layout.

## Design System

The app features a comprehensive theme system with three modes:

### Theme Options

- **Neobrutalism (Default)**: Bold, expressive design with thick borders, bright colors, and prominent shadows
- **Original**: Clean, minimal interface with subtle styling
- **Dark Mode**: Dark theme optimized for low-light environments

### Theme Switcher

Users can switch between themes using the icon buttons in the top-right navigation:

- 🎨 Neobrutalism (Bold & Colorful)
- 📝 Original (Clean & Minimal)
- 🌙 Dark (Dark Mode)

Theme preferences are automatically saved to localStorage and persist across sessions.

## Tech

- Convex (database + functions)
- React + Vite
- OpenAI for word generation and hints
- TailwindCSS + CSS Variables for theming
- Neobrutalism design principles

## Environment Variables

Set in Convex environment (convex cloud dev/prod):

- OPENAI_API_KEY: Used by Convex actions to generate words and hints (required)
- SITE_URL: Used for invites (optional)

Optional proxies used in this template (already configured if using the provided backend):

- CONVEX_OPENAI_BASE_URL
- RESEND_BASE_URL
- CONVEX_RESEND_API_KEY (unused by the core game)

To view/set variables:

```
npx convex env list
npx convex env set OPENAI_API_KEY your_key
```

## Development

Install and run locally:

```
pnpm i # or npm i / bun i
echo "VITE_CONVEX_URL=<your dev deployment url>" > .env.local
pnpm dev # runs vite and convex dev
```

Convex dev will watch functions in `convex/` and hot reload.

## Data Model (key tables)

- users: demo users (no auth)
- userAttempts: per-user session attempts for a gameId
- gameWords: generated word per gameId
- gameResults: finalized results per game (won/lost, attempts, names)
- invites/helpers/suggestions: friend assistance

## Leaderboard

- Winners Hall of Fame (top): Shows only successful games (word and attempts), with the player's `displayName` or "Anonymous Player" or fallback name.
- Recent Plays (bottom): Shows all recent games from any user; for anonymous players, only show name, attempts, and time. Do not show the word here for failed games.

## CSS Architecture

The styling system uses CSS variables for theming with these key components:

### CSS Classes

- `brutal-*`: Neobrutalism components (buttons, cards, inputs, etc.)
- `theme-*`: Theme switcher components
- CSS variables handle theme switching automatically

### Theme Variables

- Colors: `--bg-primary`, `--bg-secondary`, `--text-primary`, etc.
- Borders: `--border-width`, `--border-color`, `--border-radius`
- Shadows: `--shadow-brutal`, `--shadow-small`, `--shadow-large`
- Typography: `--font-heading`, `--font-body`, `--font-mono`

### Design Principles

- **Neobrutalism**: Bold borders (4px), bright colors, block shadows, uppercase text
- **Accessibility**: High contrast ratios and clear visual hierarchy
- **Responsive**: Works across all device sizes
- **Performance**: Minimal CSS with efficient variable switching

## Files of interest

- src/App.tsx: Shell and homepage
- src/ImpossibleGame.tsx: Main gameplay UI and flow
- src/Leaderboard.tsx: Leaderboard screen
- src/HelperGame.tsx: Friend helper interface
- src/ThemeSwitcher.tsx: Theme switching component
- src/index.css: CSS variables and Neobrutalism design system
- convex/game.ts: Game logic (queries/mutations/actions)
- convex/leaderboard.ts: Leaderboard queries
- convex/schema.ts: Database schema
