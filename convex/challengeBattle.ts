import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// =====================================
// Helper Functions
// =====================================

// Get timer duration based on word index - round 3 gets 30s, others get 60s
function getTimerDuration(wordIndex: number): number {
  return wordIndex === 2 ? 30000 : 60000; // 30s for round 3, 60s for rounds 1&2
}

// =====================================
// Demo User Management
// =====================================

import {
  getCurrentUserIdForMutation,
  getCurrentUserIdForQuery,
  getOrCreateUser,
  requireAuth,
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

// For testing: create test users
async function getTestUser(ctx: any, userNumber: number) {
  const existingUser = await ctx.db
    .query("users")
    .filter((q: any) =>
      q.eq(q.field("email"), `testuser${userNumber}@example.com`),
    )
    .first();

  if (existingUser) {
    return existingUser._id;
  }

  return await ctx.db.insert("users", {
    name: `Test User ${userNumber}`,
    email: `testuser${userNumber}@example.com`,
    isAnonymous: false,
  });
}

function generateGameId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

// =====================================
// Core Challenge Flow Functions
// =====================================

/**
 * Create new challenge
 */
export const createChallenge = mutation({
  args: { challengerName: v.string() },
  returns: v.object({
    challengeId: v.id("challengeBattles"),
    challengeLink: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    const gameId = generateGameId();

    // Create challengeBattle record with challenger
    const challengeId = await ctx.db.insert("challengeBattles", {
      gameId,
      challengerUserId: userId,
      challengerName: args.challengerName,
      status: "waiting_for_opponent",
      currentWordIndex: 0,
      challengerScore: 0,
      opponentScore: 0,
      maxWords: 3, // Always 3 words for challenge mode
    });

    // Generate challenge invite
    await ctx.db.insert("challengeInvites", {
      battleId: challengeId,
      createdBy: userId,
      createdAt: Date.now(),
      used: false,
    });

    // Generate challenge link
    const challengeLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173"}/?challenge=${challengeId}`;

    return { challengeId, challengeLink };
  },
});

/**
 * Accept challenge via link
 */
export const acceptChallenge = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    opponentName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    challengeId: v.id("challengeBattles"),
  }),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    if (challenge.status !== "waiting_for_opponent") {
      throw new Error("Challenge is no longer available");
    }

    if (challenge.opponentUserId) {
      throw new Error("Challenge already has an opponent");
    }

    // Create a unique opponent user ID to ensure they're different from challenger
    // Create a new unique user for the opponent
    const uniqueSuffix = Math.random().toString(36).substring(7);
    const opponentUserId = await ctx.db.insert("users", {
      name: `${args.opponentName}_${uniqueSuffix}`,
      email: `opponent_${uniqueSuffix}@demo.com`,
      isAnonymous: true, // Mark as demo user
    });

    // Double-check that opponent is not the same as challenger
    if (challenge.challengerUserId === opponentUserId) {
      throw new Error("You cannot accept your own challenge");
    }

    // Add opponent to challenge
    await ctx.db.patch(args.challengeId, {
      opponentUserId: opponentUserId,
      opponentName: args.opponentName,
      status: "ready_to_start",
    });

    // Mark invite as used
    const invite = await ctx.db
      .query("challengeInvites")
      .withIndex("by_battle", (q) => q.eq("battleId", args.challengeId))
      .first();

    if (invite) {
      await ctx.db.patch(invite._id, { used: true });
    }

    return { success: true, challengeId: args.challengeId };
  },
});

/**
 * Update current guess in real-time (like regular game)
 */
export const updateChallengeGuess = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    guess: v.string(),
    isOpponentSession: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge || challenge.status !== "in_progress") {
      return null;
    }

    // Determine player role
    const userId = await getLoggedInUser(ctx);
    let playerRole: "challenger" | "opponent";

    if (args.isOpponentSession) {
      playerRole = "opponent";
    } else if (challenge.challengerUserId === userId) {
      playerRole = "challenger";
    } else if (challenge.opponentUserId === userId) {
      playerRole = "opponent";
    } else {
      return null; // Not part of this challenge
    }

    // Get or create player's attempt record
    let attemptRecord = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_player_word", (q: any) =>
        q
          .eq("battleId", args.challengeId)
          .eq("player", playerRole)
          .eq("wordIndex", challenge.currentWordIndex),
      )
      .first();

    if (!attemptRecord) {
      // Create new attempt record
      const currentWordGameId = `${challenge.gameId}_${challenge.currentWordIndex}`;
      const currentGameWord = await ctx.db
        .query("gameWords")
        .withIndex("by_game_id", (q) => q.eq("gameId", currentWordGameId))
        .unique();

      if (!currentGameWord) return null;

      const attemptId = await ctx.db.insert("challengeWordAttempts", {
        battleId: args.challengeId,
        wordIndex: challenge.currentWordIndex,
        gameWordId: currentGameWord._id,
        player: playerRole,
        attempts: 0,
        completed: false,
        currentGuess: args.guess.toUpperCase(),
        finalScore: 0,
        usedHint: false,
        usedClue: false,
        usedInviteFriend: false,
      });

      attemptRecord = await ctx.db.get(attemptId);
    }

    if (attemptRecord && !attemptRecord.completed) {
      // Update current guess
      await ctx.db.patch(attemptRecord._id, {
        currentGuess: args.guess.toUpperCase(),
      });
    }

    return null;
  },
});

/**
 * Use help feature (Ask for Help or Ask for Clue)
 */
