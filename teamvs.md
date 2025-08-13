# Team VS Mode PRD - Product Requirements Document

## Epic: Impossible Word Team Battle Mode

**Product Objective**: Implement a competitive team-based version of the Impossible Word game where two teams (max 5 players each) compete in real-time with AI-generated words, time pressure, and collaborative gameplay.

**Target Release**: Next major version after authentication system implementation

---

## Executive Summary

Team VS Mode transforms the single-player Impossible Word experience into a competitive multiplayer battleground. Players can create teams, invite friends, and compete against other teams using the same challenging AI-generated words with added time pressure and scoring mechanics.

### Key Value Propositions

- **Social Engagement**: Transform solitary gameplay into collaborative team experiences
- **Competitive Element**: Real-time head-to-head team battles with live scoring
- **Scalable Multiplayer**: Support for 2-10 players (5 per team) in structured competition
- **Enhanced Retention**: Team dynamics and leaderboards drive repeat engagement

---

## User Stories & Acceptance Criteria

### Epic User Story

**As a competitive word game player, I want to form teams and battle other teams in real-time Impossible Word challenges so that I can enjoy collaborative gameplay with friends while competing against others.**

### Story 1: Team Captain Game Creation

**As a player, I want to start a team vs game mode so that I can invite my team and challenge another team.**

**Acceptance Criteria:**

- [ ] VS button appears below attempt counter in regular game mode
- [ ] Clicking VS button creates new game flow with team management interface
- [ ] Game creator automatically becomes Team A captain
- [ ] System generates unique game session ID for team battle
- [ ] Team captain can set team name (max 20 characters)
- [ ] Two distinct invite links generated: "Invite Your Team" and "Invite Challenging Team"

### Story 2: Team Invitation & Management

**As a team captain, I want to invite up to 4 additional players to my team so that we can collaborate on word guessing.**

**Acceptance Criteria:**

- [ ] Team captain can share "Invite Your Team" link
- [ ] Maximum 5 players per team (captain + 4 invites)
- [ ] Invited players add their display name when joining
- [ ] Team roster shows all joined players in real-time
- [ ] Each team member can submit up to 3 word suggestions (same as current helper system)
- [ ] Only team captain can type in the word input box

### Story 3: Challenging Team Formation

**As a challenger, I want to create the opposing team so that we can compete against the original team.**

**Acceptance Criteria:**

- [ ] First person to use "Invite Challenging Team" link becomes Team B captain
- [ ] Team B captain can set their team name
- [ ] Team B captain gets invite link to recruit their team members (max 4 additional)
- [ ] Same team management rules apply as Team A
- [ ] Game cannot start until both teams have at least 1 player each

### Story 4: Real-Time Competitive Gameplay

**As a team member, I want to participate in timed word challenges with live scoring so that my team can compete effectively.**

**Acceptance Criteria:**

- [ ] 60-second timer per word for both teams simultaneously
- [ ] Both teams see identical timer countdown
- [ ] Both teams work on the same AI-generated word
- [ ] Real-time score display visible to both teams
- [ ] All existing gameplay features preserved: hints, clues, secret word, suggestions
- [ ] Timer resets for each new word until game completion

### Story 5: Team VS Scoring System

**As a competitive player, I want a clear scoring system that rewards speed, accuracy, and collaboration so that team performance is fairly measured.**

**Acceptance Criteria:**

- [ ] **Word Completion**: +100 points for first team to complete word correctly
- [ ] **Speed Bonus**: +50 points if completed in under 30 seconds, +25 points if under 45 seconds
- [ ] **Letter Accuracy**: +10 points per correct letter in final position
- [ ] **Attempt Efficiency**: +25 points for 1st attempt, +15 for 2nd attempt, +5 for 3rd attempt
- [ ] **Time Remaining**: +1 point per second remaining when word completed
- [ ] **Suggestion Usage**: +5 points for each team suggestion used that leads to correct answer
- [ ] Score updates happen in real-time for both teams
- [ ] Final game score determines winning team

### Story 6: Team VS Leaderboard Integration

