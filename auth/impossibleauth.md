# Impossible Game Clerk Authentication Implementation Guide

## Overview

This document provides a comprehensive guide for implementing Clerk authentication in the Impossible Game with role-based access control. The implementation will support both single-player mode and the new challenge mode (1v1 battles) while maintaining backwards compatibility:

- **Admin Role**: Access to `/dashboard` page with comprehensive analytics for both game modes
- **Authenticated Users**: Personal profile with game history, scores, and challenge statistics
- **Anonymous Players**: Can still play both single-player and challenge modes without authentication (current behavior preserved)
- **Public Leaderboard**: Remains accessible to all users, displays both single-player and challenge results
- **Score Persistence**: Authenticated users can save and track scores across both game modes
- **Challenge Mode**: Full head-to-head functionality available to anonymous users, with enhanced tracking for authenticated users

## Current System Analysis

### Existing Architecture

The app currently uses a simple user system with support for both single-player and challenge modes:

#### Single Player Mode

- Anonymous user creation via `getLoggedInUser()` in `convex/game.ts` and `convex/leaderboard.ts`
- Users table with basic fields: `name`, `email`, `isAnonymous`
- Game results linked to users via `userId` field
- Friend helper system for collaborative word suggestions

#### Challenge Mode (1v1 Battles)

- Challenge battle sessions with real-time synchronization
- Individual scoring system with speed bonuses and penalties
- Challenge invitation links for head-to-head competition
- Battle results tracking with winner determination

#### Shared Systems

- Dashboard analytics accessible at `/dashboard` route (currently unprotected)
- Multi-section leaderboard showing both single-player and challenge results
- Theme system supporting three modes (Neobrutalism, Original, Dark)

### Data Models

```typescript
// Current schema structure
users: {
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  isAnonymous: v.optional(v.boolean()),
}

// Single Player Mode
gameResults: {
  userId: v.id("users"),
  gameId: v.string(),
  word: v.string(),
  completed: v.boolean(),
  attempts: v.number(),
  completedAt: v.number(),
  displayName: v.optional(v.string()),
  playerName: v.optional(v.string()),
  isAnonymous: v.boolean(),
  usedSecretWord: v.optional(v.boolean()),
}

// Challenge Mode (1v1 Battles)
challengeBattles: {
  gameId: v.string(),
  challengerUserId: v.id("users"),
  opponentUserId: v.optional(v.id("users")),
  challengerName: v.string(),
  opponentName: v.optional(v.string()),
  status: v.union(
    v.literal("waiting_for_opponent"),
    v.literal("in_progress"),
    v.literal("completed")
  ),
  challengerScore: v.number(),
  opponentScore: v.number(),
  winner: v.optional(v.string()),
  completedAt: v.optional(v.number()),
}

challengeWordAttempts: {
  battleId: v.id("challengeBattles"),
  wordIndex: v.number(),
  player: v.union(v.literal("challenger"), v.literal("opponent")),
  attempts: v.number(),
  completed: v.boolean(),
  finalScore: v.number(),
  timeUsed: v.optional(v.number()),
}
```

## Step-by-Step Implementation Guide

### Step 1: Clerk Account and Application Setup