export const useChallengeHelp = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    helpType: v.union(v.literal("hint"), v.literal("clue")),
    isOpponentSession: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    content: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge || challenge.status !== "in_progress") {
      throw new Error("Challenge not found or not in progress");
    }

    // Determine player role
    const userId = await getLoggedInUser(ctx);
    let playerRole: "challenger" | "opponent";

    if (args.isOpponentSession) {
      playerRole = "opponent";
    } else if (challenge.challengerUserId === userId) {
      playerRole = "challenger";
    } else if (challenge.opponentUserId === userId) {
      playerRole = "opponent";
    } else {
      throw new Error("You are not part of this challenge");
    }

    // Get current attempt record
    let attemptRecord = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_player_word", (q: any) =>
        q
          .eq("battleId", args.challengeId)
          .eq("player", playerRole)
          .eq("wordIndex", challenge.currentWordIndex),
      )
      .first();

    if (!attemptRecord) {
      throw new Error("No attempt record found");
    }

    if (attemptRecord.completed) {
      throw new Error("You have already completed this word");
    }

    // Check if help type already used - if so, just return the same content
    const helpField = args.helpType === "hint" ? "usedHint" : "usedClue";

    // Get the current word
    const currentWordGameId = `${challenge.gameId}_${challenge.currentWordIndex}`;
    const currentGameWord = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", currentWordGameId))
      .unique();

    if (!currentGameWord) {
      throw new Error("Current word not found");
    }

    // Generate help content
    let content = "";
    if (args.helpType === "hint") {
      // Simple hint: show word length and first letter
      content = `This ${currentGameWord.word.length}-letter word starts with "${currentGameWord.word[0]}"`;
    } else if (args.helpType === "clue") {
      // Simple clue: show a letter position
      const middleIndex = Math.floor(currentGameWord.word.length / 2);
      content = `Letter ${middleIndex + 1} is "${currentGameWord.word[middleIndex]}"`;
    }

    // Mark help as used only if not already used
    if (!attemptRecord[helpField]) {
      await ctx.db.patch(attemptRecord._id, {
        [helpField]: true,
      });
    }

    return {
      success: true,
      message: attemptRecord[helpField]
        ? `${args.helpType === "hint" ? "Hint" : "Clue"} (already used)`
        : `${args.helpType === "hint" ? "Hint" : "Clue"} revealed!`,
      content,
    };
  },
});

/**
 * Submit a guess for the current word
 */
export const submitChallengeGuess = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    guess: v.string(),
    isOpponentSession: v.optional(v.boolean()), // Helper for demo mode
  },
  returns: v.object({
    correct: v.boolean(),
    score: v.number(),
    wordCompleted: v.boolean(),
    gameCompleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    if (challenge.status !== "in_progress") {
      throw new Error("Challenge is not in progress");
    }

    // Determine player role
    const userId = await getLoggedInUser(ctx);
    let playerRole: "challenger" | "opponent";

    if (args.isOpponentSession) {
      playerRole = "opponent";
    } else if (challenge.challengerUserId === userId) {
      playerRole = "challenger";
    } else if (challenge.opponentUserId === userId) {
      playerRole = "opponent";
    } else {
      throw new Error("You are not part of this challenge");
    }

    // Get current word
    const currentWordGameId = `${challenge.gameId}_${challenge.currentWordIndex}`;
    const currentGameWord = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", currentWordGameId))
      .unique();

    if (!currentGameWord) {
      throw new Error("Current word not found");
    }

    // Get or create player's attempt record
    let attemptRecord = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_player_word", (q) =>
        q
          .eq("battleId", args.challengeId)
          .eq("player", playerRole)
          .eq("wordIndex", challenge.currentWordIndex),
      )
      .first();

    if (!attemptRecord) {
      // Create new attempt record
      const attemptId = await ctx.db.insert("challengeWordAttempts", {
        battleId: args.challengeId,
        wordIndex: challenge.currentWordIndex,
        gameWordId: currentGameWord._id,
        player: playerRole,
        attempts: 0,
        completed: false,
        currentGuess: "",
        finalScore: 0,
        usedHint: false,
        usedClue: false,
        usedInviteFriend: false,
      });

      // Fetch the created record
      attemptRecord = await ctx.db.get(attemptId);
    }

    if (!attemptRecord) {
      throw new Error("Failed to create or retrieve attempt record");
    }

    if (attemptRecord.completed) {
      throw new Error("You have already completed this word");
    }

    // Check if guess is correct
    const correct =
      args.guess.toUpperCase() === currentGameWord.word.toUpperCase();
    const newAttempts = attemptRecord.attempts + 1;

    // Calculate score with 3-attempt system
    let score = 0;
    if (correct) {
      score = 100; // Base points for correct guess

      // Attempt bonus: 50 points for 1st attempt, 30 for 2nd, 10 for 3rd
      if (newAttempts === 1) {
        score += 50;
      } else if (newAttempts === 2) {
        score += 30;
      } else if (newAttempts === 3) {
        score += 10;
      }

      // Small time bonus (max 20 points)
      const timeElapsed =
        Date.now() - (challenge.currentRoundStartTime || Date.now());
      const timeBonus = Math.max(0, 20 - Math.floor(timeElapsed / 3000)); // 1 point per 3 seconds
      score += timeBonus;
    }

    // Update attempt record
    await ctx.db.patch(attemptRecord._id, {
      attempts: newAttempts,
      completed: correct,
      currentGuess: args.guess.toUpperCase(),
      finalScore: correct ? score : 0,
      completedAt: correct ? Date.now() : undefined,
    });

    // Update challenge score
    if (correct) {
      const scoreUpdate =
        playerRole === "challenger"
          ? { challengerScore: challenge.challengerScore + score }
          : { opponentScore: challenge.opponentScore + score };

      await ctx.db.patch(args.challengeId, scoreUpdate);
    }

    // Check if both players are finished with current word (completed OR used 3 attempts)
    const bothPlayersFinished = await checkBothPlayersFinished(
      ctx,
      args.challengeId,
      challenge.currentWordIndex,
    );
    let wordCompleted = false;
    let gameCompleted = false;

    if (bothPlayersFinished) {
      wordCompleted = true;

      // Check if this was the last word
      if (challenge.currentWordIndex >= challenge.maxWords - 1) {
        // Last word completed - end the game immediately
        gameCompleted = true;

        // Update challenge scores first to get the latest values
        const updatedChallenge = await ctx.db.get(args.challengeId);
        if (!updatedChallenge) throw new Error("Challenge not found");

        // Determine winner based on final scores
        let winner = undefined;
        if (updatedChallenge.challengerScore > updatedChallenge.opponentScore) {
          winner = "challenger";
        } else if (
          updatedChallenge.opponentScore > updatedChallenge.challengerScore
        ) {
          winner = "opponent";
        }
        // If scores are equal, winner remains undefined (tie)

        // Mark challenge as completed immediately
        await ctx.db.patch(args.challengeId, {
          status: "completed",
          completedAt: Date.now(),
          winner,
        });
      } else {
        // Advance to next word
        await ctx.db.patch(args.challengeId, {
          currentWordIndex: challenge.currentWordIndex + 1,
          currentRoundStartTime: Date.now(),
        });

        // Schedule timer expiration for next word
        const nextWordIndex = challenge.currentWordIndex + 1;
        await ctx.scheduler.runAfter(
          getTimerDuration(nextWordIndex),
          internal.challengeBattle.handleChallengeTimerExpiration,
          {
            challengeId: args.challengeId,
          },
        );
      }
    }

    return { correct, score, wordCompleted, gameCompleted };
  },
});

