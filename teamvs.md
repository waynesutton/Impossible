# Challenger vs Opponent Mode PRD - Product Requirements Document

## Epic: Impossible Word Head-to-Head Competition

**Product Objective**: Implement a streamlined 1v1 competitive version of the Impossible Word game where two players compete in real-time with AI-generated words, time pressure, and individual skill-based gameplay.

**Target Release**: Next major version after current single-player implementation

---

## Executive Summary

Challenger vs Opponent Mode transforms the single-player Impossible Word experience into a competitive 1v1 battleground. Players can challenge friends to head-to-head battles using the same challenging AI-generated words with added time pressure and competitive scoring.

### Key Value Propositions

- **Simple Competition**: Direct 1v1 battles without complex team management
- **Quick Setup**: One button to create challenge, one click to accept
- **Fair Competition**: Both players get identical words and time limits
- **Enhanced Retention**: Competitive leaderboards and challenge replays

---

## User Stories & Acceptance Criteria

### Epic User Story

**As a competitive word game player, I want to challenge another player to a head-to-head battle so that we can compete directly using our individual word-guessing skills with extremely difficult words and dynamic timers.**

### Story 1: Challenge Creation

**As a player, I want to create a challenge so that I can invite another player to compete against me.**

**Acceptance Criteria:**

- [ ] "Challenge" button appears below the Begin button in regular game mode
- [ ] Clicking Challenge button creates new challenge session
- [ ] Game creator automatically becomes the "Challenger"
- [ ] System generates unique challenge link to share
- [ ] Challenger sees waiting screen with shareable link
- [ ] Challenge link includes challenge ID for routing

### Story 2: Challenge Acceptance

**As a player, I want to accept a challenge so that I can compete against the challenger.**

**Acceptance Criteria:**

- [ ] Clicking challenge link opens challenge acceptance page
- [ ] Challenged player becomes the "Opponent"
- [ ] Opponent sees "Accept Challenge" button
- [ ] First player to click "Start Game" sees waiting state
- [ ] Other player sees "Confirm Start" button
- [ ] Game begins only after both players confirm readiness

### Story 3: Head-to-Head Gameplay

**As a competitor, I want to play against another player with the same words and time limits so the competition is fair.**

**Acceptance Criteria:**

- [x] Both players compete on 3 identical extremely difficult AI-generated words (1 in 10,000 difficulty)
- [x] Dynamic timer system: 60 seconds for rounds 1&2, 30 seconds for round 3
- [x] Both players see identical countdown timer
- [ ] Each player types independently in their own input box
- [ ] All existing features available: Ask for Help, Ask for Clue, Invite a Friend
- [ ] Players cannot see each other's guesses during gameplay
- [ ] Real-time status indicators show if opponent completed current word

### Story 4: Individual Scoring System

**As a competitive player, I want a clear scoring system that rewards speed and accuracy so that my individual performance is fairly measured.**

**Acceptance Criteria:**

- [ ] **Word Completion**: +100 points per word completed correctly
- [ ] **Speed Bonus**: +50 points if completed in under 30 seconds, +25 points if under 45 seconds
- [ ] **Letter Accuracy**: +5 points per correct letter in final position
- [ ] **Attempt Efficiency**: +20 points for 1st attempt, +10 for 2nd attempt, +5 for 3rd attempt
- [ ] **Time Remaining**: +1 point per second remaining when word completed
- [ ] **Help Usage Penalty**: -10 points for using Ask for Help, -5 points for Ask for Clue
- [ ] Scores calculated independently for each player
- [ ] Final scores compared to determine winner

### Story 5: Post-Game Results

**As a player, I want to see the battle results and submit my score so that my performance is recorded.**

**Acceptance Criteria:**

- [x] After 3 words completed, both players see results screen
- [x] Results show: Final scores, simplified word list, winner declaration
- [x] Both players redirected to leaderboard entry page
- [x] Players enter their display names for leaderboard submission
- [x] Challenger vs Opponent results saved to database
- [x] Rematch system available for competitive replay

### Story 6: Challenger vs Opponent Leaderboard

**As a player, I want to see head-to-head battle results on leaderboards so that competitive achievements are recognized.**

