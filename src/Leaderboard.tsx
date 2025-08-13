import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

interface GameCompletionData {
  won: boolean;
  word: string;
  attempts: number;
  usedSecretWord?: boolean;
}

interface LeaderboardProps {
  gameCompletionData?: GameCompletionData | null;
  onStartNewGame?: () => void;
}

export function Leaderboard({
  gameCompletionData,
  onStartNewGame,
}: LeaderboardProps) {
  const leaderboard = useQuery(api.leaderboard.getLeaderboard);
  const userStats = useQuery(api.leaderboard.getUserStats);
  const updateDisplayName = useMutation(api.game.updateDisplayName);

  const [showNameEntry, setShowNameEntry] = useState(!!gameCompletionData);
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
  // State for managing Winners Hall of Fame pagination by attempt count
  const [attemptDisplayCounts, setAttemptDisplayCounts] = useState<
    Record<number, number>
  >({
    1: 3,
    2: 3,
    3: 3,
  });

  // Load initial recent plays (10)
  const recentPlaysData = useQuery(api.leaderboard.getRecentPlays, {
    cursor: undefined,
    limit: 10,
  });

  // Query for loading more data with cursor
  const moreRecentPlaysData = useQuery(
    api.leaderboard.getRecentPlays,
    currentCursor ? { cursor: currentCursor, limit: 10 } : "skip",
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

  // Load more recent plays function
  const loadMoreRecentPlays = () => {
    if (!hasMoreData || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    setCurrentCursor(nextCursor); // This will trigger the query
  };

  // Load more games for a specific attempt count
  const loadMoreAttemptGames = (attemptCount: number) => {
    setAttemptDisplayCounts((prev) => ({
      ...prev,
      [attemptCount]: prev[attemptCount] + 3,
    }));
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
      {gameCompletionData && (
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
                    🎉 Congratulations!
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

      {/* User Stats and global stats */}
      {userStats && (
        <div
          className="brutal-card"
          style={{ background: "var(--bg-surface)" }}
        >
          <div className="text-center space-y-4">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              Total Stats
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="brutal-stats-card">
                <div
                  className="brutal-text-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  {userStats.completedGames}
                </div>
                <div
                  className="brutal-text-md"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Words Conquered
                </div>
              </div>
              <div className="brutal-stats-card">
                <div
                  className="brutal-text-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  {userStats.totalGames}
                </div>
                <div
                  className="brutal-text-md"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Total Games
                </div>
              </div>
              <div className="brutal-stats-card">
                <div
                  className="brutal-text-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  {userStats.successRate}%
                </div>
                <div
                  className="brutal-text-md"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Success Rate
                </div>
              </div>
            </div>
            {userStats.bestAttempts && (
              <div className="brutal-badge">
                Best: {userStats.bestAttempts} attempt
                {userStats.bestAttempts === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Winners Hall of Fame */}
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
                          <div
                            className="text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {formatTime(game.completedAt)}
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
                      cheated
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
                <div
                  className="text-xs"
                  style={{ color: "var(--text-inverse)", opacity: 0.8 }}
                >
                  {formatTime(game.completedAt)}
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
                <div
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatTime(game.completedAt)}
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
      </div>
    </div>
  );
}
