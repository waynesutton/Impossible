# Impossible AI: How AI Powers the Game

This document explains how artificial intelligence is integrated into the Impossible game platform, covering word generation, hint creation, crossword puzzle generation, frequency management, and the technical implementation details across all game modes.

## AI Integration Overview

The Impossible game platform uses OpenAI's GPT-4o-mini model to power multiple critical features across three game modes:

1. **Dynamic Word Generation**: Creating unique, challenging words for single-player and challenge game sessions
2. **Contextual Hint Generation**: Providing intelligent hints based on player progress in word games
3. **Daily Crossword Generation**: Creating complete 7x7 crossword puzzles with traditional structure and AI-generated clues
4. **Crossword Hint System**: Providing contextual hints for specific crossword words

## Word Generation Process

### AI Model Configuration

- **Model**: GPT-4o-mini (cost-effective, fast, suitable for creative text generation)
- **Temperature**: 0.9 (high creativity for word variety)
- **Max Tokens**: Single word response expected

### Word Generation Prompt

Located in `convex/game.ts` - `generateGameWord` function:

```typescript
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
```

### Word Criteria

- **Length**: 5-8 letters (optimal for difficulty/playability balance)
- **Obscurity**: Deliberately difficult words that most players won't know
- **Language**: English dictionary words only
- **Response Format**: Single word only (no explanations or formatting)

### Word Processing Pipeline

1. **Generation**: AI creates the word based on difficulty criteria
2. **Validation**: Word is checked for appropriate length and format
3. **Shuffling**: Letters are immediately shuffled using Fisher-Yates algorithm
4. **Storage**: Word and shuffled letters stored in `gameWords` table
5. **Immutability**: Shuffled letters never change during gameplay

## Letter Shuffling Algorithm

The letter shuffling uses a Fisher-Yates shuffle implemented in `convex/game.ts`:

```typescript
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

### Shuffling Process

1. **One-Time Shuffle**: Letters are shuffled once when the word is generated
2. **Persistence**: Shuffled order is stored in database (`gameWords.shuffledLetters`)
3. **Consistency**: All players see the same shuffled letters throughout the game
4. **No Re-shuffling**: Letters never change positions during gameplay

## AI Hint Generation

### Hint Request Flow

When a player requests a hint (available after 1 failed attempt):

1. **Frontend Request**: Player clicks "Ask for Help" button
2. **Loading State**: Immediate UI feedback shows "Generating hint..."
3. **Backend Processing**: AI generates contextual hint based on word and attempts
4. **Real-time Update**: Hint appears automatically when ready

### Hint Generation Prompt

Located in `convex/game.ts` - `generateHint` function:

```typescript
const prompt = `Give a helpful but not too obvious hint for the word "${args.word}". The user has made ${args.attempts} attempts. Make the hint cryptic but fair. Respond with just the hint, nothing else.`;

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: prompt }],
});
```

### Hint Characteristics

- **Contextual**: Considers the specific word and number of attempts made
- **Progressive Difficulty**: Hints may become more helpful based on attempt count
- **Cryptic but Fair**: Provides genuine assistance without giving away the answer
- **Single Use**: Each game session gets one AI-generated hint maximum

### Hint Delivery Process

1. **Async Generation**: Hint creation runs as background action
2. **Database Update**: Hint stored in `userAttempts.hint` field
3. **Real-time Sync**: Frontend automatically receives hint via Convex reactivity
4. **UI Integration**: Hint displays in prominent warning-colored card

## Non-AI Assistance Features

### Letter Clues

Available after 2 failed attempts, these are generated programmatically (not AI):

```typescript
// Generate the first and last letter clue
const word = gameWord.word.toLowerCase();
const clue = `${word[0].toUpperCase()}...${word[word.length - 1].toUpperCase()}`;
```

### Friend Suggestions

Real-time collaborative feature allowing friends to suggest words:

- No AI involvement - purely human suggestions
- Up to 3 suggestions per helper
- Real-time delivery to main player
- Trackable usage statistics

## Frequency and Rate Limiting

### Word Generation Frequency

- **Per Game**: One word generated per unique game session
- **Session Based**: Each game ID gets exactly one word
- **No Regeneration**: Words are never regenerated for the same game
- **Caching**: Generated words persist until game completion

### AI API Usage Patterns

- **Word Generation**: ~1 API call per game start
- **Hint Generation**: ~0-1 API calls per game (optional feature)
- **Cost Optimization**: GPT-4o-mini chosen for cost efficiency
- **Error Handling**: Fallback messages if AI generation fails

### Rate Limiting Considerations

- **Convex Actions**: Natural rate limiting through Convex function execution
- **Single Word Policy**: Prevents excessive API calls per game
- **User Limitation**: One active game per user at a time

## Technical Implementation Details

### Files Containing AI Logic

#### Primary AI Integration: `convex/game.ts`

- **Lines 690-723**: `generateGameWord` - Main word generation action
- **Lines 321-348**: `generateHint` - Hint generation action
- **Lines 736-750**: `saveGameWord` - Word storage with shuffling
- **Lines 350-368**: `saveHint` - Hint storage mutation

#### Frontend AI Interface: `src/ImpossibleGame.tsx`

- **Lines 215-225**: Hint request handling
- **Lines 491-522**: Hint display UI
- **Lines 649-677**: Hint button state management

### Database Schema for AI Features

#### Word Storage (`gameWords` table)

```typescript
gameWords: defineTable({
  gameId: v.string(), // Unique game session
  word: v.string(), // AI-generated word
  shuffledLetters: v.optional(v.array(v.string())), // Pre-shuffled letters
  difficulty: v.number(), // Hardcoded to 9.5
  createdAt: v.number(), // Generation timestamp
});
```

#### Hint Storage (`userAttempts` table)

```typescript
userAttempts: defineTable({
  // ... other fields
  hint: v.optional(v.string()), // AI-generated hint
  clue: v.optional(v.string()), // Programmatic first/last letter
});
```

### Environment Configuration

#### Required Environment Variables

- **OPENAI_API_KEY**: OpenAI API key for GPT-4o-mini access
- Set in Convex deployment via: `npx convex env set OPENAI_API_KEY your_key`

#### Optional Proxy Configuration

- **CONVEX_OPENAI_BASE_URL**: Custom OpenAI endpoint (if using proxy)
- Used for potential cost optimization or regional compliance

## AI Behavior Analysis

### Word Difficulty Patterns

- AI consistently generates obscure words (archaic, technical, rare)
- Length distribution typically favors 6-7 letter words
- High temperature ensures significant word variety between games
- No word repetition prevention (relies on AI randomness)

### Hint Quality Characteristics

- Hints are genuinely helpful but maintain challenge level
- AI considers word complexity when crafting hints
- Attempt count influences hint helpfulness
- Maintains game balance between challenge and solvability

### Performance Metrics

- **Word Generation Time**: ~1-3 seconds typical response
- **Hint Generation Time**: ~1-5 seconds typical response
- **Success Rate**: Near 100% for valid English words
- **Cost per Game**: Minimal due to GPT-4o-mini efficiency

## Secret Word Functionality

The game includes a hidden secret word feature (implementation details not documented for security).

## Game Difficulty Configuration

### Regular Mode Difficulty Settings

To modify difficulty for regular gameplay, update these key locations:

#### Word Generation Difficulty (`convex/game.ts` lines 727-737)

**Current Prompt (Line 732-734):**

```typescript
content: "Generate a single obscure English word, 5-8 letters, extremely difficult to guess. Respond with ONLY the word.";
```

**Difficulty Modifications:**

**Easier Regular Mode:**

```typescript
content: "Generate a single common English word, 4-6 letters, moderately challenging but fair. Respond with ONLY the word.";
```

**Harder Regular Mode:**

```typescript
content: "Generate a single extremely obscure English word, 7-10 letters, archaic or highly technical, nearly impossible to guess. Respond with ONLY the word.";
```

**Medium Regular Mode:**

```typescript
content: "Generate a single uncommon English word, 5-7 letters, challenging but solvable with effort. Respond with ONLY the word.";
```

#### Word Length Requirements (Line 733)

- **Easier**: Change "5-8 letters" to "4-6 letters"
- **Harder**: Change "5-8 letters" to "7-10 letters"

#### Temperature Setting (Line 736)

- **More Predictable**: Change `temperature: 0.9` to `temperature: 0.5`
- **More Random**: Change `temperature: 0.9` to `temperature: 1.2`

#### Hint Generation Difficulty (`convex/game.ts` lines 343-347)

**Current Prompt (Line 343):**

```typescript
const prompt = `Give a helpful but not too obvious hint for the word "${args.word}". The user has made ${args.attempts} attempts. Make the hint cryptic but fair. Respond with just the hint, nothing else.`;
```

**Easier Hints:**

```typescript
const prompt = `Give a clear and helpful hint for the word "${args.word}". The user has made ${args.attempts} attempts. Make the hint direct and informative. Respond with just the hint, nothing else.`;
```

**Harder Hints:**

```typescript
const prompt = `Give a very cryptic and subtle hint for the word "${args.word}". The user has made ${args.attempts} attempts. Make the hint extremely indirect and require deep thinking. Respond with just the hint, nothing else.`;
```

### Challenge Mode Difficulty Settings

Challenge mode uses different AI generation for competitive play.

#### Challenge Word Generation (`convex/challengeBattle.ts` lines 1272-1289)

**Current System Prompt (Lines 1275-1277):**

```typescript
content: "Generate a single extremely challenging English word for a word-guessing game. The word should be 6-9 letters long, very uncommon and difficult to guess (approximately 1 in 10,000 chance of being guessed), but still a real English word that appears in dictionaries. Examples of difficulty: QUIXOTIC, EPHEMERAL, UBIQUITOUS, SERENDIPITY. Respond with only the word, no punctuation or explanation.";
```

**Easier Challenge Mode:**

```typescript
content: "Generate a single moderately challenging English word for a word-guessing game. The word should be 5-7 letters long, uncommon but fair to guess (approximately 1 in 1,000 chance of being guessed). Examples: MYSTIC, GOLDEN, FRIEND, BRIGHT. Respond with only the word, no punctuation or explanation.";
```

**Harder Challenge Mode:**

```typescript
content: "Generate a single extremely difficult English word for a word-guessing game. The word should be 8-12 letters long, extremely rare and technical (approximately 1 in 50,000 chance of being guessed). Examples: PERSPICACIOUS, SESQUIPEDALIAN, PUSILLANIMOUS. Respond with only the word, no punctuation or explanation.";
```

#### Challenge Length Requirements (Line 1277)

- **Easier**: Change "6-9 letters long" to "5-7 letters long"
- **Harder**: Change "6-9 letters long" to "8-12 letters long"

#### Challenge Help Features (`convex/challengeBattle.ts` lines 325-333)

**Current Simple Hints (Lines 327-328):**

```typescript
// Hint: show word length and first letter
content = `This ${currentGameWord.word.length}-letter word starts with "${currentGameWord.word[0]}"`;
```

**Easier Challenge Hints:**

```typescript
// More revealing hint
content = `This ${currentGameWord.word.length}-letter word starts with "${currentGameWord.word[0]}" and ends with "${currentGameWord.word[currentGameWord.word.length - 1]}"`;
```

**Harder Challenge Hints:**

```typescript
// More cryptic hint
content = `This word has ${currentGameWord.word.length} letters and contains the letter "${currentGameWord.word[1]}"`;
```

**Current Simple Clues (Lines 330-332):**

```typescript
// Clue: show a letter position
const middleIndex = Math.floor(currentGameWord.word.length / 2);
content = `Letter ${middleIndex + 1} is "${currentGameWord.word[middleIndex]}"`;
```

**Easier Challenge Clues:**

```typescript
// Show multiple letters
content = `Letters: ${currentGameWord.word[0]}_${currentGameWord.word[Math.floor(currentGameWord.word.length / 2)]}_${currentGameWord.word[currentGameWord.word.length - 1]}`;
```

### Scoring System Adjustments

#### Challenge Mode Scoring (`convex/challengeBattle.ts` lines 447-466)

**Current System (Lines 450-465):**

```typescript
score = 100; // Base points
// Attempt bonus: 50 points for 1st attempt, 30 for 2nd, 10 for 3rd
if (newAttempts === 1) {
  score += 50;
} else if (newAttempts === 2) {
  score += 30;
} else if (newAttempts === 3) {
  score += 10;
}
```

**Easier Scoring (More Forgiving):**

```typescript
score = 100; // Base points
// More generous attempt bonus: 40 points for any attempt
if (newAttempts <= 3) {
  score += 40;
}
```

**Harder Scoring (More Competitive):**

```typescript
score = 100; // Base points
// Stricter attempt bonus: 80 for 1st only, 20 for 2nd, 0 for 3rd
if (newAttempts === 1) {
  score += 80;
} else if (newAttempts === 2) {
  score += 20;
}
// No bonus for 3rd attempt
```

### Timer Adjustments

#### Challenge Timer Duration (`convex/challengeBattle.ts` lines 16-19)

**Current System:**

```typescript
function getTimerDuration(wordIndex: number): number {
  return wordIndex === 2 ? 30000 : 60000; // 30s for round 3, 60s for rounds 1&2
}
```

**Easier Timing:**

```typescript
function getTimerDuration(wordIndex: number): number {
  return wordIndex === 2 ? 45000 : 90000; // 45s for round 3, 90s for rounds 1&2
}
```

**Harder Timing:**

```typescript
function getTimerDuration(wordIndex: number): number {
  return wordIndex === 2 ? 20000 : 40000; // 20s for round 3, 40s for rounds 1&2
}
```

### Quick Reference Summary

**Files to Modify:**

- `convex/game.ts` - Regular mode word generation (lines 732-734) and hints (line 343)
- `convex/challengeBattle.ts` - Challenge mode generation (lines 1275-1277), timers (lines 16-19), and scoring (lines 450-465)

**Common Changes:**

- **Word Length**: Adjust letter count requirements in prompts
- **Difficulty Language**: Change "obscure" to "common" or "archaic"
- **Temperature**: Lower for consistency, higher for randomness
- **Timers**: Increase/decrease millisecond values
- **Scoring**: Modify point values and attempt bonuses

## Crossword Mode AI Integration

### Daily Crossword Puzzle Generation

The Impossible Crossword mode extends the AI capabilities to generate complete crossword puzzles with interconnected words and clues using sophisticated AI prompts and traditional crossword structure.

#### Crossword Generation Requirements

**Model**: GPT-4o-mini (optimized for cost efficiency and adequate crossword generation)
**Grid Size**: 7x7 grid for optimal mobile and desktop experience
**Word Count**: 6-8 intersecting words per puzzle following traditional crossword rules
**Daily Uniqueness**: One puzzle per user per day with 24-hour persistence
**Traditional Structure**: Includes blocked squares, rotational symmetry, and proper word intersections

#### Crossword AI Prompts

**Primary Generation Prompt** (located in `convex/crossword.ts` lines 698-737):

```typescript
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
}`
},
{
  role: "user",
  content: `Generate a simple crossword puzzle for user ${args.userId} on date ${args.dateString}. Keep it simple and fun!`
}
```

