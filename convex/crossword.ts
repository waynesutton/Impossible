import { v } from "convex/values";
import {
  query,
  mutation,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  getCurrentUserIdForQuery,
  getCurrentUserIdForMutation,
} from "./auth/helpers";

// Get or create user's crossword puzzle (unlimited after first completion)
export const getCurrentCrossword = query({
  args: {},
  returns: v.union(
    v.object({
      puzzleId: v.string(),
      words: v.array(v.string()),
      clues: v.array(v.string()),
      hints: v.optional(v.array(v.string())),
      helpClues: v.optional(v.array(v.string())),
      gridSize: v.number(),
      grid: v.optional(v.array(v.array(v.string()))), // Include grid data
      theme: v.optional(v.string()), // Include theme
      wordPositions: v.array(
        v.object({
          word: v.string(),
          startRow: v.number(),
          startCol: v.number(),
          direction: v.union(v.literal("across"), v.literal("down")),
          clueNumber: v.number(),
        }),
      ),
      expiresAt: v.number(),
      userProgress: v.optional(
        v.object({
          startedAt: v.number(),
          completed: v.boolean(),
          currentProgress: v.array(
            v.object({
              wordIndex: v.number(),
              letters: v.array(v.string()),
              completed: v.boolean(),
            }),
          ),
          hintsUsed: v.array(v.number()),
          cluesUsed: v.array(v.number()),
          aiHintsContent: v.record(v.string(), v.string()),
          aiCluesContent: v.record(v.string(), v.string()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdForQuery(ctx);
    if (!userId) return null;

    // Find the most recent puzzle for this user (unlimited play)
    const puzzle = await findMostRecentPuzzle(ctx, userId);

    if (!puzzle) {
      // No puzzle exists - return null to indicate need for generation
      return null;
    }

    // Get user's progress using the actual puzzle ID from the found puzzle
    const userProgress = puzzle
      ? await ctx.db
          .query("userCrosswordAttempts")
          .withIndex("by_user_and_puzzle", (q) =>
            q.eq("userId", userId).eq("puzzleId", puzzle.puzzleId),
          )
          .first()
      : null;

    return {
      puzzleId: puzzle.puzzleId,
      words: puzzle.words,
      clues: puzzle.clues,
      hints: puzzle.hints,
      helpClues: puzzle.helpClues,
      gridSize: puzzle.gridSize,
      grid: puzzle.grid, // Include the complete grid with blocked cells
      theme: puzzle.theme, // Include the daily theme
      wordPositions: puzzle.wordPositions,
      expiresAt: puzzle.expiresAt,
      userProgress: userProgress
        ? {
            startedAt: userProgress.startedAt,
            completed: userProgress.completed,
            currentProgress: userProgress.currentProgress,
            hintsUsed: userProgress.hintsUsed,
            cluesUsed: userProgress.cluesUsed,
            aiHintsContent: userProgress.aiHintsContent,
            aiCluesContent: userProgress.aiCluesContent,
          }
        : undefined,
    };
  },
});

// Update user's crossword progress
export const updateCrosswordProgress = mutation({
  args: {
    wordIndex: v.number(),
    letters: v.array(v.string()),
    isCompleted: v.optional(v.boolean()),
    usedSecretCode: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    wordCompleted: v.boolean(),
    crosswordCompleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Find the most recent puzzle for this user (unlimited play)
    const puzzle = await findMostRecentPuzzle(ctx, userId);

    if (!puzzle) {
      throw new Error("No active crossword found");
    }

    // Get or create user progress using the actual puzzle ID
    let userProgress = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", userId).eq("puzzleId", puzzle.puzzleId),
      )
      .first();

    const now = Date.now();

    if (!userProgress) {
      // Create new progress entry
      await ctx.db.insert("userCrosswordAttempts", {
        userId,
        puzzleId: puzzle.puzzleId,
        startedAt: now,
        lastActiveAt: now,
        completed: false,
        currentProgress: [
          {
            wordIndex: args.wordIndex,
            letters: args.letters,
            completed: args.isCompleted || false,
          },
        ],
        hintsUsed: [],
        cluesUsed: [],
        aiHintsContent: {},
        aiCluesContent: {},
        totalHintsUsed: 0,
        totalCluesUsed: 0,
        suggestionsReceived: 0,
        usedSecretCode: args.usedSecretCode || false,
      });
    } else {
      // Update existing progress
      const updatedProgress = [...userProgress.currentProgress];
      const existingIndex = updatedProgress.findIndex(
        (p) => p.wordIndex === args.wordIndex,
      );

      if (existingIndex >= 0) {
        updatedProgress[existingIndex] = {
          wordIndex: args.wordIndex,
          letters: args.letters,
          completed: args.isCompleted || false,
        };
      } else {
        updatedProgress.push({
          wordIndex: args.wordIndex,
          letters: args.letters,
          completed: args.isCompleted || false,
        });
      }

      // Check if all words are completed
      // We already have the puzzle from above

      const allCompleted =
        puzzle &&
        updatedProgress.length === puzzle.words.length &&
        updatedProgress.every((p) => p.completed);

      await ctx.db.patch(userProgress._id, {
        currentProgress: updatedProgress,
        lastActiveAt: now,
        completed: allCompleted || false,
        completedAt: allCompleted ? now : userProgress.completedAt,
        usedSecretCode:
          args.usedSecretCode || userProgress.usedSecretCode || false,
      });

      // If crossword completed, create result entry
      if (allCompleted && !userProgress.completed) {
        const totalTimeMinutes = Math.round(
          (now - userProgress.startedAt) / (1000 * 60),
        );
        const finalScore = calculateCrosswordScore(
          totalTimeMinutes,
          userProgress.totalHintsUsed,
          userProgress.totalCluesUsed,
          userProgress.suggestionsReceived,
        );

        await ctx.db.insert("crosswordResults", {
          userId,
          puzzleId: puzzle.puzzleId,
          dateString: new Date().toISOString().split("T")[0],
          completed: true,
          completedAt: now,
          totalTimeMinutes,
          hintsUsed: userProgress.totalHintsUsed,
          cluesUsed: userProgress.totalCluesUsed,
          suggestionsUsed: userProgress.suggestionsReceived,
          wordsCompleted: puzzle.words.length,
          totalWords: puzzle.words.length,
          displayName: userProgress.userId ? undefined : "Anonymous", // Will be filled from user record
          playerName: undefined, // Will be filled from user record
          isAnonymous: false, // Will be updated based on user record
          finalScore,
          usedSecretCode:
            args.usedSecretCode || userProgress.usedSecretCode || false,
        });
      }

      // Auto-generate hints/clues in background when a correct letter is detected
      const word = puzzle.words[args.wordIndex];
      if (word && args.letters.length > 0) {
        // Check if this update includes any new correct letters
        let hasNewCorrectLetter = false;
        for (let i = 0; i < args.letters.length; i++) {
          if (
            args.letters[i] &&
            args.letters[i].toLowerCase() === word[i].toLowerCase()
          ) {
            hasNewCorrectLetter = true;
            break;
          }
        }

        if (hasNewCorrectLetter) {
          // Schedule background hint generation if not already exists
          if (!userProgress.aiHintsContent[args.wordIndex.toString()]) {
            await ctx.scheduler.runAfter(
              100,
              internal.crossword.generateCrosswordHint,
              {
                userId,
                puzzleId: puzzle.puzzleId,
                wordIndex: args.wordIndex,
              },
            );
          }
        }
      }
    }

    return {
      success: true,
      wordCompleted: args.isCompleted || false,
      crosswordCompleted: false, // Would need to check all words
    };
  },
});

// Request AI hint for specific word - only available after correct letter guessed
export const requestCrosswordHint = mutation({
  args: {
    wordIndex: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    hint: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Find the most recent puzzle for this user (unlimited play)
    const puzzle = await findMostRecentPuzzle(ctx, userId);
    if (!puzzle) {
      throw new Error("No crossword in progress");
    }

    // Get user progress
    let userProgress = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", userId).eq("puzzleId", puzzle.puzzleId),
      )
      .first();

    if (!userProgress) {
      return {
        success: false,
        error: "No progress found for this crossword",
      };
    }

    // Check if user has guessed at least one correct letter in this word
    const wordProgress = userProgress.currentProgress?.find(
      (p) => p.wordIndex === args.wordIndex,
    );
    if (!wordProgress) {
      return {
        success: false,
        error: "You need to guess at least one correct letter first",
      };
    }

    const word = puzzle.words[args.wordIndex];
    if (!word) {
      return {
        success: false,
        error: "Invalid word index",
      };
    }

    // Check if at least one letter is correct
    let hasCorrectLetter = false;
    for (let i = 0; i < wordProgress.letters.length; i++) {
      if (
        wordProgress.letters[i] &&
        wordProgress.letters[i].toLowerCase() === word[i].toLowerCase()
      ) {
        hasCorrectLetter = true;
        break;
      }
    }

    if (!hasCorrectLetter) {
      return {
        success: false,
        error: "You need to guess at least one correct letter first",
      };
    }

    // Check if hint already exists
    if (userProgress.aiHintsContent[args.wordIndex.toString()]) {
      return {
        success: true,
        hint: userProgress.aiHintsContent[args.wordIndex.toString()],
      };
    }

    // Generate hint via AI action
    await ctx.scheduler.runAfter(0, internal.crossword.generateCrosswordHint, {
      userId,
      puzzleId: puzzle.puzzleId,
      wordIndex: args.wordIndex,
    });

    return {
      success: true,
      hint: undefined, // Will be available after AI generation
    };
  },
});

// Request AI clue (reveal letter) for specific word - only available after correct letter guessed
export const requestCrosswordClue = mutation({
  args: {
    wordIndex: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    clue: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Find the most recent puzzle for this user (unlimited play)
    const puzzle = await findMostRecentPuzzle(ctx, userId);
    if (!puzzle) {
      throw new Error("No crossword in progress");
    }

    // Get user progress
    let userProgress = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", userId).eq("puzzleId", puzzle.puzzleId),
      )
      .first();

    if (!userProgress) {
      return {
        success: false,
        error: "No progress found for this crossword",
      };
    }

    // Check if user has guessed at least one correct letter in this word
    const wordProgress = userProgress.currentProgress?.find(
      (p) => p.wordIndex === args.wordIndex,
    );
    if (!wordProgress) {
      return {
        success: false,
        error: "You need to guess at least one correct letter first",
      };
    }

    const word = puzzle.words[args.wordIndex];
    if (!word) {
      return {
        success: false,
        error: "Invalid word index",
      };
    }

    // Check if at least one letter is correct
    let hasCorrectLetter = false;
    for (let i = 0; i < wordProgress.letters.length; i++) {
      if (
        wordProgress.letters[i] &&
        wordProgress.letters[i].toLowerCase() === word[i].toLowerCase()
      ) {
        hasCorrectLetter = true;
        break;
      }
    }

    if (!hasCorrectLetter) {
      return {
        success: false,
        error: "You need to guess at least one correct letter first",
      };
    }

    // Check if clue already exists
    if (userProgress.aiCluesContent[args.wordIndex.toString()]) {
      return {
        success: true,
        clue: userProgress.aiCluesContent[args.wordIndex.toString()],
      };
    }

    // Generate random letter clue
    // Pick a random position to reveal
    const randomIndex = Math.floor(Math.random() * word.length);
    const letter = word[randomIndex].toUpperCase();
    const clue = `Position ${randomIndex + 1}: ${letter}`;

    // Update user progress
    const updatedCluesUsed = [...userProgress.cluesUsed];
    const updatedAiCluesContent = { ...userProgress.aiCluesContent };

    if (!updatedCluesUsed.includes(args.wordIndex)) {
      updatedCluesUsed.push(args.wordIndex);
    }
    updatedAiCluesContent[args.wordIndex.toString()] = clue;

    await ctx.db.patch(userProgress._id, {
      cluesUsed: updatedCluesUsed,
      aiCluesContent: updatedAiCluesContent,
      totalCluesUsed: updatedCluesUsed.length,
      lastActiveAt: Date.now(),
    });

    return {
      success: true,
      clue,
    };
  },
});

// Get user's crossword history
export const getUserCrosswordHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("crosswordResults"),
      dateString: v.string(),
      completed: v.boolean(),
      completedAt: v.number(),
      totalTimeMinutes: v.number(),
      hintsUsed: v.number(),
      cluesUsed: v.number(),
      finalScore: v.number(),
      wordsCompleted: v.number(),
      totalWords: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForQuery(ctx);
    if (!userId) return [];

    const results = await ctx.db
      .query("crosswordResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 10);

    return results.map((result) => ({
      _id: result._id,
      dateString: result.dateString,
      completed: result.completed,
      completedAt: result.completedAt,
      totalTimeMinutes: result.totalTimeMinutes,
      hintsUsed: result.hintsUsed,
      cluesUsed: result.cluesUsed,
      finalScore: result.finalScore,
      wordsCompleted: result.wordsCompleted,
      totalWords: result.totalWords,
    }));
  },
});

// Start crossword game and trigger puzzle generation (unlimited play)
export const startCrosswordGame = mutation({
  args: { forceNew: v.optional(v.boolean()) },
  returns: v.object({
    success: v.boolean(),
    puzzleReady: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Clean up any old 7x7 puzzles that are incompatible with new 15x15 system
    await cleanupOldCrosswordPuzzles(ctx, userId);

    // Clear any existing user progress for fresh start
    await clearUserCrosswordSession(ctx, userId);

    // Delete any existing puzzles for this user to ensure fresh start
    const existingPuzzles = await ctx.db
      .query("crosswordPuzzles")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    for (const puzzle of existingPuzzles) {
      await ctx.db.delete(puzzle._id);
    }

    // Create unique puzzle ID for unlimited play
    const puzzleId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dateString = Date.now().toString();

    // Generate new puzzle
    await ctx.scheduler.runAfter(0, internal.crossword.generateCrossword, {
      userId,
      dateString,
      puzzleId,
    });

    return {
      success: true,
      puzzleReady: false, // Puzzle is being generated
    };
  },
});

// Create invite link for crossword help
export const createCrosswordInvite = mutation({
  args: {},
  returns: v.string(), // Returns invite ID
  handler: async (ctx) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Verify user has an active crossword
    const puzzle = await findMostRecentPuzzle(ctx, userId);

    if (!puzzle) {
      throw new Error("No active crossword found");
    }

    // Get user info for creator name
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate unique invite ID string
    const inviteId = `${puzzle.puzzleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await ctx.db.insert("crosswordInvites", {
      inviteId,
      puzzleId: puzzle.puzzleId,
      creatorUserId: userId,
      creatorName: user.name || user.email || "Anonymous",
      createdAt: Date.now(),
      expiresAt: puzzle.expiresAt,
      used: false,
    });

    return inviteId;
  },
});

// Internal: Create crossword puzzle record
export const createCrosswordPuzzle = internalMutation({
  args: {
    puzzleId: v.string(),
    userId: v.id("users"),
    dateString: v.string(),
    words: v.array(v.string()),
    clues: v.array(v.string()),
    hints: v.optional(v.array(v.string())),
    helpClues: v.optional(v.array(v.string())),
    gridSize: v.number(),
    grid: v.array(v.array(v.string())),
    theme: v.optional(v.string()),
    wordPositions: v.array(
      v.object({
        word: v.string(),
        startRow: v.number(),
        startCol: v.number(),
        direction: v.union(v.literal("across"), v.literal("down")),
        clueNumber: v.number(),
      }),
    ),
    generatedAt: v.number(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("crosswordPuzzles", {
      puzzleId: args.puzzleId,
      userId: args.userId,
      dateString: args.dateString,
      words: args.words,
      clues: args.clues,
      hints: args.hints,
      helpClues: args.helpClues,
      gridSize: args.gridSize,
      grid: args.grid,
      theme: args.theme,
      wordPositions: args.wordPositions,
      generatedAt: args.generatedAt,
      expiresAt: args.expiresAt,
    });

    return null;
  },
});

// Internal: Get crossword puzzle data
export const getCrosswordPuzzle = query({
  args: {
    puzzleId: v.string(),
  },
  returns: v.union(
    v.object({
      words: v.array(v.string()),
      clues: v.array(v.string()),
      gridSize: v.number(),
      wordPositions: v.array(
        v.object({
          word: v.string(),
          startRow: v.number(),
          startCol: v.number(),
          direction: v.union(v.literal("across"), v.literal("down")),
          clueNumber: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", args.puzzleId))
      .first();

    if (!puzzle) return null;

    return {
      words: puzzle.words,
      clues: puzzle.clues,
      gridSize: puzzle.gridSize,
      wordPositions: puzzle.wordPositions,
    };
  },
});

// Internal: Update user hint
export const updateUserHint = internalMutation({
  args: {
    userId: v.id("users"),
    puzzleId: v.string(),
    wordIndex: v.number(),
    hint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userProgress = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", args.userId).eq("puzzleId", args.puzzleId),
      )
      .first();

    if (!userProgress) return null;

    const updatedHintsUsed = [...userProgress.hintsUsed];
    const updatedAiHintsContent = { ...userProgress.aiHintsContent };

    if (!updatedHintsUsed.includes(args.wordIndex)) {
      updatedHintsUsed.push(args.wordIndex);
    }
    updatedAiHintsContent[args.wordIndex.toString()] = args.hint;

    await ctx.db.patch(userProgress._id, {
      hintsUsed: updatedHintsUsed,
      aiHintsContent: updatedAiHintsContent,
      totalHintsUsed: updatedHintsUsed.length,
      lastActiveAt: Date.now(),
    });

    return null;
  },
});

// Helper function to get the word pool
export const getWordPool = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("wordPool").collect();
  },
});

// AI Integration: Generate daily crossword puzzle
export const generateCrossword = internalAction({
  args: {
    userId: v.id("users"),
    dateString: v.string(),
    puzzleId: v.string(),
  },
  handler: async (ctx, args) => {
    const wordPool = await ctx.runQuery(internal.crossword.getWordPool);

    if (wordPool.length < 10) {
      console.error(
        "Word pool has insufficient words. Triggering generation...",
      );
      // This will run the generation and the user can try again shortly.
      await ctx.scheduler.runAfter(
        0,
        internal.crossword.generateWeeklyWordPool,
        {},
      );
      throw new Error("Word pool is not ready. Please try again in a moment.");
    }

    const MAX_LAYOUT_ATTEMPTS = 50;
    let puzzleData = null;

    for (let attempt = 1; attempt <= MAX_LAYOUT_ATTEMPTS; attempt++) {
      const numWords = Math.random() > 0.5 ? 4 : 3;
      const selectedItems = selectCompatibleWords(wordPool, numWords);

      const words = selectedItems.map((item) => item.word);
      const clues = selectedItems.map((item) => item.clue);

      const layoutResult = generateLayout(
        words.map((w) => w.toUpperCase()),
        7,
      );

      if (layoutResult) {
        console.log(
          `Layout generated successfully on attempt ${attempt} with words: ${words.join(", ")}`,
        );
        puzzleData = {
          theme: "Weekly Mix", // Theme is now generalized
          words: words.map((w) => w.toUpperCase()),
          clues,
          positions: layoutResult.positions,
          grid: layoutResult.grid,
        };
        break; // Success!
      }
    }

    if (!puzzleData) {
      console.error(
        "Failed to generate a valid layout after multiple attempts. Using fallback puzzle.",
      );
      puzzleData = getFallbackPuzzle();
    }

    const { theme, words, clues, positions, grid } = puzzleData as {
      theme: string;
      words: string[];
      clues: string[];
      positions: Position[];
      grid: string[][];
    };
    const gridSize = 7;

    // Generate hints and help clues for the final word list
    const hints: string[] = [];
    const helpClues: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const clue = clues[i];
      hints.push(`Think about this: ${clue.toLowerCase()}`);
      helpClues.push(`First letter is "${word[0]}"`);
    }

    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year

    // Store the final, validated puzzle in the database
    await ctx.runMutation(internal.crossword.createCrosswordPuzzle, {
      puzzleId: args.puzzleId,
      userId: args.userId,
      dateString: args.dateString,
      words,
      clues,
      hints,
      helpClues,
      gridSize,
      grid,
      wordPositions: positions,
      generatedAt: Date.now(),
      expiresAt,
      theme,
    });

    console.log("Crossword puzzle stored successfully!");

    return {
      puzzleId: args.puzzleId,
      words,
      clues,
      gridSize,
      wordPositions: positions,
      expiresAt,
    };
  },
});

// AI hint generation using OpenAI
export const generateCrosswordHint = internalAction({
  args: {
    userId: v.id("users"),
    puzzleId: v.string(),
    wordIndex: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Get the puzzle and word
    const puzzle = await ctx.runQuery(api.crossword.getCrosswordPuzzle, {
      puzzleId: args.puzzleId,
    });

    if (!puzzle || !puzzle.words[args.wordIndex]) {
      return null;
    }

    const word = puzzle.words[args.wordIndex];
    const clue = puzzle.clues[args.wordIndex];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful crossword assistant. Generate a topical hint that gives context about what a word relates to, without revealing the word directly. Keep hints under 50 words and engaging.",
          },
          {
            role: "user",
            content: `The crossword clue is: "${clue}". The word is "${word}". Give me a topical hint about what this word relates to or its category, without revealing the answer.`,
          },
        ],

        temperature: 0.7,
        max_tokens: 150,
      });

      const hint =
        response.choices[0]?.message?.content ||
        `Think about: ${clue.split(" ").slice(0, 3).join(" ")}...`;

      // Update user progress with the hint
      await ctx.runMutation(internal.crossword.updateUserHint, {
        userId: args.userId,
        puzzleId: args.puzzleId,
        wordIndex: args.wordIndex,
        hint: hint.trim(),
      });
    } catch (error) {
      console.error("Error generating hint:", error);

      // Fallback hint
      const fallbackHint = `Think about: ${clue.split(" ").slice(0, 3).join(" ")}...`;

      await ctx.runMutation(internal.crossword.updateUserHint, {
        userId: args.userId,
        puzzleId: args.puzzleId,
        wordIndex: args.wordIndex,
        hint: fallbackHint,
      });
    }

    return null;
  },
});

// Internal query to check if user has completed any crossword (for use in actions)
export const checkUserCompletedAnyCrossword = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const completedCrossword = await ctx.db
      .query("crosswordResults")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("completed"), true))
      .first();

    return completedCrossword !== null;
  },
});

// Helper function to select random items from the word pool
function selectRandomWords(
  pool: { word: string; clue: string }[],
  count: number,
) {
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper function to select compatible words that are more likely to intersect
function selectCompatibleWords(
  pool: { word: string; clue: string }[],
  count: number,
) {
  if (pool.length < count) {
    return pool;
  }

  // Start with a random word
  const selected: { word: string; clue: string }[] = [];
  const remaining = [...pool];

  // Pick first word randomly
  const firstIndex = Math.floor(Math.random() * remaining.length);
  selected.push(remaining.splice(firstIndex, 1)[0]);

  // For subsequent words, prefer those with shared letters
  while (selected.length < count && remaining.length > 0) {
    let bestMatch = null;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let score = 0;

      // Calculate compatibility score based on shared letters
      for (const selectedWord of selected) {
        const sharedLetters = countSharedLetters(
          candidate.word.toUpperCase(),
          selectedWord.word.toUpperCase(),
        );
        score += sharedLetters;
      }

      // Add some randomness to prevent always picking the same combinations
      score += Math.random() * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }

    if (bestMatch !== null) {
      selected.push(remaining.splice(bestMatch, 1)[0]);
    } else {
      // Fallback to random selection
      const randomIndex = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(randomIndex, 1)[0]);
    }
  }

  return selected;
}

// Helper function to count shared letters between two words
function countSharedLetters(word1: string, word2: string): number {
  const letters1 = word1.split("");
  const letters2 = word2.split("");
  let count = 0;

  for (const letter of letters1) {
    if (letters2.includes(letter)) {
      count++;
      // Remove the letter to avoid double counting
      letters2.splice(letters2.indexOf(letter), 1);
    }
  }

  return count;
}

// Helper function removed - no longer needed for unlimited play

// Helper function to find the most recent puzzle for a user (any time)
async function findMostRecentPuzzle(ctx: any, userId: Id<"users">) {
  const allUserPuzzles = await ctx.db
    .query("crosswordPuzzles")
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .filter((q: any) => q.eq(q.field("gridSize"), 7)) // Only return 7x7 puzzles
    .collect();

  return allUserPuzzles.length > 0
    ? allUserPuzzles.sort((a: any, b: any) => b.generatedAt - a.generatedAt)[0]
    : null;
}

// Helper function removed - no longer needed for unlimited play

// Helper function to clear user crossword session for fresh start
async function clearUserCrosswordSession(ctx: any, userId: Id<"users">) {
  // Clear any incomplete crossword attempts
  const userAttempts = await ctx.db
    .query("userCrosswordAttempts")
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .filter((q: any) => q.eq(q.field("completed"), false))
    .collect();

  for (const attempt of userAttempts) {
    await ctx.db.delete(attempt._id);
  }
}

// Helper function to clean up old 7x7 crossword puzzles that are incompatible with 15x15 system
async function cleanupOldCrosswordPuzzles(ctx: any, userId: Id<"users">) {
  const userPuzzles = await ctx.db
    .query("crosswordPuzzles")
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .collect();

  // Delete any puzzles that aren't 7x7
  for (const puzzle of userPuzzles) {
    if (puzzle.gridSize !== 7) {
      await ctx.db.delete(puzzle._id);
      console.log(
        `Deleted old ${puzzle.gridSize}x${puzzle.gridSize} puzzle: ${puzzle.puzzleId}`,
      );
    }
  }
}

// Helper function to calculate crossword score
function calculateCrosswordScore(
  timeMinutes: number,
  hintsUsed: number,
  cluesUsed: number,
  suggestionsUsed: number,
): number {
  let baseScore = 1000;

  // Deduct for time (1 point per minute after first 10 minutes)
  if (timeMinutes > 10) {
    baseScore -= timeMinutes - 10;
  }

  // Deduct for hints and clues
  baseScore -= hintsUsed * 50;
  baseScore -= cluesUsed * 25;
  baseScore -= suggestionsUsed * 10;

  return Math.max(baseScore, 100); // Minimum score of 100
}

// Get crossword invite information for helpers
export const getCrosswordInviteInfo = query({
  args: { inviteId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      creatorName: v.string(),
      puzzleId: v.string(),
      gridPreview: v.array(v.array(v.string())),
      wordPositions: v.array(
        v.object({
          clueNumber: v.number(),
          startRow: v.number(),
          startCol: v.number(),
          direction: v.union(v.literal("across"), v.literal("down")),
          word: v.string(),
        }),
      ),
      clues: v.array(
        v.object({
          number: v.number(),
          clue: v.string(),
          direction: v.union(v.literal("across"), v.literal("down")),
        }),
      ),
      isCompleted: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("crosswordInvites")
      .withIndex("by_invite_id", (q) => q.eq("inviteId", args.inviteId))
      .unique();

    if (!invite || (invite.expiresAt && invite.expiresAt < Date.now())) {
      return null;
    }

    const puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", invite.puzzleId))
      .first();

    if (!puzzle) {
      return null;
    }

    // Get current user progress to show grid preview
    const creatorId = invite.creatorUserId || invite.createdBy;
    if (!creatorId) {
      throw new Error("Invalid invite: missing creator information");
    }

    const userAttempt = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", creatorId).eq("puzzleId", invite.puzzleId),
      )
      .first();

    // Build grid preview from user's current progress only (not the solution)
    let gridPreview = Array(puzzle.gridSize)
      .fill(null)
      .map(() => Array(puzzle.gridSize).fill(""));

    if (userAttempt?.currentProgress) {
      userAttempt.currentProgress.forEach((progress) => {
        const wordPos = puzzle.wordPositions[progress.wordIndex];
        if (wordPos) {
          progress.letters.forEach((letter, index) => {
            if (letter) {
              const row =
                wordPos.direction === "across"
                  ? wordPos.startRow
                  : wordPos.startRow + index;
              const col =
                wordPos.direction === "across"
                  ? wordPos.startCol + index
                  : wordPos.startCol;
              if (row < gridPreview.length && col < gridPreview[0].length) {
                gridPreview[row][col] = letter;
              }
            }
          });
        }
      });
    }

    return {
      creatorName: invite.creatorName || "Anonymous",
      puzzleId: invite.puzzleId,
      gridPreview,
      wordPositions: puzzle.wordPositions,
      clues: puzzle.clues.map((clue, index) => ({
        number: puzzle.wordPositions[index].clueNumber,
        clue,
        direction: puzzle.wordPositions[index].direction,
      })),
      isCompleted: userAttempt?.completed || false,
    };
  },
});

// Submit suggestion from helper
export const submitCrosswordSuggestion = mutation({
  args: {
    inviteId: v.string(),
    wordNumber: v.number(),
    suggestion: v.string(),
    helperName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("crosswordInvites")
      .withIndex("by_invite_id", (q) => q.eq("inviteId", args.inviteId))
      .unique();

    if (!invite || (invite.expiresAt && invite.expiresAt < Date.now())) {
      throw new Error("Invite expired or not found");
    }

    // Get creator ID from either new or legacy field
    const targetUserId = invite.creatorUserId || invite.createdBy;
    if (!targetUserId) {
      throw new Error("Invalid invite: missing creator information");
    }

    // Get a helper user ID (create anonymous user if needed)
    const helperUser = await ctx.db.insert("users", {
      name: args.helperName,
      isAnonymous: true,
    });

    await ctx.db.insert("crosswordSuggestions", {
      inviteId: args.inviteId,
      puzzleId: invite.puzzleId,
      helperId: helperUser,
      helperName: args.helperName,
      targetUserId,
      wordIndex: args.wordNumber,
      suggestion: args.suggestion,
      submittedAt: Date.now(),
      used: false,
    });

    return null;
  },
});

// Get crossword suggestions for the current user
export const getCrosswordSuggestions = query({
  args: { puzzleId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("crosswordSuggestions"),
      wordIndex: v.number(),
      suggestion: v.string(),
      helperName: v.string(),
      submittedAt: v.number(),
      used: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForQuery(ctx);
    if (!userId) return [];

    const suggestions = await ctx.db
      .query("crosswordSuggestions")
      .withIndex("by_puzzle_and_target", (q) =>
        q.eq("puzzleId", args.puzzleId).eq("targetUserId", userId),
      )
      .order("desc")
      .take(20);

    return suggestions.map((suggestion) => ({
      _id: suggestion._id,
      wordIndex: suggestion.wordIndex,
      suggestion: suggestion.suggestion,
      helperName: suggestion.helperName,
      submittedAt: suggestion.submittedAt,
      used: suggestion.used,
    }));
  },
});

// Get live crossword state for helpers
export const getCrosswordLiveState = query({
  args: { inviteId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      puzzleId: v.string(),
      words: v.array(v.string()),
      clues: v.array(v.string()),
      gridSize: v.number(),
      wordPositions: v.array(
        v.object({
          word: v.string(),
          startRow: v.number(),
          startCol: v.number(),
          direction: v.union(v.literal("across"), v.literal("down")),
          clueNumber: v.number(),
        }),
      ),
      userProgress: v.optional(
        v.object({
          startedAt: v.number(),
          completed: v.boolean(),
          currentProgress: v.array(
            v.object({
              wordIndex: v.number(),
              letters: v.array(v.string()),
              completed: v.boolean(),
            }),
          ),
          hintsUsed: v.array(v.number()),
          cluesUsed: v.array(v.number()),
          aiHintsContent: v.record(v.string(), v.string()),
          aiCluesContent: v.record(v.string(), v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("crosswordInvites")
      .withIndex("by_invite_id", (q) => q.eq("inviteId", args.inviteId))
      .unique();

    if (!invite || (invite.expiresAt && invite.expiresAt < Date.now())) {
      return null;
    }

    const puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", invite.puzzleId))
      .first();

    if (!puzzle) {
      return null;
    }

    // Get the creator's current progress
    const creatorId = invite.creatorUserId || invite.createdBy;
    if (!creatorId) {
      return null;
    }

    const userAttempt = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", creatorId).eq("puzzleId", invite.puzzleId),
      )
      .first();

    return {
      puzzleId: puzzle.puzzleId,
      words: puzzle.words,
      clues: puzzle.clues,
      gridSize: puzzle.gridSize,
      wordPositions: puzzle.wordPositions,
      userProgress: userAttempt
        ? {
            startedAt: userAttempt.startedAt,
            completed: userAttempt.completed,
            currentProgress: userAttempt.currentProgress,
            hintsUsed: userAttempt.hintsUsed,
            cluesUsed: userAttempt.cluesUsed,
            aiHintsContent: userAttempt.aiHintsContent,
            aiCluesContent: userAttempt.aiCluesContent,
          }
        : undefined,
    };
  },
});

// Use a friend suggestion
export const useCrosswordSuggestion = mutation({
  args: {
    suggestionId: v.id("crosswordSuggestions"),
  },
  returns: v.object({
    success: v.boolean(),
    suggestion: v.string(),
    wordIndex: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);
    const suggestion = await ctx.db.get(args.suggestionId);

    if (!suggestion || suggestion.used) {
      throw new Error("Suggestion not found or already used");
    }

    if (suggestion.targetUserId !== userId) {
      throw new Error("Not authorized to use this suggestion");
    }

    // Mark suggestion as used
    await ctx.db.patch(args.suggestionId, {
      used: true,
    });

    return {
      success: true,
      suggestion: suggestion.suggestion,
      wordIndex: suggestion.wordIndex,
    };
  },
});

// Admin-only: Clean up all old 7x7 crossword puzzles from the system
export const migrateOldCrosswordPuzzles = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // This should ideally have admin permission check, but for now just clean up
    const allPuzzles = await ctx.db.query("crosswordPuzzles").collect();

    let deletedCount = 0;
    for (const puzzle of allPuzzles) {
      if (puzzle.gridSize !== 7) {
        await ctx.db.delete(puzzle._id);
        deletedCount++;
        console.log(
          `Migration: Deleted old ${puzzle.gridSize}x${puzzle.gridSize} puzzle: ${puzzle.puzzleId}`,
        );
      }
    }

    return {
      success: true,
      deletedCount,
    };
  },
});

// Admin-only: Delete ALL existing crossword puzzles for fresh start
export const deleteAllCrosswordPuzzles = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Delete all puzzles for fresh start
    const allPuzzles = await ctx.db.query("crosswordPuzzles").collect();

    let deletedCount = 0;
    for (const puzzle of allPuzzles) {
      await ctx.db.delete(puzzle._id);
      deletedCount++;
      console.log(
        `Deleted puzzle: ${puzzle.puzzleId} with words: ${puzzle.words.join(", ")}`,
      );
    }

    return {
      success: true,
      deletedCount,
    };
  },
});

// #############################################################################
// # WEEKLY WORD POOL GENERATION
// #############################################################################

export const generateWeeklyWordPool = internalAction({
  args: {},
  handler: async (ctx) => {
    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("Generating weekly word pool via cron job...");

    const MAX_ATTEMPTS = 3;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        const themeResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are a creative assistant. Generate a single, interesting, and broad theme for a week of crossword puzzles. Examples: 'Space Exploration', 'Literary Classics', 'Famous Inventors', 'Marine Biology'. Respond with the theme name only.",
            },
            { role: "user", content: "Generate a new theme." },
          ],
        });
        const theme =
          themeResponse.choices[0]?.message?.content?.trim() ??
          "General Knowledge";

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an AI assistant that generates word lists for crossword puzzles.
              Generate a list of EXACTLY 80 unique words and corresponding clues related to the theme: "${theme}".
              Each word must be between 3 and 6 letters long.
              The response MUST be a valid JSON object with a single key "words", which is an array of 80 objects.
              Each object in the array should have two keys: "word" and "clue".
              Example format: { "words": [{ "word": "EARTH", "clue": "Third planet from the sun" }, ...] }`,
            },
            {
              role: "user",
              content: `Generate EXACTLY 80 words and clues for the theme "${theme}".`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("AI returned empty content for word pool.");
        }

        const parsed = JSON.parse(content);
        const words = parsed.words as { word: string; clue: string }[];

        if (words && words.length >= 80) {
          await ctx.runMutation(internal.crossword.populateWordPool, {
            words: words.slice(0, 80), // Ensure exactly 80
          });
          console.log("Successfully generated and populated the word pool.");
          return; // Exit after success
        }

        console.log(
          `Attempt ${i + 1} failed: AI generated only ${words?.length || 0} words. Retrying...`,
        );
      } catch (error) {
        console.error(`An error occurred during attempt ${i + 1}:`, error);
      }
    }

    throw new Error(
      `Failed to generate a sufficient word pool after ${MAX_ATTEMPTS} attempts.`,
    );
  },
});

