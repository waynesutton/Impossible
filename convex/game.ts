import {
  query,
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateGameId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export const getCurrentGame = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);

    // Get all user attempts, ordered by most recent
    const userAttempts = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .take(10);

    // First try to find an active (not completed) game
    let userAttempt = userAttempts.find((attempt) => !attempt.completed);

    // If no active game, check if there's a recently completed game (within last 5 minutes)
    // This allows the completion flow to work before auto-starting a new game
    if (!userAttempt && userAttempts.length > 0) {
      const recentGame = userAttempts[0]; // Most recent game
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      if (
        recentGame.completed &&
        recentGame.completedAt &&
        recentGame.completedAt > fiveMinutesAgo
      ) {
        userAttempt = recentGame; // Show completed game for name entry flow
      }
    }

    if (!userAttempt) {
      return null; // No active or recent game
    }

    // Get the game word
    const gameWord = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", userAttempt.gameId!))
      .unique();

    if (!gameWord) {
      return null; // Word is still being generated
    }

    return {
      gameId: userAttempt.gameId,
      word: gameWord.word,
      length: gameWord.word.length,
      letters: gameWord.word.split(""),
      shuffledLetters: gameWord.shuffledLetters || gameWord.word.split(""),
      attempts: userAttempt.attempts,
      completed: userAttempt.completed,
      currentGuess: userAttempt.currentGuess,
      canPlay: !userAttempt.completed && userAttempt.attempts < 3,
      thirdAttemptStartTime: userAttempt.thirdAttemptStartTime,
      hint: userAttempt.hint,
      won:
        userAttempt.completed &&
        userAttempt.currentGuess.toLowerCase() === gameWord.word.toLowerCase(),
    };
  },
});

export const startNewGame = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);
    const gameId = generateGameId();

    // Generate new word for this game
    await ctx.scheduler.runAfter(0, internal.game.generateGameWord, { gameId });

    // Create user's attempt record for this game
    await ctx.db.insert("userAttempts", {
      userId,
      gameId,
      attempts: 0,
      completed: false,
      currentGuess: "",
      lastAttemptTime: Date.now(),
    });

    return gameId;
  },
});

export const updateCurrentGuess = mutation({
  args: {
    guess: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);

    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (userAttempt && userAttempt.gameId) {
      await ctx.db.patch(userAttempt._id, {
        currentGuess: args.guess,
      });
    }
  },
});

export const submitGuess = mutation({
  args: {
    guess: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);

    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (!userAttempt || !userAttempt.gameId) {
      throw new Error("No active game session");
    }

    const gameWord = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", userAttempt.gameId!))
      .unique();

    if (!gameWord) {
      throw new Error("No game word available");
    }

    const currentAttempts = userAttempt.attempts || 0;

    // Don't allow submission if already completed
    if (userAttempt.completed) {
      throw new Error("Game already completed");
    }

    // Don't allow submission if max attempts reached (before processing this attempt)
    if (currentAttempts >= 3) {
      throw new Error("Maximum attempts reached");
    }

    const isCorrect = args.guess.toLowerCase() === gameWord.word.toLowerCase();
    const newAttempts = currentAttempts + 1;
    const gameCompleted = isCorrect || newAttempts >= 3;

    await ctx.db.patch(userAttempt._id, {
      attempts: newAttempts,
      completed: gameCompleted, // Mark as completed whether won or lost after 3 attempts
      currentGuess: isCorrect ? args.guess : userAttempt.currentGuess, // Keep current guess if wrong, use new guess if correct
      lastAttemptTime: Date.now(),
      completedAt: gameCompleted ? Date.now() : undefined,
    });

    // Record game result when game is completed (either won or lost)
    if (gameCompleted) {
      const user = await ctx.db.get(userId);
      const playerName =
        user && "name" in user ? user.name || user.email || "Player" : "Player";
      const isAnonymous =
        user && "isAnonymous" in user ? user.isAnonymous || false : false;

      await ctx.db.insert("gameResults", {
        userId,
        gameId: userAttempt.gameId,
        word: gameWord.word,
        completed: isCorrect, // true if they guessed correctly, false if they failed
        attempts: newAttempts,
        completedAt: Date.now(),
        displayName: userAttempt.displayName,
        playerName,
        isAnonymous,
      });
    }

    return {
      correct: isCorrect,
      attemptsRemaining: 3 - newAttempts,
      word: isCorrect ? gameWord.word : null,
    };
  },
});

export const requestHint = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);

    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (!userAttempt || !userAttempt.gameId) {
      throw new Error("No active game session");
    }

    const gameWord = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", userAttempt.gameId!))
      .unique();

    if (!gameWord) {
      throw new Error("No game word available");
    }

    if (userAttempt.attempts < 2) {
      throw new Error("Hints only available after 2 attempts");
    }

    // Set loading state first
    await ctx.db.patch(userAttempt._id, {
      hint: "Generating hint...",
    });

    // Schedule hint generation
    await ctx.scheduler.runAfter(0, internal.game.generateHint, {
      userId,
      word: gameWord.word,
      attempts: userAttempt.attempts,
    });

    return "Generating hint...";
  },
});