/**
 * Skip the current word (counts as 0 points)
 */
export const skipChallengeWord = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    isOpponentSession: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    wordCompleted: v.boolean(),
    gameCompleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge || challenge.status !== "in_progress") {
      throw new Error("Challenge not found or not in progress");
    }

    // Determine player role
    const userId = await getLoggedInUser(ctx);
    let playerRole: "challenger" | "opponent";

    if (args.isOpponentSession) {
      playerRole = "opponent";
    } else if (challenge.challengerUserId === userId) {
      playerRole = "challenger";
    } else if (challenge.opponentUserId === userId) {
      playerRole = "opponent";
    } else {
      throw new Error("You are not part of this challenge");
    }

    // Get player's attempt record for current word
    let attemptRecord = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_player_word", (q: any) =>
        q
          .eq("battleId", args.challengeId)
          .eq("player", playerRole)
          .eq("wordIndex", challenge.currentWordIndex),
      )
      .first();

    if (!attemptRecord) {
      // Create attempt record if it doesn't exist (this can happen if words are generated asynchronously)
      const currentWordGameId = `${challenge.gameId}_${challenge.currentWordIndex}`;
      const currentGameWord = await ctx.db
        .query("gameWords")
        .withIndex("by_game_id", (q) => q.eq("gameId", currentWordGameId))
        .first();

      if (!currentGameWord) {
        throw new Error("Current word not found");
      }

      const attemptId = await ctx.db.insert("challengeWordAttempts", {
        battleId: args.challengeId,
        wordIndex: challenge.currentWordIndex,
        gameWordId: currentGameWord._id,
        player: playerRole,
        attempts: 0,
        completed: false,
        currentGuess: "",
        finalScore: 0,
        timeUsed: 0,
        usedHint: false,
        usedClue: false,
        usedInviteFriend: false,
      });

      attemptRecord = await ctx.db.get(attemptId);
      if (!attemptRecord) {
        throw new Error("Failed to create attempt record");
      }
    }

    if (attemptRecord.completed) {
      throw new Error("You have already completed this word");
    }

    // Mark as skipped (completed with 0 score)
    await ctx.db.patch(attemptRecord._id, {
      completed: true,
      completedAt: Date.now(),
      finalScore: 0, // Skip = 0 points
      attempts: 3, // Mark as used all attempts
    });

    // Check if both players are finished with current word
    const bothPlayersFinished = await checkBothPlayersFinished(
      ctx,
      args.challengeId,
      challenge.currentWordIndex,
    );
    let wordCompleted = false;
    let gameCompleted = false;

    if (bothPlayersFinished) {
      wordCompleted = true;

      // Check if this was the last word
      if (challenge.currentWordIndex >= challenge.maxWords - 1) {
        // Last word completed - end the game immediately
        gameCompleted = true;

        // Get the latest challenge data to determine winner
        const updatedChallenge = await ctx.db.get(args.challengeId);
        if (!updatedChallenge) throw new Error("Challenge not found");

        // Determine winner based on final scores
        let winner = undefined;
        if (updatedChallenge.challengerScore > updatedChallenge.opponentScore) {
          winner = "challenger";
        } else if (
          updatedChallenge.opponentScore > updatedChallenge.challengerScore
        ) {
          winner = "opponent";
        }
        // If scores are equal, winner remains undefined (tie)

        // Mark challenge as completed immediately
        await ctx.db.patch(args.challengeId, {
          status: "completed",
          completedAt: Date.now(),
          winner,
        });
      } else {
        // Advance to next word
        await ctx.db.patch(args.challengeId, {
          currentWordIndex: challenge.currentWordIndex + 1,
          currentRoundStartTime: Date.now(),
        });

        // Schedule timer expiration for next word
        const nextWordIndex = challenge.currentWordIndex + 1;
        await ctx.scheduler.runAfter(
          getTimerDuration(nextWordIndex),
          internal.challengeBattle.handleChallengeTimerExpiration,
          {
            challengeId: args.challengeId,
          },
        );
      }
    }

    return { success: true, wordCompleted, gameCompleted };
  },
});

/**
 * Quit challenge - notify other player and end game
 */
export const quitChallenge = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    isOpponentSession: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    if (challenge.status === "completed") {
      return { success: true, message: "Challenge already completed" };
    }

    // Determine who quit
    const userId = await getLoggedInUser(ctx);
    let quitterRole: "challenger" | "opponent";

    if (args.isOpponentSession) {
      quitterRole = "opponent";
    } else if (challenge.challengerUserId === userId) {
      quitterRole = "challenger";
    } else if (challenge.opponentUserId === userId) {
      quitterRole = "opponent";
    } else {
      throw new Error("You are not part of this challenge");
    }

    // Mark challenge as completed with quit indicator in winner field
    const winner = `${quitterRole}_quit`; // e.g., "challenger_quit" or "opponent_quit"

    await ctx.db.patch(args.challengeId, {
      status: "completed",
      completedAt: Date.now(),
      winner,
    });

    const quitterName =
      quitterRole === "challenger"
        ? challenge.challengerName
        : challenge.opponentName;

    return {
      success: true,
      message: `${quitterName} has left the challenge`,
    };
  },
});

/**
 * Request a rematch with another player
 */