**Model Configuration**:

- Model: GPT-4o-mini
- Temperature: 0.7 (moderate creativity for varied puzzles)
- Max Tokens: 1000
- Timeout: 15 seconds

#### Crossword Hint Generation

Crossword hints are contextual and provide topical assistance without revealing the answer directly (located in `convex/crossword.ts` lines 858-873):

```typescript
{
  role: "system",
  content: "You are a helpful crossword assistant. Generate a topical hint that gives context about what a word relates to, without revealing the word directly. Keep hints under 50 words and engaging."
},
{
  role: "user",
  content: `The crossword clue is: "${clue}". The word is "${word}". Give me a topical hint about what this word relates to or its category, without revealing the answer.`
}
```

**Model Configuration**:

- Model: GPT-4o-mini
- Temperature: 0.7 (balanced creativity)
- Max Tokens: 150 (concise hints)

#### Technical Implementation

**Implemented Files**:

- `convex/crossword.ts` - Crossword-specific AI generation and management (lines 658-902)
- `src/ImpossibleCrossword.tsx` - Main crossword interface with 7x7 grid layout (lines 1124-1235)
- `src/CrosswordHelper.tsx` - Friend collaboration interface for crosswords (lines 110-156)
- `src/index.css` - Crossword grid styling and responsive layout (lines 1324-1760)