export const generateHint = internalAction({
  args: {
    userId: v.id("users"),
    word: v.string(),
    attempts: v.number(),
  },
  handler: async (ctx, args) => {
    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Give a helpful but not too obvious hint for the word "${args.word}". The user has made ${args.attempts} attempts. Make the hint cryptic but fair. Respond with just the hint, nothing else.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const hint =
      response.choices[0].message.content?.trim() || "No hint available";

    // Store the hint for the user
    await ctx.runMutation(internal.game.saveHint, {
      userId: args.userId,
      hint,
    });
  },
});

export const saveHint = internalMutation({
  args: {
    userId: v.id("users"),
    hint: v.string(),
  },
  handler: async (ctx, args) => {
    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .first();

    if (userAttempt) {
      await ctx.db.patch(userAttempt._id, {
        hint: args.hint,
      });
    }
  },
});

export const updateDisplayName = mutation({
  args: {
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);

    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (userAttempt) {
      // Update the user attempt
      await ctx.db.patch(userAttempt._id, {
        displayName: args.displayName,
      });

      // Also update the corresponding game result if it exists
      if (userAttempt.gameId) {
        const gameResult = await ctx.db
          .query("gameResults")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), userId),
              q.eq(q.field("gameId"), userAttempt.gameId!),
            ),
          )
          .first();

        if (gameResult) {
          await ctx.db.patch(gameResult._id, {
            displayName: args.displayName,
          });
        }
      }
    }
  },
});

export const createInviteLink = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);

    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (!userAttempt || !userAttempt.gameId) {
      throw new Error("No active game session");
    }

    // Create an invite record
    const inviteId = await ctx.db.insert("invites", {
      createdBy: userId,
      gameId: userAttempt.gameId,
      createdAt: Date.now(),
      used: false,
    });

    return inviteId;
  },
});

export const getInviteInfo = query({
  args: {
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      return null;
    }

    const creator = await ctx.db.get(invite.createdBy);
    const creatorName =
      creator && "name" in creator
        ? creator.name === "Demo Player"
          ? "Player"
          : creator.name || creator.email || "Player"
        : "Player";

    return {
      creatorName,
      gameId: invite.gameId,
      valid: true,
    };
  },
});

export const joinAsHelper = mutation({
  args: {
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    const invite = await ctx.db.get(args.inviteId);

    if (!invite) {
      throw new Error("Invalid invite");
    }

    // Create or update helper record
    const existingHelper = await ctx.db
      .query("helpers")
      .withIndex("by_invite_and_user", (q) =>
        q.eq("inviteId", args.inviteId).eq("helperId", userId),
      )
      .unique();

    if (!existingHelper) {
      await ctx.db.insert("helpers", {
        inviteId: args.inviteId,
        helperId: userId,
        mainUserId: invite.createdBy,
        gameId: invite.gameId,
        suggestionsUsed: 0,
        joinedAt: Date.now(),
      });
    }

    return invite.createdBy;
  },
});

export const getHelperState = query({
  args: {
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);

    const helper = await ctx.db
      .query("helpers")
      .withIndex("by_invite_and_user", (q) =>
        q.eq("inviteId", args.inviteId).eq("helperId", userId),
      )
      .unique();

    if (!helper) {
      return null;
    }

    // Get main user's game state
    let mainUserAttempt = null;
    if (helper.gameId) {
      mainUserAttempt = await ctx.db
        .query("userAttempts")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), helper.mainUserId),
            q.eq(q.field("gameId"), helper.gameId!),
          ),
        )
        .first();
    }

    const mainUserGameOver =
      mainUserAttempt &&
      (mainUserAttempt.attempts >= 3 || mainUserAttempt.completed);

    return {
      suggestionsUsed: helper.suggestionsUsed,
      canSuggest: helper.suggestionsUsed < 3 && !mainUserGameOver,
      mainUserId: helper.mainUserId,
      mainUserGameOver,
      mainUserCompleted: mainUserAttempt?.completed || false,
    };
  },
});

export const submitSuggestion = mutation({
  args: {
    inviteId: v.id("invites"),
    suggestion: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);

    const helper = await ctx.db
      .query("helpers")
      .withIndex("by_invite_and_user", (q) =>
        q.eq("inviteId", args.inviteId).eq("helperId", userId),
      )
      .unique();

    if (!helper) {
      throw new Error("Not a valid helper");
    }

    if (helper.suggestionsUsed >= 3) {
      throw new Error("Already used all 3 suggestions");
    }

    // Add suggestion
    await ctx.db.insert("suggestions", {
      inviteId: args.inviteId,
      helperId: userId,
      mainUserId: helper.mainUserId,
      suggestion: args.suggestion.toLowerCase(),
      submittedAt: Date.now(),
      used: false,
    });

    // Update helper's suggestion count
    await ctx.db.patch(helper._id, {
      suggestionsUsed: helper.suggestionsUsed + 1,
    });

    return true;
  },
});

