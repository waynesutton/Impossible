import { defineSchema, defineTable } from "convex/server";
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
  gameWords: defineTable({
    gameId: v.string(), // Unique game session ID
    word: v.string(),
    shuffledLetters: v.optional(v.array(v.string())), // Store shuffled letters to prevent reshuffling
    difficulty: v.number(),
    createdAt: v.number(),
  }).index("by_game_id", ["gameId"]),

  userAttempts: defineTable({
    userId: v.id("users"),
    gameId: v.optional(v.string()), // Game session ID
    date: v.optional(v.string()), // Legacy field for migration
    attempts: v.number(), // Number of attempts used
    completed: v.boolean(), // Whether they guessed correctly
    currentGuess: v.string(), // Their current typing progress
    lastAttemptTime: v.number(), // Timestamp of last attempt
    completedAt: v.optional(v.number()), // When they completed it (for leaderboard)
    hint: v.optional(v.string()), // AI-generated hint
    clue: v.optional(v.string()), // First and last letter clue
    displayName: v.optional(v.string()), // Optional display name for leaderboard
    thirdAttemptStartTime: v.optional(v.number()), // When third attempt timer started
  })
    .index("by_user_and_game", ["userId", "gameId"])
    .index("by_game_and_completed", ["gameId", "completed"]),

  gameResults: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    word: v.string(),
    completed: v.boolean(),
    attempts: v.number(),
    completedAt: v.number(),
    displayName: v.optional(v.string()),
    playerName: v.optional(v.string()), // User's name or email
    isAnonymous: v.boolean(),
    usedSecretWord: v.optional(v.boolean()), // Whether they used the secret word to win
    isHidden: v.optional(v.boolean()), // Admin can hide from leaderboard
    isDeleted: v.optional(v.boolean()), // Admin can soft delete
    adminAction: v.optional(v.string()), // Track which admin took action
    adminActionAt: v.optional(v.number()), // When admin action was taken
  })
    .index("by_completed_and_time", ["completed", "completedAt"])
    .index("by_user", ["userId"])
    .index("by_visibility", ["isHidden", "isDeleted"]),

  invites: defineTable({
    createdBy: v.id("users"),
    gameId: v.optional(v.string()), // Game session ID
    date: v.optional(v.string()), // Legacy field for migration
    createdAt: v.number(),
    used: v.boolean(),
  }),

  helpers: defineTable({
    inviteId: v.id("invites"),
    helperId: v.id("users"),
    mainUserId: v.id("users"),
    gameId: v.optional(v.string()),
    date: v.optional(v.string()), // Legacy field for migration
    suggestionsUsed: v.number(),
    joinedAt: v.number(),
  })
    .index("by_invite_and_user", ["inviteId", "helperId"])
    .index("by_main_user", ["mainUserId"]),

  suggestions: defineTable({
    inviteId: v.id("invites"),
    helperId: v.id("users"),
    mainUserId: v.id("users"),
    suggestion: v.string(),
    submittedAt: v.number(),
    used: v.boolean(),
  })
    .index("by_main_user", ["mainUserId"])
    .index("by_invite", ["inviteId"]),

  analytics: defineTable({
    eventType: v.string(), // "homepage_view" or "game_started"
    userId: v.optional(v.id("users")), // Optional for anonymous tracking
    timestamp: v.number(),
    sessionId: v.optional(v.string()), // Track unique sessions
  }).index("by_event_type", ["eventType"]),

  // Challenge Mode Tables (1v1 Challenger vs Opponent)
  challengeBattles: defineTable({
    gameId: v.string(), // Unique challenge session ID
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
    currentWordIndex: v.number(), // Track progression through 3 words
    challengerScore: v.number(),
    opponentScore: v.number(),
    winner: v.optional(v.string()), // "challenger" | "opponent" | "tie"
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    currentRoundStartTime: v.optional(v.number()), // For 60-second timer
    maxWords: v.number(), // Always 3 words for challenge mode
    isHidden: v.optional(v.boolean()), // Admin can hide from leaderboard
    isDeleted: v.optional(v.boolean()), // Admin can soft delete
    adminAction: v.optional(v.string()), // Track which admin took action
    adminActionAt: v.optional(v.number()), // When admin action was taken
  })
    .index("by_game_id", ["gameId"])
    .index("by_status", ["status"])
    .index("by_completion", ["completedAt"])
    .index("by_visibility", ["isHidden", "isDeleted"]),

  challengeWordAttempts: defineTable({
    battleId: v.id("challengeBattles"),
    wordIndex: v.number(), // 0, 1, or 2 (for 3 words)
    gameWordId: v.id("gameWords"), // Reference to the actual word
    player: v.union(v.literal("challenger"), v.literal("opponent")),
    attempts: v.number(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    currentGuess: v.string(),
    finalScore: v.number(), // Points earned for this word
    timeUsed: v.optional(v.number()), // Milliseconds taken to complete
    usedHint: v.boolean(),
    usedClue: v.boolean(),
    usedInviteFriend: v.boolean(),
  })
    .index("by_battle_and_word", ["battleId", "wordIndex"])
    .index("by_battle_player_word", ["battleId", "player", "wordIndex"]),

  challengeInvites: defineTable({
    battleId: v.id("challengeBattles"),
    createdBy: v.id("users"),
    createdAt: v.number(),
    used: v.boolean(),
  }).index("by_battle", ["battleId"]),

  // Rematch requests for challenge battles
  rematchRequests: defineTable({
    originalChallengeId: v.id("challengeBattles"),
    requestedBy: v.union(v.literal("challenger"), v.literal("opponent")),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
    ),
    requestedAt: v.number(),
    respondedAt: v.optional(v.number()),
    newChallengeId: v.optional(v.id("challengeBattles")), // Store new challenge ID when accepted
  }).index("by_challenge", ["originalChallengeId"]),

  // Crossword Mode Tables
  crosswordPuzzles: defineTable({
    puzzleId: v.string(), // Unique puzzle ID (unlimited play)
    userId: v.id("users"),
    dateString: v.string(), // Generation timestamp for tracking
    words: v.array(v.string()), // Array of words in the crossword
    clues: v.array(v.string()), // Corresponding clues for each word
    hints: v.optional(v.array(v.string())), // Preloaded hints for each word
    helpClues: v.optional(v.array(v.string())), // Preloaded help clues for each word
    gridSize: v.number(), // Grid dimensions (15x15 default)
    grid: v.optional(v.array(v.array(v.string()))), // 2D array representing crossword grid (optional for migration)
    theme: v.optional(v.string()), // Puzzle theme for the crossword
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
    expiresAt: v.number(), // Long expiration for unlimited play
  })
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_user_and_date", ["userId", "dateString"])
    .index("by_expiration", ["expiresAt"]),

  userCrosswordAttempts: defineTable({
    userId: v.id("users"),
    puzzleId: v.string(), // Reference to crosswordPuzzles.puzzleId
    startedAt: v.number(),
    lastActiveAt: v.number(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    currentProgress: v.array(
      v.object({
        wordIndex: v.number(),
        letters: v.array(v.string()), // Current filled letters for this word
        completed: v.boolean(),
      }),
    ),
    hintsUsed: v.array(v.number()), // Array of word indices where hints were used
    cluesUsed: v.array(v.number()), // Array of word indices where clues were used
    aiHintsContent: v.record(v.string(), v.string()), // Map word index to hint content (stringified index)
    aiCluesContent: v.record(v.string(), v.string()), // Map word index to clue content (stringified index)
    totalHintsUsed: v.number(),
    totalCluesUsed: v.number(),
    suggestionsReceived: v.number(), // Count of friend suggestions
    usedSecretCode: v.optional(v.boolean()), // Track if user used admin cheat code
  })
    .index("by_user_and_puzzle", ["userId", "puzzleId"])
    .index("by_user_and_completion", ["userId", "completed"])
    .index("by_last_active", ["lastActiveAt"]),

  crosswordResults: defineTable({
    userId: v.id("users"),
    puzzleId: v.string(),
    dateString: v.string(), // YYYY-MM-DD for daily tracking
    completed: v.boolean(),
    completedAt: v.number(),
    totalTimeMinutes: v.number(),
    hintsUsed: v.number(),
    cluesUsed: v.number(),
    suggestionsUsed: v.number(),
    wordsCompleted: v.number(),
    totalWords: v.number(),
    displayName: v.optional(v.string()),
    playerName: v.optional(v.string()),
    isAnonymous: v.boolean(),
    finalScore: v.number(), // Calculated score based on completion, time, hints used
    usedSecretCode: v.optional(v.boolean()), // Track if player used the admin cheat code
  })
    .index("by_user", ["userId"])
    .index("by_date_and_completion", ["dateString", "completed"])
    .index("by_completion_and_time", ["completed", "completedAt"])
    .index("by_final_score", ["finalScore"]),

  crosswordInvites: defineTable({
    inviteId: v.optional(v.string()), // Unique invite identifier (optional for migration)
    puzzleId: v.string(),
    createdBy: v.optional(v.id("users")), // Legacy field for migration
    creatorUserId: v.optional(v.id("users")), // New field (optional for migration)
    creatorName: v.optional(v.string()), // New field (optional for migration)
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // Same as puzzle expiration (optional for migration)
    used: v.boolean(),
    usedAt: v.optional(v.number()),
  })
    .index("by_invite_id", ["inviteId"])
    .index("by_puzzle", ["puzzleId"])
    .index("by_creator", ["creatorUserId"]),

  crosswordSuggestions: defineTable({
    inviteId: v.string(), // String invite ID to match crosswordInvites.inviteId
    puzzleId: v.string(),
    helperId: v.id("users"),
    helperName: v.string(),
    targetUserId: v.id("users"),
    wordIndex: v.number(), // Which word the suggestion is for
    suggestion: v.string(),
    submittedAt: v.number(),
    used: v.boolean(),
  })
    .index("by_puzzle_and_target", ["puzzleId", "targetUserId"])
    .index("by_invite", ["inviteId"])
    .index("by_word_index", ["puzzleId", "wordIndex"]),

  wordPool: defineTable({
    word: v.string(),
    clue: v.string(),
  }),

  // V2 Leaderboard tables
  scores: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    word: v.string(),
    completed: v.boolean(),
    attempts: v.number(),
    completedAt: v.number(),
    displayName: v.optional(v.string()),
    playerName: v.optional(v.string()),
    isAnonymous: v.boolean(),
    finalScore: v.number(),
    usedSecretCode: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_game_and_completion", ["gameId", "completed"])
    .index("by_completion_and_time", ["completed", "completedAt"])
    .index("by_final_score", ["finalScore"]),
};

export default defineSchema(applicationTables);
