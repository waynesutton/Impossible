import { v } from "convex/values";
import {
  query,
  mutation,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  getCurrentUserIdForQuery,
  getCurrentUserIdForMutation,
} from "./auth/helpers";

// Get or create user's daily crossword puzzle
export const getCurrentCrossword = query({
  args: {},
  returns: v.union(
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

    // Find the most recent puzzle for this user today
    let puzzle = await findTodaysPuzzle(ctx, userId);

    if (!puzzle) {
      // No puzzle exists - return null to indicate need for generation
      // The frontend should call a mutation to trigger puzzle generation
      return null;
    }

    // Check if puzzle is expired
    if (Date.now() > puzzle.expiresAt) {
      return null; // Will trigger new generation
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
      gridSize: puzzle.gridSize,
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

    // Find the most recent puzzle for this user today
    const puzzle = await findTodaysPuzzle(ctx, userId);

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
    }

    return {
      success: true,
      wordCompleted: args.isCompleted || false,
      crosswordCompleted: false, // Would need to check all words
    };
  },
});

// Request AI hint for specific word
export const requestCrosswordHint = mutation({
  args: {
    wordIndex: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    hint: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Find the most recent puzzle for this user today
    const puzzle = await findTodaysPuzzle(ctx, userId);
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
      // Create initial user progress if it doesn't exist
      const newProgressId = await ctx.db.insert("userCrosswordAttempts", {
        userId,
        puzzleId: puzzle.puzzleId,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        currentProgress: [],
        hintsUsed: [],
        cluesUsed: [],
        aiHintsContent: {},
        aiCluesContent: {},
        totalHintsUsed: 0,
        totalCluesUsed: 0,
        suggestionsReceived: 0,
      });

      // Get the newly created progress
      const newProgress = await ctx.db.get(newProgressId);
      if (!newProgress) {
        throw new Error("Failed to create user progress");
      }

      userProgress = newProgress;
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

// Request AI clue (reveal letter) for specific word
export const requestCrosswordClue = mutation({
  args: {
    wordIndex: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    clue: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);

    // Find the most recent puzzle for this user today
    const puzzle = await findTodaysPuzzle(ctx, userId);
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
      // Create initial user progress if it doesn't exist
      const newProgressId = await ctx.db.insert("userCrosswordAttempts", {
        userId,
        puzzleId: puzzle.puzzleId,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        currentProgress: [],
        hintsUsed: [],
        cluesUsed: [],
        aiHintsContent: {},
        aiCluesContent: {},
        totalHintsUsed: 0,
        totalCluesUsed: 0,
        suggestionsReceived: 0,
      });

      // Get the newly created progress
      const newProgress = await ctx.db.get(newProgressId);
      if (!newProgress) {
        throw new Error("Failed to create user progress");
      }

      userProgress = newProgress;
    }

    // Check if clue already exists
    if (userProgress.aiCluesContent[args.wordIndex.toString()]) {
      return {
        success: true,
        clue: userProgress.aiCluesContent[args.wordIndex.toString()],
      };
    }

    // Generate random letter clue
    const word = puzzle.words[args.wordIndex];
    if (!word) {
      throw new Error("Invalid word index");
    }

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

// Start crossword game and trigger puzzle generation if needed
export const startCrosswordGame = mutation({
  args: { forceNew: v.optional(v.boolean()) },
  returns: v.object({
    success: v.boolean(),
    puzzleReady: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdForMutation(ctx);
    const today = new Date().toISOString().split("T")[0];

    // If forceNew is true, create a new puzzle with timestamp for uniqueness
    const puzzleId = args.forceNew
      ? `${userId}_${today}_${Date.now()}`
      : `${userId}_${today}`;

    // Check if puzzle already exists (skip check if forceNew)
    if (!args.forceNew) {
      const existingPuzzle = await ctx.db
        .query("crosswordPuzzles")
        .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", puzzleId))
        .first();

      if (existingPuzzle && Date.now() <= existingPuzzle.expiresAt) {
        return {
          success: true,
          puzzleReady: true,
        };
      }
    }

    // Generate new puzzle
    const dateString = args.forceNew ? `${today}_${Date.now()}` : today;

    await ctx.scheduler.runAfter(0, internal.crossword.generateDailyCrossword, {
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
    const puzzle = await findTodaysPuzzle(ctx, userId);

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
    gridSize: v.number(),
    grid: v.array(v.array(v.string())),
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
      gridSize: args.gridSize,
      grid: args.grid,
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

// AI Integration: Generate daily crossword puzzle
export const generateDailyCrossword = internalAction({
  args: {
    userId: v.id("users"),
    dateString: v.string(),
    puzzleId: v.string(),
  },
  returns: v.object({
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
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    console.log(
      "Starting crossword generation for user:",
      args.userId,
      "date:",
      args.dateString,
    );

    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    try {
      console.log("Attempting OpenAI API call for crossword generation...");

      // Generate crossword words and clues using AI with timeout
      const response = (await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a professional crossword puzzle generator. Create a proper 7x7 crossword puzzle following traditional crossword rules.

CROSSWORD RULES (based on standard American-style crosswords):
1. Grid must have black/blocked squares (~15-20% of grid) to separate entries
2. All words must be at least 3 letters long
3. Words must intersect properly - every letter should be "checked" (part of both across and down words where possible)
4. Use common English words only, avoid proper nouns
5. Grid should have 180-degree rotational symmetry
6. All white (word) squares should be connected
7. Create challenging but fair clues

STRUCTURE:
- Total grid: 7x7 (49 squares)
- Approximately 8-12 black squares
- 6-8 words total (mix of across and down)
- Words should be 3-6 letters long
- Make words moderately challenging to guess

RESPONSE FORMAT (exact JSON):
{
  "words": ["EXAMPLE", "WORD", "LIST"],
  "clues": ["Example clue 1", "Example clue 2", "Example clue 3"],
  "positions": [
    {"word": "EXAMPLE", "startRow": 0, "startCol": 0, "direction": "across", "clueNumber": 1},
    {"word": "WORD", "startRow": 2, "startCol": 1, "direction": "down", "clueNumber": 2}
  ],
  "blockedCells": [
    {"row": 1, "col": 3},
    {"row": 5, "col": 3}
  ]
}`,
            },
            {
              role: "user",
              content: `Generate a simple crossword puzzle for user ${args.userId} on date ${args.dateString}. Keep it simple and fun!`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("OpenAI API timeout")), 15000),
        ),
      ])) as any;

      console.log("OpenAI API call successful, parsing response...");
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response content from AI");
      }

      console.log("AI Response content:", content);

      // Parse AI response
      const puzzleData = JSON.parse(content);
      console.log("Parsed puzzle data:", puzzleData);

      const puzzleId = args.puzzleId; // Use the puzzle ID passed from startCrosswordGame
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      // Build grid from word positions (7x7 grid)
      const gridSize = 7;
      const grid = Array(gridSize)
        .fill(null)
        .map(() => Array(gridSize).fill(""));

      // Mark blocked cells first
      if (puzzleData.blockedCells) {
        puzzleData.blockedCells.forEach((blocked: any) => {
          if (blocked.row < gridSize && blocked.col < gridSize) {
            grid[blocked.row][blocked.col] = "#"; // Use # to mark blocked cells
          }
        });
      }

      // Place words in the grid
      puzzleData.positions.forEach((pos: any) => {
        for (let i = 0; i < pos.word.length; i++) {
          const row =
            pos.direction === "across" ? pos.startRow : pos.startRow + i;
          const col =
            pos.direction === "across" ? pos.startCol + i : pos.startCol;
          if (row < gridSize && col < gridSize && grid[row][col] !== "#") {
            grid[row][col] = pos.word[i].toUpperCase();
          }
        }
      });

      // Store the generated puzzle
      console.log("Storing AI-generated puzzle in database...");
      await ctx.runMutation(internal.crossword.createCrosswordPuzzle, {
        puzzleId,
        userId: args.userId,
        dateString: args.dateString,
        words: puzzleData.words,
        clues: puzzleData.clues,
        gridSize: gridSize, // Now 7x7
        grid,
        wordPositions: puzzleData.positions,
        generatedAt: Date.now(),
        expiresAt,
      });

      console.log("AI-generated crossword puzzle stored successfully!");
      return {
        puzzleId,
        words: puzzleData.words,
        clues: puzzleData.clues,
        gridSize: 5,
        wordPositions: puzzleData.positions,
        expiresAt,
      };
    } catch (error) {
      console.error("Error generating crossword with AI:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        userId: args.userId,
        dateString: args.dateString,
      });

      // Re-throw the error instead of using a fallback
      // This will allow the frontend to handle the error appropriately
      throw new Error(
        `Failed to generate crossword puzzle: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
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
        model: "gpt-4o-mini",
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

// Helper function to find the most recent puzzle for a user today
async function findTodaysPuzzle(ctx: any, userId: Id<"users">) {
  const today = new Date().toISOString().split("T")[0];

  const allUserPuzzles = await ctx.db
    .query("crosswordPuzzles")
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .collect();

  const todaysPuzzles = allUserPuzzles.filter(
    (p: any) =>
      p.puzzleId.startsWith(`${userId}_${today}`) && Date.now() <= p.expiresAt,
  );

  return todaysPuzzles.length > 0
    ? todaysPuzzles.sort((a: any, b: any) => b.generatedAt - a.generatedAt)[0]
    : null;
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