export const populateWordPool = internalMutation({
  args: {
    words: v.array(v.object({ word: v.string(), clue: v.string() })),
  },
  handler: async (ctx, args) => {
    // Clear existing word pool to make way for the new weekly set
    const existingWords = await ctx.db.query("wordPool").collect();
    for (const wordDoc of existingWords) {
      await ctx.db.delete(wordDoc._id);
    }
    console.log(
      `Cleared ${existingWords.length} words from the existing pool.`,
    );

    // Populate with new words
    for (const item of args.words) {
      await ctx.db.insert("wordPool", {
        word: item.word.toUpperCase(),
        clue: item.clue,
      });
    }
    console.log(`Populated word pool with ${args.words.length} new words.`);
  },
});

// #############################################################################
// # LAYOUT GENERATION & FALLBACK LOGIC
// #############################################################################

interface Layout {
  positions: any[];
  grid: string[][];
}

type Position = {
  word: string;
  startRow: number;
  startCol: number;
  direction: "across" | "down";
  clueNumber: number;
};

function generateLayout(words: string[], gridSize: number): Layout | null {
  const sortedWords = [...words].sort((a, b) => b.length - a.length);
  const grid: string[][] = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(""));
  const positions: Omit<Position, "clueNumber">[] = [];

  // Attempt to place the first (longest) word in the center
  const firstWord = sortedWords[0];
  const startRow = Math.floor(gridSize / 2);
  const startCol = Math.floor((gridSize - firstWord.length) / 2);

  if (!placeWord(firstWord, startRow, startCol, "across", grid, positions)) {
    return null; // Should not happen for an empty grid
  }

  const unplacedWords = sortedWords.slice(1);

  let placedSomething = true; // FIX: Added missing variable declaration
  while (unplacedWords.length > 0 && placedSomething) {
    placedSomething = false;
    for (let i = 0; i < unplacedWords.length; i++) {
      const wordToPlace = unplacedWords[i];
      let bestFit = null;

      // Find the best intersection point for this word
      for (const placedPos of positions) {
        for (let j = 0; j < wordToPlace.length; j++) {
          for (let k = 0; k < placedPos.word.length; k++) {
            if (wordToPlace[j] === placedPos.word[k]) {
              const newDirection =
                placedPos.direction === "across" ? "down" : "across";
              let newRow, newCol;

              if (placedPos.direction === "across") {
                newRow = placedPos.startRow - j;
                newCol = placedPos.startCol + k;
              } else {
                newRow = placedPos.startRow + k;
                newCol = placedPos.startCol - j;
              }

              if (canPlace(wordToPlace, newRow, newCol, newDirection, grid)) {
                bestFit = {
                  word: wordToPlace,
                  startRow: newRow,
                  startCol: newCol,
                  direction: newDirection,
                };
                break;
              }
            }
          }
          if (bestFit) break;
        }
        if (bestFit) break;
      }

      if (bestFit) {
        placeWord(
          bestFit.word,
          bestFit.startRow,
          bestFit.startCol,
          bestFit.direction as "across" | "down",
          grid,
          positions,
        );
        unplacedWords.splice(i, 1);
        placedSomething = true;
        break;
      }
    }
  }

  if (unplacedWords.length > 0) {
    return null; // Failed to place all words
  }

  // Final validation: Ensure all words form a single connected component
  if (!isSingleComponent(positions)) {
    return null;
  }

  const finalPositions: Position[] = [...positions]
    .sort(
      (a, b) =>
        a.startRow * gridSize +
        a.startCol -
        (b.startRow * gridSize + b.startCol),
    )
    .map((pos, index) => ({
      ...pos,
      clueNumber: index + 1,
    }));

  return { positions: finalPositions, grid };
}