export const requestRematch = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    isOpponentSession: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge || challenge.status !== "completed") {
      throw new Error("Challenge not found or not completed");
    }

    // Determine who is requesting the rematch
    const userId = await getLoggedInUser(ctx);
    let requestedBy: "challenger" | "opponent";

    if (args.isOpponentSession) {
      requestedBy = "opponent";
    } else if (challenge.challengerUserId === userId) {
      requestedBy = "challenger";
    } else if (challenge.opponentUserId === userId) {
      requestedBy = "opponent";
    } else {
      throw new Error("You are not part of this challenge");
    }

    // Check if there's already a pending rematch request
    const existingRequest = await ctx.db
      .query("rematchRequests")
      .withIndex("by_challenge", (q) =>
        q.eq("originalChallengeId", args.challengeId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      return {
        success: false,
        message: "Rematch request already pending",
      };
    }

    // Create the rematch request
    await ctx.db.insert("rematchRequests", {
      originalChallengeId: args.challengeId,
      requestedBy,
      status: "pending",
      requestedAt: Date.now(),
    });

    return {
      success: true,
      message: "Rematch request sent",
    };
  },
});

/**
 * Respond to a rematch request (accept or decline)
 */
export const respondToRematch = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    accept: v.boolean(),
    isOpponentSession: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    newChallengeId: v.optional(v.id("challengeBattles")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const rematchRequest = await ctx.db
      .query("rematchRequests")
      .withIndex("by_challenge", (q) =>
        q.eq("originalChallengeId", args.challengeId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!rematchRequest) {
      throw new Error("No pending rematch request found");
    }

    // Update request status first
    await ctx.db.patch(rematchRequest._id, {
      status: args.accept ? "accepted" : "declined",
      respondedAt: Date.now(),
    });

    if (!args.accept) {
      return {
        success: true,
        message: "Rematch declined",
      };
    }

    // If accepted, create the rematch directly (inline to avoid circular reference)
    const originalChallenge = await ctx.db.get(args.challengeId);

    if (!originalChallenge || originalChallenge.status !== "completed") {
      throw new Error("Original challenge not found or not completed");
    }

    const gameId = Math.random().toString(36).substring(2, 15);

    const newChallengeId = await ctx.db.insert("challengeBattles", {
      gameId,
      challengerUserId: originalChallenge.opponentUserId!, // Swap roles
      opponentUserId: originalChallenge.challengerUserId,
      challengerName: originalChallenge.opponentName || "Opponent",
      opponentName: originalChallenge.challengerName,
      status: "ready_to_start", // Start with ready state, not immediately in progress
      currentWordIndex: 0,
      challengerScore: 0,
      opponentScore: 0,
      maxWords: 3,
    });

    // Store the new challenge ID in the rematch request so both players can access it
    await ctx.db.patch(rematchRequest._id, {
      newChallengeId,
    });

    return {
      success: true,
      newChallengeId,
      message: "Rematch started! Roles have been swapped.",
    };
  },
});

/**
 * Get rematch status for a challenge
 */
export const getRematchStatus = query({
  args: {
    challengeId: v.id("challengeBattles"),
  },
  returns: v.union(
    v.object({
      hasRequest: v.boolean(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        v.literal("expired"),
      ),
      requestedBy: v.union(v.literal("challenger"), v.literal("opponent")),
      requestedAt: v.number(),
      newChallengeId: v.optional(v.id("challengeBattles")), // Include new challenge ID when accepted
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const rematchRequest = await ctx.db
      .query("rematchRequests")
      .withIndex("by_challenge", (q) =>
        q.eq("originalChallengeId", args.challengeId),
      )
      .order("desc")
      .first();

    if (!rematchRequest) {
      return null;
    }

    return {
      hasRequest: true,
      status: rematchRequest.status,
      requestedBy: rematchRequest.requestedBy,
      requestedAt: rematchRequest.requestedAt,
      newChallengeId: rematchRequest.newChallengeId,
    };
  },
});

// Helper function to check if both players are done with current word
async function checkBothPlayersFinished(
  ctx: any,
  challengeId: Id<"challengeBattles">,
  wordIndex: number,
) {
  const challengerAttempt = await ctx.db
    .query("challengeWordAttempts")
    .withIndex("by_battle_player_word", (q: any) =>
      q
        .eq("battleId", challengeId)
        .eq("player", "challenger")
        .eq("wordIndex", wordIndex),
    )
    .first();

  const opponentAttempt = await ctx.db
    .query("challengeWordAttempts")
    .withIndex("by_battle_player_word", (q: any) =>
      q
        .eq("battleId", challengeId)
        .eq("player", "opponent")
        .eq("wordIndex", wordIndex),
    )
    .first();

  // A player is finished if they completed the word OR used all 3 attempts
  const challengerFinished =
    challengerAttempt?.completed || challengerAttempt?.attempts >= 3;
  const opponentFinished =
    opponentAttempt?.completed || opponentAttempt?.attempts >= 3;

  return challengerFinished && opponentFinished;
}

/**
 * Get current timer state for a challenge
 */
export const getChallengeTimer = query({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.union(
    v.object({
      remaining: v.number(), // milliseconds remaining
      started: v.number(), // when current round started
      expired: v.boolean(), // whether timer has expired
      wordIndex: v.number(), // current word index
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (
      !challenge ||
      challenge.status !== "in_progress" ||
      !challenge.currentRoundStartTime
    ) {
      return null;
    }

    const elapsed = Date.now() - challenge.currentRoundStartTime;
    // Round 3 (index 2) gets 30 seconds, rounds 1&2 get 60 seconds
    const timeLimit = challenge.currentWordIndex === 2 ? 30000 : 60000;
    const remaining = Math.max(0, timeLimit - elapsed);

    return {
      remaining,
      started: challenge.currentRoundStartTime,
      expired: remaining === 0,
      wordIndex: challenge.currentWordIndex,
    };
  },
});

/**
 * Handle timer expiration for a challenge word
 */
export const handleChallengeTimerExpiration = internalMutation({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge || challenge.status !== "in_progress") {
      return null;
    }

    // Mark any incomplete attempts as timed out
    const challengerAttempt = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_player_word", (q: any) =>
        q
          .eq("battleId", args.challengeId)
          .eq("player", "challenger")
          .eq("wordIndex", challenge.currentWordIndex),
      )
      .first();

    const opponentAttempt = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_player_word", (q: any) =>
        q
          .eq("battleId", args.challengeId)
          .eq("player", "opponent")
          .eq("wordIndex", challenge.currentWordIndex),
      )
      .first();

    // Force completion for players who haven't finished (either completed word or used 3 attempts)
    if (
      challengerAttempt &&
      !challengerAttempt.completed &&
      challengerAttempt.attempts < 3
    ) {
      await ctx.db.patch(challengerAttempt._id, {
        attempts: 3, // Mark as having used all attempts
        timeUsed: getTimerDuration(challenge.currentWordIndex), // Used full timer duration
        finalScore: 0, // No points for timeout
      });
    }

    if (
      opponentAttempt &&
      !opponentAttempt.completed &&
      opponentAttempt.attempts < 3
    ) {
      await ctx.db.patch(opponentAttempt._id, {
        attempts: 3, // Mark as having used all attempts
        timeUsed: getTimerDuration(challenge.currentWordIndex), // Used full timer duration
        finalScore: 0, // No points for timeout
      });
    }

    // Advance to next word or complete game
    if (challenge.currentWordIndex >= challenge.maxWords - 1) {
      // Game completed - determine winner
      let winner = undefined;
      if (challenge.challengerScore > challenge.opponentScore) {
        winner = "challenger";
      } else if (challenge.opponentScore > challenge.challengerScore) {
        winner = "opponent";
      }
      // If scores are equal, winner remains undefined (tie)

      await ctx.db.patch(args.challengeId, {
        status: "completed",
        completedAt: Date.now(),
        winner,
      });
    } else {
      // Advance to next word
      const newWordIndex = challenge.currentWordIndex + 1;
      await ctx.db.patch(args.challengeId, {
        currentWordIndex: newWordIndex,
        currentRoundStartTime: Date.now(),
      });

      // Schedule timer expiration for next word
      await ctx.scheduler.runAfter(
        getTimerDuration(newWordIndex),
        internal.challengeBattle.handleChallengeTimerExpiration,
        {
          challengeId: args.challengeId,
        },
      );
    }

    return null;
  },
});