**Acceptance Criteria:**

- [x] New "Challenge Battles" section added to main leaderboard
- [x] Shows "Challenger Name vs Opponent Name" format with scores and winner
- [x] Displays last 3 most recent head-to-head battles
- [x] "Load More Challenges" button to see additional battle history (loads 3 at a time)
- [x] Battle results show: Player names, individual scores, winner, completion time
- [x] Challenge battle analytics integrated with dashboard system

---

## Implementation Status ✅

**Challenge Mode has been successfully implemented with the following features:**

### Core Features Completed

- ✅ **Challenge Creation**: One-click challenge creation with shareable links
- ✅ **Head-to-Head Gameplay**: Real-time synchronized 1v1 battles
- ✅ **Dynamic Timer System**: 60 seconds for rounds 1&2, 30 seconds for round 3
- ✅ **Extremely Difficult Words**: AI-generated words with 1 in 10,000 difficulty
- ✅ **Individual Scoring**: Speed bonuses, accuracy scoring, and attempt efficiency
- ✅ **Real-time Progress**: Live opponent status without revealing guesses
- ✅ **Battle Results**: Comprehensive results with simplified word display
- ✅ **Rematch System**: Competitive replay between opponents
- ✅ **Challenge Leaderboard**: Dedicated section showing recent battles
- ✅ **Mobile Optimization**: Full responsive design across all devices
- ✅ **Netlify Deployment**: Proper routing for challenge links and SPA support

### Key Implementation Highlights

- **Unique Word Generation**: Each challenge features 3 unique, extremely difficult words
- **Session Management**: Proper player session isolation and cleanup
- **Timer Accuracy**: Server-authoritative timing for fairness
- **UI Enhancement**: Challenge button with divider and descriptive text
- **Analytics Integration**: Comprehensive dashboard tracking for challenge metrics

---

## Technical Implementation Plan

### Phase 1: Database Schema Extensions

#### New Tables Required

**challengeBattles**

```typescript
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
  .index("by_completion", ["completedAt"]);
```

**challengeWordAttempts**

```typescript
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
  .index("by_battle_player_word", ["battleId", "player", "wordIndex"]);
```

#### Modified Tables

**challengeInvites**

```typescript
challengeInvites: defineTable({
  battleId: v.id("challengeBattles"),
  createdBy: v.id("users"),
  createdAt: v.number(),
  used: v.boolean(),
}).index("by_battle", ["battleId"]);
```

### Phase 2: Backend API Development

#### Challenge Battle Management Functions

**1. Core Game Flow Functions**

```typescript
// Create new challenge
export const createChallenge = mutation({
  args: { challengerName: v.string() },
  handler: async (ctx, args) => {
    // Create challengeBattle record with challenger
    // Generate unique challenge link/ID
    // Set status to "waiting_for_opponent"
    // Return challenge ID and shareable link
  },
});

// Accept challenge via link
export const acceptChallenge = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    opponentName: v.string(),
  },
  handler: async (ctx, args) => {
    // Add opponent to challenge
    // Update status to "ready_to_start"
    // Return success confirmation
  },
});

// Player ready to start
export const setPlayerReady = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    player: v.union(v.literal("challenger"), v.literal("opponent")),
  },
  handler: async (ctx, args) => {
    // Mark player as ready
    // If both ready, start game and generate words
    // Update status accordingly
  },
});
```

**2. Gameplay Functions**

```typescript
// Start challenge game (when both players ready)
export const startChallengeGame = mutation({
  args: { challengeId: v.id("challengeBattles") },
  handler: async (ctx, args) => {
    // Generate 3 AI words for battle
    // Initialize word attempts for both players
    // Start 60-second timer for word 1
    // Update status to "in_progress"
  },
});

// Submit player's guess
export const submitChallengeGuess = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    guess: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate player permissions
    // Check timer hasn't expired
    // Process guess and calculate individual score
    // Advance to next word or end game
  },
});

// Use help features (hint, clue, invite friend)
export const useChallengeHelp = mutation({
  args: {
    challengeId: v.id("challengeBattles"),
    helpType: v.union(
      v.literal("hint"),
      v.literal("clue"),
      v.literal("invite"),
    ),
  },
  handler: async (ctx, args) => {
    // Mark help feature as used
    // Apply scoring penalty
    // Return help content (hint/clue)
  },
});
```

