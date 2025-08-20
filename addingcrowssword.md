<!-- cspell:ignore neobrutalism,ghibli,tsx,ctx,bg,rgba,ts,completers,Neobrutalism -->

# PRD: Adding Impossible Crossword Mode

## Overview

This PRD outlines the implementation of "Impossible Crossword" mode for the Impossible Word game, adding a daily crossword puzzle feature that integrates seamlessly with the existing single-player, challenge mode, authentication system, and analytics dashboard.

## Executive Summary

**What**: A daily crossword puzzle mode where each user (logged in or anonymous) gets a unique crossword that persists for 24 hours, providing unlimited time to solve with friend collaboration and AI clue assistance.

**Why**: Expand the game offerings to include a more relaxed, collaborative puzzle experience that complements the existing high-pressure word guessing and challenge battle modes.

**How**: Leverage existing AI generation, authentication infrastructure, friend collaboration system, and analytics tracking to create a seamless crossword experience that works for both authenticated and anonymous users.

**Theme Compatibility**: The crossword interface is designed to work seamlessly with all existing themes (neobrutalism, original, ghibli, dark) using CSS variables and theme-specific overrides for optimal visual consistency.

## User Stories

### Primary Users

**As an anonymous user**, I want to start a daily impossible crossword so that I can enjoy a challenging puzzle without needing to create an account.

**As a logged-in user**, I want to access my daily crossword and see my progress tracked in my personal scores so that I can monitor my crossword-solving performance over time.

**As any user**, I want to invite friends to help with unlimited suggestions so that I can collaboratively solve challenging crosswords.

**As any user**, I want to request AI-generated hints and clues for specific words at any time so that I can get contextual help when stuck on individual crossword entries.

**As any user**, I want AI hints to provide topical context about what specific words relate to so that I can understand the subject matter without revealing letters.

**As any user**, I want AI clues to reveal one correct letter placement in a specific word so that I can get concrete solving assistance for challenging entries.

**As a logged-in user**, I want my crossword completions to appear on the leaderboard so that I can share my solving achievements.

**As an admin**, I want crossword analytics in the dashboard so that I can track engagement and performance across all game modes.

## Technical Requirements

### Core Crossword Logic

1. **Daily Uniqueness**: Each user gets one crossword per calendar day (UTC timezone)
2. **24-Hour Persistence**: Crossword state persists for 24 hours from creation
3. **Grid Generation**: AI-generated crossword puzzles with 7x7 grid size
4. **Word Integration**: 8-12 words per crossword with varying difficulty
5. **Base Clue Generation**: AI-generated initial clues for each word in the crossword
6. **On-Demand AI Assistance**: Individual word hints and letter clues available per request

### User Experience Flow

1. **Entry Point**: "Impossible Crossword" button appears next to "Challenge a Friend" after clicking "Begin"
2. **Session Management**: 24-hour crossword sessions for both logged-in and anonymous users
3. **Progressive Solving**: Users can partially complete and return to their crossword
4. **AI Assistance Tracking**: Track completion time, AI hints used, AI clues used, and friend suggestions received
5. **Per-Word Help**: Individual AI assistance available for each crossword word entry
6. **Results Integration**: Completed crosswords appear in personal scores and leaderboard

### Authentication Integration

1. **Anonymous Support**: Full crossword functionality without authentication
2. **Account Linking**: Anonymous crossword progress transfers if user signs up within 24 hours
3. **Personal Tracking**: Logged-in users see crosswords in "My Scores" page
4. **Admin Analytics**: Crossword metrics included in admin dashboard

## Implementation Plan

### Phase 1: Database Schema Updates

#### New Tables

**crosswordPuzzles** - Daily crossword puzzle definitions

```typescript
crosswordPuzzles: defineTable({
  puzzleId: v.string(), // Daily unique identifier: "crossword_YYYY-MM-DD"
  gridSize: v.number(), // Fixed at 7 for initial implementation
  grid: v.array(v.array(v.string())), // 2D array representing crossword grid
  words: v.array(
    v.object({
      word: v.string(),
      startRow: v.number(),
      startCol: v.number(),
      direction: v.union(v.literal("across"), v.literal("down")),
      clue: v.string(),
      number: v.number(),
    }),
  ),
  difficulty: v.number(), // Calculated difficulty score
  createdAt: v.number(),
  expiresAt: v.number(), // 24 hours after creation
}).index("by_puzzle_id", ["puzzleId"]);
```

**userCrosswordAttempts** - User progress tracking

```typescript
userCrosswordAttempts: defineTable({
  userId: v.id("users"),
  puzzleId: v.string(), // Links to crosswordPuzzles.puzzleId
  currentState: v.array(v.array(v.string())), // User's current grid state
  completedWords: v.array(v.number()), // Array of completed word numbers
  hintsUsed: v.array(v.number()), // Array of word numbers with AI hints requested
  cluesUsed: v.array(v.number()), // Array of word numbers with AI letter clues requested
  aiHintsContent: v.record(v.number(), v.string()), // Map of wordNumber -> hint content
  aiCluesContent: v.record(v.number(), v.string()), // Map of wordNumber -> revealed letter position
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  isCompleted: v.boolean(),
  lastUpdated: v.number(),
  friendSuggestionsReceived: v.number(),
}).index("by_user_and_puzzle", ["userId", "puzzleId"]);
```

**crosswordResults** - Completed crossword records

```typescript
crosswordResults: defineTable({
  userId: v.id("users"),
  puzzleId: v.string(),
  completedAt: v.number(),
  totalTime: v.number(), // Time from start to completion in milliseconds
  hintsUsed: v.number(), // Count of AI hints requested
  cluesUsed: v.number(), // Count of AI letter clues requested
  friendSuggestionsUsed: v.number(), // Count of friend suggestions received
  wordsCompleted: v.number(), // Total words in the crossword
  playerName: v.optional(v.string()),
  isAnonymous: v.boolean(),
  isHidden: v.optional(v.boolean()), // Admin moderation
  isDeleted: v.optional(v.boolean()), // User/admin deletion
})
  .index("by_completion_time", ["completedAt"])
  .index("by_user", ["userId"]);
```

**crosswordInvites** - Friend collaboration system

```typescript
crosswordInvites: defineTable({
  inviteId: v.string(), // Unique invite identifier
  puzzleId: v.string(),
  creatorUserId: v.id("users"),
  creatorName: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(), // Same as puzzle expiration
}).index("by_invite_id", ["inviteId"]);
```

**crosswordSuggestions** - Friend word suggestions

```typescript
crosswordSuggestions: defineTable({
  inviteId: v.string(),
  wordNumber: v.number(), // Which word in the crossword
  suggestion: v.string(),
  helperName: v.string(),
  createdAt: v.number(),
}).index("by_invite", ["inviteId"]);
```

