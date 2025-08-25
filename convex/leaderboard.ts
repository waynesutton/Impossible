import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import {
  requireAdminRole,
  getCurrentUserIdForMutation,
  getCurrentUserIdForQuery,
} from "./auth/helpers";

// Create a dummy user for demo purposes since we removed auth
async function getLoggedInUser(ctx: any) {
  // Check if this is a mutation context
  if ("insert" in ctx.db) {
    return await getCurrentUserIdForMutation(ctx);
  } else {
    const userId = await getCurrentUserIdForQuery(ctx);
    if (!userId) {
      throw new Error("No user found for anonymous gameplay");
    }
    return userId;
  }
}

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Winners (completed = true) - filter out hidden/deleted games
    const allCompletedGames = await ctx.db
      .query("gameResults")
      .withIndex("by_completed_and_time", (q) => q.eq("completed", true))
      .order("desc")
      .filter((q) =>
        q.and(
          q.neq(q.field("isHidden"), true),
          q.neq(q.field("isDeleted"), true),
        ),
      )
      .take(50);

    // Separate legitimate winners from secret word users
    const completedGames = allCompletedGames.filter(
      (game) => !game.usedSecretWord,
    );
    const shameGames = allCompletedGames.filter((game) => game.usedSecretWord);

    // Recent plays (any games), newest first - only get 10 for initial load - filter out hidden/deleted
    const recentPlays = await ctx.db
      .query("gameResults")
      .order("desc")
      .filter((q) =>
        q.and(
          q.neq(q.field("isHidden"), true),
          q.neq(q.field("isDeleted"), true),
        ),
      )
      .take(10);

    // Global totals - filter out hidden/deleted
    const totalGames = (
      await ctx.db
        .query("gameResults")
        .order("desc")
        .filter((q) =>
          q.and(
            q.neq(q.field("isHidden"), true),
            q.neq(q.field("isDeleted"), true),
          ),
        )
        .take(200)
    ).length;

    return {
      completedGames,
      shameGames,
      recentPlays,
      totalGames,
      totalCompleted: completedGames.length,
      successRate:
        totalGames > 0
          ? Math.round((completedGames.length / totalGames) * 100)
          : 0,
    };
  },
});

// New paginated query for recent plays
export const getRecentPlays = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    games: v.array(
      v.object({
        _id: v.id("gameResults"),
        _creationTime: v.number(),
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
      }),
    ),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get games in descending order (newest first) - filter out hidden/deleted
    let query = ctx.db
      .query("gameResults")
      .order("desc")
      .filter((q) =>
        q.and(
          q.neq(q.field("isHidden"), true),
          q.neq(q.field("isDeleted"), true),
        ),
      );

    // If cursor is provided, start from that point
    if (args.cursor) {
      // Parse cursor to get the completedAt timestamp
      const cursorTime = parseInt(args.cursor);
      query = query.filter((q) => q.lt(q.field("completedAt"), cursorTime));
    }

    // Get one extra to check if there are more
    const games = await query.take(limit + 1);

    const hasMore = games.length > limit;
    const returnGames = hasMore ? games.slice(0, limit) : games;

    // Next cursor is the completedAt of the last game
    const nextCursor =
      hasMore && returnGames.length > 0
        ? returnGames[returnGames.length - 1].completedAt.toString()
        : undefined;

    return {
      games: returnGames,
      hasMore,
      nextCursor,
    };
  },
});

// Track analytics events
export const trackEvent = mutation({
  args: {
    eventType: v.string(),
    sessionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);

    await ctx.db.insert("analytics", {
      eventType: args.eventType,
      userId: userId,
      timestamp: Date.now(),
      sessionId: args.sessionId,
    });

    return null;
  },
});

// Get analytics data
export const getAnalytics = query({
  args: {},
  returns: v.object({
    totalHomepageViews: v.number(),
    totalGamesPlayed: v.number(),
  }),
  handler: async (ctx) => {
    // Count homepage views
    const homepageViews = await ctx.db
      .query("analytics")
      .withIndex("by_event_type", (q) => q.eq("eventType", "homepage_view"))
      .collect();

    // Count games played (use gameResults table as it's more accurate)
    const gamesPlayed = await ctx.db.query("gameResults").collect();

    return {
      totalHomepageViews: homepageViews.length,
      totalGamesPlayed: gamesPlayed.length,
    };
  },
});