/**
 * Player ready to start
 */
export const setPlayerReady = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    player: v.union(v.literal("challenger"), v.literal("opponent")),
    isOpponentSession: v.optional(v.boolean()), // Helper for demo mode
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // In demo mode, use session context to help verify player
    if (args.isOpponentSession && args.player === "opponent") {
      // Skip user ID verification for opponent in demo mode
      // The frontend context tells us this is the opponent session
    } else {
      // Normal verification for challenger or real auth mode
      if (
        args.player === "challenger" &&
        challenge.challengerUserId !== userId
      ) {
        throw new Error("You are not the challenger");
      }
      if (
        args.player === "opponent" &&
        challenge.opponentUserId !== userId &&
        !args.isOpponentSession
      ) {
        throw new Error("You are not the opponent");
      }
    }

    // Update status based on which player is ready
    let newStatus = challenge.status;
    if (args.player === "challenger") {
      if (challenge.status === "ready_to_start") {
        newStatus = "challenger_ready";
      } else if (challenge.status === "opponent_ready") {
        newStatus = "in_progress";
        // Both ready, start the game
        await ctx.scheduler.runAfter(
          0,
          internal.challengeBattle.startChallengeGame,
          {
            challengeId: args.challengeId,
          },
        );
      }
    } else if (args.player === "opponent") {
      if (challenge.status === "ready_to_start") {
        newStatus = "opponent_ready";
      } else if (challenge.status === "challenger_ready") {
        newStatus = "in_progress";
        // Both ready, start the game
        await ctx.scheduler.runAfter(
          0,
          internal.challengeBattle.startChallengeGame,
          {
            challengeId: args.challengeId,
          },
        );
      }
    }

    await ctx.db.patch(args.challengeId, { status: newStatus });
    return null;
  },
});

// =====================================
// Gameplay Functions
// =====================================

/**
 * Start challenge game (when both players ready)
 */
export const startChallengeGame = internalMutation({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Generate 3 AI words for battle
    await ctx.scheduler.runAfter(
      0,
      internal.challengeBattle.generateChallengeWords,
      {
        challengeId: args.challengeId,
      },
    );

    // Update challenge status and start timer
    await ctx.db.patch(args.challengeId, {
      status: "in_progress",
      startedAt: Date.now(),
      currentRoundStartTime: Date.now(),
    });

    // Schedule timer expiration (60s for first word)
    await ctx.scheduler.runAfter(
      getTimerDuration(0), // First word index is 0
      internal.challengeBattle.handleChallengeTimerExpiration,
      {
        challengeId: args.challengeId,
      },
    );

    return null;
  },
});

/**
 * Generate AI words for the challenge
 */
export const generateChallengeWords = internalAction({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const challenge = await ctx.runQuery(
      internal.challengeBattle.getChallengeForWords,
      {
        challengeId: args.challengeId,
      },
    );

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Generate 3 unique words for challenge mode
    const generatedWords = new Set<string>();

    for (let i = 0; i < 3; i++) {
      let attempts = 0;
      let word = "";

      // Try up to 5 times to get a unique word
      while (attempts < 5) {
        try {
          // Use existing game word generation
          const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content:
                      "Generate a single extremely challenging English word for a word-guessing game. The word should be 6-9 letters long, very uncommon and difficult to guess (approximately 1 in 10,000 chance of being guessed), but still a real English word that appears in dictionaries. Examples of difficulty: QUIXOTIC, EPHEMERAL, UBIQUITOUS, SERENDIPITY. Respond with only the word, no punctuation or explanation.",
                  },
                  {
                    role: "user",
                    content:
                      generatedWords.size > 0
                        ? `Avoid these already generated words: ${Array.from(generatedWords).join(", ")}`
                        : "Generate a challenging word.",
                  },
                ],
                max_tokens: 10,
                temperature: 0.9,
              }),
            },
          );

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          const data = await response.json();
          const candidateWord = data.choices[0].message.content
            .trim()
            .toUpperCase();

          if (
            candidateWord &&
            /^[A-Z]+$/.test(candidateWord) &&
            !generatedWords.has(candidateWord)
          ) {
            word = candidateWord;
            generatedWords.add(word);
            break; // Successfully generated unique word
          }

          attempts++;
        } catch (error) {
          console.error(
            `Error generating word ${i}, attempt ${attempts}:`,
            error,
          );
          attempts++;
        }
      }

      // If we couldn't generate a unique word, use fallback
      if (!word) {
        const fallbackWords = ["QUIXOTIC", "EPHEMERAL", "UBIQUITOUS"];
        word = fallbackWords[i] || "CHALLENGING";
        generatedWords.add(word);
      }

      // Save the word
      const wordGameId = `${challenge.gameId}_${i}`;
      await ctx.runMutation(internal.challengeBattle.saveChallengeWord, {
        gameId: wordGameId,
        wordIndex: i,
        word,
      });
    }

    // Initialize word attempts for both players
    await ctx.runMutation(
      internal.challengeBattle.initializeChallengeAttempts,
      {
        challengeId: args.challengeId,
      },
    );

    return null;
  },
});