function canPlace(
  word: string,
  row: number,
  col: number,
  direction: "across" | "down",
  grid: string[][],
): boolean {
  const gridSize = grid.length;
  if (row < 0 || col < 0) return false;

  if (direction === "across") {
    if (col + word.length > gridSize) return false;
    // Check for adjacent letters at the start and end of the word
    if (grid[row]?.[col - 1] || grid[row]?.[col + word.length]) {
      return false;
    }
    for (let i = 0; i < word.length; i++) {
      const existing = grid[row][col + i];
      const isIntersection = existing === word[i];

      // Cell must be empty, unless it's a valid intersection point
      if (existing && !isIntersection) return false;

      // Check perpendicular neighbors for non-intersection cells
      if (!isIntersection) {
        if (grid[row - 1]?.[col + i] || grid[row + 1]?.[col + i]) {
          return false;
        }
      }
    }
  } else {
    // "down"
    if (row + word.length > gridSize) return false;
    // Check for adjacent letters at the start and end of the word
    if (grid[row - 1]?.[col] || grid[row + word.length]?.[col]) {
      return false;
    }
    for (let i = 0; i < word.length; i++) {
      const existing = grid[row + i][col];
      const isIntersection = existing === word[i];

      if (existing && !isIntersection) return false;

      if (!isIntersection) {
        if (grid[row + i]?.[col - 1] || grid[row + i]?.[col + 1]) {
          return false;
        }
      }
    }
  }
  return true;
}