**As a player, I want to see team performance on leaderboards so that successful teams gain recognition.**

**Acceptance Criteria:**

- [ ] New "Team Battles" section added to main leaderboard
- [ ] Shows team name vs team name format with final scores
- [ ] Displays top 5 most recent team battles
- [ ] "Load More" button to see additional team battle history
- [ ] Team battle results show: Team names, final scores, game duration, word difficulty
- [ ] Individual player profiles (future auth system) will show team battle participation stats

---

## Technical Implementation Plan

### Phase 1: Database Schema Extensions

#### New Tables Required

**teamBattles**

```typescript
teamBattles: defineTable({
  gameId: v.string(), // Unique team vs game session
  teamAName: v.string(),
  teamBName: v.string(),
  teamACaptain: v.id("users"),
  teamBCaptain: v.optional(v.id("users")),
  status: v.union(
    v.literal("waiting_for_team_b"),
    v.literal("waiting_for_players"),
    v.literal("in_progress"),
    v.literal("completed"),
  ),
  currentWordIndex: v.number(), // Track progression through words
  wordsCompleted: v.number(),
  teamAScore: v.number(),
  teamBScore: v.number(),
  winningTeam: v.optional(v.string()), // "A" | "B" | "tie"
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  currentRoundStartTime: v.optional(v.number()), // For 60-second timer
  maxWords: v.number(), // Game length (default 5 words)
})
  .index("by_game_id", ["gameId"])
  .index("by_status", ["status"])
  .index("by_completion", ["completedAt"]);
```

**teamMembers**

```typescript
teamMembers: defineTable({
  battleId: v.id("teamBattles"),
  userId: v.id("users"),
  team: v.union(v.literal("A"), v.literal("B")),
  isCaptain: v.boolean(),
  displayName: v.string(),
  suggestionsUsed: v.number(),
  joinedAt: v.number(),
})
  .index("by_battle_and_team", ["battleId", "team"])
  .index("by_battle_and_user", ["battleId", "userId"]);
```

**teamWordAttempts**

```typescript
teamWordAttempts: defineTable({
  battleId: v.id("teamBattles"),
  wordIndex: v.number(), // Which word in the battle sequence
  gameWordId: v.id("gameWords"), // Reference to the actual word
  team: v.union(v.literal("A"), v.literal("B")),
  attempts: v.number(),
  completed: v.boolean(),
  completedAt: v.optional(v.number()),
  currentGuess: v.string(),
  finalScore: v.number(), // Points earned for this word
  timeUsed: v.optional(v.number()), // Milliseconds taken to complete
  usedHint: v.boolean(),
  usedClue: v.boolean(),
  usedSecretWord: v.boolean(),
})
  .index("by_battle_and_word", ["battleId", "wordIndex"])
  .index("by_battle_team_word", ["battleId", "team", "wordIndex"]);
```

**teamSuggestions**

```typescript
teamSuggestions: defineTable({
  battleId: v.id("teamBattles"),
  wordIndex: v.number(),
  team: v.union(v.literal("A"), v.literal("B")),
  suggesterId: v.id("users"),
  suggestion: v.string(),
  submittedAt: v.number(),
  used: v.boolean(),
  usedAt: v.optional(v.number()),
})
  .index("by_battle_team_word", ["battleId", "team", "wordIndex"])
  .index("by_battle_and_suggester", ["battleId", "suggesterId"]);
```

#### Modified Tables

**teamBattleInvites**

```typescript
teamBattleInvites: defineTable({
  battleId: v.id("teamBattles"),
  inviteType: v.union(v.literal("team_a"), v.literal("team_b")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  used: v.boolean(),
}).index("by_battle_and_type", ["battleId", "inviteType"]);
```

### Phase 2: Backend API Development

#### Team Battle Management Functions

**1. Core Game Flow Functions**