**Database Schema** (implemented in `convex/schema.ts` lines 170-272):

- `crosswordPuzzles` - Daily puzzle storage with AI-generated content, words, clues, and grid positions
- `userCrosswordAttempts` - Progress tracking across 24-hour sessions with hints and completion status
- `crosswordInvites` - Shareable invitation links for friend collaboration
- `crosswordSuggestions` - Unlimited friend suggestions for specific word positions

#### Cost Considerations

**Optimized Model Usage**: GPT-4o-mini used for both crossword generation and hints (cost-efficient)
**Per-User Generation**: One API call per user per day for personalized puzzle creation
**Hint Generation**: Additional API calls for contextual crossword hints (on-demand)
**Estimated Cost**: ~$0.05-0.10 per daily puzzle generation, ~$0.02 per hint request (significantly lower with GPT-4o-mini)

#### Difficulty Configuration

**Easier Crosswords** (modify `convex/crossword.ts` lines 714-720):

```typescript
// Change grid size and word complexity
STRUCTURE:
- Total grid: 5x5 (25 squares)
- Approximately 4-6 black squares
- 4-6 words total (mix of across and down)
- Words should be 3-4 letters long
- Make words simple and commonly known
```

**Harder Crosswords** (modify `convex/crossword.ts` lines 714-720):