#### Schema Updates

Update existing analytics table to track crossword events:

```typescript
analytics: defineTable({
  // ... existing fields
  eventType: v.union(
    v.literal("homepage_view"),
    v.literal("game_start"),
    v.literal("challenge_created"),
    v.literal("crossword_started"), // NEW
    v.literal("crossword_completed"), // NEW
  ),
});
```

### Phase 2: Backend Functions

#### Core Crossword Functions (convex/crossword.ts)

**getCurrentCrossword** - Get user's daily crossword

```typescript
export const getCurrentCrossword = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      puzzleId: v.string(),
      gridSize: v.number(),
      clues: v.object({
        across: v.array(
          v.object({
            number: v.number(),
            clue: v.string(),
            answer: v.string(), // Only revealed for completed words
            length: v.number(),
          }),
        ),
        down: v.array(
          v.object({
            number: v.number(),
            clue: v.string(),
            answer: v.string(),
            length: v.number(),
          }),
        ),
      }),
      currentState: v.array(v.array(v.string())),
      completedWords: v.array(v.number()),
      isCompleted: v.boolean(),
      startedAt: v.number(),
      timeRemaining: v.number(), // Milliseconds until expiration
    }),
  ),
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);
    const today = new Date().toISOString().split("T")[0];
    const puzzleId = `crossword_${today}`;

    // Get or create today's puzzle
    let puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", puzzleId))
      .unique();

    if (!puzzle) {
      // Trigger puzzle generation
      await ctx.scheduler.runAfter(
        0,
        internal.crossword.generateDailyCrossword,
        { puzzleId },
      );
      return null; // Return loading state
    }

    // Get user's attempt
    const userAttempt = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", userId).eq("puzzleId", puzzleId),
      )
      .unique();

    if (!userAttempt) {
      // Create new attempt
      await ctx.db.insert("userCrosswordAttempts", {
        userId,
        puzzleId,
        currentState: Array(puzzle.gridSize)
          .fill(null)
          .map(() => Array(puzzle.gridSize).fill("")),
        completedWords: [],
        hintsUsed: [],
        startedAt: Date.now(),
        isCompleted: false,
        lastUpdated: Date.now(),
      });

      // Track analytics
      await ctx.db.insert("analytics", {
        eventType: "crossword_started",
        timestamp: Date.now(),
        userId,
      });
    }

    // Return puzzle with user progress
    return {
      puzzleId,
      gridSize: puzzle.gridSize,
      clues: formatCluesForDisplay(
        puzzle.words,
        userAttempt?.completedWords || [],
      ),
      currentState:
        userAttempt?.currentState || initializeEmptyGrid(puzzle.gridSize),
      completedWords: userAttempt?.completedWords || [],
      isCompleted: userAttempt?.isCompleted || false,
      startedAt: userAttempt?.startedAt || Date.now(),
      timeRemaining: puzzle.expiresAt - Date.now(),
    };
  },
});
```

**updateCrosswordProgress** - Save user's grid updates

```typescript
export const updateCrosswordProgress = mutation({
  args: {
    row: v.number(),
    col: v.number(),
    letter: v.string(),
  },
  returns: v.object({
    completedWords: v.array(v.number()),
    isFullyCompleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    const today = new Date().toISOString().split("T")[0];
    const puzzleId = `crossword_${today}`;

    const userAttempt = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", userId).eq("puzzleId", puzzleId),
      )
      .unique();

    if (!userAttempt) {
      throw new Error("No active crossword session");
    }

    const puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", puzzleId))
      .unique();

    if (!puzzle) {
      throw new Error("Puzzle not found");
    }

    // Update grid state
    const newState = [...userAttempt.currentState];
    newState[args.row] = [...newState[args.row]];
    newState[args.row][args.col] = args.letter.toUpperCase();

    // Check for completed words
    const completedWords = checkCompletedWords(puzzle.words, newState);
    const isFullyCompleted = completedWords.length === puzzle.words.length;

    // Update attempt record
    await ctx.db.patch(userAttempt._id, {
      currentState: newState,
      completedWords,
      isCompleted: isFullyCompleted,
      lastUpdated: Date.now(),
      completedAt: isFullyCompleted ? Date.now() : undefined,
    });

    // If completed, create result record
    if (isFullyCompleted && !userAttempt.isCompleted) {
      const user = await ctx.db.get(userId);
      await ctx.db.insert("crosswordResults", {
        userId,
        puzzleId,
        completedAt: Date.now(),
        totalTime: Date.now() - userAttempt.startedAt,
        hintsUsed: userAttempt.hintsUsed.length,
        friendSuggestionsUsed: 0, // TODO: Implement friend suggestion tracking
        wordsCompleted: puzzle.words.length,
        playerName: user?.profileDisplayName || user?.name,
        isAnonymous: user?.isAnonymous || false,
      });

      // Track analytics
      await ctx.db.insert("analytics", {
        eventType: "crossword_completed",
        timestamp: Date.now(),
        userId,
      });
    }

    return {
      completedWords,
      isFullyCompleted,
    };
  },
});
```

**requestCrosswordHint** - AI clue generation

```typescript
export const requestCrosswordHint = mutation({
  args: { wordNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    const today = new Date().toISOString().split("T")[0];
    const puzzleId = `crossword_${today}`;

    const userAttempt = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", userId).eq("puzzleId", puzzleId),
      )
      .unique();

    if (!userAttempt) {
      throw new Error("No active crossword session");
    }

    // Check if hint already used for this word
    if (userAttempt.hintsUsed.includes(args.wordNumber)) {
      return null; // Hint already provided
    }

    const puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", puzzleId))
      .unique();

    if (!puzzle) {
      throw new Error("Puzzle not found");
    }

    const word = puzzle.words.find((w) => w.number === args.wordNumber);
    if (!word) {
      throw new Error("Word not found");
    }

    // Generate AI hint
    await ctx.scheduler.runAfter(0, internal.crossword.generateCrosswordHint, {
      userId,
      puzzleId,
      wordNumber: args.wordNumber,
      word: word.word,
      currentClue: word.clue,
    });

    // Update hints used
    await ctx.db.patch(userAttempt._id, {
      hintsUsed: [...userAttempt.hintsUsed, args.wordNumber],
    });
  },
});
```

**requestCrosswordClue** - AI letter clue generation

