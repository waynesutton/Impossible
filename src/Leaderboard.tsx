import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

interface GameCompletionData {
  won: boolean;
  word: string;
  attempts: number;
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
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading leaderboard...</p>
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
    <div className="space-y-6">
      {/* Game Completion Section */}
      {gameCompletionData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          {gameCompletionData.won ? (
            <div className="space-y-4">
              <div className="text-3xl font-bold text-green-600">
                🎉 Congratulations!
              </div>
              <p className="text-gray-600">You guessed the impossible word!</p>
              <p className="text-lg font-mono uppercase font-bold text-gray-800">
                {gameCompletionData.word}
              </p>
              <p className="text-sm text-gray-500">
                Solved in {gameCompletionData.attempts} attempts
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-2xl font-bold text-red-600">Game Over</div>
              <p className="text-gray-600">You've used all 3 attempts!</p>
              <p className="text-sm text-gray-500">
                The word was:{" "}
                <span className="font-bold uppercase font-mono">
                  {gameCompletionData.word}
                </span>
              </p>
            </div>
          )}

          {/* Name Entry Form */}
          {showNameEntry && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-gray-600">
                Add your name to the leaderboard (optional):
              </p>
              <form onSubmit={handleNameSubmit} className="space-y-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-gray-800 focus:outline-none"
                  maxLength={20}
                />
                <div className="flex gap-2 justify-center">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipNameEntry}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium"
              >
                Start New Game
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Leaderboard</h1>
        <p className="text-gray-600">
          Hall of Fame - Every impossible word conquered!
        </p>
      </div>

      {/* Global Stats */}
      <div className="bg-gray-100 rounded-lg p-4">
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-gray-800">
            {leaderboard.totalCompleted}
          </div>
          <div className="text-sm text-gray-600">Words Conquered</div>
          <div className="text-xs text-gray-500">
            {leaderboard.successRate}% success rate (
            {leaderboard.totalCompleted}/{leaderboard.totalGames} games)
          </div>
        </div>
      </div>

      {/* User Stats */}
      {userStats && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-center space-y-2">
            <div className="text-sm font-semibold text-blue-800">
              Your Stats
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-blue-700">
                  {userStats.completedGames}
                </div>
                <div className="text-xs text-blue-600">Completed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-700">
                  {userStats.totalGames}
                </div>
                <div className="text-xs text-blue-600">Total Games</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-700">
                  {userStats.successRate}%
                </div>
                <div className="text-xs text-blue-600">Success Rate</div>
              </div>
            </div>
            {userStats.bestAttempts && (
              <div className="text-xs text-blue-600 mt-2">
                Best: {userStats.bestAttempts} attempt
                {userStats.bestAttempts === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Winners Hall of Fame */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 text-center">
          Winners Hall of Fame
        </h2>

        {leaderboard.completedGames.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🏆</div>
            <p className="text-gray-600">No victories yet!</p>
            <p className="text-sm text-gray-500 mt-2">
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
                <div key={attemptCount} className="space-y-3">
                  <div className="text-center">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                        attemptCount === 1
                          ? "bg-yellow-100 text-yellow-800"
                          : attemptCount === 2
                            ? "bg-gray-100 text-gray-800"
                            : "bg-orange-100 text-orange-800"
                      }`}
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

                  {/* Words conquered in this attempt count */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {[
                      ...new Set(
                        gamesForAttempts.map((game: any) => game.word),
                      ),
                    ].map((word) => (
                      <div
                        key={word}
                        className="text-center p-2 bg-gray-50 rounded border"
                      >
                        <span className="font-mono uppercase font-bold text-gray-800">
                          {word}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Players who conquered these words */}
                  <div className="space-y-2">
                    {gamesForAttempts.map((game: any) => (
                      <div
                        key={game._id}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">•</span>
                          <span className="font-medium text-gray-800">
                            {game.displayName ||
                              (game.isAnonymous
                                ? "Anonymous Player"
                                : game.playerName || "Player")}
                          </span>
                          <span className="text-sm text-gray-500">
                            conquered "
                            <span className="font-mono uppercase">
                              {game.word}
                            </span>
                            "
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatTime(game.completedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Plays (all games) */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 text-center">
          Recent Plays
        </h2>
        {leaderboard.recentPlays.length === 0 ? (
          <div className="text-center text-gray-500">No games yet.</div>
        ) : (
          <div className="space-y-2">
            {leaderboard.recentPlays.map((game: any) => (
              <div
                key={game._id}
                className="flex items-center justify-between p-3 bg-white border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">
                    {game.displayName ||
                      (game.isAnonymous
                        ? "Anonymous Player"
                        : game.playerName || "Player")}
                  </span>
                  <span className="text-sm text-gray-500">
                    • Attempts: {game.attempts}
                    {!game.completed ? "" : ""}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {formatTime(game.completedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
