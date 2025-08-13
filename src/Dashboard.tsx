import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function Dashboard() {
  const analytics = useQuery(api.leaderboard.getDashboardAnalytics);

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

      {/* Game Performance */}
      <div className="brutal-card">
        <h2
          className="brutal-text-lg mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Game Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <div className="text-center">
            <div
              className="brutal-text-xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {analytics.totalHomepageViews.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Homepage Views
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
                    {activity.gamesPlayed} games
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {activity.successfulGames} successful
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
