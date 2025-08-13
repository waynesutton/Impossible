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
};

export default defineSchema({
  ...applicationTables,
});