1. **Create Clerk Account and Application**

   - Sign up at [clerk.com](https://clerk.com)
   - Create new application
   - Choose "React" as framework
   - Copy publishable and secret keys

2. **Configure JWT Template**

   - Go to "JWT Templates" in Clerk dashboard
   - Create new template named "convex"
   - Add custom claims:

   ```json
   {
     "role": "{{user.public_metadata.role}}",
     "userId": "{{user.id}}"
   }
   ```

3. **Set Up User Metadata Structure**
   - Go to "Users" section
   - Set up public metadata structure for roles
   - Default role should be "user"
   - Admin role: "admin"

### Step 2: Install Required Packages

```bash
# Install Clerk packages
npm install @clerk/clerk-react @clerk/themes

# Install Convex Auth (recommended for Clerk + Convex integration)
npm install @convex-dev/auth

# Install additional dependencies for auth
npm install @types/node
```

### Step 3: Environment Variables Setup

Create/update `.env.local`:

```bash
# Clerk Configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Convex Configuration (existing)
VITE_CONVEX_URL=your_convex_url_here
CONVEX_DEPLOY_KEY=your_deploy_key_here
```

### Step 4: Update Convex Schema

Update `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const applicationTables = {
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    clerkId: v.optional(v.string()), // Link to Clerk user
    role: v.optional(v.string()), // "admin" | "user"
    profileDisplayName: v.optional(v.string()), // For profile page
  }).index("by_clerk_id", ["clerkId"]),

  // Single Player Mode Tables
  gameWords: defineTable({
    /* existing definition */
  }),
  userAttempts: defineTable({
    /* existing definition */
  }),
  gameResults: defineTable({
    /* existing definition */
  }),
  invites: defineTable({
    /* existing definition */
  }),
  helpers: defineTable({
    /* existing definition */
  }),
  suggestions: defineTable({
    /* existing definition */
  }),

  // Challenge Mode Tables
  challengeBattles: defineTable({
    gameId: v.string(),
    challengerUserId: v.id("users"),
    opponentUserId: v.optional(v.id("users")),
    challengerName: v.string(),
    opponentName: v.optional(v.string()),
    status: v.union(
      v.literal("waiting_for_opponent"),
      v.literal("ready_to_start"),
      v.literal("in_progress"),
      v.literal("completed"),
    ),
    challengerScore: v.number(),
    opponentScore: v.number(),
    winner: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  }).index("by_game_id", ["gameId"]),

  challengeWordAttempts: defineTable({
    battleId: v.id("challengeBattles"),
    wordIndex: v.number(),
    player: v.union(v.literal("challenger"), v.literal("opponent")),
    attempts: v.number(),
    completed: v.boolean(),
    finalScore: v.number(),
    timeUsed: v.optional(v.number()),
  }).index("by_battle_and_player", ["battleId", "player"]),

  challengeInvites: defineTable({
    battleId: v.id("challengeBattles"),
    createdBy: v.id("users"),
    createdAt: v.number(),
    used: v.boolean(),
  }).index("by_battle", ["battleId"]),

  // ... other existing tables (analytics, etc.)
};

export default defineSchema({
  ...authTables, // Convex Auth tables
  ...applicationTables,
});
```

### Step 5: Configure Convex Auth

Create `convex/auth.ts`:

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import { ClerkWebhookUserSync } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [],
});

export const clerkWebhook = ClerkWebhookUserSync({
  userTable: "users",
  clerkUserIdField: "clerkId",
});
```

### Step 6: Create Authentication Helper Functions

Create `convex/auth/helpers.ts`:

```typescript
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export async function getUserIdentity(ctx: QueryCtx | MutationCtx) {
  return await ctx.auth.getUserIdentity();
}

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await getUserIdentity(ctx);
  if (!identity) {
    throw new Error("Authentication required");
  }
  return identity;
}

export async function requireAdminRole(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);

  if (!identity.role || identity.role !== "admin") {
    throw new Error("Admin role required for this action");
  }

  return identity;
}

export async function getOrCreateUser(ctx: MutationCtx): Promise<Id<"users">> {
  const identity = await getUserIdentity(ctx);

  if (!identity) {
    // Create anonymous user (preserve existing behavior)
    return await createAnonymousUser(ctx);
  }

  // Check if user exists by clerkId
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (existingUser) {
    return existingUser._id;
  }

  // Create new authenticated user
  return await ctx.db.insert("users", {
    name: identity.name || identity.email?.split("@")[0] || "User",
    email: identity.email,
    clerkId: identity.subject,
    role: identity.role || "user",
    isAnonymous: false,
  });
}

async function createAnonymousUser(ctx: MutationCtx): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    name: "Anonymous Player",
    isAnonymous: true,
  });
}

export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const identity = await getUserIdentity(ctx);

  if (!identity) {
    // For anonymous users, create or find a temporary user
    // This preserves the existing behavior for unauthenticated gameplay
    let user = await ctx.db
      .query("users")
      .filter((q) => q.eq("isAnonymous", true))
      .first();
    if (!user) {
      const userId = await ctx.db.insert("users", {
        name: "Anonymous Player",
        isAnonymous: true,
      });
      return userId;
    }
    return user._id;
  }

  // For authenticated users, get or create their user record
  return await getOrCreateUser(ctx as MutationCtx);
}
```

### Step 7: Update Game Functions

Update both `convex/game.ts` and `convex/challengeBattle.ts` to use new auth system:

#### Single Player Mode (`convex/game.ts`)

```typescript
import { requireAuth, getCurrentUserId, getOrCreateUser } from "./auth/helpers";

