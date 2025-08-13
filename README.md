# Impossible Word

A Convex-powered real-time word game with Neobrutalism design. Each player gets a unique, hard, AI-generated word. You have 3 attempts to guess the full word. After two failed attempts, you can request a hint. Invite friends to suggest words to try.

## How the App Works

The Impossible Word game is a challenging word-guessing game that combines AI-generated content, real-time collaboration, and a unique user experience:

### Game Flow

1. **Word Generation**: Each game starts with AI generating an obscure, difficult word (5-8 letters)
2. **Letter Shuffling**: The word's letters are shuffled once and displayed as hints
3. **Guessing**: Players type to guess the word - attempts are counted when a complete word is submitted
4. **AI Assistance**: After failed attempts, players can request AI-generated hints or letter clues
5. **Friend Collaboration**: Players can invite friends to suggest words via shareable links
6. **Completion**: Game ends when word is guessed correctly or 3 attempts are exhausted

### Core Features

- **Goal**: Guess the impossible word
- **Attempts**: You get 3 tries per game
- **Hints**: AI-generated hints available after 1 attempt
- **Clues**: First/last letter reveals available after 2 attempts
- **Friends**: Invite friends to suggest words via unique invite links
- **Fresh**: New impossible word every game
- **Secret Word**: There's a special secret word that always wins (not documented publicly)

### Game Mechanics

- No per-letter resets. A full attempt is counted only when you submit a complete word
- The letters are not reshuffled mid-game; you always see the fixed word layout
- Third attempt has a 60-second timer for added pressure
- Real-time collaboration with friends through suggestions
- Anonymous or named gameplay with leaderboard tracking

## Project Structure

```
impossible/
├── src/                          # Frontend React application
│   ├── App.tsx                   # Main app shell with navigation and page routing
│   ├── ImpossibleGame.tsx        # Core game component with word guessing logic
│   ├── Leaderboard.tsx           # Winners hall of fame and recent plays
│   ├── HelperGame.tsx            # Friend helper interface for suggestions
│   ├── ThemeSwitcher.tsx         # Theme switching component (3 themes)
│   ├── lib/
│   │   └── utils.ts              # Utility functions
│   ├── index.css                 # CSS variables and Neobrutalism design system
│   └── main.tsx                  # React bootstrap with Convex Provider
├── convex/                       # Backend Convex functions and schema
│   ├── schema.ts                 # Database schema definitions
│   ├── game.ts                   # Core game logic, AI integration, word generation
│   ├── leaderboard.ts            # Leaderboard queries and analytics
│   ├── router.ts                 # HTTP routing (unused currently)
│   ├── http.ts                   # HTTP endpoints (unused currently)
│   └── _generated/               # Auto-generated Convex types and API
├── public/
│   └── og-preview.png            # Social media preview image
├── components.json               # Shadcn/ui component configuration
├── index.html                    # HTML entry point with social meta tags
├── package.json                  # Dependencies and scripts
├── vite.config.ts                # Vite build configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.cjs            # PostCSS configuration
└── tsconfig.*.json               # TypeScript configurations
```

## Design System

The app features a comprehensive theme system with three modes:

### Theme Options

- **Neobrutalism (Default)**: Bold, expressive design with thick borders, bright colors, and prominent shadows
- **Original**: Clean, minimal interface with subtle styling
- **Dark Mode**: Dark theme optimized for low-light environments

### Theme Switcher

Users can switch between themes using the icon buttons in the top-right navigation:

- Palette icon: Neobrutalism (Bold & Colorful)
- File icon: Original (Clean & Minimal)
- Moon icon: Dark (Dark Mode)

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
