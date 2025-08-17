import { useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";

export function Dashboard() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { user, isSignedIn } = useUser();

  // Use Clerk's authentication state as primary
  const userIsAuthenticated = isSignedIn && user;

  const analytics = useQuery(
    api.leaderboard.getDashboardAnalytics,
    authIsLoading || !userIsAuthenticated ? "skip" : {},
  );

  if (!analytics) {
    return (
      <div className="space-y-8">
        <div className="brutal-card text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p style={{ color: "var(--text-secondary)" }}>
            Loading dashboard analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="brutal-card text-center">
        <h1
          className="brutal-text-xl mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Admin Dashboard
        </h1>
        <p
          className="brutal-text-md"
          style={{ color: "var(--text-secondary)" }}
        >
          Comprehensive site analytics and game statistics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="brutal-stats-card">
          <div
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {analytics.totalGamesPlayed.toLocaleString()}
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Total Games Played
          </div>
        </div>
        <div className="brutal-stats-card">
          <div
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {analytics.successRate}%
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Success Rate
          </div>
        </div>
        <div className="brutal-stats-card">
          <div
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {analytics.wordsConquered.toLocaleString()}
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Words Conquered
          </div>
        </div>
        <div className="brutal-stats-card">
          <div
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {analytics.uniqueSessions.toLocaleString()}
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Unique Sessions
          </div>
        </div>
      </div>

      {/* Admin Moderation Stats */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Total Moderation Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.adminModeration.totalHidden.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Total Hidden Items
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.adminModeration.totalDeleted.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Total Deleted Items
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {(
                analytics.playerDeletions.deletedGames +
                analytics.playerDeletions.deletedChallenges
              ).toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Player Self-Deletions
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {(
                analytics.adminModeration.hiddenGames +
                analytics.adminModeration.deletedGames +
                analytics.adminModeration.hiddenChallenges +
                analytics.adminModeration.deletedChallenges
              ).toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Admin Moderation Actions
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {(
                analytics.adminModeration.totalHidden +
                analytics.adminModeration.totalDeleted
              ).toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Total Items Moderated (All Sources)
            </div>
          </div>
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {(
                (analytics.adminModeration.totalHidden + analytics.adminModeration.totalDeleted) /
                (analytics.totalGamesPlayed + analytics.challengeMode.totalChallengeBattles) * 100
              ).toFixed(1)}%
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Moderation Rate
            </div>
          </div>
        </div>
      </div>

      {/* Challenge Mode Analytics */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Challenge Mode Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.challengeMode.challengesCreated.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Challenges Created
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.challengeMode.challengesCompleted.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              1v1 Games Completed
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.challengeMode.challengeLinksClicked.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Challenge Links Clicked
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.challengeMode.rematchRequests.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Rematch Requests
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.challengeMode.averageChallengeScore.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Average Challenge Score
            </div>
          </div>
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.challengeMode.topChallengeScore.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Highest Challenge Score
            </div>
          </div>
        </div>
      </div>

      {/* Link Analytics */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Link Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.linkAnalytics.normalModeLinksClicked.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Normal Mode Links Clicked
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Friend invite links used in normal games
            </div>
          </div>
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.linkAnalytics.challengeLinksShared.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Challenge Links Shared
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Total challenge links created and shared
            </div>
          </div>
        </div>
      </div>

      {/* Game Performance */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Game Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.totalSuccessfulGames.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Successful Games
            </div>
          </div>
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.averageAttempts}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Average Attempts
            </div>
          </div>
        </div>
      </div>

      {/* Attempt Breakdown */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Success by Attempt
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.attemptBreakdown.firstAttempt.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              First Attempt Winners
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {analytics.totalSuccessfulGames > 0
                ? Math.round(
                    (analytics.attemptBreakdown.firstAttempt /
                      analytics.totalSuccessfulGames) *
                      100,
                  )
                : 0}
              % of successful games
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.attemptBreakdown.secondAttempt.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Second Attempt Winners
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {analytics.totalSuccessfulGames > 0
                ? Math.round(
                    (analytics.attemptBreakdown.secondAttempt /
                      analytics.totalSuccessfulGames) *
                      100,
                  )
                : 0}
              % of successful games
            </div>
          </div>
          <div className="brutal-stats-card">
            <div
              className="brutal-text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.attemptBreakdown.thirdAttempt.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Third Attempt Winners
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {analytics.totalSuccessfulGames > 0
                ? Math.round(
                    (analytics.attemptBreakdown.thirdAttempt /
                      analytics.totalSuccessfulGames) *
                      100,
                  )
                : 0}
              % of successful games
            </div>
          </div>
        </div>
      </div>

      {/* Player Analytics */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Player Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--text-secondary)" }}>
                Anonymous Games
              </span>
              <span
                className="brutal-text-md"
                style={{ color: "var(--text-primary)" }}
              >
                {analytics.anonymousGames.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--text-secondary)" }}>
                Named Games
              </span>
              <span
                className="brutal-text-md"
                style={{ color: "var(--text-primary)" }}
              >
                {analytics.namedGames.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--text-secondary)" }}>
                Invites Created
              </span>
              <span
                className="brutal-text-md"
                style={{ color: "var(--text-primary)" }}
              >
                {analytics.invitesCreated.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--text-secondary)" }}>
                Hints Requested
              </span>
              <span
                className="brutal-text-md"
                style={{ color: "var(--text-primary)" }}
              >
                {analytics.hintsRequested.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--text-secondary)" }}>
                Clues Requested
              </span>
              <span
                className="brutal-text-md"
                style={{ color: "var(--text-primary)" }}
              >
                {analytics.cluesRequested.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--text-secondary)" }}>
                Friend Suggestions
              </span>
              <span
                className="brutal-text-md"
                style={{ color: "var(--text-primary)" }}
              >
                {analytics.friendSuggestions.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Player Deletions & Admin Moderation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div>
            <h3 className="brutal-text-md mb-4" style={{ color: "var(--text-primary)" }}>
              Player Deletions
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Single-Player Games Deleted
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  {analytics.playerDeletions.deletedGames.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Challenge Battles Deleted
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  {analytics.playerDeletions.deletedChallenges.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                <span style={{ color: "var(--text-secondary)" }}>
                  <strong>Total Player Deletions</strong>
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  <strong>
                    {(
                      analytics.playerDeletions.deletedGames +
                      analytics.playerDeletions.deletedChallenges
                    ).toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="brutal-text-md mb-4" style={{ color: "var(--text-primary)" }}>
              Admin Moderation Actions
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Games Hidden by Admin
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  {analytics.adminModeration.hiddenGames.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Games Deleted by Admin
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  {analytics.adminModeration.deletedGames.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Challenges Hidden by Admin
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  {analytics.adminModeration.hiddenChallenges.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Challenges Deleted by Admin
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  {analytics.adminModeration.deletedChallenges.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                <span style={{ color: "var(--text-secondary)" }}>
                  <strong>Total Admin Actions</strong>
                </span>
                <span
                  className="brutal-text-md"
                  style={{ color: "var(--text-primary)" }}
                >
                  <strong>
                    {(
                      analytics.adminModeration.hiddenGames +
                      analytics.adminModeration.deletedGames +
                      analytics.adminModeration.hiddenChallenges +
                      analytics.adminModeration.deletedChallenges
                    ).toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secret Word Usage */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Secret Word Usage
        </h2>
        <div className="brutal-stats-card">
          <div
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {analytics.secretWordUsage.toLocaleString()}
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Times Secret Word Used
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {analytics.totalGamesPlayed > 0
              ? Math.round(
                  (analytics.secretWordUsage / analytics.totalGamesPlayed) *
                    100,
                )
              : 0}
            % of total games
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {analytics.recentActivity.length > 0 && (
        <div className="brutal-card">
          <h2
            className="brutal-text-lg mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Recent Activity (Last 7 Days)
          </h2>
          <div className="space-y-4">
            {analytics.recentActivity.map((activity) => (
              <div key={activity.date} className="brutal-leaderboard-item">
                <div className="mb-2">
                  <span
                    className="brutal-text-md"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {new Date(activity.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-6 text-sm">
                  <div style={{ color: "var(--text-secondary)" }}>
                    {activity.gamesPlayed} normal games
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {activity.successfulGames} successful
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {activity.challengeBattles || 0} challenge battles
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {activity.gamesPlayed > 0
                      ? Math.round(
                          (activity.successfulGames / activity.gamesPlayed) *
                            100,
                        )
                      : 0}
                    % success
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="brutal-card text-center py-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Dashboard data updates in real-time. All statistics exclude
          test/invalid data.
        </p>
      </div>
    </div>
  );
}