// Replace the existing getLoggedInUser function
async function getLoggedInUser(ctx: any) {
  return await getCurrentUserId(ctx);
}

// Add new authenticated-only functions
export const getUserGameHistory = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx); // Require authentication
    const userId = await getOrCreateUser(ctx);

    const userGames = await ctx.db
      .query("gameResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    return userGames;
  },
});

// Keep existing single-player functions as-is for anonymous play
```

#### Challenge Mode (`convex/challengeBattle.ts`)

```typescript
import { getCurrentUserId, getOrCreateUser } from "./auth/helpers";

// Challenge creation supports both authenticated and anonymous users
export const createChallenge = mutation({
  args: { challengerName: v.string() },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx); // Works for both auth states

    // Create challenge with user tracking
    const challengeId = await ctx.db.insert("challengeBattles", {
      gameId: generateUniqueId(),
      challengerUserId: userId,
      challengerName: args.challengerName,
      status: "waiting_for_opponent",
      challengerScore: 0,
      opponentScore: 0,
    });

    return { challengeId, gameId: challenge.gameId };
  },
});

// Challenge participation supports anonymous users
export const acceptChallenge = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    opponentName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx); // Anonymous or authenticated

    await ctx.db.patch(args.challengeId, {
      opponentUserId: userId,
      opponentName: args.opponentName,
      status: "ready_to_start",
    });
  },
});

// Authenticated users get enhanced challenge statistics
export const getUserChallengeHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required for challenge history");
    }

    const userId = await getOrCreateUser(ctx);

    const challenges = await ctx.db
      .query("challengeBattles")
      .filter((q) =>
        q.or(
          q.eq(q.field("challengerUserId"), userId),
          q.eq(q.field("opponentUserId"), userId),
        ),
      )
      .order("desc")
      .take(25);

    return challenges;
  },
});
```

### Step 8: Protect Admin Functions

Update `convex/leaderboard.ts`:

```typescript
import { requireAdminRole } from "./auth/helpers";

export const getDashboardAnalytics = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminRole(ctx); // Require admin role

    // ... existing analytics logic
  },
});

export const getDashboardAnalyticsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    // Enhanced analytics for admin with additional sensitive data
    const analytics = await getDashboardAnalyticsInternal(ctx);

    // Add admin-specific metrics
    const userRegistrations = await ctx.db
      .query("users")
      .filter((q) => q.eq("isAnonymous", false))
      .collect();

    // Challenge mode analytics
    const challengeStats = await ctx.db
      .query("challengeBattles")
      .filter((q) => q.eq("status", "completed"))
      .collect();

    const totalChallenges = challengeStats.length;
    const challengeCompletionRate =
      totalChallenges > 0
        ? (challengeStats.filter((c) => c.completedAt).length /
            totalChallenges) *
          100
        : 0;

    return {
      ...analytics,
      totalRegisteredUsers: userRegistrations.length,
      anonymousVsRegistered: {
        anonymous: analytics.totalGames - userRegistrations.length,
        registered: userRegistrations.length,
      },
      challengeMode: {
        totalChallenges,
        completedChallenges: challengeStats.filter((c) => c.completedAt).length,
        completionRate: challengeCompletionRate,
        averageScore:
          challengeStats.reduce(
            (sum, c) => sum + c.challengerScore + c.opponentScore,
            0,
          ) /
            (totalChallenges * 2) || 0,
      },
    };
  },
});
```

### Step 9: Update Main App Wrapper

Update `src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import "./index.css";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY!}
    appearance={{
      baseTheme: "dark", // Match your app's theme
    }}
  >
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <App />
    </ConvexProviderWithClerk>
  </ClerkProvider>,
);
```

### Step 10: Create Authentication Components

Create `src/components/AuthButton.tsx`:

```tsx
import {
  SignInButton,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

export function AuthButton() {
  const { isSignedIn, user } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          Welcome, {user.firstName || user.emailAddresses[0].emailAddress}
        </span>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className="brutal-btn">Sign In</button>
    </SignInButton>
  );
}
```

### Step 11: Create Protected Route Component

Create `src/components/ProtectedRoute.tsx`:

```tsx
import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  fallback,
}: ProtectedRouteProps) {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { user, isLoaded } = useUser();

  // Show loading while auth is being determined
  if (authIsLoading || !isLoaded) {
    return (
      <div className="brutal-card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p style={{ color: "var(--text-secondary)" }}>
          Loading authentication...
        </p>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      fallback || (
        <div className="brutal-card text-center">
          <h2 className="brutal-text-lg mb-4">Authentication Required</h2>
          <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
            Please sign in to access this section.
          </p>
        </div>
      )
    );
  }

  // Check admin role if required
  if (requireAdmin) {
    const userRole = user.publicMetadata?.role;
    if (userRole !== "admin") {
      return (
        fallback || (
          <div className="brutal-card text-center">
            <h2 className="brutal-text-lg mb-4">Access Denied</h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Admin privileges required to access this section.
            </p>
          </div>
        )
      );
    }
  }

  return <>{children}</>;
}
```

### Step 12: Update Dashboard Component

Update `src/Dashboard.tsx`:

```tsx
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { ProtectedRoute } from "./components/ProtectedRoute";