```typescript
export const requestCrosswordClue = mutation({
  args: { wordNumber: v.number() },
  returns: v.union(v.null(), v.string()), // Returns clue content or null if already used
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    const today = new Date().toISOString().split("T")[0];
    const puzzleId = `crossword_${today}`;

    const userAttempt = await ctx.db
      .query("userCrosswordAttempts")
      .withIndex("by_user_and_puzzle", (q) =>
        q.eq("userId", userId).eq("puzzleId", puzzleId),
      )
      .unique();

    if (!userAttempt) {
      throw new Error("No active crossword session");
    }

    // Check if clue already exists for this word
    if (userAttempt.aiCluesContent[args.wordNumber]) {
      return userAttempt.aiCluesContent[args.wordNumber]; // Return existing clue
    }

    const puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", puzzleId))
      .unique();

    if (!puzzle) {
      throw new Error("Puzzle not found");
    }

    const word = puzzle.words.find((w) => w.number === args.wordNumber);
    if (!word) {
      throw new Error("Word not found");
    }

    // Generate random letter position clue
    const currentState = userAttempt.currentState;
    const availablePositions = [];

    // Find positions that aren't already filled correctly
    for (let i = 0; i < word.word.length; i++) {
      const row =
        word.direction === "across" ? word.startRow : word.startRow + i;
      const col =
        word.direction === "across" ? word.startCol + i : word.startCol;

      if (!currentState[row][col] || currentState[row][col] !== word.word[i]) {
        availablePositions.push({ position: i, letter: word.word[i] });
      }
    }

    if (availablePositions.length === 0) {
      return null; // Word already completed correctly
    }

    // Select random unfilled position
    const randomPosition =
      availablePositions[Math.floor(Math.random() * availablePositions.length)];
    const clueContent = `Position ${randomPosition.position + 1}: ${randomPosition.letter}`;

    // Update clues used and content
    const updatedCluesUsed = userAttempt.cluesUsed.includes(args.wordNumber)
      ? userAttempt.cluesUsed
      : [...userAttempt.cluesUsed, args.wordNumber];

    const updatedCluesContent = {
      ...userAttempt.aiCluesContent,
      [args.wordNumber]: clueContent,
    };

    await ctx.db.patch(userAttempt._id, {
      cluesUsed: updatedCluesUsed,
      aiCluesContent: updatedCluesContent,
      lastUpdated: Date.now(),
    });

    return clueContent;
  },
});
```

**createCrosswordInvite** - Friend collaboration

```typescript
export const createCrosswordInvite = mutation({
  args: {},
  returns: v.string(), // Returns invite link
  handler: async (ctx) => {
    const userId = await getLoggedInUser(ctx);
    const user = await ctx.db.get(userId);
    const today = new Date().toISOString().split("T")[0];
    const puzzleId = `crossword_${today}`;
    const inviteId = generateInviteId();

    const puzzle = await ctx.db
      .query("crosswordPuzzles")
      .withIndex("by_puzzle_id", (q) => q.eq("puzzleId", puzzleId))
      .unique();

    if (!puzzle) {
      throw new Error("No active crossword");
    }

    await ctx.db.insert("crosswordInvites", {
      inviteId,
      puzzleId,
      creatorUserId: userId,
      creatorName: user?.name || "Anonymous",
      createdAt: Date.now(),
      expiresAt: puzzle.expiresAt,
    });

    return `${process.env.SITE_URL}?crossword-invite=${inviteId}`;
  },
});
```

#### AI Generation Functions

**generateDailyCrossword** - Daily puzzle creation

```typescript
export const generateDailyCrossword = internalAction({
  args: { puzzleId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if puzzle already exists
    const existing = await ctx.runQuery(
      internal.crossword.checkExistingPuzzle,
      {
        puzzleId: args.puzzleId,
      },
    );
    if (existing) return null;

    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate crossword structure
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Generate a 7x7 crossword puzzle with 8-12 intersecting words. Return JSON format with:
          {
            "words": [
              {
                "word": "EXAMPLE",
                "clue": "A representative case or instance",
                "startRow": 0,
                "startCol": 0,
                "direction": "across",
                "number": 1
              }
            ]
          }
          Make words challenging but fair, suitable for a difficult word game. Ensure proper intersections and no conflicts.`,
        },
        {
          role: "user",
          content:
            "Create a challenging crossword puzzle for experienced word game players.",
        },
      ],
      temperature: 0.7,
    });

    const puzzleData = JSON.parse(response.choices[0].message.content || "{}");

    // Generate grid from words
    const grid = generateGridFromWords(puzzleData.words, 7);

    // Calculate expiration (24 hours from now)
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.runMutation(internal.crossword.saveDailyCrossword, {
      puzzleId: args.puzzleId,
      gridSize: 7,
      grid,
      words: puzzleData.words,
      difficulty: calculateDifficulty(puzzleData.words),
      expiresAt,
    });
  },
});
```

**generateCrosswordHint** - AI topical hint generation

```typescript
export const generateCrosswordHint = internalAction({
  args: {
    userId: v.id("users"),
    puzzleId: v.string(),
    wordNumber: v.number(),
    word: v.string(),
    currentClue: v.string(),
  },
  returns: v.string(), // Returns the generated hint content
  handler: async (ctx, args) => {
    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate a helpful topical hint for a crossword word. The hint should provide context about what category, field, or subject the word relates to, without revealing letters or the answer directly. Focus on the domain, topic area, or conceptual category.",
        },
        {
          role: "user",
          content: `Word: "${args.word}"\nOriginal clue: "${args.currentClue}"\nProvide a topical hint about what subject area or category this word relates to.`,
        },
      ],
    });

    const hint =
      response.choices[0].message.content?.trim() ||
      "This word relates to a general knowledge topic";

    return hint;
  },
});
```

### Phase 3: Frontend Components

#### Core Crossword Component (src/ImpossibleCrossword.tsx)

```typescript
interface ImpossibleCrosswordProps {
  onBackToHome: () => void;
}

