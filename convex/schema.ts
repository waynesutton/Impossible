import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const applicationTables = {
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  }),
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
  })
    .index("by_completed_and_time", ["completed", "completedAt"])
    .index("by_user", ["userId"]),

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
  })
    .index("by_game_id", ["gameId"])
    .index("by_status", ["status"])
    .index("by_completion", ["completedAt"]),

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
};

export default defineSchema({
  ...applicationTables,
});