export function Dashboard() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  // Use the admin-protected query with conditional skipping
  const analytics = useQuery(
    api.leaderboard.getDashboardAnalyticsAdmin,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="space-y-8">
        {/* ... existing dashboard content */}
        {analytics && (
          <div className="brutal-card">
            <h3 className="brutal-text-lg mb-4">Admin Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">
                  {analytics.totalRegisteredUsers}
                </div>
                <div className="text-sm">Registered Users</div>
              </div>
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">
                  {Math.round(
                    (analytics.anonymousVsRegistered.registered /
                      (analytics.anonymousVsRegistered.registered +
                        analytics.anonymousVsRegistered.anonymous)) *
                      100,
                  )}
                  %
                </div>
                <div className="text-sm">Registration Rate</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
```

### Step 13: Create User Profile Component

Create `src/components/UserProfile.tsx`:

```tsx
import { useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";
import { ProtectedRoute } from "./ProtectedRoute";

export function UserProfile() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();

  const userStats = useQuery(
    api.leaderboard.getUserStats,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );

  const userGameHistory = useQuery(
    api.game.getUserGameHistory,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="brutal-card text-center">
          <h1 className="brutal-text-xl mb-2">Your Profile</h1>
          <p
            className="brutal-text-md"
            style={{ color: "var(--text-secondary)" }}
          >
            Welcome back,{" "}
            {user?.firstName || user?.emailAddresses[0].emailAddress}!
          </p>
        </div>

        {/* User Stats */}
        {userStats && (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Your Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">{userStats.totalGames}</div>
                <div className="text-sm">Single Player Games</div>
              </div>
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">{userStats.wins}</div>
                <div className="text-sm">Games Won</div>
              </div>
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">{userStats.winRate}%</div>
                <div className="text-sm">Win Rate</div>
              </div>
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">
                  {userStats.averageAttempts}
                </div>
                <div className="text-sm">Avg Attempts</div>
              </div>
            </div>

            {/* Challenge Mode Statistics */}
            {userStats.challengeStats && (
              <div className="mt-6">
                <h3 className="brutal-text-md mb-3">Challenge Battle Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.totalChallenges}
                    </div>
                    <div className="text-sm">Challenges Played</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.challengesWon}
                    </div>
                    <div className="text-sm">Challenges Won</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.challengeWinRate}%
                    </div>
                    <div className="text-sm">Challenge Win Rate</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.averageScore}
                    </div>
                    <div className="text-sm">Avg Challenge Score</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Game History */}
        {userGameHistory && (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Recent Games</h2>
            <div className="space-y-2">
              {userGameHistory.slice(0, 10).map((game, index) => (
                <div
                  key={game._id}
                  className="flex justify-between items-center p-3 border-2 border-gray-300"
                >
                  <div>
                    <span className="font-bold">{game.word.toUpperCase()}</span>
                    <span
                      className="text-sm ml-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {new Date(game.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div
                      className={
                        game.completed ? "text-green-600" : "text-red-600"
                      }
                    >
                      {game.completed ? "WON" : "FAILED"}
                    </div>
                    <div className="text-sm">{game.attempts} attempts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
```

### Step 14: Update Main App Component

Update `src/App.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { AuthButton } from "./components/AuthButton";
import { UserProfile } from "./components/UserProfile";
// ... other imports

export default function App() {
  const [currentPage, setCurrentPage] = useState<
    "game" | "leaderboard" | "playing" | "helper" | "dashboard" | "profile" | "challenge" | "challenge-setup"
  >("game");

  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();

  // Handle challenge invitation URLs
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const challengeInvite = urlParams.get("challenge");
    if (challengeInvite) {
      setCurrentPage("challenge");
      // Handle challenge acceptance flow
    }
  }, []);

  // ... existing code

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <header className="brutal-header sticky top-0 z-50">
        <div className="flex justify-between items-center">
          {/* Logo/Title */}
          <h1 className="brutal-text-xl">
            <button
              onClick={() => setCurrentPage("game")}
              className="hover:opacity-70 transition-opacity"
            >
              IMPOSSIBLE
            </button>
          </h1>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-4">
            <button
              onClick={() => setCurrentPage("game")}
              className={`brutal-btn ${currentPage === "game" ? "bg-gray-200 dark:bg-gray-800" : ""}`}
            >
              Play
            </button>
            <button
              onClick={() => setCurrentPage("leaderboard")}
              className={`brutal-btn ${currentPage === "leaderboard" ? "bg-gray-200 dark:bg-gray-800" : ""}`}
            >
              Leaderboard
            </button>

            {/* Authenticated user navigation */}
            {isAuthenticated && (
              <button
                onClick={() => setCurrentPage("profile")}
                className={`brutal-btn ${currentPage === "profile" ? "bg-gray-200 dark:bg-gray-800" : ""}`}
              >
                Profile
              </button>
            )}

            {/* Admin navigation */}
            {user?.publicMetadata?.role === "admin" && (
              <button
                onClick={() => setCurrentPage("dashboard")}
                className={`brutal-btn ${currentPage === "dashboard" ? "bg-gray-200 dark:bg-gray-800" : ""}`}
              >
                Dashboard
              </button>
            )}
          </nav>

          {/* Auth Button */}
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {currentPage === "profile" ? (
            <UserProfile />
          ) : currentPage === "dashboard" ? (
            <Dashboard />
          ) : currentPage === "challenge" ? (
            <ChallengeMode />
          ) : currentPage === "challenge-setup" ? (
            <ChallengeSetup />
          ) : (
            /* ... existing page logic including ImpossibleGame */
          )}
        </div>
      </main>

      {/* ... existing footer */}
    </div>
  );
}
```

### Step 15: Configure Convex HTTP Routes

Update `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { clerkWebhook } from "./auth";

const http = httpRouter();

// Clerk webhook for user synchronization
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: clerkWebhook,
});

export default http;
```

### Step 16: Set Up Clerk Webhooks

1. **In Clerk Dashboard:**

   - Go to "Webhooks" section
   - Click "Add Endpoint"
   - URL: `https://your-convex-deployment.convex.cloud/clerk-webhook`
   - Events to subscribe to:
     - `user.created`
     - `user.updated`
     - `user.deleted`

2. **Add Webhook Secret to Convex Environment:**
   ```bash
   npx convex env set CLERK_WEBHOOK_SECRET your_webhook_secret_here
   ```

### Step 17: Create Data Migration Script

Create `convex/migrations.ts`:

```typescript
import { internalMutation } from "./_generated/server";

export const migrateAnonymousUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Mark all existing users without clerkId as anonymous
    const existingUsers = await ctx.db.query("users").collect();

    for (const user of existingUsers) {
      if (!user.clerkId) {
        await ctx.db.patch(user._id, {
          isAnonymous: true,
        });
      }
    }
  },
});
```

### Step 18: Deploy and Test the Implementation

1. **Deploy Backend Changes**

   ```bash
   npx convex deploy
   ```

2. **Run Data Migration**

   ```bash
   npx convex run migrations:migrateAnonymousUsers
   ```

3. **Test Authentication Flows**
   - Test anonymous gameplay (should work unchanged)
   - Test user registration and login
   - Test admin dashboard access
   - Test profile page for authenticated users

### Step 19: Create Admin User

1. **Register First Admin User**
   - Sign up through the app
   - Go to Clerk dashboard > Users
   - Find the user and edit their public metadata
   - Add: `{"role": "admin"}`
   - Save changes

### Step 20: Final Verification and Go-Live

1. **Verification Checklist**
   - [ ] Anonymous users can play without signing up
   - [ ] Authenticated users can view their profile
   - [ ] Admin users can access dashboard
   - [ ] Public leaderboard works for all users
   - [ ] Webhook synchronization is working
   - [ ] All environment variables are set

## Security and Best Practices

### Authorization Guidelines

Following the [Convex Authorization Guide](https://stack.convex.dev/authorization):

1. **Endpoint-Level Authorization**: Primary security at function boundaries
2. **Defense in Depth**: Multiple layers of checks
3. **Principle of Least Privilege**: Users only get minimum required access

### Admin Role Security Example

```typescript
// Example of secure admin function
export const sensitiveAdminAction = mutation({
  args: {
    /* args */
  },
  handler: async (ctx, args) => {
    // 1. Authentication check
    const identity = await requireAdminRole(ctx);

    // 2. Additional authorization logic
    if (someSpecificCondition) {
      throw new Error("Additional authorization failed");
    }

    // 3. Audit logging
    await ctx.db.insert("adminActions", {
      adminId: identity.subject,
      action: "sensitiveAdminAction",
      timestamp: Date.now(),
      args: JSON.stringify(args),
    });

    // 4. Perform the action
    // ... implementation
  },
});
```

## Testing Strategy

### Authentication Flow Testing

1. **Anonymous User Flow**:

   - Can play games without signing up
   - Scores are temporary/local
   - Can view public leaderboard
   - Cannot access profile or admin areas

2. **Authenticated User Flow**:

   - Can sign in/sign up
   - Scores are saved permanently
   - Can access personal profile
   - Can view game history
   - Cannot access admin areas

3. **Admin User Flow**:
   - All authenticated user features
   - Can access admin dashboard
   - Can view sensitive analytics
   - Actions are logged

### Edge Cases to Test

1. **Session expiry during gameplay**
2. **Role changes while user is active**
3. **Anonymous to authenticated user migration**
4. **Network connectivity issues**

## Monitoring and Maintenance

### Analytics to Track

Track authentication-related metrics:

- Sign-up conversion rate
- Anonymous vs authenticated play sessions
- Admin action frequency
- Authentication error rates

### Regular Maintenance Tasks

- Monitor Clerk webhook delivery
- Review admin access logs
- Update role assignments as needed
- Performance monitoring for auth overhead

## PRD-Style Implementation Instructions

### Epic: Authentication System Integration

**Objective**: Implement Clerk-based authentication with role-based access control while preserving anonymous gameplay experience.

### User Stories

#### Story 1: Anonymous Player (Current Experience Preserved)

**As an** anonymous player  
**I want to** play the impossible game without signing up  
**So that** I can enjoy the game immediately without barriers

**Acceptance Criteria**:

- [ ] Can start and play games without authentication
- [ ] Can view public leaderboard
- [ ] Cannot access profile or admin areas
- [ ] Game flow remains identical to current experience

#### Story 2: Authenticated Player

**As a** registered user  
**I want to** sign in and have my scores saved  
**So that** I can track my progress over time

**Acceptance Criteria**:

- [ ] Can sign in using Clerk authentication
- [ ] Single-player scores are permanently saved to profile
- [ ] Challenge battle results are permanently saved to profile
- [ ] Can view personal game history for both modes
- [ ] Can access profile page with comprehensive statistics
- [ ] Can view challenge win/loss records and performance metrics

#### Story 3: Admin User

**As an** admin  
**I want to** access analytics and manage the platform  
**So that** I can monitor platform health and user engagement

**Acceptance Criteria**:

- [ ] Can access admin dashboard at `/dashboard`
- [ ] Can view comprehensive analytics for both single-player and challenge modes
- [ ] Can see challenge completion rates and battle statistics
- [ ] Can view user registration vs anonymous play metrics
- [ ] Cannot access without admin role
- [ ] Actions are logged for audit purposes

### Technical Requirements

1. **Authentication Provider**: Clerk
2. **Backend Framework**: Convex with Convex Auth
3. **Frontend Framework**: React with Clerk React
4. **Role System**: JWT claims with public metadata
5. **Migration Strategy**: Gradual rollout with anonymous user preservation

### Definition of Done

- [ ] All user stories implemented and tested
- [ ] Single-player mode works seamlessly with and without authentication
- [ ] Challenge mode supports both anonymous and authenticated players
- [ ] Security review completed for both game modes
- [ ] Performance impact assessed across all features
- [ ] Documentation updated to reflect challenge mode integration
- [ ] Monitoring and analytics in place for both modes
- [ ] Deployment checklist completed

This comprehensive guide provides everything needed to implement authentication while preserving the core game experience and adding powerful admin and user management capabilities.