function placeWord(
  word: string,
  row: number,
  col: number,
  direction: "across" | "down",
  grid: string[][],
  positions: Omit<Position, "clueNumber">[],
) {
  if (direction === "across") {
    for (let i = 0; i < word.length; i++) {
      grid[row][col + i] = word[i];
    }
  } else {
    for (let i = 0; i < word.length; i++) {
      grid[row + i][col] = word[i];
    }
  }
  positions.push({
    word,
    startRow: row,
    startCol: col,
    direction: direction,
  });
  return true;
}

function isSingleComponent(positions: Omit<Position, "clueNumber">[]): boolean {
  if (positions.length <= 1) return true;
  const visited = new Set<string>();
  const queue: Omit<Position, "clueNumber">[] = [positions[0]];
  visited.add(positions[0].word);

  let head = 0;
  while (head < queue.length) {
    const currentPos = queue[head++];
    for (const otherPos of positions) {
      if (!visited.has(otherPos.word) && wordsIntersect(currentPos, otherPos)) {
        visited.add(otherPos.word);
        queue.push(otherPos);
      }
    }
  }
  return visited.size === positions.length;
}

function wordsIntersect(
  pos1: Omit<Position, "clueNumber">,
  pos2: Omit<Position, "clueNumber">,
): boolean {
  const [startRow1, endRow1, startCol1, endCol1] = getWordBounds(pos1);
  const [startRow2, endRow2, startCol2, endCol2] = getWordBounds(pos2);

  return (
    startRow1 <= endRow2 &&
    endRow1 >= startRow2 &&
    startCol1 <= endCol2 &&
    endCol1 >= startCol2
  );
}

