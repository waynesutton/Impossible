# Project Files Documentation

## Frontend Components (`src/`)

### Core Components

- **App.tsx**: Main application shell with navigation, routing, and page state management. Handles navigation between single-player game, challenge mode, leaderboard, and helper modes. Includes mobile-responsive hamburger menu, theme switcher integration, and challenge invitation URL handling.

- **ImpossibleGame.tsx**: Primary single-player game component containing all solo gameplay logic. Manages word input, attempt tracking, real-time guess updates, AI hint requests, friend invitations, timer countdown for final attempt, and game completion flow.

- **ChallengeMode.tsx**: Challenge vs opponent game component for 1v1 battles. Handles head-to-head gameplay with synchronized timers, individual scoring, real-time opponent status updates, and competitive game flow management.

- **ChallengeSetup.tsx**: Challenge creation and invitation interface. Manages challenge setup, shareable link generation, opponent invitation flow, and readiness confirmation for both challenger and opponent players.

- **Leaderboard.tsx**: Multi-section leaderboard displaying single-player winners hall of fame, recent plays, and challenge battle results. Shows game completion statistics, player names, attempts used, and word reveals. Handles both individual game results and head-to-head battle outcomes with proper anonymization and authentication status awareness.

- **HelperGame.tsx**: Friend helper interface for collaborative gameplay. Allows invited friends to view the game state, submit word suggestions (up to 3), and track the main player's progress in real-time.

- **ThemeSwitcher.tsx**: Theme management component supporting three distinct visual modes: Neobrutalism (default bold design), Original (clean minimal), and Dark mode. Persists theme preferences to localStorage.

### Utilities

- **lib/utils.ts**: Shared utility functions for common operations like className merging and other helper functions used across components.

- **main.tsx**: React application bootstrap file that sets up the Convex provider, renders the root App component, and initializes the React application.

- **index.css**: Comprehensive CSS system with CSS variables for theming, Neobrutalism design components (brutal-\* classes), responsive design, and custom styling for game elements.

## Backend Functions (`convex/`)

### Core Game Logic

- **game.ts**: Central single-player game logic containing all solo game-related mutations, queries, and actions. Includes:

  - Single-player session management (start, track attempts, completion)
  - AI word generation using OpenAI GPT-4o-mini
  - Hint generation with contextual AI prompts
  - Friend invitation system with unique invite links for collaborative play
  - Real-time suggestion sharing between players and helpers
  - Timer management for third attempt pressure in solo mode
  - Secret word functionality for testing/admin use

- **challengeBattle.ts**: Challenge mode logic for head-to-head 1v1 battles. Includes:

  - Challenge creation and invitation management
  - Real-time synchronized gameplay between two players
  - Individual scoring system with speed bonuses and penalties
  - Dynamic timer system: 60 seconds for rounds 1&2, 30 seconds for round 3
  - Battle state management (waiting, ready, in-progress, completed)
  - Results calculation and winner determination
  - Rematch system for competitive replay
  - Challenge battle history tracking and analytics

- **schema.ts**: Complete database schema definitions using Convex validators. Defines tables for:

  **Single Player Mode:**

  - `users`: Player accounts (name, email, anonymity preferences, optional authentication)
  - `gameWords`: AI-generated words with shuffled letters and difficulty
  - `userAttempts`: Single-player session tracking with attempts and completion state
  - `gameResults`: Final single-player game outcomes for leaderboard display
  - `invites`: Friend invitation system for collaborative suggestions
  - `helpers`: Helper relationship tracking between players and friends
  - `suggestions`: Word suggestions from friends to main players

  **Challenge Mode:**

  - `challengeBattles`: Head-to-head battle sessions with status and scoring
  - `challengeWordAttempts`: Individual player attempts and scores for each word in battles
  - `challengeInvites`: Challenge invitation links and acceptance tracking
  - `rematchRequests`: Rematch system for competitive replay between same opponents

  **System:**

  - `analytics`: Event tracking for usage analytics across both game modes

- **leaderboard.ts**: Comprehensive leaderboard data queries and analytics tracking. Handles:
  - Single-player winners hall of fame (successful games only)
  - Recent single-player plays (all games with appropriate data privacy)
  - Challenge battle results and head-to-head competition history
  - Cross-mode analytics combining single-player and challenge statistics
  - Event tracking for homepage views, game starts, and challenge creations
  - Player name anonymization and display logic for both authenticated and anonymous users
  - Authentication-aware score persistence and profile statistics

### Configuration Files

- **router.ts**: HTTP routing configuration (currently unused but set up for future API endpoints)

- **http.ts**: HTTP endpoint definitions (currently unused but configured for potential webhook integrations)

- **\_generated/**: Auto-generated Convex types, API definitions, and server functions. Created automatically by Convex CLI and should not be manually edited.

## Configuration & Build Files

### Core Configuration

- **package.json**: NPM package configuration with dependencies (React, Convex, OpenAI, Tailwind), build scripts, and development tools setup.

- **vite.config.ts**: Vite build tool configuration for development server, build optimization, and React integration.

- **tsconfig.json** (multiple): TypeScript configuration files for different parts of the application (main app, Node.js, Vite) with proper type checking and module resolution.

### Styling & UI

- **tailwind.config.js**: Tailwind CSS configuration with custom theme extensions, color schemes, and design system integration for the Neobrutalism aesthetic.

- **postcss.config.cjs**: PostCSS configuration for CSS processing, autoprefixing, and Tailwind CSS integration.

- **components.json**: Shadcn/ui component library configuration (though the app primarily uses custom Neobrutalism components).

### Development Tools

- **eslint.config.js**: ESLint configuration for code quality, TypeScript integration, and React-specific linting rules.

### Static Assets

- **index.html**: Main HTML entry point with proper meta tags for social sharing, favicon links, and React root element. Includes Open Graph tags for social media previews.

- **public/og-preview.png**: Social media preview image used for link sharing and Open Graph meta tags.

## AI Integration Points

The following files contain AI-related functionality:

### Single Player Mode

- `convex/game.ts`: Primary AI integration with OpenAI for word generation and hint creation
- `src/ImpossibleGame.tsx`: AI hint request handling and display logic

### Challenge Mode

- `convex/challengeBattle.ts`: AI word generation for synchronized 1v1 battles
- `src/ChallengeMode.tsx`: AI hint integration for competitive gameplay

### Configuration

- Environment variables in Convex deployment for OpenAI API key management
- Consistent AI prompting across both single-player and challenge modes

## Authentication Integration Points

The following areas support optional Clerk authentication:

### Frontend Components

- `src/App.tsx`: Authentication status checking and role-based navigation
- `src/Leaderboard.tsx`: Authenticated vs anonymous score display logic
- User profile components for authenticated users (future implementation)

### Backend Functions

- `convex/game.ts`: Optional user authentication for score persistence
- `convex/challengeBattle.ts`: Authentication-aware challenge creation and results
- `convex/leaderboard.ts`: Role-based analytics access and personal statistics

### Key Principles

- **Anonymous First**: All core gameplay works without authentication
- **Authentication Enhancement**: Login provides score persistence and personal profiles
- **Admin Access**: Dashboard analytics require admin role authentication
