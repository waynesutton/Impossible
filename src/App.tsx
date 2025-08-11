import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Leaderboard } from "./Leaderboard";
import { ImpossibleGame } from "./ImpossibleGame";
import { HelperGame } from "./HelperGame";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Id } from "../convex/_generated/dataModel";

interface GameCompletionData {
  won: boolean;
  word: string;
  attempts: number;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<
    "game" | "leaderboard" | "playing" | "helper"
  >("game");
  const [gameCompletionData, setGameCompletionData] =
    useState<GameCompletionData | null>(null);
  const [inviteId, setInviteId] = useState<Id<"invites"> | null>(null);
  const startNewGame = useMutation(api.game.startNewGame);

  // Check for invite parameter on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
      setInviteId(invite as Id<"invites">);
      setCurrentPage("helper");
    }
  }, []);

  const handleBeginGame = async () => {
    try {
      await startNewGame();
      setCurrentPage("playing");
      setGameCompletionData(null); // Clear any previous completion data
      console.log("New game started!");
    } catch (error) {
      console.error("Failed to start new game:", error);
    }
  };

  const handleGameComplete = (data: GameCompletionData) => {
    console.log("Game completed:", data);
    setGameCompletionData(data);
    setCurrentPage("leaderboard");
  };

  const handleStartNewGameFromLeaderboard = async () => {
    try {
      await startNewGame();
      setGameCompletionData(null);
      setCurrentPage("playing");
    } catch (error) {
      console.error("Failed to start new game:", error);
    }
  };
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      <header className="brutal-header sticky top-0 z-10 h-16 flex justify-between items-center px-4">
        <a
          href="/"
          className="brutal-text-lg"
          style={{ color: "var(--text-primary)" }}
        >
          Impossible
        </a>
        <div className="flex items-center gap-4">
          <nav className="flex gap-2">
            <button
              onClick={() => setCurrentPage("game")}
              className={`brutal-nav-button ${
                currentPage === "game" ? "active" : ""
              }`}
            >
              Game
            </button>
            <button
              onClick={() => {
                setCurrentPage("leaderboard");
                setGameCompletionData(null); // Clear completion data when manually navigating to leaderboard
              }}
              className={`brutal-nav-button ${
                currentPage === "leaderboard" ? "active" : ""
              }`}
            >
              Leaderboard
            </button>
          </nav>
          <ThemeSwitcher />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md mx-auto">
          {currentPage === "game" ? (
            <div className="text-center space-y-8">
              <div className="brutal-card">
                <h1
                  className="brutal-text-xl mb-4"
                  style={{ color: "var(--text-primary)" }}
                >
                  Impossible
                </h1>
                <p
                  className="brutal-text-md mb-6"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Guess the impossible word. 3 attempts.
                </p>
                <button
                  onClick={handleBeginGame}
                  className="brutal-button px-8 py-4 text-lg"
                >
                  Begin
                </button>
              </div>

              {/* How to Play */}
              <div className="brutal-card text-left space-y-4">
                <h3
                  className="brutal-text-lg text-center mb-6"
                  style={{ color: "var(--text-primary)" }}
                >
                  How to Play
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="brutal-badge">🎯</span>
                    <div>
                      <strong
                        className="brutal-text-md"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Goal:
                      </strong>
                      <p style={{ color: "var(--text-secondary)" }}>
                        Guess the impossible word
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="brutal-badge">🔢</span>
                    <div>
                      <strong
                        className="brutal-text-md"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Attempts:
                      </strong>
                      <p style={{ color: "var(--text-secondary)" }}>
                        You get 3 tries to solve it
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="brutal-badge">💡</span>
                    <div>
                      <strong
                        className="brutal-text-md"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Hints:
                      </strong>
                      <p style={{ color: "var(--text-secondary)" }}>
                        Available after 2 failed attempts
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="brutal-badge">👥</span>
                    <div>
                      <strong
                        className="brutal-text-md"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Friends:
                      </strong>
                      <p style={{ color: "var(--text-secondary)" }}>
                        Invite friends to suggest words for you
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="brutal-badge">🆕</span>
                    <div>
                      <strong
                        className="brutal-text-md"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Fresh:
                      </strong>
                      <p style={{ color: "var(--text-secondary)" }}>
                        New impossible word every game!
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="text-center mt-6 pt-4"
                  style={{
                    borderTop: "var(--border-width) solid var(--border-color)",
                  }}
                >
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Each game has a unique impossible word!
                  </p>
                </div>
              </div>
            </div>
          ) : currentPage === "playing" ? (
            <ImpossibleGame onGameComplete={handleGameComplete} />
          ) : currentPage === "helper" && inviteId ? (
            <HelperGame inviteId={inviteId} />
          ) : (
            <Leaderboard
              gameCompletionData={gameCompletionData}
              onStartNewGame={handleStartNewGameFromLeaderboard}
            />
          )}
        </div>
      </main>

      <footer className="brutal-header py-4">
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Cooked by{" "}
            <a
              href="https://chef.convex.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="brutal-text-md hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              Chef by Convex
            </a>
          </p>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
