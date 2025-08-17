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
│   ├── App.tsx                   # Main app shell with navigation, routing, and authentication
│   ├── ImpossibleGame.tsx        # Core single-player game component with word guessing logic
│   ├── ChallengeMode.tsx         # Challenge vs opponent game component for 1v1 battles
│   ├── ChallengeSetup.tsx        # Challenge creation and invitation interface
│   ├── Dashboard.tsx             # Admin dashboard with comprehensive analytics and moderation
│   ├── Leaderboard.tsx           # Winners hall of fame, recent plays, and challenge results
│   ├── HelperGame.tsx            # Friend helper interface for collaborative word suggestions
│   ├── ThemeSwitcher.tsx         # Theme switching component (3 themes)
│   ├── components/               # Reusable UI components
│   │   ├── AuthButton.tsx        # Clerk authentication buttons (Sign In/Out, User Button)
│   │   ├── MyScores.tsx          # Personal score history with pagination and deletion
│   │   ├── UserProfile.tsx       # User profile component for authenticated users
│   │   ├── ProtectedRoute.tsx    # Route protection wrapper for authenticated features
│   │   ├── ConfirmDialog.tsx     # Reusable confirmation dialog component
│   │   └── ShareableScoreHandler.tsx # Score sharing functionality
│   ├── lib/
│   │   └── utils.ts              # Utility functions and helper methods
│   ├── index.css                 # CSS variables and comprehensive design system
│   └── main.tsx                  # React bootstrap with Convex and Clerk providers
├── convex/                       # Backend Convex functions and schema
│   ├── auth.config.ts            # Clerk authentication configuration for Convex
│   ├── auth/
│   │   └── helpers.ts            # Authentication helper functions
│   ├── schema.ts                 # Complete database schema (game + challenge + auth tables)
│   ├── game.ts                   # Single-player game logic, AI integration, word generation
│   ├── challengeBattle.ts        # Challenge mode logic, 1v1 battles, scoring system
│   ├── leaderboard.ts            # Leaderboard queries, analytics, and user statistics
│   ├── router.ts                 # HTTP routing configuration
│   ├── http.ts                   # HTTP endpoints for external integrations
│   └── _generated/               # Auto-generated Convex types and API definitions
├── auth/                         # Authentication documentation and guides
│   ├── impossibleauth.md         # Clerk authentication implementation guide
│   ├── clerk-auth-check.mdc      # Authentication verification checklist
│   └── clerk-admin-fix.MD        # Admin dashboard setup and role configuration
├── public/                       # Static assets and favicon collection
│   ├── og-preview.png            # Social media preview image
│   └── [favicon files]          # Comprehensive favicon collection for all platforms
├── components.json               # Shadcn/ui component configuration
├── index.html                    # HTML entry point with meta tags and favicon links
├── package.json                  # Dependencies and scripts
├── vite.config.ts                # Vite build configuration with Convex integration
├── tailwind.config.js            # Tailwind CSS configuration with custom theme
├── postcss.config.cjs            # PostCSS configuration for CSS processing
├── eslint.config.js              # ESLint configuration for code quality
├── teamvs.md                     # Challenge mode PRD and technical specifications
├── files.md                      # Comprehensive project files documentation
├── impossibleai.md               # AI integration documentation and prompts
└── tsconfig.*.json               # TypeScript configurations for different environments
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

## Tech Stack

### Frontend

- **React 18** - Modern React with hooks and concurrent features
- **Vite** - Lightning-fast build tool and dev server
- **TypeScript** - Type-safe development with full IntelliSense
- **Tailwind CSS** - Utility-first CSS framework with custom theme system
- **CSS Variables** - Dynamic theming system supporting multiple themes
- **Lucide React** - Beautiful icon library for UI components

### Backend & Database

- **Convex** - Full-stack TypeScript platform with real-time database
- **Convex Functions** - Serverless functions (queries, mutations, actions)
- **Convex Auth** - Authentication integration with Clerk
- **Real-time Subscriptions** - Live updates across all connected clients
- **Convex Scheduling** - Background jobs and cron scheduling

### Authentication & User Management

- **Clerk** - Complete authentication solution with social logins
- **JWT Tokens** - Secure token-based authentication
- **Role-Based Access** - Admin and user roles with permissions
- **Session Management** - Persistent sessions across browser tabs

### AI Integration

- **OpenAI GPT-4** - AI word generation and hint/clue generation
- **OpenAI API** - Serverless AI actions through Convex
- **Custom Prompts** - Engineered prompts for game-specific content

#### AI Word Generation System

The game uses sophisticated AI prompts to create challenging words for different game modes:

**Single Player Mode:**

- **Difficulty Target**: Medium to hard words (5-8 letters)
- **Word Selection**: Uncommon but legitimate English words from standard dictionaries
- **Examples**: Words like "sprig", "flung", "brisk", "charm" that are real but not commonly guessed
- **Scoring**: Balanced difficulty to provide achievable but challenging gameplay

**Challenge Mode (1v1 Battles):**

- **Difficulty Target**: Extremely hard words (1 in 10,000 difficulty level)
- **Word Selection**: Obscure, technical, archaic, or highly specialized vocabulary
- **Examples**: Words like "zugzwang", "quaich", "ptosis", "fjord" that are exceptionally difficult
- **Competitive Balance**: Identical words for both players ensure fair head-to-head competition
- **Timer Pressure**: Shorter time limits (30-60 seconds) combined with extreme difficulty create intense competition

**AI Assistance Features:**

- **Hints**: Contextual clues about word meaning, usage, or category (available after 1 failed attempt)
- **Letter Clues**: Strategic letter reveals (first/last letters) to help narrow possibilities (available after 2 failed attempts)
- **Prompt Engineering**: Carefully crafted prompts ensure consistent difficulty and appropriate content for each game mode

### Development & Build Tools

- **Bun/npm/pnpm** - Package manager flexibility
- **ESLint** - Code quality and consistency
- **PostCSS** - CSS processing and optimization
- **Sonner** - Toast notifications for user feedback
- **Canvas Confetti** - Celebration animations

### Design System

- **Neobrutalism Design** - Bold, expressive UI with thick borders
- **Multi-theme Support** - Light, dark, and accent theme variants
- **Responsive Design** - Mobile-first responsive layouts
- **CSS Grid & Flexbox** - Modern layout techniques

## Environment Variables

### Convex Environment Variables

Set in Convex environment (convex cloud dev/prod):

- **OPENAI_API_KEY**: Used by Convex actions to generate words and hints (required)
- **SITE_URL**: Used for invites (optional)

Optional proxies used in this template (already configured if using the provided backend):

- **CONVEX_OPENAI_BASE_URL**: OpenAI API proxy endpoint
- **RESEND_BASE_URL**: Email service proxy endpoint
- **CONVEX_RESEND_API_KEY**: Email service API key (unused by the core game)

### Clerk Authentication Variables

Required for frontend authentication (set in your frontend environment):

- **VITE_CLERK_PUBLISHABLE_KEY**: Clerk public key for frontend authentication
- **CLERK_SECRET_KEY**: Clerk secret key for backend integration (automatically used by Convex)

### Managing Environment Variables

To view/set Convex variables:

```bash
npx convex env list
npx convex env set OPENAI_API_KEY your_key
npx convex env set CLERK_SECRET_KEY your_secret_key
```

For frontend Clerk integration, add to your `.env.local`:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

## Hosting & Deployment

### Convex Cloud Hosting

This app is hosted on **Convex Cloud**, which provides:

- **Serverless Functions** - Auto-scaling backend functions with zero configuration
- **Real-time Database** - ACID transactions with live subscriptions
- **Global Edge Network** - Low-latency response times worldwide
- **Automatic HTTPS** - SSL certificates and secure connections
- **99.9% Uptime SLA** - Enterprise-grade reliability and monitoring

### Deployment Architecture

```
Frontend (Netlify/Vercel) ←→ Convex Cloud ←→ External APIs
     ↓                          ↓              ↓
Static Assets              Database         OpenAI
Theme Assets              Functions         Clerk Auth
                         Scheduling
```

### Convex Deployment Process

1. **Development Environment**

   ```bash
   npx convex dev          # Local development with hot reload
   npx convex dashboard    # Open local dashboard
   ```

2. **Production Deployment**

   ```bash
   npx convex deploy       # Deploy to production
   npx convex deploy --cmd="npm run build"  # Build and deploy
   ```

3. **Environment Management**
   ```bash
   npx convex env list                    # View environment variables
   npx convex env set KEY value          # Set production variables
   npx convex env set KEY value --dev    # Set development variables
   ```

### Frontend Hosting Options

**Recommended Platforms:**

- **Netlify** - Zero-config deployments with edge functions
- **Vercel** - Optimized for React/Vite with automatic deployments
- **Cloudflare Pages** - Global CDN with serverless functions

**Build Configuration:**

