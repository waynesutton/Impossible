import { Toaster } from "sonner";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Leaderboard } from "./Leaderboard";
import { ImpossibleGame } from "./ImpossibleGame";

interface GameCompletionData {
  won: boolean;
  word: string;
  attempts: number;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<
    "game" | "leaderboard" | "playing"
  >("game");
  const [gameCompletionData, setGameCompletionData] =
    useState<GameCompletionData | null>(null);
  const startNewGame = useMutation(api.game.startNewGame);

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <a href="/" className="text-xl font-semibold text-gray-800">
          Impossible
        </a>
        <nav className="flex gap-4">
          <button
            onClick={() => setCurrentPage("game")}
            className={`px-3 py-1 rounded transition-colors ${
              currentPage === "game"
                ? "bg-black text-white"
                : "text-gray-600 hover:text-black"
            }`}
          >
            Game
          </button>
          <button
            onClick={() => {
              setCurrentPage("leaderboard");
              setGameCompletionData(null); // Clear completion data when manually navigating to leaderboard
            }}
            className={`px-3 py-1 rounded transition-colors ${
              currentPage === "leaderboard"
                ? "bg-black text-white"
                : "text-gray-600 hover:text-black"
            }`}
          >
            Leaderboard
          </button>
        </nav>
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md mx-auto">
          {currentPage === "game" ? (
            <div className="text-center">
              <h1 className="text-5xl font-bold text-gray-800 mb-4">
                Impossible
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Guess the impossible word. 3 attempts.
              </p>
              <button
                onClick={handleBeginGame}
                className="bg-black text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Begin
              </button>

              {/* How to Play */}
              <div className="mt-8 text-left bg-gray-100 rounded-lg p-6 space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 text-center mb-4">
                  How to Play
                </h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <strong>🎯 Goal:</strong> Guess the impossible word
                  </p>
                  <p>
                    <strong>🔢 Attempts:</strong> You get 3 tries to solve it
                  </p>
                  <p>
                    <strong>💡 Hints:</strong> Available after 2 failed attempts
                  </p>
                  <p>
                    <strong>👥 Friends:</strong> Invite friends to suggest words
                    for you
                  </p>
                  <p>
                    <strong>🆕 Fresh:</strong> New impossible word every game!
                  </p>
                </div>
                <div className="text-center mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Each game has a unique impossible word!
                  </p>
                </div>
              </div>
            </div>
          ) : currentPage === "playing" ? (
            <ImpossibleGame onGameComplete={handleGameComplete} />
          ) : (
            <Leaderboard
              gameCompletionData={gameCompletionData}
              onStartNewGame={handleStartNewGameFromLeaderboard}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 py-4">
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Cooked by{" "}
            <a
              href="https://chef.convex.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:underline font-medium"
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