```typescript
// Create new team battle
export const startTeamBattle = mutation({
  args: { teamName: v.string() },
  handler: async (ctx, args) => {
    // Create teamBattle record
    // Set creator as Team A captain
    // Generate invite links
    // Return battle ID and invite links
  },
});

// Join team via invite
export const joinTeamBattle = mutation({
  args: {
    inviteId: v.id("teamBattleInvites"),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate invite and team capacity
    // Add user to appropriate team
    // Update team battle status if ready
  },
});

// Set challenging team name and captain
export const createChallengingTeam = mutation({
  args: {
    inviteId: v.id("teamBattleInvites"),
    teamName: v.string(),
    captainDisplayName: v.string(),
  },
  handler: async (ctx, args) => {
    // Set Team B captain and name
    // Generate Team B invite link
    // Update battle status
  },
});
```

**2. Gameplay Functions**

```typescript
// Start team battle (when both teams ready)
export const startTeamBattleGame = mutation({
  args: { battleId: v.id("teamBattles") },
  handler: async (ctx, args) => {
    // Generate AI words for battle
    // Initialize first round
    // Start 60-second timer
    // Update status to "in_progress"
  },
});

// Submit team captain's guess
export const submitTeamGuess = mutation({
  args: {
    battleId: v.id("teamBattles"),
    guess: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate captain permissions
    // Check timer hasn't expired
    // Process guess and calculate score
    // Advance to next word or end game
  },
});

// Team member suggestion
export const submitTeamSuggestion = mutation({
  args: {
    battleId: v.id("teamBattles"),
    suggestion: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate team membership and suggestion limit
    // Store suggestion for captain to use
  },
});
```

**3. Real-time State Functions**

```typescript
// Get live battle state
export const getTeamBattleState = query({
  args: { battleId: v.id("teamBattles") },
  handler: async (ctx, args) => {
    // Return complete battle state
    // Current scores, timer, teams, current word
    // User's team and role (captain/member)
  },
});

// Get team suggestions for captain
export const getTeamSuggestions = query({
  args: { battleId: v.id("teamBattles") },
  handler: async (ctx, args) => {
    // Return suggestions for current word
    // Only for team captains
  },
});
```

### Phase 3: Frontend Component Development

#### New Components Required

**1. TeamBattleMode.tsx**

- Main team vs game component
- Handles all team battle states and flows
- Real-time updates via Convex subscriptions

**2. TeamCreation.tsx**

- Team setup interface for captains
- Team name input, invite link generation
- Team roster management

**3. TeamJoin.tsx**

- Join flow for invited players
- Display name entry
- Team role confirmation

**4. TeamBattleGame.tsx**

- Live game interface during battles
- Dual-team score display
- 60-second timer countdown
- Team captain word input
- Team member suggestion interface

**5. TeamBattleLeaderboard.tsx**

- Team vs results display
- Integration with main leaderboard
- Team battle history

#### Modified Components

**1. ImpossibleGame.tsx**

```typescript
// Add VS button below attempt counter
const handleStartTeamBattle = async () => {
  // Navigate to team creation flow
  setCurrentMode("team-vs-setup");
};

// Render VS button when in regular game mode
{currentGame?.attempts !== undefined && (
  <button
    onClick={handleStartTeamBattle}
    className="brutal-button warning mt-4"
  >
    ⚔️ Start Team VS Mode
  </button>
)}
```

**2. App.tsx**

```typescript
// Add team vs routing
const [currentMode, setCurrentMode] = useState<
  | "game"
  | "leaderboard"
  | "playing"
  | "helper"
  | "dashboard"
  | "team-vs"
  | "team-vs-setup"
>("game");

// Handle team vs URL params for invites
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const teamInvite = urlParams.get("team-invite");
  if (teamInvite) {
    setCurrentMode("team-vs");
    // Handle team invite join flow
  }
}, []);
```

**3. Leaderboard.tsx**

```typescript
// Add team battles section
const [showTeamBattles, setShowTeamBattles] = useState(false);

// Team battles toggle
<div className="brutal-card">
  <button
    onClick={() => setShowTeamBattles(!showTeamBattles)}
    className="brutal-button mb-4"
  >
    {showTeamBattles ? "Show Individual Games" : "Show Team Battles"}
  </button>

  {showTeamBattles ? (
    <TeamBattleLeaderboard />
  ) : (
    // Existing leaderboard content
  )}
</div>
```