**3. Real-time State Functions**

```typescript
// Get live challenge state
export const getChallengeState = query({
  args: { challengeId: v.id("challengeBattles") },
  handler: async (ctx, args) => {
    // Return complete battle state
    // Current scores, timer, current word, progress
    // User's role (challenger/opponent)
    // Opponent completion status (without revealing guess)
  },
});

// Get challenge results
export const getChallengeResults = query({
  args: { challengeId: v.id("challengeBattles") },
  handler: async (ctx, args) => {
    // Return final results for completed challenge
    // Word-by-word breakdown, final scores, winner
  },
});
```

### Phase 3: Frontend Component Development

#### New Components Required

**1. ChallengeMode.tsx**

- Main challenge vs game component
- Handles all challenge states and flows
- Real-time updates via Convex subscriptions

**2. ChallengeSetup.tsx**

- Challenge creation interface
- Challenger name input, challenge link generation
- Waiting for opponent interface

**3. ChallengeAccept.tsx**

- Accept challenge flow for opponents
- Opponent name entry
- Challenge confirmation

**4. ChallengeGame.tsx**

- Live 1v1 game interface
- Individual score displays
- 60-second timer countdown
- Independent word input boxes
- Help features (Ask for Help, Ask for Clue, Invite Friend)

**5. ChallengeResults.tsx**

- Post-game results display
- Word-by-word score breakdown
- Winner declaration
- Leaderboard submission flow

**6. ChallengeLeaderboard.tsx**

- Challenger vs Opponent results display
- Integration with main leaderboard
- Challenge battle history

#### Modified Components

**1. ImpossibleGame.tsx**

```typescript
// Add Challenge button below Begin button
const handleStartChallenge = async () => {
  // Navigate to challenge creation flow
  setCurrentMode("challenge-setup");
};

// Render Challenge button in game interface
<div className="game-controls">
  <button onClick={handleBeginGame} className="brutal-button primary">
    Begin
  </button>

  <button
    onClick={handleStartChallenge}
    className="brutal-button warning mt-2"
  >
    Challenge
  </button>
</div>
```

**2. App.tsx**

```typescript
// Add challenge routing
const [currentMode, setCurrentMode] = useState<
  | "game"
  | "leaderboard"
  | "playing"
  | "helper"
  | "dashboard"
  | "challenge"
  | "challenge-setup"
>("game");

// Handle challenge URL params for invites
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const challengeInvite = urlParams.get("challenge");
  if (challengeInvite) {
    setCurrentMode("challenge");
    // Handle challenge invite accept flow
  }
}, []);
```

**3. Leaderboard.tsx**

```typescript
// Add challenger vs opponent section
const [showChallenges, setShowChallenges] = useState(false);

// Challenge battles toggle
<div className="brutal-card">
  <button
    onClick={() => setShowChallenges(!showChallenges)}
    className="brutal-button mb-4"
  >
    {showChallenges ? "Show Individual Games" : "Show Challenge Battles"}
  </button>

  {showChallenges ? (
    <ChallengeLeaderboard />
  ) : (
    // Existing leaderboard content
  )}
</div>
```

### Phase 4: Scoring Algorithm Implementation

#### Individual Player Scoring Function

```typescript
const calculateChallengeScore = (wordData: {
  completed: boolean;
  attempts: number;
  timeUsed: number; // milliseconds
  correctLetters: number;
  usedHint: boolean;
  usedClue: boolean;
  usedInviteFriend: boolean;
}) => {
  let score = 0;

  if (wordData.completed) {
    // Base completion points
    score += 100;

    // Speed bonus (60000ms = 60 seconds)
    const timeUsedSeconds = wordData.timeUsed / 1000;
    if (timeUsedSeconds <= 30) {
      score += 50; // Under 30 seconds
    } else if (timeUsedSeconds <= 45) {
      score += 25; // Under 45 seconds
    }

    // Attempt efficiency bonus
    if (wordData.attempts === 1) score += 20;
    else if (wordData.attempts === 2) score += 10;
    else if (wordData.attempts === 3) score += 5;

    // Time remaining bonus
    const timeRemaining = Math.max(0, 60 - timeUsedSeconds);
    score += Math.floor(timeRemaining);

    // Help usage penalties
    if (wordData.usedHint) score -= 10;
    if (wordData.usedClue) score -= 5;
    // Note: usedInviteFriend doesn't affect score (social feature)
  } else {
    // Partial credit for correct letters when time expires
    score += wordData.correctLetters * 5;
  }

  return Math.max(0, score); // Never negative score
};
```

