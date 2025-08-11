import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create a dummy user for demo purposes since we removed auth
async function getLoggedInUser(ctx: any) {
  // Check if a demo user exists, if not create one
  let user = await ctx.db.query("users").first();
  if (!user) {
    const userId = await ctx.db.insert("users", {
      name: "Player",
      email: "demo@example.com",
      isAnonymous: false,
    });
    return userId;
  }
  return user._id;
}

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Winners (completed = true)
    const completedGames = await ctx.db
      .query("gameResults")
      .withIndex("by_completed_and_time", (q) => q.eq("completed", true))
      .order("desc")
      .take(50);

    // Recent plays (any games), newest first
    const recentPlays = await ctx.db
      .query("gameResults")
      .order("desc")
      .take(50);

    // Global totals
    const totalGames = (
      await ctx.db.query("gameResults").order("desc").take(200)
    ).length;

    return {
      completedGames,
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

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);
    if (!userId) return null;

    const userGames = await ctx.db
      .query("gameResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const completed = userGames.filter((g) => g.completed);

    return {
      totalGames: userGames.length,
      completedGames: completed.length,
      successRate:
        userGames.length > 0
          ? Math.round((completed.length / userGames.length) * 100)
          : 0,
      bestAttempts:
        completed.length > 0
          ? Math.min(...completed.map((g) => g.attempts))
          : null,
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