### Phase 4: Scoring Algorithm Implementation

#### Scoring Calculation Function

```typescript
const calculateTeamScore = (wordData: {
  completed: boolean;
  attempts: number;
  timeUsed: number; // milliseconds
  correctLetters: number;
  usedHint: boolean;
  usedClue: boolean;
  usedSuggestion: boolean;
  firstToComplete: boolean;
}) => {
  let score = 0;

  if (wordData.completed) {
    // Base completion points
    score += 100;

    // First team bonus
    if (wordData.firstToComplete) {
      score += 50;
    }

    // Speed bonus (60000ms = 60 seconds)
    const timeUsedSeconds = wordData.timeUsed / 1000;
    if (timeUsedSeconds <= 30) {
      score += 50; // Under 30 seconds
    } else if (timeUsedSeconds <= 45) {
      score += 25; // Under 45 seconds
    }

    // Attempt efficiency
    if (wordData.attempts === 1) score += 25;
    else if (wordData.attempts === 2) score += 15;
    else if (wordData.attempts === 3) score += 5;

    // Time remaining bonus
    const timeRemaining = Math.max(0, 60 - timeUsedSeconds);
    score += Math.floor(timeRemaining);

    // Suggestion usage bonus
    if (wordData.usedSuggestion) {
      score += 5;
    }
  } else {
    // Partial credit for correct letters
    score += wordData.correctLetters * 10;
  }

  return score;
};
```

### Phase 5: Real-time Synchronization

#### Timer Synchronization

```typescript
// Server-side timer management
export const getTeamBattleTimer = query({
  args: { battleId: v.id("teamBattles") },
  handler: async (ctx, args) => {
    const battle = await ctx.db.get(battleId);
    if (!battle?.currentRoundStartTime) return null;

    const elapsed = Date.now() - battle.currentRoundStartTime;
    const remaining = Math.max(0, 60000 - elapsed);

    return {
      remaining,
      started: battle.currentRoundStartTime,
      expired: remaining === 0,
    };
  },
});

// Handle timer expiration
export const handleTimerExpiration = internalMutation({
  args: { battleId: v.id("teamBattles") },
  handler: async (ctx, args) => {
    // Force completion of current round
    // Calculate partial scores
    // Advance to next word or end game
  },
});
```

### Phase 6: URL Routing & Sharing

#### Team Invite URL Structure

```
Base URL formats:
- Team A invite: https://impossible.game/?team-invite=<inviteId>&type=team-a
- Team B invite: https://impossible.game/?team-invite=<inviteId>&type=team-b
- Spectator link: https://impossible.game/?team-battle=<battleId>&spectate=true
```

#### URL Handling

```typescript
// App.tsx URL parameter handling
const handleTeamInviteParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const teamInvite = urlParams.get("team-invite");
  const inviteType = urlParams.get("type");
  const battleId = urlParams.get("team-battle");

  if (teamInvite && inviteType) {
    setCurrentPage("team-vs");
    setInviteData({ inviteId: teamInvite, type: inviteType });
  } else if (battleId) {
    setCurrentPage("team-vs");
    setBattleViewData({ battleId, spectate: true });
  }
};
```

### Phase 7: Theme Integration

#### CSS Classes for Team VS Mode

```css
/* Team vs specific brutal styling */
.team-vs-container {
  background: var(--bg-card);
  border: 4px solid var(--border-primary);
  box-shadow: 8px 8px 0 var(--border-primary);
}

.team-score-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 3px solid var(--border-primary);
  background: var(--bg-surface);
}

.team-timer {
  font-size: 2rem;
  font-weight: 900;
  color: var(--text-error);
  text-align: center;
  border: 3px solid var(--border-error);
  padding: 1rem;
  background: var(--bg-error);
}

.vs-button {
  background: var(--bg-warning);
  border: 3px solid var(--border-warning);
  color: var(--text-warning);
  font-weight: 900;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all 0.1s ease;
}

.vs-button:hover {
  background: var(--bg-warning-hover);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--border-warning);
}
```

---

## User Experience Flow

