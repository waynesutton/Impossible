# Project Files Documentation

## Frontend Components (`src/`)

### Core Components

- **App.tsx**: Main application shell with navigation, routing, and page state management. Handles navigation between game, leaderboard, and helper modes. Includes mobile-responsive hamburger menu and theme switcher integration.

- **ImpossibleGame.tsx**: Primary game component containing all gameplay logic. Manages word input, attempt tracking, real-time guess updates, AI hint requests, friend invitations, timer countdown for final attempt, and game completion flow.

- **Leaderboard.tsx**: Displays winners hall of fame and recent plays. Shows game completion statistics, player names, attempts used, and word reveals. Handles both successful and failed game results with proper anonymization.

- **HelperGame.tsx**: Friend helper interface for collaborative gameplay. Allows invited friends to view the game state, submit word suggestions (up to 3), and track the main player's progress in real-time.

- **ThemeSwitcher.tsx**: Theme management component supporting three distinct visual modes: Neobrutalism (default bold design), Original (clean minimal), and Dark mode. Persists theme preferences to localStorage.

### Utilities

- **lib/utils.ts**: Shared utility functions for common operations like className merging and other helper functions used across components.

- **main.tsx**: React application bootstrap file that sets up the Convex provider, renders the root App component, and initializes the React application.

- **index.css**: Comprehensive CSS system with CSS variables for theming, Neobrutalism design components (brutal-\* classes), responsive design, and custom styling for game elements.

## Backend Functions (`convex/`)

### Core Game Logic

- **game.ts**: Central game logic containing all game-related mutations, queries, and actions. Includes:

  - Game session management (start, track attempts, completion)
  - AI word generation using OpenAI GPT-4o-mini
  - Hint generation with contextual AI prompts
  - Friend invitation system with unique invite links
  - Real-time suggestion sharing between players
  - Timer management for third attempt pressure
  - Secret word functionality for testing/admin use

- **schema.ts**: Complete database schema definitions using Convex validators. Defines tables for:

  - `users`: Player accounts (name, email, anonymity preferences)
  - `gameWords`: AI-generated words with shuffled letters and difficulty
  - `userAttempts`: Game session tracking with attempts and completion state
  - `gameResults`: Final game outcomes for leaderboard display
  - `invites`: Friend invitation system with unique identifiers
  - `helpers`: Helper relationship tracking between players
  - `suggestions`: Word suggestions from friends to main players
  - `analytics`: Event tracking for usage analytics

- **leaderboard.ts**: Leaderboard data queries and analytics tracking. Handles:
  - Winners hall of fame (successful games only)
  - Recent plays (all games with appropriate data privacy)
  - Event tracking for homepage views and game starts
  - Player name anonymization and display logic

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

- `convex/game.ts`: Primary AI integration with OpenAI for word generation and hint creation
- `src/ImpossibleGame.tsx`: AI hint request handling and display logic
- Environment variables in Convex deployment for OpenAI API key management