function getWordBounds(pos: Omit<Position, "clueNumber">) {
  if (pos.direction === "across") {
    return [
      pos.startRow,
      pos.startRow,
      pos.startCol,
      pos.startCol + pos.word.length - 1,
    ];
  } else {
    return [
      pos.startRow,
      pos.startRow + pos.word.length - 1,
      pos.startCol,
      pos.startCol,
    ];
  }
}

function getFallbackPuzzle() {
  const gridSize = 7;
  const fallbackSets = [
    {
      theme: "Classic Combo",
      words: ["ART", "TAPE", "EGG"],
      clues: ["Creative expression", "Sticky stuff", "Breakfast food"],
      positions: [
        {
          word: "ART",
          startRow: 3,
          startCol: 2,
          direction: "across",
          clueNumber: 1,
        },
        {
          word: "TAPE",
          startRow: 1,
          startCol: 4,
          direction: "down",
          clueNumber: 2,
        },
        {
          word: "EGG",
          startRow: 3,
          startCol: 4,
          direction: "down",
          clueNumber: 3,
        },
      ],
    },
    // Add more valid 7x7 fallbacks here if needed
  ];
  const randomSet =
    fallbackSets[Math.floor(Math.random() * fallbackSets.length)];

  const grid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(""));
  randomSet.positions.forEach((pos) => {
    for (let i = 0; i < pos.word.length; i++) {
      const row = pos.direction === "across" ? pos.startRow : pos.startRow + i;
      const col = pos.direction === "across" ? pos.startCol + i : pos.startCol;
      if (grid[row]) grid[row][col] = pos.word[i];
    }
  });

  return { ...randomSet, grid };
}