export function ImpossibleCrossword({ onBackToHome }: ImpossibleCrosswordProps) {
  const crosswordData = useQuery(api.crossword.getCurrentCrossword);
  const updateProgress = useMutation(api.crossword.updateCrosswordProgress);
      const requestHint = useMutation(api.crossword.requestCrosswordHint);
    const requestClue = useMutation(api.crossword.requestCrosswordClue);
    const createInvite = useMutation(api.crossword.createCrosswordInvite);

  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [hints, setHints] = useState<Record<number, string>>({});
  const [clues, setClues] = useState<Record<number, string>>({});
  const [loadingHint, setLoadingHint] = useState<number | null>(null);
  const [loadingClue, setLoadingClue] = useState<number | null>(null);

  // Handle AI hint request
  const handleRequestHint = async (wordNumber: number) => {
    try {
      setLoadingHint(wordNumber);
      const hintContent = await requestHint({ wordNumber });
      if (hintContent) {
        setHints(prev => ({ ...prev, [wordNumber]: hintContent }));
      }
    } catch (error) {
      console.error("Failed to get hint:", error);
    } finally {
      setLoadingHint(null);
    }
  };

  // Handle AI clue request
  const handleRequestClue = async (wordNumber: number) => {
    try {
      setLoadingClue(wordNumber);
      const clueContent = await requestClue({ wordNumber });
      if (clueContent) {
        setClues(prev => ({ ...prev, [wordNumber]: clueContent }));
      }
    } catch (error) {
      console.error("Failed to get clue:", error);
    } finally {
      setLoadingClue(null);
    }
  };

  // Component logic for crossword interaction
  // Grid rendering, cell selection, word highlighting
  // Input handling, completion checking, timer display

  return (
    <div className="space-y-6">
      {/* Timer and completion status */}
      <div className="brutal-card text-center">
        <h1 className="brutal-text-xl mb-2">Daily Impossible Crossword</h1>
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {formatTimeRemaining(crosswordData?.timeRemaining || 0)}
        </div>
      </div>

      {/* Crossword grid */}
      <div className="brutal-card">
        <CrosswordGrid
          grid={crosswordData?.currentState || []}
          onCellClick={handleCellClick}
          selectedCell={selectedCell}
          selectedWord={selectedWord}
        />
      </div>

      {/* Clues sections */}
      <div className="grid md:grid-cols-2 gap-4">
        <CluesList
          title="Across"
          clues={crosswordData?.clues.across || []}
          onClueClick={handleClueClick}
          selectedWord={selectedWord}
          onHintRequest={handleRequestHint}
          onClueRequest={handleRequestClue}
          hints={hints}
          clues={clues}
          loadingHint={loadingHint}
          loadingClue={loadingClue}
        />
        <CluesList
          title="Down"
          clues={crosswordData?.clues.down || []}
          onClueClick={handleClueClick}
          selectedWord={selectedWord}
          onHintRequest={handleRequestHint}
          onClueRequest={handleRequestClue}
          hints={hints}
          clues={clues}
          loadingHint={loadingHint}
          loadingClue={loadingClue}
        />
      </div>

      {/* Friend collaboration */}
      <div className="brutal-card">
        <h3 className="brutal-text-lg mb-4">Get Help from Friends</h3>
        {!inviteLink ? (
          <button
            onClick={handleCreateInvite}
            className="brutal-button px-6 py-3"
          >
            Invite Friend to Help
          </button>
        ) : (
          <InviteDisplay link={inviteLink} />
        )}
      </div>

      {/* Back button */}
      <div className="text-center">
        <button
          onClick={onBackToHome}
          className="brutal-button secondary px-6 py-3"
        >
          Back to Game
        </button>
      </div>
    </div>
  );
}
```

#### Helper Components

**CrosswordGrid** - Interactive grid component

```typescript
interface CrosswordGridProps {
  grid: string[][];
  onCellClick: (row: number, col: number) => void;
  selectedCell: {row: number, col: number} | null;
  selectedWord: number | null;
}