```typescript
// Change grid size and word complexity
STRUCTURE:
- Total grid: 9x9 (81 squares)
- Approximately 15-20 black squares
- 10-14 words total (mix of across and down)
- Words should be 4-8 letters long
- Make words extremely challenging, including technical and archaic terms
```

### Friend Collaboration Extensions

The crossword mode extends the existing friend collaboration system with unlimited suggestions rather than the 3-suggestion limit in single-player mode.

#### Crossword Suggestion System (implemented)

- **Unlimited Suggestions**: Friends can suggest multiple words for different clues (no 3-word limit)
- **Word-Specific Help**: Suggestions targeted to specific crossword positions with clue number identification
- **Real-time Collaboration**: Multiple friends can help simultaneously on different words
- **Persistent Invites**: Crossword invite links remain valid for the full 24-hour puzzle lifecycle
- **Live Grid Display**: Helpers see real-time progress of the main solver's grid state
- **Position-Aware Suggestions**: Helpers can target specific clue numbers and word positions

## Future AI Enhancement Opportunities

### Current Mode Improvements

1. **Adaptive Difficulty**: Adjust word difficulty based on player success rates
2. **Hint Progression**: Multi-level hints that become more specific
3. **Word Categories**: AI-generated words within specific themes
4. **Player Analysis**: AI-driven personalized difficulty adjustment
5. **Hint Quality Assessment**: Track hint effectiveness and optimize prompts

### Crossword Mode Enhancements

1. **Themed Crosswords**: AI-generated puzzles around specific topics (sports, science, history)
2. **Difficulty Progression**: Weekly increasing difficulty with AI-adjusted complexity
3. **Collaborative Solving**: AI-moderated team crossword competitions
4. **Adaptive Grid Sizes**: AI determines optimal grid size based on word complexity
5. **Cross-Puzzle Learning**: AI learns from player solving patterns to improve future puzzles
6. **Tournament Mode**: AI-generated competitive crossword tournaments with bracket systems

### Advanced AI Features

1. **Multi-Modal Hints**: AI-generated image clues for visual learners
2. **Cultural Adaptation**: AI adjusts references and difficulty based on user region
3. **Learning Disabilities Support**: AI provides alternative hint formats for accessibility
4. **Competitive Analysis**: AI analyzes solving strategies to suggest improvements

### Technical Considerations

- Monitor AI API costs as user base grows, optimized with GPT-4o-mini for all crossword generation
- Implement fallback crossword templates if AI service unavailable
- Consider caching generated crosswords for cost optimization (currently per-user generation)
- Evaluate alternative AI models for cost/quality optimization
- Test crossword generation success rates and implement validation systems
- Monitor hint request patterns to optimize crossword difficulty
- Track crossword completion rates and adjust AI prompts accordingly
- Implement graceful degradation for failed crossword generations