```bash
# Build command
npm run build

# Output directory
dist/

# Environment variables needed
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

### Database & Backend

- **Convex Cloud Database** - Automatically managed, globally distributed
- **Function Runtime** - V8 isolates for JavaScript/TypeScript functions
- **Real-time Sync** - WebSocket connections for live updates
- **Automatic Backups** - Point-in-time recovery and data protection
- **Schema Migrations** - Version-controlled database schema changes

### Monitoring & Analytics

Convex provides built-in monitoring:

- **Function Performance** - Execution time and error tracking
- **Database Queries** - Query performance and optimization insights
- **Real-time Connections** - WebSocket connection monitoring
- **Usage Analytics** - Request volume and user activity metrics

### Security Features

- **Authentication** - Integrated with Clerk for user management
- **Authorization** - Function-level access control and role-based permissions
- **Data Validation** - Runtime validation with Convex validators
- **HTTPS Everywhere** - All connections encrypted in transit
- **Environment Isolation** - Separate dev/prod environments with isolated data

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

### Authentication (Clerk Integration)

- **User Authentication**: Optional Clerk integration for enhanced user experience
- **Personal Profiles**: Authenticated users get permanent score history and detailed statistics
- **Admin Dashboard**: Role-based access to comprehensive analytics and moderation tools
- **Score Management**: Ability to delete personal scores from both profile and public leaderboard
- **Social Features**: User profiles with shareable score links and challenge history

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

## Authentication Features

The app includes comprehensive Clerk authentication integration providing enhanced features for registered users:

### User Authentication

- **Optional Login**: Core gameplay works without authentication
- **Clerk Integration**: Secure authentication with social logins and email/password
- **Persistent Sessions**: Stay logged in across browser sessions
- **Role-Based Access**: Regular users and admin roles with different permissions

### Personal Profiles (My Scores)

- **Game History**: View paginated history of single-player games and challenge battles
- **Quick Stats**: Personal statistics including win rate, total games, and challenge performance
- **Score Management**: Delete scores from both personal profile and public leaderboard
- **Share Functionality**: Generate shareable links to specific game results or challenge outcomes

### Admin Dashboard

- **Comprehensive Analytics**: Real-time statistics across all game modes and user activity
- **Game Performance Metrics**: Success rates, attempt breakdowns, and player behavior analytics
- **Challenge Mode Statistics**: Head-to-head battle analytics, completion rates, and scoring trends
- **Moderation Tools**: Admin and player deletion tracking with detailed moderation statistics
- **User Activity**: Session analytics, link sharing metrics, and engagement tracking
- **Recent Activity**: 7-day activity breakdown with daily game and challenge statistics

### Role-Based Features

- **Regular Users**: Access to personal profiles, score history, and social features
- **Admin Users**: Full dashboard access with site-wide analytics and moderation capabilities
- **Anonymous Users**: Full gameplay experience without authentication requirements

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

- **src/App.tsx**: Main app shell with navigation, routing, and authentication integration
- **src/ImpossibleGame.tsx**: Single-player gameplay UI and flow
- **src/ChallengeMode.tsx**: Challenge vs opponent 1v1 battle interface
- **src/ChallengeSetup.tsx**: Challenge creation and invitation management
- **src/Dashboard.tsx**: Admin dashboard with comprehensive analytics and moderation tools
- **src/Leaderboard.tsx**: Multi-section leaderboard (single-player + challenge results)
- **src/HelperGame.tsx**: Friend helper interface for collaborative suggestions
- **src/ThemeSwitcher.tsx**: Theme switching component (Neobrutalism/Original/Dark)
- **src/components/AuthButton.tsx**: Clerk authentication buttons and user menu
- **src/components/MyScores.tsx**: Personal score history with pagination and management
- **src/components/ProtectedRoute.tsx**: Route protection wrapper for authenticated features
- **src/components/UserProfile.tsx**: User profile component for authenticated users
- **src/index.css**: CSS variables and comprehensive design system

### Backend Functions

- **convex/game.ts**: Single-player game logic with authentication-aware score persistence
- **convex/challengeBattle.ts**: Challenge mode logic, 1v1 battles, and scoring system
- **convex/leaderboard.ts**: Leaderboard queries, analytics, and user statistics (role-based access)
- **convex/schema.ts**: Complete database schema (single-player + challenge + auth tables)
- **convex/auth.config.ts**: Clerk authentication configuration for Convex integration
- **convex/auth/helpers.ts**: Authentication helper functions and user management

### Documentation

- **teamvs.md**: Challenge mode PRD and technical implementation specifications
- **auth/impossibleauth.md**: Clerk authentication integration guide and requirements
- **auth/clerk-admin-fix.MD**: Admin dashboard setup and role configuration
- **impossibleai.md**: AI integration documentation and prompt engineering
- **files.md**: Comprehensive project files documentation
