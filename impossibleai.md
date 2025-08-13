# Impossible AI: How AI Powers the Word Game

This document explains how artificial intelligence is integrated into the Impossible Word game, covering word generation, hint creation, frequency management, and the technical implementation details.

## AI Integration Overview

The Impossible Word game uses OpenAI's GPT-4o-mini model to power two critical features:

1. **Dynamic Word Generation**: Creating unique, challenging words for each game session
2. **Contextual Hint Generation**: Providing intelligent hints based on player progress

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

## Future AI Enhancement Opportunities

### Potential Improvements

1. **Adaptive Difficulty**: Adjust word difficulty based on player success rates
2. **Hint Progression**: Multi-level hints that become more specific
3. **Word Categories**: AI-generated words within specific themes
4. **Player Analysis**: AI-driven personalized difficulty adjustment
5. **Hint Quality Assessment**: Track hint effectiveness and optimize prompts

### Technical Considerations

- Monitor AI API costs as user base grows
- Implement fallback word lists if AI service unavailable
- Consider caching frequently generated words for cost optimization
- Evaluate alternative AI models for cost/quality optimization