// Comprehensive dashboard analytics
export const getDashboardAnalytics = query({
  args: {},
  returns: v.object({
    totalHomepageViews: v.number(),
    totalGamesPlayed: v.number(),
    totalSuccessfulGames: v.number(),
    successRate: v.number(),
    wordsConquered: v.number(),
    secretWordUsage: v.number(),
    attemptBreakdown: v.object({
      firstAttempt: v.number(),
      secondAttempt: v.number(),
      thirdAttempt: v.number(),
    }),
    averageAttempts: v.number(),
    uniqueSessions: v.number(),
    namedGames: v.number(),
    anonymousGames: v.number(),
    hintsRequested: v.number(),
    cluesRequested: v.number(),
    invitesCreated: v.number(),
    friendSuggestions: v.number(),
    // Player Deletion Stats
    playerDeletions: v.object({
      deletedGames: v.number(),
      deletedChallenges: v.number(),
    }),
    // Admin Moderation Stats
    adminModeration: v.object({
      hiddenGames: v.number(),
      deletedGames: v.number(),
      hiddenChallenges: v.number(),
      deletedChallenges: v.number(),
      totalHidden: v.number(),
      totalDeleted: v.number(),
    }),
    // Challenge Mode Analytics
    challengeMode: v.object({
      challengesCreated: v.number(),
      challengesCompleted: v.number(),
      totalChallengeBattles: v.number(),
      challengeLinksClicked: v.number(),
      averageChallengeScore: v.number(),
      topChallengeScore: v.number(),
      rematchRequests: v.number(),
      round3Games: v.number(), // Track games that reach round 3 (30-second timer)
      averageCompletionTime: v.number(), // Average time to complete a challenge
      tieGames: v.number(), // Number of tied challenge results
    }),
    // Link Analytics
    linkAnalytics: v.object({
      normalModeLinksClicked: v.number(),
      challengeLinksShared: v.number(),
    }),
    // Crossword Mode Analytics
    crosswordMode: v.object({
      totalCrosswordsGenerated: v.number(),
      totalCrosswordsCompleted: v.number(),
      averageCompletionTime: v.number(),
      averageHintsUsed: v.number(),
      averageCluesUsed: v.number(),
      dailyActiveUsers: v.number(),
      crosswordInvitesCreated: v.number(),
      averageFinalScore: v.number(),
      topCrosswordScore: v.number(),
    }),
    recentActivity: v.array(
      v.object({
        date: v.string(),
        gamesPlayed: v.number(),
        successfulGames: v.number(),
        challengeBattles: v.number(),
        crosswordGames: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    // Check admin role gracefully
    let identity;
    try {
      identity = await ctx.auth.getUserIdentity();
    } catch (error) {
      console.error("Error getting user identity:", error);
      // Return empty analytics on auth error
      return {
        totalHomepageViews: 0,
        totalGamesPlayed: 0,
        totalSuccessfulGames: 0,
        successRate: 0,
        wordsConquered: 0,
        secretWordUsage: 0,
        attemptBreakdown: {
          firstAttempt: 0,
          secondAttempt: 0,
          thirdAttempt: 0,
        },
        averageAttempts: 0,
        uniqueSessions: 0,
        namedGames: 0,
        anonymousGames: 0,
        hintsRequested: 0,
        cluesRequested: 0,
        invitesCreated: 0,
        friendSuggestions: 0,
        playerDeletions: {
          deletedGames: 0,
          deletedChallenges: 0,
        },
        adminModeration: {
          hiddenGames: 0,
          deletedGames: 0,
          hiddenChallenges: 0,
          deletedChallenges: 0,
          totalHidden: 0,
          totalDeleted: 0,
        },
        challengeMode: {
          challengesCreated: 0,
          challengesCompleted: 0,
          totalChallengeBattles: 0,
          challengeLinksClicked: 0,
          averageChallengeScore: 0,
          topChallengeScore: 0,
          rematchRequests: 0,
          round3Games: 0,
          averageCompletionTime: 0,
          tieGames: 0,
        },
        linkAnalytics: {
          normalModeLinksClicked: 0,
          challengeLinksShared: 0,
        },
        crosswordMode: {
          totalCrosswordsGenerated: 0,
          totalCrosswordsCompleted: 0,
          averageCompletionTime: 0,
          averageHintsUsed: 0,
          averageCluesUsed: 0,
          dailyActiveUsers: 0,
          crosswordInvitesCreated: 0,
          averageFinalScore: 0,
          topCrosswordScore: 0,
        },
        recentActivity: [],
      };
    }

    if (!identity) {
      // Return empty/default analytics for unauthenticated users
      return {
        totalHomepageViews: 0,
        totalGamesPlayed: 0,
        totalSuccessfulGames: 0,
        successRate: 0,
        wordsConquered: 0,
        secretWordUsage: 0,
        attemptBreakdown: {
          firstAttempt: 0,
          secondAttempt: 0,
          thirdAttempt: 0,
        },
        averageAttempts: 0,
        uniqueSessions: 0,
        namedGames: 0,
        anonymousGames: 0,
        hintsRequested: 0,
        cluesRequested: 0,
        invitesCreated: 0,
        friendSuggestions: 0,
        playerDeletions: {
          deletedGames: 0,
          deletedChallenges: 0,
        },
        adminModeration: {
          hiddenGames: 0,
          deletedGames: 0,
          hiddenChallenges: 0,
          deletedChallenges: 0,
          totalHidden: 0,
          totalDeleted: 0,
        },
        challengeMode: {
          challengesCreated: 0,
          challengesCompleted: 0,
          totalChallengeBattles: 0,
          challengeLinksClicked: 0,
          averageChallengeScore: 0,
          topChallengeScore: 0,
          rematchRequests: 0,
          round3Games: 0,
          averageCompletionTime: 0,
          tieGames: 0,
        },
        linkAnalytics: {
          normalModeLinksClicked: 0,
          challengeLinksShared: 0,
        },
        crosswordMode: {
          totalCrosswordsGenerated: 0,
          totalCrosswordsCompleted: 0,
          averageCompletionTime: 0,
          averageHintsUsed: 0,
          averageCluesUsed: 0,
          dailyActiveUsers: 0,
          crosswordInvitesCreated: 0,
          averageFinalScore: 0,
          topCrosswordScore: 0,
        },
        recentActivity: [],
      };
    }

    // Check admin role - try multiple possible locations for the role
    const userRole = identity.role || (identity as any).publicMetadata?.role;
    if (!userRole || userRole !== "admin") {
      // Return empty analytics for non-admin users, but at least they're authenticated
      return {
        totalHomepageViews: 0,
        totalGamesPlayed: 0,
        totalSuccessfulGames: 0,
        successRate: 0,
        wordsConquered: 0,
        secretWordUsage: 0,
        attemptBreakdown: {
          firstAttempt: 0,
          secondAttempt: 0,
          thirdAttempt: 0,
        },
        averageAttempts: 0,
        uniqueSessions: 0,
        namedGames: 0,
        anonymousGames: 0,
        hintsRequested: 0,
        cluesRequested: 0,
        invitesCreated: 0,
        friendSuggestions: 0,
        playerDeletions: {
          deletedGames: 0,
          deletedChallenges: 0,
        },
        adminModeration: {
          hiddenGames: 0,
          deletedGames: 0,
          hiddenChallenges: 0,
          deletedChallenges: 0,
          totalHidden: 0,
          totalDeleted: 0,
        },
        challengeMode: {
          challengesCreated: 0,
          challengesCompleted: 0,
          totalChallengeBattles: 0,
          challengeLinksClicked: 0,
          averageChallengeScore: 0,
          topChallengeScore: 0,
          rematchRequests: 0,
          round3Games: 0,
          averageCompletionTime: 0,
          tieGames: 0,
        },
        linkAnalytics: {
          normalModeLinksClicked: 0,
          challengeLinksShared: 0,
        },
        crosswordMode: {
          totalCrosswordsGenerated: 0,
          totalCrosswordsCompleted: 0,
          averageCompletionTime: 0,
          averageHintsUsed: 0,
          averageCluesUsed: 0,
          dailyActiveUsers: 0,
          crosswordInvitesCreated: 0,
          averageFinalScore: 0,
          topCrosswordScore: 0,
        },
        recentActivity: [],
      };
    }

    // Continue with real analytics for admin users

    // Get all game results
    const allGames = await ctx.db.query("gameResults").collect();
    const successfulGames = allGames.filter(
      (game) => game.completed && !game.usedSecretWord,
    );
    const secretWordGames = allGames.filter((game) => game.usedSecretWord);

    // Count homepage views
    const homepageViews = await ctx.db
      .query("analytics")
      .withIndex("by_event_type", (q) => q.eq("eventType", "homepage_view"))
      .collect();

    // Get unique words conquered
    const uniqueWords = new Set(
      successfulGames.map((game) => game.word.toLowerCase()),
    );

    // Attempt breakdown for successful games
    const attemptBreakdown = {
      firstAttempt: successfulGames.filter((game) => game.attempts === 1)
        .length,
      secondAttempt: successfulGames.filter((game) => game.attempts === 2)
        .length,
      thirdAttempt: successfulGames.filter((game) => game.attempts === 3)
        .length,
    };

    // Average attempts for all games
    const totalAttempts = allGames.reduce(
      (sum, game) => sum + game.attempts,
      0,
    );
    const averageAttempts =
      allGames.length > 0 ? totalAttempts / allGames.length : 0;

    // Session statistics (since there's no real user auth)
    // Note: In this demo app, all players share the same user record
    // So user counts are not meaningful - we'll track unique sessions instead
    const uniqueSessions = new Set(
      await ctx.db
        .query("analytics")
        .filter((q) => q.neq(q.field("sessionId"), undefined))
        .collect()
        .then((events) => events.map((e) => e.sessionId).filter(Boolean)),
    ).size;

    // Count named vs anonymous from game results instead
    const namedGames = allGames.filter(
      (game) => game.displayName && game.displayName !== "Anonymous",
    ).length;
    const anonymousGames = allGames.length - namedGames;

    // Get user attempts for hints/clues analysis
    const userAttempts = await ctx.db.query("userAttempts").collect();
    const hintsRequested = userAttempts.filter(
      (attempt) => attempt.hint,
    ).length;
    const cluesRequested = userAttempts.filter(
      (attempt) => attempt.clue,
    ).length;

    // Invitation and suggestion statistics
    const invites = await ctx.db.query("invites").collect();
    const suggestions = await ctx.db.query("suggestions").collect();

    // Challenge Mode Analytics
    const allChallengeBattles = await ctx.db
      .query("challengeBattles")
      .collect();
    const completedChallengeBattles = allChallengeBattles.filter(
      (battle) => battle.status === "completed",
    );
    const challengeInvites = await ctx.db.query("challengeInvites").collect();
    const rematchRequests = await ctx.db.query("rematchRequests").collect();

    // Calculate challenge scores
    const allChallengeScores = completedChallengeBattles.flatMap((battle) => [
      battle.challengerScore,
      battle.opponentScore,
    ]);
    const averageChallengeScore =
      allChallengeScores.length > 0
        ? Math.round(
            allChallengeScores.reduce((sum, score) => sum + score, 0) /
              allChallengeScores.length,
          )
        : 0;
    const topChallengeScore =
      allChallengeScores.length > 0 ? Math.max(...allChallengeScores) : 0;

    // Additional challenge metrics
    const round3Games = completedChallengeBattles.filter(
      (battle) => battle.currentWordIndex >= 2,
    ).length;

    const tieGames = completedChallengeBattles.filter(
      (battle) => !battle.winner,
    ).length;

    const averageCompletionTime =
      completedChallengeBattles.length > 0
        ? Math.round(
            completedChallengeBattles
              .filter((battle) => battle.startedAt && battle.completedAt)
              .reduce((sum, battle) => {
                const duration = battle.completedAt! - battle.startedAt!;
                return sum + duration;
              }, 0) /
              completedChallengeBattles.filter(
                (battle) => battle.startedAt && battle.completedAt,
              ).length,
          ) / 1000 // Convert to seconds
        : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentGames = allGames.filter(
      (game) => game.completedAt > sevenDaysAgo,
    );
    const recentChallengeBattles = completedChallengeBattles.filter(
      (battle) => battle.completedAt && battle.completedAt > sevenDaysAgo,
    );

    // Group by date for recent activity
    const activityMap = new Map<
      string,
      {
        gamesPlayed: number;
        successfulGames: number;
        challengeBattles: number;
        crosswordGames: number;
      }
    >();

    // Add regular games to activity map
    recentGames.forEach((game) => {
      const date = new Date(game.completedAt).toISOString().split("T")[0];
      const current = activityMap.get(date) || {
        gamesPlayed: 0,
        successfulGames: 0,
        challengeBattles: 0,
        crosswordGames: 0,
      };
      current.gamesPlayed++;
      if (game.completed && !game.usedSecretWord) {
        current.successfulGames++;
      }
      activityMap.set(date, current);
    });

    // Add challenge battles to activity map
    recentChallengeBattles.forEach((battle) => {
      const date = new Date(battle.completedAt || battle._creationTime)
        .toISOString()
        .split("T")[0];
      const current = activityMap.get(date) || {
        gamesPlayed: 0,
        successfulGames: 0,
        challengeBattles: 0,
        crosswordGames: 0,
      };
      current.challengeBattles++;
      activityMap.set(date, current);
    });

    // Add crossword games to activity map
    const recentCrosswordResults = await ctx.db
      .query("crosswordResults")
      .filter((q) => q.gt(q.field("completedAt"), sevenDaysAgo))
      .collect();

    recentCrosswordResults.forEach((result) => {
      const date = new Date(result.completedAt).toISOString().split("T")[0];
      const current = activityMap.get(date) || {
        gamesPlayed: 0,
        successfulGames: 0,
        challengeBattles: 0,
        crosswordGames: 0,
      };
      current.crosswordGames++;
      activityMap.set(date, current);
    });

    const recentActivity = Array.from(activityMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Player deletion statistics
    const playerDeletedGames = allGames.filter(
      (game) => game.isDeleted === true && !game.adminAction,
    ).length;
    const playerDeletedChallenges = allChallengeBattles.filter(
      (battle) => battle.isDeleted === true && !battle.adminAction,
    ).length;

    // Admin moderation statistics
    const adminHiddenGames = allGames.filter(
      (game) => game.isHidden === true && game.adminAction,
    ).length;
    const adminDeletedGames = allGames.filter(
      (game) => game.isDeleted === true && game.adminAction,
    ).length;
    const adminHiddenChallenges = allChallengeBattles.filter(
      (battle) => battle.isHidden === true && battle.adminAction,
    ).length;
    const adminDeletedChallenges = allChallengeBattles.filter(
      (battle) => battle.isDeleted === true && battle.adminAction,
    ).length;

    // Total moderation (for backwards compatibility)
    const hiddenGames = allGames.filter(
      (game) => game.isHidden === true,
    ).length;
    const deletedGames = allGames.filter(
      (game) => game.isDeleted === true,
    ).length;
    const hiddenChallenges = allChallengeBattles.filter(
      (battle) => battle.isHidden === true,
    ).length;
    const deletedChallenges = allChallengeBattles.filter(
      (battle) => battle.isDeleted === true,
    ).length;

    return {
      totalHomepageViews: homepageViews.length,
      totalGamesPlayed: allGames.length,
      totalSuccessfulGames: successfulGames.length,
      successRate:
        allGames.length > 0
          ? Math.round((successfulGames.length / allGames.length) * 100)
          : 0,
      wordsConquered: uniqueWords.size,
      secretWordUsage: secretWordGames.length,
      attemptBreakdown,
      averageAttempts: Math.round(averageAttempts * 100) / 100,
      uniqueSessions,
      namedGames,
      anonymousGames,
      hintsRequested,
      cluesRequested,
      invitesCreated: invites.length,
      friendSuggestions: suggestions.length,
      // Player Deletion Stats
      playerDeletions: {
        deletedGames: playerDeletedGames,
        deletedChallenges: playerDeletedChallenges,
      },
      // Admin Moderation Stats
      adminModeration: {
        hiddenGames: adminHiddenGames,
        deletedGames: adminDeletedGames,
        hiddenChallenges: adminHiddenChallenges,
        deletedChallenges: adminDeletedChallenges,
        totalHidden: hiddenGames,
        totalDeleted: deletedGames,
      },
      // Challenge Mode Analytics
      challengeMode: {
        challengesCreated: allChallengeBattles.length,
        challengesCompleted: completedChallengeBattles.length,
        totalChallengeBattles: allChallengeBattles.length, // Total including incomplete
        challengeLinksClicked: challengeInvites.filter((invite) => invite.used)
          .length,
        averageChallengeScore,
        topChallengeScore,
        rematchRequests: rematchRequests.length,
        round3Games,
        averageCompletionTime,
        tieGames,
      },
      // Link Analytics
      linkAnalytics: {
        normalModeLinksClicked: invites.filter((invite) => invite.used).length, // Using regular invites for normal mode
        challengeLinksShared: challengeInvites.length, // Total challenge invites created (shared)
      },

      // Crossword Mode Analytics
      crosswordMode: await calculateCrosswordAnalytics(ctx),

      recentActivity,
    };
  },
});

// User stats for authenticated users
// Simple admin functions for moderation
export const adminHideGame = mutation({
  args: { gameId: v.id("gameResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireAdminRole(ctx);
    await ctx.db.patch(args.gameId, {
      isHidden: true,
      adminAction: identity.email || "Admin",
      adminActionAt: Date.now(),
    });
    return null;
  },
});

export const adminDeleteGame = mutation({
  args: { gameId: v.id("gameResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireAdminRole(ctx);
    await ctx.db.patch(args.gameId, {
      isDeleted: true,
      adminAction: identity.email || "Admin",
      adminActionAt: Date.now(),
    });
    return null;
  },
});

export const adminHideChallenge = mutation({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireAdminRole(ctx);
    await ctx.db.patch(args.challengeId, {
      isHidden: true,
      adminAction: identity.email || "Admin",
      adminActionAt: Date.now(),
    });
    return null;
  },
});

export const adminDeleteChallenge = mutation({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireAdminRole(ctx);
    await ctx.db.patch(args.challengeId, {
      isDeleted: true,
      adminAction: identity.email || "Admin",
      adminActionAt: Date.now(),
    });
    return null;
  },
});

export const getUserStats = query({
  args: {},
  returns: v.object({
    totalGames: v.number(),
    wins: v.number(),
    winRate: v.number(),
    averageAttempts: v.number(),
    challengeStats: v.optional(
      v.object({
        totalChallenges: v.number(),
        challengesWon: v.number(),
        challengeWinRate: v.number(),
        averageScore: v.number(),
      }),
    ),
    crosswordStats: v.optional(
      v.object({
        totalCrosswords: v.number(),
        crosswordsCompleted: v.number(),
        averageScore: v.number(),
        bestScore: v.number(),
        averageTime: v.number(),
        fastestTime: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return default stats for unauthenticated users
      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        averageAttempts: 0,
        challengeStats: undefined,
        crosswordStats: undefined,
      };
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!existingUser) {
      // Return default stats for users not yet in database
      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        averageAttempts: 0,
        challengeStats: undefined,
        crosswordStats: undefined,
      };
    }

    const userId = existingUser._id;

    // Get user's single-player game results
    const userGames = await ctx.db
      .query("gameResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const totalGames = userGames.length;
    const wins = userGames.filter(
      (game) => game.completed && !game.usedSecretWord,
    ).length;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    const averageAttempts =
      totalGames > 0
        ? Math.round(
            (userGames.reduce((sum, game) => sum + game.attempts, 0) /
              totalGames) *
              10,
          ) / 10
        : 0;

    // Get user's challenge stats
    const userChallenges = await ctx.db
      .query("challengeBattles")
      .filter((q) =>
        q.or(
          q.eq(q.field("challengerUserId"), userId),
          q.eq(q.field("opponentUserId"), userId),
        ),
      )
      .collect();

    const completedChallenges = userChallenges.filter(
      (c) => c.status === "completed",
    );
    const challengesWon = completedChallenges.filter((c) => {
      const isChallenger = c.challengerUserId === userId;
      return (
        (isChallenger && c.winner === "challenger") ||
        (!isChallenger && c.winner === "opponent")
      );
    }).length;

    const challengeWinRate =
      completedChallenges.length > 0
        ? Math.round((challengesWon / completedChallenges.length) * 100)
        : 0;

    const averageScore =
      completedChallenges.length > 0
        ? Math.round(
            completedChallenges.reduce((sum, c) => {
              const isChallenger = c.challengerUserId === userId;
              return sum + (isChallenger ? c.challengerScore : c.opponentScore);
            }, 0) / completedChallenges.length,
          )
        : 0;

    // Get user's crossword stats
    const userCrosswordResults = await ctx.db
      .query("crosswordResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const completedCrosswords = userCrosswordResults.filter(
      (result) => result.completed,
    );

    const crosswordStats =
      userCrosswordResults.length > 0
        ? {
            totalCrosswords: userCrosswordResults.length,
            crosswordsCompleted: completedCrosswords.length,
            averageScore:
              completedCrosswords.length > 0
                ? Math.round(
                    completedCrosswords.reduce(
                      (sum, result) => sum + result.finalScore,
                      0,
                    ) / completedCrosswords.length,
                  )
                : 0,
            bestScore:
              completedCrosswords.length > 0
                ? Math.max(...completedCrosswords.map((r) => r.finalScore))
                : 0,
            averageTime:
              completedCrosswords.length > 0
                ? Math.round(
                    completedCrosswords.reduce(
                      (sum, result) => sum + result.totalTimeMinutes,
                      0,
                    ) / completedCrosswords.length,
                  )
                : 0,
            fastestTime:
              completedCrosswords.length > 0
                ? Math.min(
                    ...completedCrosswords.map((r) => r.totalTimeMinutes),
                  )
                : 0,
          }
        : undefined;

    return {
      totalGames,
      wins,
      winRate,
      averageAttempts,
      challengeStats:
        completedChallenges.length > 0
          ? {
              totalChallenges: completedChallenges.length,
              challengesWon,
              challengeWinRate,
              averageScore,
            }
          : undefined,
      crosswordStats,
    };
  },
});

// Get crossword leaderboard
export const getCrosswordLeaderboard = query({
  args: {},
  returns: v.object({
    topScores: v.array(
      v.object({
        userId: v.string(),
        userName: v.string(),
        finalScore: v.number(),
        totalTimeMinutes: v.number(),
        hintsUsed: v.number(),
        cluesUsed: v.number(),
        completedAt: v.number(),
      }),
    ),
    recentCompletions: v.array(
      v.object({
        userId: v.string(),
        userName: v.string(),
        finalScore: v.number(),
        totalTimeMinutes: v.number(),
        hintsUsed: v.number(),
        cluesUsed: v.number(),
        completedAt: v.number(),
      }),
    ),
    stats: v.object({
      totalCrosswordsCompleted: v.number(),
      averageScore: v.number(),
      averageTime: v.number(),
      fastestTime: v.number(),
    }),
  }),
  handler: async (ctx) => {
    try {
      // Get all completed crossword results
      const allResults = await ctx.db.query("crosswordResults").collect();
      const completedResults = allResults.filter((result) => result.completed);

      if (completedResults.length === 0) {
        return {
          topScores: [],
          recentCompletions: [],
          stats: {
            totalCrosswordsCompleted: 0,
            averageScore: 0,
            averageTime: 0,
            fastestTime: 0,
          },
        };
      }

      // Get users for display names
      const userIds = [
        ...new Set(completedResults.map((result) => result.userId)),
      ];
      const users = await Promise.all(
        userIds.map((userId) => ctx.db.get(userId)),
      );
      const userMap = new Map(
        users.filter(Boolean).map((user) => [user!._id, user]),
      );

      // Prepare results with user names
      const resultsWithNames = completedResults
        .map((result) => {
          const user = userMap.get(result.userId);
          return {
            userId: result.userId,
            userName: user?.name || user?.email || "Anonymous",
            finalScore: result.finalScore,
            totalTimeMinutes: result.totalTimeMinutes,
            hintsUsed: result.hintsUsed,
            cluesUsed: result.cluesUsed,
            completedAt: result.completedAt,
          };
        })
        .filter(Boolean);

      // Top scores (sorted by score, then by time)
      const topScores = resultsWithNames
        .sort((a, b) => {
          if (b.finalScore !== a.finalScore) {
            return b.finalScore - a.finalScore; // Higher score wins
          }
          return a.totalTimeMinutes - b.totalTimeMinutes; // Faster time wins if scores equal
        })
        .slice(0, 10);

      // Recent completions (last 10)
      const recentCompletions = resultsWithNames
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, 10);

      // Calculate stats
      const averageScore = Math.round(
        resultsWithNames.reduce((sum, result) => sum + result.finalScore, 0) /
          resultsWithNames.length,
      );
      const averageTime = Math.round(
        resultsWithNames.reduce(
          (sum, result) => sum + result.totalTimeMinutes,
          0,
        ) / resultsWithNames.length,
      );
      const fastestTime = Math.min(
        ...resultsWithNames.map((result) => result.totalTimeMinutes),
      );

      return {
        topScores,
        recentCompletions,
        stats: {
          totalCrosswordsCompleted: completedResults.length,
          averageScore,
          averageTime,
          fastestTime,
        },
      };
    } catch (error) {
      console.error("Error getting crossword leaderboard:", error);
      return {
        topScores: [],
        recentCompletions: [],
        stats: {
          totalCrosswordsCompleted: 0,
          averageScore: 0,
          averageTime: 0,
          fastestTime: 0,
        },
      };
    }
  },
});

// Helper function to calculate crossword analytics
async function calculateCrosswordAnalytics(ctx: any) {
  try {
    // Get all crossword data
    const allCrosswordPuzzles = await ctx.db
      .query("crosswordPuzzles")
      .collect();
    const allCrosswordResults = await ctx.db
      .query("crosswordResults")
      .collect();
    const allCrosswordInvites = await ctx.db
      .query("crosswordInvites")
      .collect();
    const completedCrosswords = allCrosswordResults.filter(
      (result: Doc<"crosswordResults">) => result.completed,
    );

    // Calculate completion time average
    const averageCompletionTime =
      completedCrosswords.length > 0
        ? Math.round(
            completedCrosswords.reduce(
              (sum: number, result: Doc<"crosswordResults">) =>
                sum + result.totalTimeMinutes,
              0,
            ) / completedCrosswords.length,
          )
        : 0;

    // Calculate hints and clues usage
    const averageHintsUsed =
      completedCrosswords.length > 0
        ? Math.round(
            (completedCrosswords.reduce(
              (sum: number, result: Doc<"crosswordResults">) =>
                sum + result.hintsUsed,
              0,
            ) /
              completedCrosswords.length) *
              10,
          ) / 10 // Round to 1 decimal place
        : 0;

    const averageCluesUsed =
      completedCrosswords.length > 0
        ? Math.round(
            (completedCrosswords.reduce(
              (sum: number, result: Doc<"crosswordResults">) =>
                sum + result.cluesUsed,
              0,
            ) /
              completedCrosswords.length) *
              10,
          ) / 10 // Round to 1 decimal place
        : 0;

    // Calculate daily active users (unique users who played in last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCrosswordResults = allCrosswordResults.filter(
      (result: Doc<"crosswordResults">) => result.completedAt > sevenDaysAgo,
    );
    const dailyActiveUsers = new Set(
      recentCrosswordResults.map(
        (result: Doc<"crosswordResults">) => result.userId,
      ),
    ).size;

    // Calculate score metrics
    const allScores = allCrosswordResults.map(
      (result: Doc<"crosswordResults">) => result.finalScore,
    );
    const averageFinalScore =
      allScores.length > 0
        ? Math.round(
            allScores.reduce((sum: number, score: number) => sum + score, 0) /
              allScores.length,
          )
        : 0;
    const topCrosswordScore = allScores.length > 0 ? Math.max(...allScores) : 0;

    return {
      totalCrosswordsGenerated: allCrosswordPuzzles.length,
      totalCrosswordsCompleted: completedCrosswords.length,
      averageCompletionTime,
      averageHintsUsed,
      averageCluesUsed,
      dailyActiveUsers,
      crosswordInvitesCreated: allCrosswordInvites.length,
      averageFinalScore,
      topCrosswordScore,
    };
  } catch (error) {
    console.error("Error calculating crossword analytics:", error);
    // Return default values on error
    return {
      totalCrosswordsGenerated: 0,
      totalCrosswordsCompleted: 0,
      averageCompletionTime: 0,
      averageHintsUsed: 0,
      averageCluesUsed: 0,
      dailyActiveUsers: 0,
      crosswordInvitesCreated: 0,
      averageFinalScore: 0,
      topCrosswordScore: 0,
    };
  }
}

// Get recent crossword completions for leaderboard display
export const getCrosswordCompletions = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      userId: v.string(),
      userName: v.string(),
      dateString: v.string(),
      completedAt: v.number(),
      usedSecretCode: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get recent completed crosswords
    const completions = await ctx.db
      .query("crosswordResults")
      .withIndex("by_completion_and_time", (q) => q.eq("completed", true))
      .order("desc")
      .take(limit);

    return await Promise.all(
      completions.map(async (result) => {
        const user = await ctx.db.get(result.userId);
        return {
          userId: result.userId,
          userName: user?.name || "Anonymous",
          dateString: result.dateString,
          completedAt: result.completedAt,
          usedSecretCode: result.usedSecretCode || false,
        };
      }),
    );
  },
});
