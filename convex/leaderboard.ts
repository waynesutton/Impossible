import { query } from "./_generated/server";
import { v } from "convex/values";

// Create a dummy user for demo purposes since we removed auth
async function getLoggedInUser(ctx: any) {
  // Check if a demo user exists, if not create one
  let user = await ctx.db.query("users").first();
  if (!user) {
    const userId = await ctx.db.insert("users", {
      name: "Demo Player",
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
    // Get only won games (where completed = true means they guessed correctly)
    const wonGames = await ctx.db
      .query("gameResults")
      .withIndex("by_completed_and_time", (q) => q.eq("completed", true))
      .order("desc")
      .take(50); // Limit to top 50 for performance

    // Get all games (completed and failed) for total stats
    const allGames = await ctx.db.query("gameResults").order("desc").take(100);

    return {
      completedGames: wonGames,
      totalGames: allGames.length,
      totalCompleted: wonGames.length,
      successRate:
        allGames.length > 0
          ? Math.round((wonGames.length / allGames.length) * 100)
          : 0,
    };
  },
});

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);
    if (!userId) {
      return null;
    }

    const userGames = await ctx.db
      .query("gameResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const completedGames = userGames.filter((game) => game.completed);
    const totalGames = userGames.length;

    return {
      totalGames,
      completedGames: completedGames.length,
      successRate:
        totalGames > 0
          ? Math.round((completedGames.length / totalGames) * 100)
          : 0,
      bestAttempts:
        completedGames.length > 0
          ? Math.min(...completedGames.map((g) => g.attempts))
          : null,
    };
  },
});