/**
 * Internal query to get challenge for word generation
 */
export const getChallengeForWords = internalQuery({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.union(
    v.object({
      gameId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;
    return { gameId: challenge.gameId };
  },
});

/**
 * Save generated word
 */
export const saveChallengeWord = internalMutation({
  args: {
    gameId: v.string(),
    wordIndex: v.number(),
    word: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const letters = args.word.split("");
    const shuffledLetters = shuffleArray([...letters]);

    await ctx.db.insert("gameWords", {
      gameId: args.gameId,
      word: args.word,
      shuffledLetters,
      difficulty: 3, // Default difficulty level for challenges
      createdAt: Date.now(),
    });

    return null;
  },
});

/**
 * Initialize word attempts for both players
 */
export const initializeChallengeAttempts = internalMutation({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    // Initialize attempts for all 3 words for both players
    for (let wordIndex = 0; wordIndex < 3; wordIndex++) {
      const wordGameId = `${challenge.gameId}_${wordIndex}`;
      const gameWord = await ctx.db
        .query("gameWords")
        .withIndex("by_game_id", (q) => q.eq("gameId", wordGameId))
        .unique();

      if (gameWord) {
        // Challenger attempts
        await ctx.db.insert("challengeWordAttempts", {
          battleId: args.challengeId,
          wordIndex,
          gameWordId: gameWord._id,
          player: "challenger",
          attempts: 0,
          completed: false,
          currentGuess: "",
          finalScore: 0,
          usedHint: false,
          usedClue: false,
          usedInviteFriend: false,
        });

        // Opponent attempts
        await ctx.db.insert("challengeWordAttempts", {
          battleId: args.challengeId,
          wordIndex,
          gameWordId: gameWord._id,
          player: "opponent",
          attempts: 0,
          completed: false,
          currentGuess: "",
          finalScore: 0,
          usedHint: false,
          usedClue: false,
          usedInviteFriend: false,
        });
      }
    }

    return null;
  },
});

// =====================================
// Real-time State Functions
// =====================================

/**
 * Get live challenge state
 */
export const getChallengeState = query({
  args: {
    challengeId: v.id("challengeBattles"),
    forceOpponentView: v.optional(v.boolean()), // Helper for demo mode
  },
  returns: v.union(
    v.object({
      challenge: v.object({
        _id: v.id("challengeBattles"),
        _creationTime: v.number(),
        gameId: v.string(),
        challengerUserId: v.id("users"),
        opponentUserId: v.optional(v.id("users")),
        challengerName: v.string(),
        opponentName: v.optional(v.string()),
        status: v.union(
          v.literal("waiting_for_opponent"),
          v.literal("ready_to_start"),
          v.literal("challenger_ready"),
          v.literal("opponent_ready"),
          v.literal("in_progress"),
          v.literal("completed"),
        ),
        currentWordIndex: v.number(),
        challengerScore: v.number(),
        opponentScore: v.number(),
        winner: v.optional(v.string()),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        currentRoundStartTime: v.optional(v.number()),
        maxWords: v.number(),
      }),
      userRole: v.optional(
        v.union(v.literal("challenger"), v.literal("opponent")),
      ),
      currentWord: v.optional(
        v.object({
          word: v.string(),
          length: v.number(),
          letters: v.array(v.string()),
          shuffledLetters: v.array(v.string()),
        }),
      ),
      challengerAttempt: v.optional(
        v.object({
          attempts: v.number(),
          completed: v.boolean(),
          currentGuess: v.string(),
        }),
      ),
      opponentAttempt: v.optional(
        v.object({
          attempts: v.number(),
          completed: v.boolean(),
          currentGuess: v.string(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      return null;
    }

    // Determine user role
    let userRole: "challenger" | "opponent" | undefined;

    // In demo mode, use forceOpponentView to help identify role
    if (args.forceOpponentView && challenge.opponentUserId) {
      userRole = "opponent";
    } else if (challenge.challengerUserId === userId) {
      userRole = "challenger";
    } else if (challenge.opponentUserId === userId) {
      userRole = "opponent";
    } else {
      // If user is not the challenger or opponent, they are a potential opponent
      // This handles the case where someone opens the challenge link
      userRole = undefined;
    }

    let currentWord = undefined;
    let challengerAttempt = undefined;
    let opponentAttempt = undefined;

    // Get current word if game is in progress
    if (challenge.status === "in_progress") {
      const currentWordGameId = `${challenge.gameId}_${challenge.currentWordIndex}`;
      const currentGameWord = await ctx.db
        .query("gameWords")
        .withIndex("by_game_id", (q) => q.eq("gameId", currentWordGameId))
        .unique();

      if (currentGameWord) {
        const letters = currentGameWord.word.split("");
        currentWord = {
          word: currentGameWord.word,
          length: currentGameWord.word.length,
          letters: letters,
          shuffledLetters: currentGameWord.shuffledLetters || letters,
        };

        // Get current attempts for both players
        const challengerAttemptRecord = await ctx.db
          .query("challengeWordAttempts")
          .withIndex("by_battle_player_word", (q) =>
            q
              .eq("battleId", args.challengeId)
              .eq("player", "challenger")
              .eq("wordIndex", challenge.currentWordIndex),
          )
          .unique();

        const opponentAttemptRecord = await ctx.db
          .query("challengeWordAttempts")
          .withIndex("by_battle_player_word", (q) =>
            q
              .eq("battleId", args.challengeId)
              .eq("player", "opponent")
              .eq("wordIndex", challenge.currentWordIndex),
          )
          .unique();

        if (challengerAttemptRecord) {
          challengerAttempt = {
            attempts: challengerAttemptRecord.attempts,
            completed: challengerAttemptRecord.completed,
            currentGuess: challengerAttemptRecord.currentGuess,
          };
        }

        if (opponentAttemptRecord) {
          opponentAttempt = {
            attempts: opponentAttemptRecord.attempts,
            completed: opponentAttemptRecord.completed,
            currentGuess: opponentAttemptRecord.currentGuess,
          };
        }
      }
    }

    return {
      challenge,
      userRole,
      currentWord,
      challengerAttempt,
      opponentAttempt,
    };
  },
});

/**
 * Get recent challenge battles for leaderboard display
 */
export const getRecentChallengeBattles = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    battles: v.array(
      v.object({
        _id: v.id("challengeBattles"),
        _creationTime: v.number(),
        challengerName: v.string(),
        opponentName: v.string(),
        challengerScore: v.number(),
        opponentScore: v.number(),
        winner: v.optional(v.string()),
        completedAt: v.number(),
        maxWords: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    let query = ctx.db
      .query("challengeBattles")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .filter((q) =>
        q.and(
          q.neq(q.field("isHidden"), true),
          q.neq(q.field("isDeleted"), true),
        ),
      );

    // Handle pagination cursor
    if (args.cursor) {
      const cursorId = args.cursor as Id<"challengeBattles">;
      query = query.filter((q) => q.lt(q.field("_id"), cursorId));
    }

    const results = await query.take(limit + 1);

    const battles = results.slice(0, limit).map((battle) => ({
      _id: battle._id,
      _creationTime: battle._creationTime,
      challengerName: battle.challengerName,
      opponentName: battle.opponentName || "Unknown",
      challengerScore: battle.challengerScore,
      opponentScore: battle.opponentScore,
      winner: battle.winner,
      completedAt: battle.completedAt || battle._creationTime,
      maxWords: battle.maxWords,
    }));

    const isDone = results.length <= limit;
    const continueCursor = isDone
      ? undefined
      : battles[battles.length - 1]?._id;

    return {
      battles,
      isDone,
      continueCursor,
    };
  },
});

/**
 * Get challenge battle statistics for leaderboard
 */
export const getChallengeBattleStats = query({
  args: {},
  returns: v.object({
    totalBattles: v.number(),
    totalCompleted: v.number(),
    averageScore: v.number(),
    topScore: v.number(),
  }),
  handler: async (ctx) => {
    const allBattles = await ctx.db
      .query("challengeBattles")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .take(500);

    const totalBattles = allBattles.length;
    const totalCompleted = allBattles.filter((b) => b.completedAt).length;

    if (totalCompleted === 0) {
      return {
        totalBattles: 0,
        totalCompleted: 0,
        averageScore: 0,
        topScore: 0,
      };
    }

    const allScores = allBattles.flatMap((b) => [
      b.challengerScore,
      b.opponentScore,
    ]);
    const totalPoints = allScores.reduce((sum, score) => sum + score, 0);
    const averageScore = Math.round(totalPoints / allScores.length);
    const topScore = Math.max(...allScores);

    return {
      totalBattles,
      totalCompleted,
      averageScore,
      topScore,
    };
  },
});

/**
 * Get challenge results for completed challenges
 */
export const getChallengeResults = query({
  args: { challengeId: v.id("challengeBattles") },
  returns: v.union(
    v.object({
      challenge: v.object({
        _id: v.id("challengeBattles"),
        challengerName: v.string(),
        opponentName: v.string(),
        challengerScore: v.number(),
        opponentScore: v.number(),
        winner: v.optional(v.string()),
        completedAt: v.optional(v.number()),
        maxWords: v.number(),
      }),
      wordResults: v.array(
        v.object({
          wordIndex: v.number(),
          word: v.string(),
          challengerAttempt: v.optional(
            v.object({
              attempts: v.number(),
              completed: v.boolean(),
              finalScore: v.number(),
              timeUsed: v.optional(v.number()),
              usedHint: v.boolean(),
              usedClue: v.boolean(),
            }),
          ),
          opponentAttempt: v.optional(
            v.object({
              attempts: v.number(),
              completed: v.boolean(),
              finalScore: v.number(),
              timeUsed: v.optional(v.number()),
              usedHint: v.boolean(),
              usedClue: v.boolean(),
            }),
          ),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge || challenge.status !== "completed") {
      return null;
    }

    // Get all word attempts for this challenge
    const allAttempts = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_and_word", (q) =>
        q.eq("battleId", args.challengeId),
      )
      .collect();

    // Get word results for each word in the challenge
    const wordResults = [];
    for (let wordIndex = 0; wordIndex < challenge.maxWords; wordIndex++) {
      const challengerAttempt = allAttempts.find(
        (a) => a.player === "challenger" && a.wordIndex === wordIndex,
      );
      const opponentAttempt = allAttempts.find(
        (a) => a.player === "opponent" && a.wordIndex === wordIndex,
      );

      // Get the actual word
      const currentWordGameId = `${challenge.gameId}_${wordIndex}`;
      const currentGameWord = await ctx.db
        .query("gameWords")
        .withIndex("by_game_id", (q) => q.eq("gameId", currentWordGameId))
        .unique();

      if (currentGameWord) {
        wordResults.push({
          wordIndex,
          word: currentGameWord.word,
          challengerAttempt: challengerAttempt
            ? {
                attempts: challengerAttempt.attempts,
                completed: challengerAttempt.completed,
                finalScore: challengerAttempt.finalScore,
                timeUsed: challengerAttempt.timeUsed,
                usedHint: challengerAttempt.usedHint,
                usedClue: challengerAttempt.usedClue,
              }
            : undefined,
          opponentAttempt: opponentAttempt
            ? {
                attempts: opponentAttempt.attempts,
                completed: opponentAttempt.completed,
                finalScore: opponentAttempt.finalScore,
                timeUsed: opponentAttempt.timeUsed,
                usedHint: opponentAttempt.usedHint,
                usedClue: opponentAttempt.usedClue,
              }
            : undefined,
        });
      }
    }

    return {
      challenge: {
        _id: challenge._id,
        challengerName: challenge.challengerName,
        opponentName: challenge.opponentName || "Opponent",
        challengerScore: challenge.challengerScore,
        opponentScore: challenge.opponentScore,
        winner: challenge.winner,
        completedAt: challenge.completedAt,
        maxWords: challenge.maxWords,
      },
      wordResults,
    };
  },
});

// Authenticated users get enhanced challenge statistics
export const getUserChallengeHistory = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("challengeBattles"),
      _creationTime: v.number(),
      gameId: v.string(),
      challengerUserId: v.id("users"),
      opponentUserId: v.optional(v.id("users")),
      challengerName: v.string(),
      opponentName: v.optional(v.string()),
      status: v.union(
        v.literal("waiting_for_opponent"),
        v.literal("ready_to_start"),
        v.literal("challenger_ready"),
        v.literal("opponent_ready"),
        v.literal("in_progress"),
        v.literal("completed"),
      ),
      currentWordIndex: v.number(),
      challengerScore: v.number(),
      opponentScore: v.number(),
      winner: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      currentRoundStartTime: v.optional(v.number()),
      maxWords: v.number(),
      isHidden: v.optional(v.boolean()),
      isDeleted: v.optional(v.boolean()),
      adminAction: v.optional(v.string()),
      adminActionAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required for challenge history");
    }

    // For queries, we need to find existing user, not create
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!existingUser) {
      throw new Error("User not found");
    }

    const userId = existingUser._id;

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

// Get paginated user challenge history (for My Scores page)
export const getUserChallengeHistoryPaginated = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    challenges: v.array(
      v.object({
        _id: v.id("challengeBattles"),
        _creationTime: v.number(),
        gameId: v.string(),
        challengerUserId: v.id("users"),
        opponentUserId: v.optional(v.id("users")),
        challengerName: v.string(),
        opponentName: v.optional(v.string()),
        status: v.union(
          v.literal("waiting_for_opponent"),
          v.literal("ready_to_start"),
          v.literal("challenger_ready"),
          v.literal("opponent_ready"),
          v.literal("in_progress"),
          v.literal("completed"),
        ),
        currentWordIndex: v.number(),
        challengerScore: v.number(),
        opponentScore: v.number(),
        winner: v.optional(v.string()),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        currentRoundStartTime: v.optional(v.number()),
        maxWords: v.number(),
        isHidden: v.optional(v.boolean()),
        isDeleted: v.optional(v.boolean()),
        adminAction: v.optional(v.string()),
        adminActionAt: v.optional(v.number()),
      }),
    ),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return empty results for unauthenticated users
      return {
        challenges: [],
        hasMore: false,
        nextCursor: undefined,
      };
    }

    // For queries, we need to find existing user, not create
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!existingUser) {
      // Return empty results for users not yet in database
      return {
        challenges: [],
        hasMore: false,
        nextCursor: undefined,
      };
    }

    const userId = existingUser._id;
    const limit = args.limit || 3;

    let query = ctx.db
      .query("challengeBattles")
      .filter((q) =>
        q.or(
          q.eq(q.field("challengerUserId"), userId),
          q.eq(q.field("opponentUserId"), userId),
        ),
      )
      .order("desc");

    // Apply cursor if provided
    if (args.cursor) {
      const cursorTime = parseInt(args.cursor);
      query = query.filter((q) => q.lt(q.field("_creationTime"), cursorTime));
    }

    const challenges = await query.take(limit + 1);
    const hasMore = challenges.length > limit;
    const returnChallenges = hasMore ? challenges.slice(0, limit) : challenges;

    const nextCursor =
      hasMore && returnChallenges.length > 0
        ? returnChallenges[returnChallenges.length - 1]._creationTime.toString()
        : undefined;

    return {
      challenges: returnChallenges,
      hasMore,
      nextCursor,
    };
  },
});

// Delete a user's challenge battle (only if they are a participant)
export const deleteChallengeResult = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx); // Require authentication

    // For mutations, we can use the mutation helper
    const userId = await getCurrentUserIdForMutation(ctx);

    // Get the challenge to verify ownership
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Verify the user is a participant in this challenge
    if (
      challenge.challengerUserId !== userId &&
      challenge.opponentUserId !== userId
    ) {
      throw new Error("You can only delete challenges you participated in");
    }

    // Delete related challenge word attempts first
    const wordAttempts = await ctx.db
      .query("challengeWordAttempts")
      .withIndex("by_battle_and_word", (q) =>
        q.eq("battleId", args.challengeId),
      )
      .collect();

    for (const attempt of wordAttempts) {
      await ctx.db.delete(attempt._id);
    }

    // Delete challenge invites
    const invites = await ctx.db
      .query("challengeInvites")
      .withIndex("by_battle", (q) => q.eq("battleId", args.challengeId))
      .collect();

    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }

    // Delete the challenge battle
    await ctx.db.delete(args.challengeId);

    return null;
  },
});

// Get public challenge score for sharing
export const getPublicChallengeScore = query({
  args: {
    challengeId: v.id("challengeBattles"),
  },
  returns: v.union(
    v.object({
      challengerName: v.string(),
      opponentName: v.string(),
      challengerScore: v.number(),
      opponentScore: v.number(),
      winner: v.optional(v.string()),
      completedAt: v.optional(v.number()),
      maxWords: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge || challenge.status !== "completed") {
      return null;
    }

    return {
      challengerName: challenge.challengerName,
      opponentName: challenge.opponentName || "Opponent",
      challengerScore: challenge.challengerScore,
      opponentScore: challenge.opponentScore,
      winner: challenge.winner,
      completedAt: challenge.completedAt,
      maxWords: challenge.maxWords,
    };
  },
});

// =====================================
// Helper Functions
// =====================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
