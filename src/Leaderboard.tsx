import { useState, useEffect } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

interface GameCompletionData {
  won: boolean;
  word: string;
  attempts: number;
  usedSecretWord?: boolean;
}

interface ChallengeCompletionData {
  challengeId: string;
  challengerName: string;
  opponentName: string;
  words: string[];
  finalScores: {
    challenger: number;
    opponent: number;
  };
  winner?: string;
}

interface LeaderboardProps {
  gameCompletionData?: GameCompletionData | null;
  challengeCompletionData?: ChallengeCompletionData | null;
  crosswordCompletionData?: {
    completed: boolean;
    timeMinutes: number;
    hintsUsed: number;
    cluesUsed: number;
    finalScore: number;
    usedSecretCode: boolean;
  } | null;
  onStartNewGame?: () => void;
  onNavigateToCrossword?: () => void;
}

export function Leaderboard({
  gameCompletionData,
  challengeCompletionData,
  crosswordCompletionData,
  onStartNewGame,
  onNavigateToCrossword,
}: LeaderboardProps) {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const leaderboard = useQuery(api.leaderboard.getLeaderboard);
  const userStats = useQuery(
    api.leaderboard.getUserStats,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  const challengeBattles = useQuery(
    api.challengeBattle.getRecentChallengeBattles,
    { limit: 3 },
  );
  const challengeStats = useQuery(api.challengeBattle.getChallengeBattleStats);
  const crosswordLeaderboard = useQuery(
    api.leaderboard.getCrosswordLeaderboard,
  );
  const crosswordCompletions = useQuery(
    api.leaderboard.getCrosswordCompletions,
    { limit: 10 },
  );
  const updateDisplayName = useMutation(api.game.updateDisplayName);

  // Admin mutations
  const adminHideGame = useMutation(api.leaderboard.adminHideGame);
  const adminDeleteGame = useMutation(api.leaderboard.adminDeleteGame);
  const adminHideChallenge = useMutation(api.leaderboard.adminHideChallenge);
  const adminDeleteChallenge = useMutation(
    api.leaderboard.adminDeleteChallenge,
  );

  // Check if user is admin
  const isAdmin = user?.publicMetadata?.role === "admin";

  const [showNameEntry, setShowNameEntry] = useState(
    !!gameCompletionData && !challengeCompletionData,
  );
  const [displayName, setDisplayName] = useState("");

  // Pagination state for recent plays
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [allRecentPlays, setAllRecentPlays] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined,
  );
  const [showAllShameGames, setShowAllShameGames] = useState(false);
  const [challengeCursor, setChallengeCursor] = useState<string | undefined>(
    undefined,
  );
  const [currentChallengeCursor, setCurrentChallengeCursor] = useState<
    string | undefined
  >(undefined);
  const [allChallengeBattles, setAllChallengeBattles] = useState<any[]>([]);
  const [loadingMoreChallenges, setLoadingMoreChallenges] = useState(false);
  const [crosswordDisplayCount, setCrosswordDisplayCount] = useState(3);
  // State for managing Winners Hall of Fame pagination by attempt count
  const [attemptDisplayCounts, setAttemptDisplayCounts] = useState<
    Record<number, number>
  >({
    1: 3,
    2: 3,
    3: 3,
  });

  // Tab state for leaderboard sections
  const [activeTab, setActiveTab] = useState<
    "normal" | "challenges" | "crosswords"
  >("normal");

  // Load initial recent plays (10)
  const recentPlaysData = useQuery(api.leaderboard.getRecentPlays, {
    cursor: undefined,
    limit: 10,
  });

  // Load initial challenge battles and update when data changes
  useEffect(() => {
    if (challengeBattles?.battles) {
      setAllChallengeBattles(challengeBattles.battles);
      if (!challengeBattles.isDone) {
        setChallengeCursor(challengeBattles.continueCursor);
      }
    }
  }, [challengeBattles]);

  // Query for loading more data with cursor
  const moreRecentPlaysData = useQuery(
    api.leaderboard.getRecentPlays,
    currentCursor ? { cursor: currentCursor, limit: 10 } : "skip",
  );

  // Query for loading more challenge battles
  const moreChallengeBattlesData = useQuery(
    api.challengeBattle.getRecentChallengeBattles,
    currentChallengeCursor
      ? { cursor: currentChallengeCursor, limit: 3 }
      : "skip",
  );

  // Initialize allRecentPlays with first batch using useEffect
  useEffect(() => {
    if (recentPlaysData && allRecentPlays.length === 0) {
      setAllRecentPlays(recentPlaysData.games);
      setNextCursor(recentPlaysData.nextCursor);
      setHasMoreData(recentPlaysData.hasMore);
    }
  }, [recentPlaysData]);

  // Handle loading more data when new data comes in using useEffect
  useEffect(() => {
    if (moreRecentPlaysData && loadingMore) {
      setAllRecentPlays((prev) => [...prev, ...moreRecentPlaysData.games]);
      setNextCursor(moreRecentPlaysData.nextCursor);
      setHasMoreData(moreRecentPlaysData.hasMore);
      setLoadingMore(false);
      setCurrentCursor(undefined); // Reset current cursor
    }
  }, [moreRecentPlaysData, loadingMore]);

  // Handle loading more challenge battles
  useEffect(() => {
    if (moreChallengeBattlesData && loadingMoreChallenges) {
      setAllChallengeBattles((prev) => [
        ...prev,
        ...moreChallengeBattlesData.battles,
      ]);
      setChallengeCursor(moreChallengeBattlesData.continueCursor);
      setLoadingMoreChallenges(false);
      setCurrentChallengeCursor(undefined); // Reset current cursor
    }
  }, [moreChallengeBattlesData, loadingMoreChallenges]);

  // Load more recent plays function
  const loadMoreRecentPlays = () => {
    if (!hasMoreData || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    setCurrentCursor(nextCursor); // This will trigger the query
  };

  // Load more challenge battles function
  const loadMoreChallengeBattles = () => {
    if (
      !challengeBattles ||
      challengeBattles.isDone ||
      loadingMoreChallenges ||
      !challengeCursor
    )
      return;
    setLoadingMoreChallenges(true);
    setCurrentChallengeCursor(challengeCursor); // This will trigger the query
  };

  // Load more games for a specific attempt count
  const loadMoreAttemptGames = (attemptCount: number) => {
    setAttemptDisplayCounts((prev) => ({
      ...prev,
      [attemptCount]: prev[attemptCount] + 3,
    }));
  };

  // Load more crossword completions
  const loadMoreCrosswordCompletions = () => {
    setCrosswordDisplayCount((prev) => prev + 3);
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim()) {
      await updateDisplayName({ displayName: displayName.trim() });
    }
    setShowNameEntry(false);
  };

  const handleSkipNameEntry = async () => {
    await updateDisplayName({ displayName: "Anonymous" });
    setShowNameEntry(false);
  };

  // Admin action handlers
  const handleHideGame = async (gameId: string) => {
    if (!isAdmin) return;
    try {
      await adminHideGame({ gameId: gameId as Id<"gameResults"> });
      // The queries will automatically refresh due to Convex reactivity
    } catch (error) {
      console.error("Failed to hide game:", error);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!isAdmin) return;
    try {
      await adminDeleteGame({ gameId: gameId as Id<"gameResults"> });
      // The queries will automatically refresh due to Convex reactivity
    } catch (error) {
      console.error("Failed to delete game:", error);
    }
  };

  const handleHideChallenge = async (challengeId: string) => {
    if (!isAdmin) return;
    try {
      await adminHideChallenge({
        challengeId: challengeId as Id<"challengeBattles">,
      });
      // The queries will automatically refresh due to Convex reactivity
    } catch (error) {
      console.error("Failed to hide challenge:", error);
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!isAdmin) return;
    try {
      await adminDeleteChallenge({
        challengeId: challengeId as Id<"challengeBattles">,
      });
      // The queries will automatically refresh due to Convex reactivity
    } catch (error) {
      console.error("Failed to delete challenge:", error);
    }
  };

  if (!leaderboard) {
    return (
      <div className="brutal-card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p style={{ color: "var(--text-secondary)" }}>Loading leaderboard...</p>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-8">
      {/* Game Completion Section */}
      {gameCompletionData && !challengeCompletionData && (
        <div className="brutal-card text-center">
          {gameCompletionData.won ? (
            <div className="space-y-4">
              {gameCompletionData.usedSecretWord ? (
                <>
                  <div
                    className="brutal-text-xl"
                    style={{ color: "var(--bg-error)" }}
                  >
                    You Cheated!
                  </div>
                  <p
                    className="brutal-text-md"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    You cheated playing the impossible word!
                  </p>
                  <div className="brutal-badge text-lg">
                    {gameCompletionData.word}
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Used secret shortcut in {gameCompletionData.attempts}{" "}
                    attempts
                  </p>
                </>
              ) : (
                <>
                  <div
                    className="brutal-text-xl"
                    style={{ color: "var(--bg-success)" }}
                  >
                    Congratulations!
                  </div>
                  <p
                    className="brutal-text-md"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    You guessed the impossible word!
                  </p>
                  <div className="brutal-badge text-lg">
                    {gameCompletionData.word}
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Solved in {gameCompletionData.attempts} attempts
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="brutal-text-xl"
                style={{ color: "var(--bg-error)" }}
              >
                Game Over
              </div>
              <p
                className="brutal-text-md"
                style={{ color: "var(--text-secondary)" }}
              >
                You've used all 3 attempts!
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                The word was:{" "}
                <span className="brutal-badge">{gameCompletionData.word}</span>
              </p>
            </div>
          )}

          {/* Name Entry Form */}
          {showNameEntry && (
            <div className="mt-6 space-y-4">
              <p
                className="brutal-text-md"
                style={{ color: "var(--text-secondary)" }}
              >
                Add your name to the leaderboard (optional):
              </p>
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="brutal-input w-full"
                  maxLength={20}
                />
                <div className="flex gap-3 justify-center">
                  <button type="submit" className="brutal-button px-6 py-2">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipNameEntry}
                    className="brutal-button secondary px-6 py-2"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Start New Game Button - shown after name entry or always if no name entry */}
          {!showNameEntry && onStartNewGame && (
            <div className="mt-6">
              <button
                onClick={onStartNewGame}
                className="brutal-button px-8 py-4 text-lg"
              >
                Start New Game
              </button>
            </div>
          )}
        </div>
      )}

      {/* Challenge Completion Section */}
      {challengeCompletionData && (
        <div className="brutal-card text-center">
          <div className="space-y-4">
            <div
              className="brutal-text-xl"
              style={{ color: "var(--bg-success)" }}
            >
              Challenge Complete!
            </div>
            <p
              className="brutal-text-md"
              style={{ color: "var(--text-secondary)" }}
            >
              {challengeCompletionData.challengerName} vs{" "}
              {challengeCompletionData.opponentName}
            </p>
            <div className="brutal-badge text-lg">
              Final Scores: {challengeCompletionData.finalScores.challenger} -{" "}
              {challengeCompletionData.finalScores.opponent}
            </div>

            {/* Show the words that were guessed */}
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-4">Words You Played:</h3>
              <div className="space-y-3">
                {challengeCompletionData.words.map((word, index) => (
                  <div
                    key={index}
                    className="w-full py-4 px-6 text-center font-black text-xl"
                    style={{
                      background: "#F4D03F",
                      border: "3px solid #D4AF37",
                      color: "#2C3E50",
                      borderRadius: "8px",
                    }}
                  >
                    WORD {index + 1}: {word.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {challengeCompletionData.winner && (
              <p
                className="text-lg font-bold"
                style={{ color: "var(--text-success)" }}
              >
                Winner:{" "}
                {challengeCompletionData.winner === "challenger"
                  ? challengeCompletionData.challengerName
                  : challengeCompletionData.opponentName}
                !
              </p>
            )}
          </div>

          {/* Name Entry Form */}
          {showNameEntry && (
            <div className="mt-6 space-y-4">
              <p
                className="brutal-text-md"
                style={{ color: "var(--text-secondary)" }}
              >
                Add your name to the leaderboard (optional):
              </p>
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="brutal-input w-full"
                  maxLength={20}
                />
                <div className="flex gap-3 justify-center">
                  <button type="submit" className="brutal-button px-6 py-2">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipNameEntry}
                    className="brutal-button secondary px-6 py-2"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Start New Game Button - shown after name entry or always if no name entry */}
          {!showNameEntry && onStartNewGame && (
            <div className="mt-6">
              <button
                onClick={onStartNewGame}
                className="brutal-button px-8 py-4 text-lg"
              >
                Start New Game
              </button>
            </div>
          )}
        </div>
      )}

      {/* Crossword Completion Section */}
      {crosswordCompletionData && crosswordCompletionData.completed && (
        <div className="brutal-card text-center">
          <div className="space-y-4">
            <div
              className="brutal-text-xl"
              style={{ color: "var(--bg-success)" }}
            >
              🎉 Crossword Complete!
            </div>
            <p
              className="brutal-text-md"
              style={{ color: "var(--text-secondary)" }}
            >
              You solved today's impossible crossword!
            </p>
            <div className="brutal-badge text-lg">
              Score: {crosswordCompletionData.finalScore}
            </div>
            <div className="flex justify-center gap-6 text-sm">
              <span style={{ color: "var(--text-secondary)" }}>
                Time: {crosswordCompletionData.timeMinutes} minutes
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Hints: {crosswordCompletionData.hintsUsed}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Clues: {crosswordCompletionData.cluesUsed}
              </span>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={onNavigateToCrossword}
                className="brutal-button px-6 py-3"
              >
                Play Another Crossword
              </button>
              {onStartNewGame && (
                <button
                  onClick={onStartNewGame}
                  className="brutal-button secondary px-6 py-3"
                >
                  Play Regular Game
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="brutal-card text-center">
        <h1
          className="brutal-text-xl mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Leaderboard
        </h1>
        <p
          className="brutal-text-md"
          style={{ color: "var(--text-secondary)" }}
        >
          Hall of Fame - Every impossible word conquered!
        </p>
      </div>

      {/* Individual Games Section */}
      <div className="space-y-6">
        <div className="brutal-card text-center">
          <h2
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            Winners Hall of Fame
          </h2>
        </div>

        {leaderboard.completedGames.length === 0 ? (
          <div className="brutal-card text-center py-8">
            <div className="text-4xl mb-4">🏆</div>
            <p
              className="brutal-text-md mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              No victories yet!
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Be the first to conquer an impossible word.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {[1, 2, 3].map((attemptCount) => {
              const gamesForAttempts = leaderboard.completedGames.filter(
                (game: any) => game.attempts === attemptCount,
              );
              if (gamesForAttempts.length === 0) return null;

              return (
                <div key={attemptCount} className="space-y-4">
                  <div className="text-center">
                    <div
                      className={`brutal-badge inline-flex items-center gap-2 px-6 py-3 text-lg ${
                        attemptCount === 1
                          ? ""
                          : attemptCount === 2
                            ? "secondary"
                            : "warning"
                      }`}
                      style={{
                        background:
                          attemptCount === 1
                            ? "var(--bg-warning)"
                            : attemptCount === 2
                              ? "var(--bg-surface)"
                              : "var(--bg-accent)",
                      }}
                    >
                      {attemptCount === 1
                        ? "🥇"
                        : attemptCount === 2
                          ? "🥈"
                          : "🥉"}
                      <span>
                        {attemptCount} Attempt{attemptCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* Players who conquered these words */}
                  <div className="space-y-3">
                    {gamesForAttempts
                      .slice(0, attemptDisplayCounts[attemptCount])
                      .map((game: any) => (
                        <div
                          key={game._id}
                          className="brutal-leaderboard-item flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <span
                                className="brutal-text-md"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {game.displayName ||
                                  (game.isAnonymous
                                    ? "Anonymous Player"
                                    : game.playerName || "Player")}
                              </span>
                              <div
                                className="text-sm"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                conquered{" "}
                                <span className="brutal-badge">
                                  {game.word}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="text-xs"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {formatTime(game.completedAt)}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleHideGame(game._id)}
                                  className="brutal-button text-xs px-2 py-1"
                                  style={{
                                    background: "var(--bg-warning)",
                                    color: "var(--text-warning)",
                                    border: "1px solid var(--border-warning)",
                                    fontSize: "10px",
                                  }}
                                  title="Hide from leaderboard"
                                >
                                  Hide
                                </button>
                                <button
                                  onClick={() => handleDeleteGame(game._id)}
                                  className="brutal-button text-xs px-2 py-1"
                                  style={{
                                    background: "var(--bg-error)",
                                    color: "var(--text-inverse)",
                                    border: "1px solid var(--border-error)",
                                    fontSize: "10px",
                                  }}
                                  title="Delete permanently"
                                >
                                  Del
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Load more button for this attempt count */}
                  {gamesForAttempts.length >
                    attemptDisplayCounts[attemptCount] && (
                    <div className="text-center">
                      <button
                        onClick={() => loadMoreAttemptGames(attemptCount)}
                        className="brutal-button secondary"
                      >
                        Load More (
                        {gamesForAttempts.length -
                          attemptDisplayCounts[attemptCount]}{" "}
                        more)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Winners Hall of Shame */}
      {leaderboard.shameGames && leaderboard.shameGames.length > 0 && (
        <div className="space-y-6">
          <div className="brutal-card text-center">
            <h2
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              Winners Hall of Shame
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Players who used the secret shortcut
            </p>
          </div>

          <div className="space-y-3">
            {(showAllShameGames
              ? leaderboard.shameGames
              : leaderboard.shameGames.slice(0, 5)
            ).map((game: any) => (
              <div
                key={game._id}
                className="brutal-leaderboard-item flex items-center justify-between"
                style={{ background: "var(--bg-error)" }}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <span
                      className="brutal-text-md"
                      style={{ color: "var(--text-inverse)" }}
                    >
                      {game.displayName ||
                        (game.isAnonymous
                          ? "Anonymous"
                          : game.playerName || "Player")}{" "}
                      Used Secret Word for a win
                    </span>
                    <div
                      className="text-sm"
                      style={{ color: "var(--text-inverse)", opacity: 0.8 }}
                    >
                      should have guessed{" "}
                      <span
                        className="brutal-badge"
                        style={{
                          background: "var(--bg-secondary)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {game.word}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-inverse)", opacity: 0.8 }}
                  >
                    {formatTime(game.completedAt)}
                  </div>
                  {/* Admin buttons temporarily commented out for debugging */}
                  {/* {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleHideGame(game._id)}
                        className="brutal-button text-xs px-2 py-1"
                        style={{
                          background: "var(--bg-warning)",
                          color: "var(--text-warning)",
                          border: "1px solid var(--border-warning)",
                          fontSize: "10px",
                        }}
                        title="Hide from leaderboard"
                      >
                        Hide
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game._id)}
                        className="brutal-button text-xs px-2 py-1"
                        style={{
                          background: "var(--bg-secondary)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-color)",
                          fontSize: "10px",
                        }}
                        title="Delete permanently"
                      >
                        Del
                      </button>
                    </div>
                  )} */}
                </div>
              </div>
            ))}
          </div>

          {/* Load more button for shame games */}
          {leaderboard.shameGames.length > 5 && !showAllShameGames && (
            <div className="text-center">
              <button
                onClick={() => setShowAllShameGames(true)}
                className="brutal-button secondary"
              >
                Load More Cheaters ({leaderboard.shameGames.length - 5} more)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Crossword Solved Section */}
      {crosswordCompletions && crosswordCompletions.length > 0 && (
        <div className="space-y-6">
          <div className="brutal-card text-center">
            <h2
              className="brutal-text-lg mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Crossword Solved
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Players who solved the daily crossword
            </p>
          </div>

          {crosswordCompletions.filter(
            (completion) => !completion.usedSecretCode,
          ).length > 0 ? (
            <div className="space-y-3">
              {crosswordCompletions
                .filter((completion) => !completion.usedSecretCode)
                .slice(0, crosswordDisplayCount)
                .map((completion) => (
                  <div
                    key={`${completion.userId}-${completion.completedAt}`}
                    className="brutal-leaderboard-item"
                    style={{ background: "var(--bg-success)" }}
                  >
                    <div className="w-full text-center">
                      <div className="font-bold text-lg">
                        {completion.userName}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        solved the daily crossword on{" "}
                        {new Date(completion.completedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}

              {/* Load More Button */}
              {crosswordCompletions.filter(
                (completion) => !completion.usedSecretCode,
              ).length > crosswordDisplayCount && (
                <div className="text-center">
                  <button
                    onClick={loadMoreCrosswordCompletions}
                    className="brutal-button secondary px-6 py-3"
                  >
                    Load More (
                    {crosswordCompletions.filter(
                      (completion) => !completion.usedSecretCode,
                    ).length - crosswordDisplayCount}{" "}
                    more)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p style={{ color: "var(--text-secondary)" }}>
                No crosswords solved yet. Complete a daily crossword to see
                results here!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Secret Word for a Win Section */}
      {crosswordCompletions && crosswordCompletions.length > 0 && (
        <div className="space-y-6">
          {crosswordCompletions.filter(
            (completion) => completion.usedSecretCode,
          ).length > 0 && (
            <div className="brutal-card text-center">
              <h2
                className="brutal-text-lg mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                Secret Word for a Win
              </h2>
              <p
                className="text-sm mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                Players who used the secret word to solve the crossword
              </p>
              <div className="space-y-3 mt-4">
                {crosswordCompletions
                  .filter((completion) => completion.usedSecretCode)
                  .slice(0, 5)
                  .map((completion) => (
                    <div
                      key={`${completion.userId}-${completion.completedAt}`}
                      className="brutal-leaderboard-item"
                      style={{ background: "var(--bg-warning)" }}
                    >
                      <div className="w-full text-center">
                        <div className="font-bold text-lg">
                          {completion.userName}
                        </div>
                        <div
                          className="text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          used the secret word on{" "}
                          {new Date(
                            completion.completedAt,
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Plays (all games) */}
      <div className="space-y-6">
        <div className="brutal-card text-center">
          <h2
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            Recent Plays
          </h2>
          <p
            className="text-sm mt-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Last 10 games played.
          </p>
        </div>
        {allRecentPlays.length === 0 ? (
          <div
            className="brutal-card text-center"
            style={{ color: "var(--text-secondary)" }}
          >
            No games yet.
          </div>
        ) : (
          <div className="space-y-3">
            {allRecentPlays.map((game: any) => (
              <div
                key={game._id}
                className="brutal-leaderboard-item flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="brutal-text-md"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {game.displayName ||
                      (game.isAnonymous
                        ? "Anonymous Player"
                        : game.playerName || "Player")}
                  </span>
                  <span className="brutal-badge secondary">
                    {game.attempts} attempts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatTime(game.completedAt)}
                  </div>
                  {/* Admin buttons temporarily commented out for debugging */}
                  {/* {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleHideGame(game._id)}
                        className="brutal-button text-xs px-2 py-1"
                        style={{
                          background: "var(--bg-warning)",
                          color: "var(--text-warning)",
                          border: "1px solid var(--border-warning)",
                          fontSize: "10px",
                        }}
                        title="Hide from leaderboard"
                      >
                        Hide
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game._id)}
                        className="brutal-button text-xs px-2 py-1"
                        style={{
                          background: "var(--bg-error)",
                          color: "var(--text-inverse)",
                          border: "1px solid var(--border-error)",
                          fontSize: "10px",
                        }}
                        title="Delete permanently"
                      >
                        Del
                      </button>
                    </div>
                  )} */}
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMoreData && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMoreRecentPlays}
                  disabled={loadingMore}
                  className="brutal-button secondary px-6 py-3"
                >
                  {loadingMore ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-800"></div>
                      Loading...
                    </div>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Challenge Battles Section */}
        <div className="space-y-6">
          <div className="brutal-card text-center">
            <h2
              className="brutal-text-lg mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Challenge Battles
            </h2>

            {challengeStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="brutal-stat">
                  <div className="brutal-stat-number">
                    {challengeStats.totalBattles}
                  </div>
                  <div className="brutal-stat-label">Total Battles</div>
                </div>
                <div className="brutal-stat">
                  <div className="brutal-stat-number">
                    {challengeStats.totalCompleted}
                  </div>
                  <div className="brutal-stat-label">Completed</div>
                </div>
                <div className="brutal-stat">
                  <div className="brutal-stat-number">
                    {challengeStats.averageScore}
                  </div>
                  <div className="brutal-stat-label">Avg Score</div>
                </div>
                <div className="brutal-stat">
                  <div className="brutal-stat-number">
                    {challengeStats.topScore}
                  </div>
                  <div className="brutal-stat-label">Top Score</div>
                </div>
              </div>
            )}

            {/* Last 5 Challenge Battles */}
            {allChallengeBattles.length > 0 ? (
              <div className="mt-6">
                <h3
                  className="text-lg font-bold mb-4"
                  style={{ color: "var(--text-primary)" }}
                >
                  Recent Battles
                </h3>
                <div className="space-y-3">
                  {allChallengeBattles.slice(0, 3).map((battle: any) => (
                    <div
                      key={battle._id}
                      className="brutal-leaderboard-item"
                      style={{ background: "var(--bg-warning)" }}
                    >
                      <div className="w-full">
                        <div className="challenger-vs-opponent mb-4">
                          <div className="challenger-score">
                            <h4 className="font-bold">
                              {battle.challengerName}
                            </h4>
                            <p className="text-2xl font-black">
                              {battle.challengerScore}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Challenger
                            </p>
                          </div>

                          <div className="vs-divider text-lg">VS</div>

                          <div className="opponent-score">
                            <h4 className="font-bold">{battle.opponentName}</h4>
                            <p className="text-2xl font-black">
                              {battle.opponentScore}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Opponent
                            </p>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm font-bold mb-1">
                            {battle.winner === "challenger" && (
                              <span style={{ color: "var(--text-success)" }}>
                                {battle.challengerName} Wins!
                              </span>
                            )}
                            {battle.winner === "opponent" && (
                              <span style={{ color: "var(--text-success)" }}>
                                {battle.opponentName} Wins!
                              </span>
                            )}
                            {!battle.winner && (
                              <span style={{ color: "var(--text-secondary)" }}>
                                Tie Game!
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="text-xs"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {formatTime(battle.completedAt)}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    handleHideChallenge(battle._id)
                                  }
                                  className="brutal-button text-xs px-2 py-1"
                                  style={{
                                    background: "var(--bg-secondary)",
                                    color: "var(--text-primary)",
                                    border: "1px solid var(--border-color)",
                                    fontSize: "10px",
                                  }}
                                  title="Hide from leaderboard"
                                >
                                  Hide
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteChallenge(battle._id)
                                  }
                                  className="brutal-button text-xs px-2 py-1"
                                  style={{
                                    background: "var(--bg-error)",
                                    color: "var(--text-inverse)",
                                    border: "1px solid var(--border-error)",
                                    fontSize: "10px",
                                  }}
                                  title="Delete permanently"
                                >
                                  Del
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p style={{ color: "var(--text-secondary)" }}>
                  No challenge battles yet. Start a challenge to see results
                  here!
                </p>
              </div>
            )}
          </div>

          {/* Load More Challenges Button - Below the box */}
          {allChallengeBattles.length > 3 &&
            challengeBattles &&
            !challengeBattles.isDone && (
              <div className="text-center">
                <button
                  onClick={loadMoreChallengeBattles}
                  disabled={loadingMoreChallenges}
                  className="brutal-button secondary px-6 py-3"
                >
                  {loadingMoreChallenges ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-800"></div>
                      Loading...
                    </div>
                  ) : (
                    "Load More Challenges"
                  )}
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