### Phase 5: Real-time Synchronization

#### Timer Synchronization

```typescript
// Server-side timer management
export const getChallengeTimer = query({
  args: { challengeId: v.id("challengeBattles") },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(challengeId);
    if (!challenge?.currentRoundStartTime) return null;

    const elapsed = Date.now() - challenge.currentRoundStartTime;
    const remaining = Math.max(0, 60000 - elapsed);

    return {
      remaining,
      started: challenge.currentRoundStartTime,
      expired: remaining === 0,
      wordIndex: challenge.currentWordIndex,
    };
  },
});

// Handle timer expiration
export const handleChallengeTimerExpiration = internalMutation({
  args: { challengeId: v.id("challengeBattles") },
  handler: async (ctx, args) => {
    // Force completion of current word for both players
    // Calculate partial scores based on current guesses
    // Advance to next word (if < 3) or end game
  },
});
```

### Phase 6: URL Routing & Sharing

#### Challenge Invite URL Structure

```
Base URL formats:
- Challenge invite: https://impossible.game/?challenge=<challengeId>
- Spectator link: https://impossible.game/?challenge=<challengeId>&spectate=true
```

#### URL Handling

```typescript
// App.tsx URL parameter handling
const handleChallengeParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const challengeId = urlParams.get("challenge");
  const spectate = urlParams.get("spectate");

  if (challengeId) {
    if (spectate === "true") {
      setCurrentPage("challenge");
      setChallengeViewData({ challengeId, spectate: true });
    } else {
      setCurrentPage("challenge");
      setChallengeData({ challengeId });
    }
  }
};
```

### Phase 7: Theme Integration

#### CSS Classes for Challenge Mode

```css
/* Challenge mode specific brutal styling */
.challenge-container {
  background: var(--bg-card);
  border: 4px solid var(--border-primary);
  box-shadow: 8px 8px 0 var(--border-primary);
}

.challenger-vs-opponent {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border: 3px solid var(--border-primary);
  background: var(--bg-surface);
}

.challenger-score,
.opponent-score {
  text-align: center;
  padding: 1rem;
  border: 3px solid var(--border-secondary);
  background: var(--bg-card);
  font-weight: 900;
}

.vs-divider {
  font-size: 2rem;
  font-weight: 900;
  color: var(--text-primary);
}

.challenge-timer {
  font-size: 2rem;
  font-weight: 900;
  color: var(--text-error);
  text-align: center;
  border: 3px solid var(--border-error);
  padding: 1rem;
  background: var(--bg-error);
}

.challenge-button {
  background: var(--bg-warning);
  border: 3px solid var(--border-warning);
  color: var(--text-warning);
  font-weight: 900;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all 0.1s ease;
}

.challenge-button:hover {
  background: var(--bg-warning-hover);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--border-warning);
}

.player-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--border-primary);
}

.status-ready {
  background: var(--bg-success);
}
.status-waiting {
  background: var(--bg-warning);
}
.status-playing {
  background: var(--bg-primary);
}
```

---

## User Experience Flow

### Challenge Creation Flow

1. **Player starts regular game** → sees Challenge button below Begin button
2. **Clicks Challenge button** → enters challenge creation mode
3. **Sets challenger name** → system generates shareable challenge link
4. **Shares challenge link** → opponent receives invitation
5. **Opponent clicks link** → sees challenge acceptance page
6. **Opponent enters name** → challenge ready to start

### Game Start Flow

1. **Challenger sees "Start Game" button** → clicks to initiate
2. **Opponent sees "Confirm Start" button** → both must confirm
3. **Both confirmed** → game begins with 3 AI-generated words
4. **60-second timer starts** → first word appears for both players

