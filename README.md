# Impossible Word

A Convex-powered real-time word game with Neobrutalism design featuring both solo challenges and head-to-head battles. Each player gets a unique, hard, AI-generated word. You have 3 attempts to guess the full word. After two failed attempts, you can request a hint. Invite friends to suggest words or challenge them to compete directly.

## How the App Works

The Impossible Word game is a challenging word-guessing experience that combines AI-generated content, real-time collaboration, and competitive gameplay with multiple modes:

### Single Player Mode

1. **Word Generation**: Each game starts with AI generating an obscure, difficult word (5-8 letters)
2. **Letter Shuffling**: The word's letters are shuffled once and displayed as hints
3. **Guessing**: Players type to guess the word - attempts are counted when a complete word is submitted
4. **AI Assistance**: After failed attempts, players can request AI-generated hints or letter clues
5. **Friend Collaboration**: Players can invite friends to suggest words via shareable links
6. **Completion**: Game ends when word is guessed correctly or 3 attempts are exhausted

### Challenge Mode (1v1 Battles)

1. **Challenge Creation**: Any player can create a challenge and share an invite link
2. **Head-to-Head Setup**: Opponent accepts challenge and both players confirm readiness
3. **Synchronized Competition**: Both players get 3 identical extremely difficult AI-generated words
4. **Dynamic Timers**: 60 seconds for rounds 1&2, 30 seconds for the final round 3
5. **Individual Scoring**: Points awarded for completion speed, accuracy, and attempt efficiency
6. **Real-time Progress**: Players see opponent's completion status without revealing guesses
7. **Battle Results**: Final scores compared, winner declared, results saved to leaderboard
8. **Rematch System**: Players can challenge each other again for competitive replay

### Core Features

- **Goal**: Guess the impossible word (solo) or outscore your opponent (challenge)
- **Attempts**: You get 3 tries per game in both modes
- **Hints**: AI-generated hints available after 1 attempt
- **Clues**: First/last letter reveals available after 2 attempts
- **Friends**: Invite friends to suggest words or challenge them to compete
- **Fresh**: New impossible word every game
- **Challenge Battles**: Compete head-to-head with friends in timed rounds
- **Authentication**: Optional login to save personal scores and challenge history
- **Secret Word**: There's a special secret word that always wins (not documented publicly)

### Game Mechanics

- No per-letter resets. A full attempt is counted only when you submit a complete word
- The letters are not reshuffled mid-game; you always see the fixed word layout
- Third attempt has a 60-second timer for added pressure (solo mode)
- Challenge mode: Dynamic timers - 60 seconds for rounds 1&2, 30 seconds for round 3
- Real-time collaboration with friends through suggestions
- Anonymous or named gameplay with public leaderboard tracking
- Authenticated users get personal profiles with game history and stats
- Challenge battles feature unique word generation (1 in 10,000 difficulty)

## Project Structure