export const getSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);

    // Get the user's current game session
    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (!userAttempt || !userAttempt.gameId) {
      return []; // No current game, no suggestions
    }

    // Only get suggestions for the current game session
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_main_user", (q) => q.eq("mainUserId", userId))
      .filter((q) => q.eq(q.field("used"), false))
      .order("desc")
      .collect();

    // Filter suggestions to only include those from the current game
    const currentGameSuggestions = suggestions.filter((suggestion) => {
      // Check if this suggestion is from the current game by looking up the invite
      return suggestion.inviteId; // We'll need to check the invite's gameId
    });

    // For each suggestion, verify it belongs to the current game
    const validSuggestions = [];
    for (const suggestion of currentGameSuggestions) {
      const invite = await ctx.db.get(suggestion.inviteId);
      if (invite && invite.gameId === userAttempt.gameId) {
        validSuggestions.push(suggestion);
      }
    }

    return await Promise.all(
      validSuggestions.map(async (suggestion) => {
        const helper = await ctx.db.get(suggestion.helperId);
        const helperName =
          helper && "name" in helper
            ? helper.name || helper.email || "Anonymous Friend"
            : "Anonymous Friend";

        return {
          _id: suggestion._id,
          suggestion: suggestion.suggestion,
          helperName,
          submittedAt: suggestion.submittedAt,
        };
      }),
    );
  },
});

export const useSuggestion = mutation({
  args: {
    suggestionId: v.id("suggestions"),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);

    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion || suggestion.mainUserId !== userId) {
      throw new Error("Invalid suggestion");
    }

    // Mark suggestion as used
    await ctx.db.patch(args.suggestionId, {
      used: true,
    });

    return suggestion.suggestion;
  },
});

export const startThirdAttemptTimer = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);

    const userAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (
      userAttempt &&
      userAttempt.gameId &&
      userAttempt.attempts === 2 &&
      !userAttempt.thirdAttemptStartTime
    ) {
      await ctx.db.patch(userAttempt._id, {
        thirdAttemptStartTime: Date.now(),
      });
    }
  },
});

export const generateGameWord = internalAction({
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(internal.game.checkExistingGameWord, {
      gameId: args.gameId,
    });
    if (existing) return;

    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content:
            "Generate a single obscure English word, 5-8 letters, extremely difficult to guess. Respond with ONLY the word.",
        },
      ],
      temperature: 0.9,
    });

    const word = response.choices[0].message.content?.trim().toLowerCase();
    if (!word) throw new Error("Failed to generate word");

    await ctx.runMutation(internal.game.saveGameWord, {
      gameId: args.gameId,
      word,
      difficulty: 9.5,
    });
  },
});

export const checkExistingGameWord = internalQuery({
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
      .unique();
    return existing !== null;
  },
});

export const saveGameWord = internalMutation({
  args: { gameId: v.string(), word: v.string(), difficulty: v.number() },
  handler: async (ctx, args) => {
    // Generate shuffled letters once and store them
    const shuffledLetters = shuffleArray(args.word.split(""));

    await ctx.db.insert("gameWords", {
      gameId: args.gameId,
      word: args.word,
      shuffledLetters,
      difficulty: args.difficulty,
      createdAt: Date.now(),
    });
  },
});

export const getHelperGameWord = query({
  args: {
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      return null;
    }

    if (!invite.gameId) {
      return null;
    }

    const gameWord = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", invite.gameId!))
      .unique();

    if (!gameWord) {
      return null;
    }

    return {
      word: gameWord.word,
      length: gameWord.word.length,
      letters: gameWord.word.split(""),
      shuffledLetters: gameWord.shuffledLetters || gameWord.word.split(""),
    };
  },
});

export const getMainPlayerGameState = query({
  args: {
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      return null;
    }

    if (!invite.gameId) {
      return null;
    }

    // Get main player's current attempt
    const mainUserAttempt = await ctx.db
      .query("userAttempts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), invite.createdBy),
          q.eq(q.field("gameId"), invite.gameId!),
        ),
      )
      .first();

    if (!mainUserAttempt) {
      return null;
    }

    // Get the game word
    const gameWord = await ctx.db
      .query("gameWords")
      .withIndex("by_game_id", (q) => q.eq("gameId", invite.gameId!))
      .unique();

    if (!gameWord) {
      return null;
    }

    return {
      gameId: mainUserAttempt.gameId,
      word: gameWord.word,
      length: gameWord.word.length,
      letters: gameWord.word.split(""),
      shuffledLetters: gameWord.shuffledLetters || gameWord.word.split(""),
      attempts: mainUserAttempt.attempts,
      completed: mainUserAttempt.completed,
      currentGuess: mainUserAttempt.currentGuess,
      canPlay: !mainUserAttempt.completed && mainUserAttempt.attempts < 3,
      won:
        mainUserAttempt.completed &&
        mainUserAttempt.currentGuess.toLowerCase() ===
          gameWord.word.toLowerCase(),
    };
  },
});