### Gameplay Flow

1. **Both players see identical word** → 60-second timer counting down
2. **Players type independently** → can use Ask for Help, Ask for Clue, Invite Friend
3. **Word completed or timer expires** → individual scores calculated
4. **Next word loads** → process repeats for 3 words total
5. **Real-time progress indicators** → shows if opponent completed current word
6. **Final word completed** → total scores calculated

### Post-Game Flow

1. **Results screen appears** → word-by-word breakdown and final scores
2. **Winner declared** → or tie if scores equal
3. **Redirect to leaderboard** → both players enter names for scoring
4. **Challenge history updated** → results appear on leaderboard
5. **"Challenge Again" option** → rematch with same opponent

---

## Success Metrics

### Engagement Metrics

- **Challenge Completion Rate**: % of started challenges that finish all 3 words
- **Challenge Acceptance Rate**: % of sent challenge links that get accepted
- **Repeat Challenge Rate**: How often players challenge each other again
- **Session Duration**: Average time spent in challenge mode

### Social Metrics

- **Invite Conversion**: % of sent challenge links that result in completed games
- **Friend Referral**: New players joining via challenge invites
- **Help Feature Usage**: Usage of Ask for Help, Ask for Clue, Invite Friend during challenges
- **Cross-Challenge Formation**: Players challenging different opponents over time

### Competitive Metrics

- **Score Distribution**: Balance between challenger and opponent wins
- **Close Game Frequency**: Challenges decided by <50 point margins
- **Perfect Games**: Players completing all 3 words under 30 seconds each
- **Strategy Evolution**: Changes in help feature usage patterns over time

---

## Technical Considerations

### Performance Requirements

- **Real-time Updates**: <200ms latency for score/timer updates
- **Concurrent Challenges**: Support 100+ simultaneous 1v1 challenges
- **Database Efficiency**: Optimized queries for live game state
- **Mobile Responsiveness**: Full feature parity on mobile devices

### Security Considerations

- **Player Validation**: Only authenticated players can submit guesses
- **Help Feature Rate Limiting**: Standard limits on Ask for Help/Clue usage
- **Timer Synchronization**: Server-authoritative timing for fairness
- **Challenge Link Security**: Time-limited challenge invitations

### Scalability Planning

- **Database Partitioning**: Challenge data partitioned by completion date
- **Caching Strategy**: Active challenge states cached for performance
- **Connection Management**: WebSocket optimization for real-time features
- **Analytics Pipeline**: Efficient data collection for competitive insights

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

- **Tournament Mode**: Multi-player elimination brackets
- **Spectator Mode**: Watch live 1v1 challenges without participating
- **Player Rankings**: ELO-style rating system for individual players
- **Custom Game Modes**: Adjustable word count (3/5/7), timer length, difficulty

### Integration Opportunities

- **Authentication System**: Persistent challenge stats and win/loss records
- **Social Features**: Player profiles, achievements, challenge streaks
- **Communication**: Optional in-game chat during challenges
- **Streaming Integration**: Twitch/YouTube broadcasting support for competitive play

---

## Launch Strategy

### Beta Testing Phase

1. **Internal Testing**: Development team plays 100+ challenges
2. **Closed Beta**: 20 invited users, collect feedback on 1v1 gameplay
3. **Open Beta**: Public announcement, gather competitive metrics
4. **Iteration**: Fix bugs, balance scoring, optimize challenge flow

### Release Rollout

1. **Soft Launch**: Feature flag for gradual user exposure
2. **Marketing Push**: Social media focus on head-to-head competition
3. **Community Events**: Organized tournaments and challenge competitions
4. **Feedback Loop**: Continuous monitoring and improvements

### Success Criteria for Launch

- [ ] 95% challenge completion rate (no crashes/abandons)
- [ ] <3 second average load time for challenge start
- [ ] 80% positive feedback rating in user surveys
- [ ] 25% of daily active users try challenge mode within first month

---

_This PRD serves as the comprehensive blueprint for implementing Challenger vs Opponent Mode in the Impossible Word game, maintaining compatibility with existing systems while introducing streamlined competitive 1v1 dynamics._
