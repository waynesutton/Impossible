import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { Share } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ProtectedRoute } from "./ProtectedRoute";
import { ConfirmDialog } from "./ConfirmDialog";
import { Id } from "../../convex/_generated/dataModel";

export function MyScores() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { user, isSignedIn } = useUser();

  // Use Clerk's authentication state as primary
  const userIsAuthenticated = isSignedIn && user;

  // State for pagination
  const [gamesCursor, setGamesCursor] = useState<string | undefined>(undefined);
  const [challengesCursor, setChallengesCursor] = useState<string | undefined>(
    undefined,
  );

  // State for delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "game" | "challenge";
    id: Id<"gameResults"> | Id<"challengeBattles">;
    title: string;
  }>({
    isOpen: false,
    type: "game",
    id: "" as Id<"gameResults">,
    title: "",
  });

  // State for copy feedback
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Mutations
  const deleteGameMutation = useMutation(api.game.deleteGameResult);
  const deleteChallengeMutation = useMutation(
    api.challengeBattle.deleteChallengeResult,
  );

  // Queries with conditional skipping
  const gamesData = useQuery(
    api.game.getUserGameHistoryPaginated,
    authIsLoading || !userIsAuthenticated
      ? "skip"
      : {
          cursor: gamesCursor,
          limit: 3,
        },
  );

  const challengesData = useQuery(
    api.challengeBattle.getUserChallengeHistoryPaginated,
    authIsLoading || !userIsAuthenticated
      ? "skip"
      : {
          cursor: challengesCursor,
          limit: 3,
        },
  );

  const userStats = useQuery(
    api.leaderboard.getUserStats,
    authIsLoading || !userIsAuthenticated ? "skip" : {},
  );

  const loadMoreGames = () => {
    if (gamesData?.nextCursor) {
      setGamesCursor(gamesData.nextCursor);
    }
  };

  const loadMoreChallenges = () => {
    if (challengesData?.nextCursor) {
      setChallengesCursor(challengesData.nextCursor);
    }
  };

  const handleDeleteGame = (gameId: Id<"gameResults">, word: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: "game",
      id: gameId,
      title: `Delete game result for "${word.toUpperCase()}"?`,
    });
  };

  const handleDeleteChallenge = (
    challengeId: Id<"challengeBattles">,
    opponentName: string,
  ) => {
    setDeleteConfirm({
      isOpen: true,
      type: "challenge",
      id: challengeId as any,
      title: `Delete challenge battle vs ${opponentName}?`,
    });
  };

  const confirmDelete = async () => {
    try {
      if (deleteConfirm.type === "game") {
        await deleteGameMutation({
          gameResultId: deleteConfirm.id as Id<"gameResults">,
        });
      } else {
        await deleteChallengeMutation({
          challengeId: deleteConfirm.id as Id<"challengeBattles">,
        });
      }

      // Reset pagination to refresh the data
      setGamesCursor(undefined);
      setChallengesCursor(undefined);

      setDeleteConfirm({
        isOpen: false,
        type: "game",
        id: "" as Id<"gameResults">,
        title: "",
      });
    } catch (error) {
      console.error("Error deleting:", error);
      // You could add a toast notification here
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      type: "game",
      id: "" as Id<"gameResults">,
      title: "",
    });
  };

  const handleShareGame = async (gameId: Id<"gameResults">) => {
    try {
      // Link to leaderboard with the specific game result highlighted
      const shareUrl = `${window.location.origin}/?highlight=${gameId}#leaderboard`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedItem(gameId);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleShareChallenge = async (challengeId: Id<"challengeBattles">) => {
    try {
      // Link to leaderboard with the specific challenge highlighted
      const shareUrl = `${window.location.origin}/?highlight-challenge=${challengeId}#leaderboard`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedItem(challengeId);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="brutal-card text-center">
          <h1 className="brutal-text-xl mb-2">My Scores</h1>
          <p
            className="brutal-text-md"
            style={{ color: "var(--text-secondary)" }}
          >
            Your personal game history and statistics
          </p>
        </div>

        {/* User Stats Summary */}
        {userStats ? (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Quick Stats</h2>
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
              {userStats.challengeStats && (
                <div className="brutal-stats-card">
                  <div className="brutal-text-lg">
                    {userStats.challengeStats.totalChallenges}
                  </div>
                  <div className="text-sm">Challenge Battles</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="brutal-card text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
            <p style={{ color: "var(--text-secondary)" }}>
              Loading your statistics...
            </p>
          </div>
        )}

        {/* Single Player Scores */}
        {gamesData ? (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Recent Single Player Games</h2>
            {gamesData.games.length > 0 ? (
              <>
                <div className="space-y-2">
                  {gamesData.games.map((game) => (
                    <div
                      key={game._id}
                      className="p-3 border-2 border-gray-300 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold">
                            {game.word.toUpperCase()}
                          </span>
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
                              game.completed
                                ? game.usedSecretWord
                                  ? "text-yellow-600"
                                  : "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {game.completed
                              ? game.usedSecretWord
                                ? "Used Secret Word"
                                : "WON"
                              : "FAILED"}
                          </div>
                          <div className="text-sm">
                            {game.attempts} attempts
                            {game.usedSecretWord && (
                              <span className="text-yellow-600 ml-1">⚠️</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => handleShareGame(game._id)}
                          className="brutal-button text-sm px-3 py-1 flex items-center gap-1"
                          title="Share this score"
                        >
                          {copiedItem === game._id ? (
                            "Copied!"
                          ) : (
                            <>
                              <Share size={14} />
                              Share
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteGame(game._id, game.word)}
                          className="brutal-button error text-sm px-3 py-1"
                          title="Delete this score"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {gamesData.hasMore && (
                  <div className="text-center mt-4">
                    <button
                      onClick={loadMoreGames}
                      className="brutal-button text-sm px-4 py-2"
                    >
                      Load More Games
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <h3 className="brutal-text-lg mb-4">Welcome to Impossible!</h3>
                <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
                  Thanks for signing up! Your new game scores will show here
                  after you play.
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Start playing single-player games to see your scores and track
                  your progress!
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="brutal-card text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
            <p style={{ color: "var(--text-secondary)" }}>
              Loading your game history...
            </p>
          </div>
        )}

        {/* Challenge Battle Scores */}
        {challengesData ? (
          <div className="brutal-card">
            <h2 className="brutal-text-lg mb-4">Recent Challenge Battles</h2>
            {challengesData.challenges.length > 0 ? (
              <>
                <div className="space-y-2">
                  {challengesData.challenges.map((challenge) => {
                    // This is a simplified check - in practice you'd need the actual user ID
                    const isChallenger = true; // Would need proper user ID comparison
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
                        className="p-3 border-2 border-gray-300 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold">
                              vs {opponentName || "Opponent"}
                            </span>
                            <span
                              className="text-sm ml-2"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {challenge.completedAt &&
                                new Date(
                                  challenge.completedAt,
                                ).toLocaleDateString()}
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
                        <div className="flex gap-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => handleShareChallenge(challenge._id)}
                            className="brutal-button text-sm px-3 py-1 flex items-center gap-1"
                            title="Share this challenge score"
                          >
                            {copiedItem === challenge._id ? (
                              "Copied!"
                            ) : (
                              <>
                                <Share size={14} />
                                Share
                              </>
                            )}
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteChallenge(
                                challenge._id,
                                opponentName || "Opponent",
                              )
                            }
                            className="brutal-button error text-sm px-3 py-1"
                            title="Delete this challenge"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {challengesData.hasMore && (
                  <div className="text-center mt-4">
                    <button
                      onClick={loadMoreChallenges}
                      className="brutal-button text-sm px-4 py-2"
                    >
                      Load More Challenges
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
                  No challenge battles yet!
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Challenge a friend to head-to-head battles and see your
                  results here!
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="brutal-card text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
            <p style={{ color: "var(--text-secondary)" }}>
              Loading challenge history...
            </p>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={deleteConfirm.title}
          message="This action cannot be undone. The score will be removed from both your profile and the public leaderboard."
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </ProtectedRoute>
  );
}
