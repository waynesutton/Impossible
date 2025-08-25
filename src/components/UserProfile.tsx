import { useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { ProtectedRoute } from "./ProtectedRoute";

export function UserProfile() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();

  const userStats = useQuery(
    api.leaderboard.getUserStats,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );

  const userGameHistory = useQuery(
    api.game.getUserGameHistory,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );

  const userChallengeHistory = useQuery(
    api.challengeBattle.getUserChallengeHistory,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="brutal-card text-center">
          <h1 className="brutal-text-xl mb-2">Your Profile</h1>
          <p
            className="brutal-text-md"
            style={{ color: "var(--text-secondary)" }}
          >
            Welcome back,{" "}
            {user?.firstName || user?.emailAddresses[0].emailAddress}!
          </p>
        </div>

        {/* User Stats */}
        {userStats && (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Your Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">{userStats.totalGames}</div>
                <div className="text-sm">Single Player Games</div>
              </div>
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">{userStats.wins}</div>
                <div className="text-sm">Games Won</div>
              </div>
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">{userStats.winRate}%</div>
                <div className="text-sm">Win Rate</div>
              </div>
              <div className="brutal-stats-card">
                <div className="brutal-text-lg">
                  {userStats.averageAttempts}
                </div>
                <div className="text-sm">Avg Attempts</div>
              </div>
            </div>

            {/* Crossword Statistics */}
            {userStats.crosswordStats && (
              <div className="mt-6">
                <h3 className="brutal-text-md mb-3">Crossword Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.crosswordStats.crosswordsCompleted}
                    </div>
                    <div className="text-sm">Crosswords Completed</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.crosswordStats.bestScore}
                    </div>
                    <div className="text-sm">Best Score</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.crosswordStats.averageScore}
                    </div>
                    <div className="text-sm">Avg Score</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.crosswordStats.fastestTime}m
                    </div>
                    <div className="text-sm">Fastest Time</div>
                  </div>
                </div>
              </div>
            )}

            {/* Challenge Mode Statistics */}
            {userStats.challengeStats && (
              <div className="mt-6">
                <h3 className="brutal-text-md mb-3">Challenge Battle Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.totalChallenges}
                    </div>
                    <div className="text-sm">Challenges Played</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.challengesWon}
                    </div>
                    <div className="text-sm">Challenges Won</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.challengeWinRate}%
                    </div>
                    <div className="text-sm">Challenge Win Rate</div>
                  </div>
                  <div className="brutal-stats-card">
                    <div className="brutal-text-lg">
                      {userStats.challengeStats.averageScore}
                    </div>
                    <div className="text-sm">Avg Challenge Score</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Game History */}
        {userGameHistory && userGameHistory.length > 0 && (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Recent Single-Player Games</h2>
            <div className="space-y-2">
              {userGameHistory.slice(0, 10).map((game) => (
                <div
                  key={game._id}
                  className="flex justify-between items-center p-3 border-2 border-gray-300"
                >
                  <div>
                    <span className="font-bold">{game.word.toUpperCase()}</span>
                    <span
                      className="text-sm ml-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {new Date(game.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div
                      className={
                        game.completed ? "text-green-600" : "text-red-600"
                      }
                    >
                      {game.completed ? "WON" : "FAILED"}
                    </div>
                    <div className="text-sm">{game.attempts} attempts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Challenge History */}
        {userChallengeHistory && userChallengeHistory.length > 0 && (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Recent Challenge Battles</h2>
            <div className="space-y-2">
              {userChallengeHistory.slice(0, 10).map((challenge) => {
                const isChallenger =
                  challenge.challengerUserId === challenge.challengerUserId;
                const userScore = isChallenger
                  ? challenge.challengerScore
                  : challenge.opponentScore;
                const opponentScore = isChallenger
                  ? challenge.opponentScore
                  : challenge.challengerScore;
                const opponentName = isChallenger
                  ? challenge.opponentName
                  : challenge.challengerName;
                const won =
                  (isChallenger && challenge.winner === "challenger") ||
                  (!isChallenger && challenge.winner === "opponent");
                const isTie =
                  challenge.winner === "tie" ||
                  (userScore === opponentScore &&
                    challenge.winner === undefined);

                return (
                  <div
                    key={challenge._id}
                    className="flex justify-between items-center p-3 border-2 border-gray-300"
                  >
                    <div>
                      <span className="font-bold">
                        vs {opponentName || "Opponent"}
                      </span>
                      <span
                        className="text-sm ml-2"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {challenge.completedAt &&
                          new Date(challenge.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div
                        className={
                          isTie
                            ? "text-yellow-600"
                            : won
                              ? "text-green-600"
                              : "text-red-600"
                        }
                      >
                        {isTie ? "TIE" : won ? "WON" : "LOST"}
                      </div>
                      <div className="text-sm">
                        {userScore} - {opponentScore}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