### Team Creation Flow

1. **Player starts regular game** → sees VS button after first attempt
2. **Clicks VS button** → enters team creation mode
3. **Sets team name** → system generates two invite links
4. **Shares "Invite Your Team" link** → friends join as Team A members
5. **Shares "Invite Challenging Team" link** → challenger creates Team B
6. **Team B captain sets name** → gets invite link for their team
7. **Both teams ready** → battle countdown begins

### Gameplay Flow

1. **60-second timer starts** → both teams see same word
2. **Team members suggest words** → captains see suggestions real-time
3. **Captains type guesses** → live scoring updates
4. **Word completed or timer expires** → scores calculated
5. **Next word loads** → process repeats for 5 words total
6. **Final scores** → winning team declared
7. **Results added to leaderboard** → stats updated

### Post-Game Flow

1. **Battle results displayed** → final scores and breakdown
2. **Leaderboard integration** → team battle appears in history
3. **Individual stats** → (future auth) updated on profiles
4. **Rematch option** → quick restart with same teams

---

## Success Metrics

### Engagement Metrics

- **Team Battle Completion Rate**: % of started battles that finish
- **Team Size Distribution**: Average team sizes and full team rates
- **Repeat Team Formation**: How often same players team up again
- **Session Duration**: Average time spent in team vs mode

### Social Metrics

- **Invite Conversion**: % of sent invites that result in joins
- **Friend Referral**: New players joining via team invites
- **Team Communication**: Usage of suggestion features
- **Cross-Team Formation**: Players joining different teams over time

### Competitive Metrics

- **Score Distribution**: Balance of team vs individual scores
- **Comeback Frequency**: Teams overcoming score deficits
- **Perfect Games**: Teams completing all words quickly
- **Strategy Evolution**: Changes in team composition over time

---

## Technical Considerations

### Performance Requirements

- **Real-time Updates**: <200ms latency for score/timer updates
- **Concurrent Battles**: Support 50+ simultaneous team battles
- **Database Efficiency**: Optimized queries for live game state
- **Mobile Responsiveness**: Full feature parity on mobile devices

### Security Considerations

- **Team Captain Validation**: Only captains can submit guesses
- **Suggestion Rate Limiting**: 3 suggestions per player per word
- **Timer Synchronization**: Server-authoritative timing
- **Invite Link Security**: Time-limited and single-use constraints

### Scalability Planning

- **Database Partitioning**: Battle data partitioned by completion date
- **Caching Strategy**: Active battle states cached for performance
- **Connection Management**: WebSocket optimization for real-time features
- **Analytics Pipeline**: Efficient data collection for insights

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

- **Tournament Mode**: Multi-team brackets and elimination rounds
- **Spectator Mode**: Watch live battles without participating
- **Team Rankings**: ELO-style rating system for teams
- **Custom Game Modes**: Adjustable word count, timer, team sizes

### Integration Opportunities

- **Authentication System**: Persistent team stats and history
- **Social Features**: Team profiles, achievements, badges
- **Communication**: In-game chat or voice integration
- **Streaming Integration**: Twitch/YouTube broadcasting support

---

## Launch Strategy

### Beta Testing Phase

1. **Internal Testing**: Development team plays 100+ battles
2. **Closed Beta**: 20 invited users, collect feedback
3. **Open Beta**: Public announcement, gather metrics
4. **Iteration**: Fix bugs, balance scoring, optimize UX

### Release Rollout

1. **Soft Launch**: Feature flag for gradual user exposure
2. **Marketing Push**: Social media, influencer partnerships
3. **Community Events**: Organized tournaments and competitions
4. **Feedback Loop**: Continuous monitoring and improvements

### Success Criteria for Launch

- [ ] 95% battle completion rate (no crashes/abandons)
- [ ] <3 second average load time for battle start
- [ ] 80% positive feedback rating in user surveys
- [ ] 25% of daily active users try team vs mode within first month

---

_This PRD serves as the comprehensive blueprint for implementing Team VS Mode in the Impossible Word game, maintaining compatibility with existing systems while introducing competitive multiplayer dynamics._