export function CrosswordGrid({ grid, onCellClick, selectedCell, selectedWord }: CrosswordGridProps) {
  return (
    <div className="crossword-grid">
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="crossword-row">
          {row.map((cell, colIndex) => (
            <CrosswordCell
              key={`${rowIndex}-${colIndex}`}
              value={cell}
              row={rowIndex}
              col={colIndex}
              isSelected={selectedCell?.row === rowIndex && selectedCell?.col === colIndex}
              isInSelectedWord={isCellInSelectedWord(rowIndex, colIndex, selectedWord)}
              onClick={() => onCellClick(rowIndex, colIndex)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

**CluesList** - Clues display with hint and clue functionality

```typescript
interface CluesListProps {
  title: string;
  clues: Array<{number: number, clue: string, answer?: string, length: number}>;
  selectedWord: number | null;
  onWordSelect: (wordNumber: number) => void;
  onHintRequest: (wordNumber: number) => void;
  onClueRequest: (wordNumber: number) => void;
  hints: Record<number, string>;
  clues: Record<number, string>;
  loadingHint: number | null;
  loadingClue: number | null;
}

function CluesList({
  title,
  clues,
  selectedWord,
  onWordSelect,
  onHintRequest,
  onClueRequest,
  hints,
  clues: letterClues,
  loadingHint,
  loadingClue
}: CluesListProps) {
  return (
    <div className="brutal-card">
      <h3 className="brutal-text-lg mb-4">{title}</h3>
      <div className="space-y-3">
        {clues.map((clue) => (
          <div
            key={clue.number}
            className={`clue-item ${selectedWord === clue.number ? 'selected' : ''}`}
            onClick={() => onWordSelect(clue.number)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="brutal-badge mr-2">{clue.number}</span>
                <span>{clue.clue}</span>
                <span className="text-xs text-gray-500 ml-2">({clue.length} letters)</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHintRequest(clue.number);
                  }}
                  className="brutal-button secondary text-xs px-2 py-1"
                  disabled={!!hints[clue.number] || loadingHint === clue.number}
                >
                  {loadingHint === clue.number ? 'Getting...' : hints[clue.number] ? 'Hint Used' : 'AI Hint'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClueRequest(clue.number);
                  }}
                  className="brutal-button warning text-xs px-2 py-1"
                  disabled={!!letterClues[clue.number] || loadingClue === clue.number}
                >
                  {loadingClue === clue.number ? 'Getting...' : letterClues[clue.number] ? 'Clue Used' : 'AI Clue'}
                </button>
              </div>
            </div>
            {hints[clue.number] && (
              <div className="mt-2 p-2 bg-blue-50 text-sm border-l-4 border-blue-400">
                💡 <strong>Hint:</strong> {hints[clue.number]}
              </div>
            )}
            {letterClues[clue.number] && (
              <div className="mt-2 p-2 bg-green-50 text-sm border-l-4 border-green-400">
                🔤 <strong>Letter Clue:</strong> {letterClues[clue.number]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Friend Helper Component (src/CrosswordHelper.tsx)

```typescript
interface CrosswordHelperProps {
  inviteId: string;
  onBackToHome: () => void;
}

export function CrosswordHelper({ inviteId, onBackToHome }: CrosswordHelperProps) {
  const inviteInfo = useQuery(api.crossword.getCrosswordInviteInfo, { inviteId });
  const submitSuggestion = useMutation(api.crossword.submitCrosswordSuggestion);

  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState("");

  return (
    <div className="space-y-6">
      {/* Helper header */}
      <div className="brutal-card text-center">
        <h1 className="brutal-text-xl mb-2">Help Solve Crossword</h1>
        <p className="brutal-text-md" style={{ color: "var(--text-secondary)" }}>
          {inviteInfo?.creatorName} needs your help with today's impossible crossword!
        </p>
      </div>

      {/* Crossword preview */}
      {/* Friend suggestion interface */}
      {/* Back button */}
    </div>
  );
}
```

### Phase 4: App Integration Updates

#### App.tsx Routing Updates

```typescript
// Add crossword state management
const [currentPage, setCurrentPage] = useState<
  | "game"
  | "leaderboard"
  | "playing"
  | "helper"
  | "dashboard"
  | "my-scores"
  | "challenge"
  | "challenge-setup"
  | "crossword" // NEW
  | "crossword-helper" // NEW
>("game");

const [crosswordInviteId, setCrosswordInviteId] = useState<string | null>(null);

// URL parameter handling
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const crosswordInvite = params.get("crossword-invite");

  if (crosswordInvite) {
    setCrosswordInviteId(crosswordInvite);
    setCurrentPage("crossword-helper");
  }
}, []);

// Add routing logic
{currentPage === "crossword" ? (
  <ImpossibleCrossword
    onBackToHome={() => setCurrentPage("game")}
  />
) : currentPage === "crossword-helper" && crosswordInviteId ? (
  <CrosswordHelper
    inviteId={crosswordInviteId}
    onBackToHome={() => setCurrentPage("game")}
  />
) : (
  // ... existing routing
)}
```

#### ImpossibleGame.tsx Button Addition

```typescript
// Add crossword button next to challenge button
{currentGame.canPlay && !currentGame.completed && (
  <div className="text-center space-y-4">
    <hr className="my-4 border-t-2" style={{ borderColor: "var(--border-color)" }} />

    <div className="flex gap-4 justify-center">
      <button
        onClick={handleStartChallenge}
        className="brutal-button warning px-6 py-2"
        style={{
          background: "var(--bg-warning)",
          border: "3px solid var(--border-warning)",
          color: "var(--text-warning)",
        }}
      >
        Challenge a Friend
      </button>

      <button
        onClick={handleStartCrossword}
        className="brutal-button secondary px-6 py-2"
        style={{
          background: "var(--bg-info)",
          border: "3px solid var(--border-info)",
          color: "var(--text-info)",
        }}
      >
        Impossible Crossword
      </button>
    </div>

    <p className="text-sm mt-3 px-4" style={{ color: "var(--text-secondary)" }}>
      <strong>Daily crossword puzzle with 24 hours to solve. Get AI hints, AI clues, and invite friends for unlimited help!</strong>
    </p>
  </div>
)}
```

// Add handler function
const handleStartCrossword = () => {
if (onGameComplete) {
onGameComplete({
won: false,
word: currentGame?.word || "",
attempts: currentGame?.attempts || 0,
startCrossword: true, // Flag to indicate crossword start
});
}
};

````

### Phase 5: Leaderboard & Analytics Integration

#### Leaderboard Updates (src/Leaderboard.tsx)

```typescript
// Add crossword section to leaderboard
// Similar to existing leaderboard structure but for crossword completions
````

#### My Scores Updates (src/components/MyScores.tsx)

```typescript
// Add crossword history query
const crosswordResults = useQuery(
  api.crossword.getUserCrosswordHistory,
  authIsLoading || !userIsAuthenticated ? "skip" : {
    cursor: crosswordCursor,
    limit: 3,
  }
);

// Add crossword section to render
{crosswordResults && crosswordResults.results.length > 0 && (
  <div className="brutal-card">
    <h2 className="brutal-text-lg mb-4">Recent Crosswords</h2>
    <div className="space-y-2">
      {crosswordResults.results.map((crossword) => (
        <div key={crossword._id} className="p-3 border-2 border-gray-300 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold">Daily Crossword</span>
              <span className="text-sm ml-2" style={{ color: "var(--text-secondary)" }}>
                {new Date(crossword.completedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="text-right">
              <div className="text-green-600">COMPLETED</div>
              <div className="text-sm">
                {Math.floor(crossword.totalTime / 60000)}min
                {crossword.hintsUsed > 0 && ` • ${crossword.hintsUsed} hints`}
                {crossword.cluesUsed > 0 && ` • ${crossword.cluesUsed} clues`}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

#### Dashboard Analytics Updates (convex/leaderboard.ts)

```typescript
// Add crossword analytics to getDashboardAnalytics
const completedCrosswords = await ctx.db.query("crosswordResults").collect();

const crosswordAnalytics = {
  totalCrosswordsGenerated: (await ctx.db.query("crosswordPuzzles").collect())
    .length,
  totalCrosswordsCompleted: completedCrosswords.length,
  averageCompletionTime:
    completedCrosswords.length > 0
      ? completedCrosswords.reduce((sum, c) => sum + c.totalTime, 0) /
        completedCrosswords.length
      : 0,
  averageHintsUsed:
    completedCrosswords.length > 0
      ? completedCrosswords.reduce((sum, c) => sum + c.hintsUsed, 0) /
        completedCrosswords.length
      : 0,
  averageCluesUsed:
    completedCrosswords.length > 0
      ? completedCrosswords.reduce((sum, c) => sum + c.cluesUsed, 0) /
        completedCrosswords.length
      : 0,
};

return {
  // ... existing analytics
  crosswordMode: crosswordAnalytics,
};
```

### Phase 6: Styling & CSS Updates

#### Crossword-specific CSS (src/index.css)

```css
/* Crossword Grid Styles - Base */
.crossword-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  max-width: 400px;
  margin: 0 auto;
  padding: 1rem;
  background: var(--bg-secondary);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-brutal);
}

.crossword-cell {
  width: 100%;
  aspect-ratio: 1;
  border: var(--border-width) solid var(--border-color);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: var(--border-radius);
  color: var(--text-primary);
}

.crossword-cell:hover {
  background: var(--bg-accent);
  color: var(--text-inverse);
  transform: translateY(-2px);
}

.crossword-cell.selected {
  background: var(--bg-info);
  color: var(--text-info);
  box-shadow: var(--shadow-small);
}

.crossword-cell.in-selected-word {
  background: var(--bg-warning);
  color: var(--text-warning);
  border-color: var(--bg-warning);
}

.crossword-cell.filled {
  background: var(--bg-success);
  color: var(--text-success);
}

.crossword-cell.blocked {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.5;
}

/* Clue List Styles */
.clue-item {
  padding: 0.75rem;
  border: var(--border-width) solid var(--border-color);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: var(--border-radius);
  margin-bottom: 0.5rem;
  box-shadow: var(--shadow-small);
}

.clue-item:hover {
  background: var(--bg-secondary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-brutal);
}

.clue-item.selected {
  background: var(--bg-info);
  color: var(--text-info);
  border-color: var(--bg-info);
}

.clue-item.completed {
  opacity: 0.6;
  background: var(--bg-success);
  color: var(--text-success);
}

.clue-item .hint-display {
  background: var(--bg-warning);
  color: var(--text-warning);
  padding: 0.5rem;
  border-radius: var(--border-radius);
  margin-top: 0.5rem;
  font-style: italic;
  border: 1px solid var(--bg-warning);
}

.clue-item .clue-display {
  background: var(--bg-success);
  color: var(--text-success);
  padding: 0.5rem;
  border-radius: var(--border-radius);
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  border: 1px solid var(--bg-success);
  letter-spacing: 0.1em;
}

/* Theme-Specific Crossword Overrides */

/* Neobrutalism Theme (Default) - Extra brutal styling */
:root .crossword-grid {
  box-shadow: 8px 8px 0px var(--border-color);
}

:root .crossword-cell:hover {
  box-shadow: 4px 4px 0px var(--border-color);
}

/* Original Theme - Clean and minimal */
[data-theme="original"] .crossword-grid {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

[data-theme="original"] .crossword-cell {
  border-width: 1px;
}

[data-theme="original"] .crossword-cell:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

[data-theme="original"] .clue-item {
  border-width: 1px;
}

/* Ghibli Theme - Soft and rounded */
[data-theme="ghibli"] .crossword-grid {
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

[data-theme="ghibli"] .crossword-cell {
  border-radius: 8px;
  border-width: 1px;
}

[data-theme="ghibli"] .crossword-cell:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

[data-theme="ghibli"] .clue-item {
  border-radius: 12px;
  border-width: 1px;
}

[data-theme="ghibli"] .clue-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

[data-theme="ghibli"] .hint-display,
[data-theme="ghibli"] .clue-display {
  border-radius: 8px;
}

/* Dark Theme - Enhanced contrast and glow effects */
[data-theme="dark"] .crossword-grid {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  border-color: var(--border-color);
}

[data-theme="dark"] .crossword-cell {
  border-width: 2px;
}

[data-theme="dark"] .crossword-cell:hover {
  box-shadow: 0 4px 8px rgba(204, 85, 0, 0.3);
  border-color: var(--bg-accent);
}

[data-theme="dark"] .crossword-cell.selected {
  box-shadow: 0 0 12px rgba(74, 93, 35, 0.5);
}

[data-theme="dark"] .clue-item {
  border-width: 2px;
}

[data-theme="dark"] .clue-item:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  border-color: var(--bg-accent);
}

[data-theme="dark"] .hint-display {
  box-shadow: 0 2px 8px rgba(244, 162, 97, 0.3);
}

[data-theme="dark"] .clue-display {
  box-shadow: 0 2px 8px rgba(107, 124, 58, 0.3);
}

/* Responsive Design */
@media (max-width: 768px) {
  .crossword-grid {
    max-width: 280px;
    gap: 1px;
    padding: 0.5rem;
  }

  .crossword-cell {
    font-size: 0.9rem;
  }

  .crossword-grid {
    transform: scale(0.9);
  }
}

@media (max-width: 480px) {
  .crossword-grid {
    max-width: 240px;
  }

  .crossword-cell {
    font-size: 0.8rem;
  }

  .crossword-grid {
    transform: scale(0.8);
  }
}
```

## Testing Strategy

### Unit Tests

1. **Crossword Grid Generation**: Test AI-generated crossword validation and grid structure
2. **Progress Tracking**: Test user progress persistence across 24-hour sessions
3. **AI Assistance Functions**: Test hint and clue generation with proper content formatting
4. **Friend Collaboration**: Test unlimited suggestion system and real-time updates

### Integration Tests

1. **End-to-End Crossword Flow**: Complete crossword from start to finish with AI assistance
2. **Friend Helper Flow**: Invite friend, receive unlimited suggestions, complete crossword
3. **Auth Integration**: Test anonymous and authenticated user flows with session persistence
4. **Analytics Tracking**: Verify crossword completion tracking in dashboard and leaderboard
5. **Theme Compatibility**: Test crossword UI across all 4 themes
   - **Neobrutalism** (default): Brutal shadows and thick borders
   - **Original**: Clean minimal styling with subtle shadows
   - **Ghibli**: Soft rounded corners and gentle shadows
   - **Dark**: Enhanced contrast with glow effects
6. **Theme Switching**: Verify seamless theme changes during active crossword gameplay

### Performance Tests

1. **AI Generation Time**: Ensure crossword generation completes within 10 seconds
2. **Grid Rendering**: Test smooth interaction with 7x7 grid on mobile devices
3. **Real-time Updates**: Test friend suggestion delivery and hint/clue response times

## Success Metrics

### User Engagement

- **Daily Active Crossword Users**: Target 20% of daily game players try crossword mode
- **Completion Rate**: Target 40% of started crosswords completed within 24 hours
- **Return Usage**: Target 60% of crossword completers return next day
- **Friend Collaboration**: Target 30% of crosswords use friend suggestions
- **AI Assistance Usage**: Target 50% of users request hints, 30% request letter clues

### Technical Performance

- **Generation Speed**: 95% of crosswords generated within 5 seconds
- **Session Persistence**: 99% uptime for 24-hour session tracking
- **Mobile Experience**: 90% of mobile users complete grid interactions successfully
- **AI Response Time**: 95% of hint/clue requests respond within 3 seconds

### Business Impact

- **User Retention**: 15% increase in daily return users
- **Authentication Conversion**: 25% of anonymous crossword players sign up
- **Session Duration**: 20% increase in average session time
- **Feature Discovery**: 70% of crossword users also try challenge mode

## Risk Assessment

### High-Risk Areas

1. **AI Crossword Generation Complexity**: Generating valid intersecting words is challenging
   - **Mitigation**: Start with simpler 7x7 grids, implement fallback puzzle templates
2. **24-Hour Session Management**: Complex state management across authentication boundaries
   - **Mitigation**: Robust session linking, comprehensive testing of edge cases
3. **Real-time Collaboration Performance**: Friend suggestions with multiple helpers
   - **Mitigation**: Rate limiting, suggestion queuing, graceful degradation

### Medium-Risk Areas

1. **Mobile Crossword Interface**: Complex grid interaction on small screens
   - **Mitigation**: Progressive enhancement, touch-optimized controls
2. **Analytics Integration**: Complex tracking across multiple game modes
   - **Mitigation**: Incremental dashboard updates, thorough testing

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1-2)

- [ ] Database schema implementation and testing
- [ ] Basic AI crossword generation (simplified 5x5 grid initially)
- [ ] 24-hour session management system
- [ ] Anonymous and authenticated user flow

### Phase 2: User Interface (Week 3-4)

- [ ] Crossword grid component with full interaction
- [ ] Clues display with AI hint and AI clue buttons
- [ ] Progress tracking and completion detection
- [ ] Mobile-responsive crossword interface
- [ ] **Theme-aware styling for all 4 themes (neobrutalism, original, ghibli, dark)**

### Phase 3: AI Integration (Week 4-5)

- [ ] AI topical hint generation for individual words
- [ ] AI letter clue generation with random position reveal
- [ ] Hint/clue request rate limiting and caching
- [ ] AI response time optimization

### Phase 4: Social Features (Week 5)

- [ ] Friend collaboration system with unlimited suggestions
- [ ] Invite link generation and helper interface
- [ ] Real-time suggestion delivery
- [ ] Social sharing functionality

### Phase 5: Analytics & Polish (Week 6)

- [ ] Leaderboard integration for completed crosswords
- [ ] My Scores page crossword history section
- [ ] Dashboard analytics for crossword engagement
- [ ] Performance optimization and testing

### Phase 6: Launch Preparation (Week 7)

- [ ] Comprehensive testing across all user flows
- [ ] **Cross-theme compatibility testing and refinement**
- [ ] Performance optimization and monitoring setup
- [ ] Documentation and deployment procedures
- [ ] Beta testing with selected users

### Phase 7: Public Launch (Week 8)

- [ ] Feature announcement to existing user base
- [ ] Monitor adoption metrics and user feedback
- [ ] Bug fixes and immediate improvements
- [ ] Post-launch performance monitoring

## Post-Launch Roadmap

### Week 1-2 Post-Launch

- Monitor daily crossword generation success rates
- Track user completion rates and identify drop-off points
- Analyze AI hint/clue usage patterns and effectiveness
- Gather user feedback on crossword difficulty and interface

### Month 1 Post-Launch

- Add crossword difficulty options (easy/medium/hard)
- Implement weekly themed crosswords (sports, science, etc.)
- Add crossword completion streaks and achievements
- Optimize AI generation based on user success patterns

### Month 2-3 Post-Launch

- Consider larger grid sizes (9x9, 11x11) for advanced users
- Add crossword categories and specialized vocabularies
- Implement crossword tournaments and competitions
- Add collaborative crossword solving for teams

## Dependencies

### External Dependencies

- OpenAI API access for crossword and clue generation
- Existing Convex backend infrastructure
- Clerk authentication system
- React frontend with TypeScript

### Internal Dependencies

- Existing user management and authentication flows
- Current analytics and leaderboard systems
- Mobile-responsive design patterns from existing components
- Real-time collaboration infrastructure from challenge mode

### Team Requirements

- Frontend developer familiar with React and TypeScript
- Backend developer experienced with Convex and AI integration
- UI/UX designer for crossword interface optimization
- QA engineer for comprehensive testing across devices

This PRD provides a comprehensive roadmap for implementing Impossible Crossword mode with enhanced AI assistance while maintaining consistency with the existing app architecture, authentication system, and user experience patterns. The dual AI assistance system (topical hints + letter clues) offers users flexible help options that cater to different solving preferences and difficulty levels.
{crosswordHistory.map((crossword) => (

<div key={crossword._id} className="p-3 border-2 border-gray-300 space-y-2">
<div className="flex justify-between items-center">
<div>
<span className="font-bold">Daily Crossword</span>
<span className="text-sm ml-2">
{new Date(crossword.completedAt).toLocaleDateString()}
</span>
</div>
<div className="text-right">
<div className="text-green-600">COMPLETED</div>
<div className="text-sm">
{formatDuration(crossword.totalTime)} • {crossword.hintsUsed} hints
</div>
</div>
</div>
<div className="flex gap-2 pt-2 border-t border-gray-200">
<button
onClick={() => handleShareCrossword(crossword.\_id)}
className="brutal-button text-sm px-3 py-1 flex items-center gap-1" >
<Share size={14} />
Share
</button>
<button
onClick={() => handleDeleteCrossword(crossword.\_id)}
className="brutal-button error text-sm px-3 py-1" >
Delete
</button>
</div>
</div>
))}
</div>
) : (
<div className="text-center py-8">
<p className="mb-4" style={{ color: "var(--text-secondary)" }}>
No crosswords completed yet!
</p>
<p className="text-sm" style={{ color: "var(--text-secondary)" }}>
Complete your daily crossword to see your solving history here.
</p>
</div>
)}

</div>
```

#### Dashboard Analytics Updates (convex/leaderboard.ts)

```typescript
// Add crossword analytics to getDashboardAnalytics
const crosswordAnalytics = v.object({
  totalCrosswordsGenerated: v.number(),
  totalCrosswordsCompleted: v.number(),
  averageCompletionTime: v.number(),
  totalHintsUsed: v.number(),
  averageHintsPerCrossword: v.number(),
  friendCollaborations: v.number(),
  completionRate: v.number(),
}),

// Implementation in handler
const allCrosswords = await ctx.db.query("crosswordResults").collect();
const completedCrosswords = allCrosswords.filter(c => !c.isDeleted && !c.isHidden);

const crosswordAnalytics = {
  totalCrosswordsGenerated: (await ctx.db.query("crosswordPuzzles").collect()).length,
  totalCrosswordsCompleted: completedCrosswords.length,
  averageCompletionTime: completedCrosswords.length > 0
    ? completedCrosswords.reduce((sum, c) => sum + c.totalTime, 0) / completedCrosswords.length
    : 0,
  totalHintsUsed: completedCrosswords.reduce((sum, c) => sum + c.hintsUsed, 0),
  averageHintsPerCrossword: completedCrosswords.length > 0
    ? completedCrosswords.reduce((sum, c) => sum + c.hintsUsed, 0) / completedCrosswords.length
    : 0,
  friendCollaborations: completedCrosswords.reduce((sum, c) => sum + c.friendSuggestionsUsed, 0),
  completionRate: // Calculate based on active crossword sessions vs completions
};
```

### Phase 6: CSS Styling Updates

#### Crossword-specific CSS (src/index.css)

```css
/* Crossword Grid Styles */
.crossword-grid {
  display: inline-block;
  border: 3px solid var(--border-color);
  background: var(--bg-secondary);
}

.crossword-row {
  display: flex;
}

.crossword-cell {
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.crossword-cell.blocked {
  background: var(--text-primary);
  cursor: default;
}

.crossword-cell.selected {
  background: var(--bg-accent);
  color: var(--text-inverse);
  border: 2px solid var(--border-accent);
}

.crossword-cell.highlighted {
  background: var(--bg-warning);
  color: var(--text-primary);
}

.crossword-cell.completed {
  background: var(--bg-success);
  color: var(--text-primary);
}

.crossword-cell:hover:not(.blocked) {
  background: var(--bg-secondary);
  border-color: var(--border-accent);
}

/* Clues Styles */
.clue-item {
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-secondary);
}

.clue-item:hover {
  background: var(--bg-primary);
  border-color: var(--border-accent);
}

.clue-item.selected {
  background: var(--bg-accent);
  border-color: var(--border-accent);
  color: var(--text-inverse);
}

.clue-item.completed {
  background: var(--bg-success);
  border-color: var(--border-success);
  color: var(--text-success);
}

.hint-display {
  padding: 0.5rem;
  background: var(--bg-warning);
  border: 2px solid var(--border-warning);
  color: var(--text-primary);
  font-style: italic;
  margin-top: 0.5rem;
}

/* Timer display for crossword */
.crossword-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--text-primary);
}

.crossword-timer.warning {
  color: var(--text-warning);
}

.crossword-timer.critical {
  color: var(--text-error);
  animation: pulse 1s infinite;
}

/* Responsive crossword grid */
@media (max-width: 768px) {
  .crossword-cell {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }

  .crossword-grid {
    transform: scale(0.9);
    transform-origin: center;
  }
}

@media (max-width: 480px) {
  .crossword-cell {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }

  .crossword-grid {
    transform: scale(0.8);
  }
}
```

### Phase 7: Testing & Quality Assurance

#### Unit Tests

1. **Crossword Grid Generation**: Test AI-generated crossword validation
2. **Progress Tracking**: Test user progress persistence across 24-hour sessions
3. **Friend Collaboration**: Test suggestion system and invite link generation
4. **Authentication Flow**: Test anonymous vs authenticated user experiences
5. **Timer Logic**: Test 24-hour expiration and countdown display

#### Integration Tests

1. **End-to-End Crossword Flow**: Complete crossword from start to finish
2. **Friend Helper Flow**: Invite friend and receive suggestions
3. **Leaderboard Integration**: Verify completed crosswords appear correctly
4. **Analytics Tracking**: Verify admin dashboard updates with crossword metrics
5. **Cross-Device Session**: Test session persistence across devices for logged-in users

#### Performance Tests

1. **AI Generation Time**: Ensure crossword generation completes within 10 seconds
2. **Grid Rendering**: Test smooth interaction with 7x7 grid on mobile devices
3. **Real-time Updates**: Verify friend suggestions appear instantly
4. **Memory Usage**: Test component cleanup on navigation away from crossword

## Success Metrics

### User Engagement

- **Daily Active Crossword Users**: Target 20% of daily game players try crossword mode
- **Completion Rate**: Target 40% of started crosswords completed within 24 hours
- **Return Usage**: Target 60% of crossword completers return next day
- **Friend Collaboration**: Target 30% of crosswords use friend suggestions

### Technical Performance

- **Generation Speed**: 95% of crosswords generated within 5 seconds
- **Session Persistence**: 99% uptime for 24-hour session tracking
- **Mobile Experience**: Smooth interaction on devices down to 320px width
- **AI Cost Efficiency**: Maintain under $0.10 per completed crossword in AI costs

### Business Impact

- **User Retention**: 15% increase in daily return users
- **Authentication Conversion**: 25% of anonymous crossword players sign up
- **Engagement Time**: Average session time increases by 10 minutes
- **Social Sharing**: 20% of completed crosswords shared on social media

## Technical Risks & Mitigation

### High-Risk Areas

1. **AI Crossword Generation Complexity**: Generating valid intersecting words is challenging
   - **Mitigation**: Start with simpler 7x7 grids, implement fallback puzzle templates
2. **24-Hour Session Management**: Complex state management across authentication boundaries
   - **Mitigation**: Robust session linking, comprehensive testing of edge cases
3. **Real-time Collaboration Performance**: Friend suggestions with multiple helpers
   - **Mitigation**: Rate limiting, suggestion queuing, graceful degradation

### Medium-Risk Areas

1. **Mobile Crossword Interface**: Complex grid interaction on small screens
   - **Mitigation**: Progressive enhancement, touch-optimized controls
2. **Analytics Integration**: Complex tracking across multiple game modes
   - **Mitigation**: Incremental dashboard updates, thorough testing

## Launch Plan

### Phase 1: Core Infrastructure (Week 1-2)

- [ ] Database schema implementation and testing
- [ ] Basic AI crossword generation (simplified 5x5 grid initially)
- [ ] 24-hour session management system
- [ ] Anonymous and authenticated user flow

### Phase 2: User Interface (Week 3-4)

- [ ] Crossword grid component with full interaction
- [ ] Clues display and hint request system
- [ ] Mobile-responsive design and testing
- [ ] Integration with existing app navigation

### Phase 3: Social Features (Week 5)

- [ ] Friend collaboration system
- [ ] Invite link generation and helper interface
- [ ] Real-time suggestion delivery
- [ ] Social sharing functionality

### Phase 4: Analytics & Polish (Week 6)

- [ ] Leaderboard integration for completed crosswords
- [ ] My Scores page crossword history section
- [ ] Admin dashboard analytics updates
- [ ] Performance optimization and bug fixes

### Phase 5: Launch Preparation (Week 7)

- [ ] Comprehensive testing across all user flows
- [ ] Performance optimization and monitoring setup
- [ ] Documentation updates and team training
- [ ] Soft launch with internal testing group

### Phase 6: Public Launch (Week 8)

- [ ] Feature announcement to existing user base
- [ ] Monitor adoption metrics and user feedback
- [ ] Rapid iteration based on real usage patterns
- [ ] Scale infrastructure based on demand

## Post-Launch Iteration

### Week 1-2 Post-Launch

- Monitor daily crossword generation success rates
- Track user completion rates and identify drop-off points
- Collect feedback on grid size and difficulty level
- Optimize AI generation prompts based on user success

### Month 1 Post-Launch

- Add crossword difficulty options (easy/medium/hard)
- Implement weekly themed crosswords
- Add crossword statistics to user profiles
- Enhance mobile interaction based on usage data

### Month 2-3 Post-Launch

- Consider larger grid sizes (9x9, 11x11) for advanced users
- Add crossword categories (sports, science, pop culture)
- Implement crossword sharing and social features
- Add competitive weekly crossword leaderboards

## Dependencies & Prerequisites

### External Dependencies

- OpenAI API access for crossword and clue generation
- Existing Convex backend infrastructure
- Clerk authentication system
- React frontend with TypeScript

### Internal Dependencies

- Existing user management and authentication flows
- Current analytics and leaderboard systems
- Friend invitation infrastructure from single-player mode
- Theme system and CSS design components

### Team Requirements

- Frontend developer familiar with React and TypeScript
- Backend developer experienced with Convex and AI integration
- UI/UX designer for crossword interface optimization
- QA engineer for comprehensive testing across device types

This PRD provides a comprehensive roadmap for implementing Impossible Crossword mode while maintaining consistency with the existing app architecture, authentication system, and user experience patterns.