```
impossible/
├── src/                          # Frontend React application
│   ├── App.tsx                   # Main app shell with navigation and page routing
│   ├── ImpossibleGame.tsx        # Core single-player game component with word guessing logic
│   ├── ChallengeMode.tsx         # Challenge vs opponent game component for 1v1 battles
│   ├── ChallengeSetup.tsx        # Challenge creation and invitation interface
│   ├── Leaderboard.tsx           # Winners hall of fame, recent plays, and challenge results
│   ├── HelperGame.tsx            # Friend helper interface for collaborative word suggestions
│   ├── ThemeSwitcher.tsx         # Theme switching component (3 themes)
│   ├── lib/
│   │   └── utils.ts              # Utility functions
│   ├── index.css                 # CSS variables and Neobrutalism design system
│   └── main.tsx                  # React bootstrap with Convex Provider
├── convex/                       # Backend Convex functions and schema
│   ├── schema.ts                 # Database schema definitions (includes challenge tables)
│   ├── game.ts                   # Core single-player game logic, AI integration, word generation
│   ├── challengeBattle.ts        # Challenge mode logic, 1v1 battles, scoring system
│   ├── leaderboard.ts            # Leaderboard queries, analytics, and challenge results
│   ├── router.ts                 # HTTP routing (unused currently)
│   ├── http.ts                   # HTTP endpoints (unused currently)
│   └── _generated/               # Auto-generated Convex types and API
├── auth/                         # Authentication documentation and guides
│   ├── impossibleauth.md         # Clerk authentication implementation guide
│   └── clerk-auth-check.mdc      # Authentication verification checklist
├── public/
│   └── og-preview.png            # Social media preview image
├── components.json               # Shadcn/ui component configuration
├── index.html                    # HTML entry point with social meta tags
├── package.json                  # Dependencies and scripts
├── vite.config.ts                # Vite build configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.cjs            # PostCSS configuration
├── teamvs.md                     # Challenge mode PRD and technical specifications
├── files.md                      # Project files documentation
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

### Single Player Mode

- **users**: player accounts (supports both anonymous and authenticated users)
- **userAttempts**: per-user session attempts for a gameId
- **gameWords**: AI-generated words per gameId with difficulty and shuffled letters
- **gameResults**: finalized single-player results (won/lost, attempts, names)
- **invites/helpers/suggestions**: friend assistance system for collaborative play

### Challenge Mode (1v1 Battles)

- **challengeBattles**: head-to-head game sessions with scores and status tracking
- **challengeWordAttempts**: individual player attempts and scores for each word in battle
- **challengeInvites**: shareable challenge invitation links and acceptance tracking
- **rematchRequests**: rematch system for competitive replay between opponents

### Authentication (Optional)

- **authTables**: Clerk authentication integration for user accounts and profiles
- **User roles**: admin access for analytics dashboard, regular users for personal profiles
- **Score persistence**: authenticated users get permanent score history and statistics

## Leaderboard

The leaderboard features multiple sections to showcase different types of achievements:

### Single Player Results

- **Winners Hall of Fame**: Shows only successful single-player games (word and attempts), with the player's `displayName` or "Anonymous Player" or fallback name
- **Recent Plays**: Shows all recent single-player games from any user; for anonymous players, only show name, attempts, and time. Do not show the word here for failed games

### Challenge Battle Results

- **Challenge Battles**: Shows head-to-head competition results with "Challenger vs Opponent" format
- **Battle History**: Displays individual scores, winner, and completion times for 1v1 battles
- **Challenge Statistics**: For authenticated users, personal challenge win/loss records and performance metrics

### Authentication Benefits

- **Anonymous Users**: Scores appear on public leaderboards but are not saved to personal profiles
- **Authenticated Users**: All scores saved permanently with access to detailed game history and statistics

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

### Frontend Components

- **src/App.tsx**: Main app shell with navigation and routing for all game modes
- **src/ImpossibleGame.tsx**: Single-player gameplay UI and flow
- **src/ChallengeMode.tsx**: Challenge vs opponent 1v1 battle interface
- **src/ChallengeSetup.tsx**: Challenge creation and invitation management
- **src/Leaderboard.tsx**: Multi-section leaderboard (single-player + challenge results)
- **src/HelperGame.tsx**: Friend helper interface for collaborative suggestions
- **src/ThemeSwitcher.tsx**: Theme switching component (Neobrutalism/Original/Dark)
- **src/index.css**: CSS variables and comprehensive design system

### Backend Functions

- **convex/game.ts**: Single-player game logic (queries/mutations/actions)
- **convex/challengeBattle.ts**: Challenge mode logic, 1v1 battles, scoring system
- **convex/leaderboard.ts**: Leaderboard queries for both game modes and analytics
- **convex/schema.ts**: Complete database schema (single-player + challenge + auth tables)

### Documentation

- **teamvs.md**: Challenge mode PRD and technical implementation specifications
- **auth/impossibleauth.md**: Clerk authentication integration guide and requirements
- **files.md**: Comprehensive project files documentation
