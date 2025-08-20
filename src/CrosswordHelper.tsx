import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

interface CrosswordHelperProps {
  inviteId: string;
  onBackToHome: () => void;
}

export function CrosswordHelper({
  inviteId,
  onBackToHome,
}: CrosswordHelperProps) {
  const inviteInfo = useQuery(api.crossword.getCrosswordInviteInfo, {
    inviteId,
  });
  const submitSuggestion = useMutation(api.crossword.submitCrosswordSuggestion);

  // Poll for real-time updates of the main player's progress
  const liveProgress = useQuery(
    api.crossword.getCrosswordLiveState,
    inviteId ? { inviteId } : "skip",
  );

  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [helperName, setHelperName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  // Load helper name from localStorage
  useEffect(() => {
    const storedName = localStorage.getItem(`crossword_helper_${inviteId}`);
    if (storedName) {
      setHelperName(storedName);
      setHasJoined(true);
    }
  }, [inviteId]);

  const handleJoin = () => {
    if (!helperName.trim()) return;
    localStorage.setItem(`crossword_helper_${inviteId}`, helperName);
    setHasJoined(true);
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestion.trim() || selectedWord === null) return;

    try {
      setIsSubmitting(true);
      await submitSuggestion({
        inviteId,
        wordNumber: selectedWord,
        suggestion: suggestion.toUpperCase(),
        helperName,
      });
      setSuggestion("");
      setSelectedWord(null);
    } catch (error) {
      console.error("Failed to send suggestion:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render live grid with real-time progress
  const renderLiveGrid = () => {
    if (!inviteInfo || !liveProgress) {
      return (
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p style={{ color: "var(--text-secondary)" }}>Loading live grid...</p>
        </div>
      );
    }

    const gridSize = liveProgress.gridSize || 7;

    // Build live grid from current progress
    const liveGrid = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(""));

    // Fill in letters from the main player's current progress
    if (liveProgress.userProgress?.currentProgress) {
      liveProgress.userProgress.currentProgress.forEach((progress: any) => {
        const wordPos = liveProgress.wordPositions[progress.wordIndex];
        if (wordPos && progress.letters) {
          progress.letters.forEach((letter: string, index: number) => {
            if (letter) {
              const row =
                wordPos.direction === "across"
                  ? wordPos.startRow
                  : wordPos.startRow + index;
              const col =
                wordPos.direction === "across"
                  ? wordPos.startCol + index
                  : wordPos.startCol;

              if (row < gridSize && col < gridSize) {
                liveGrid[row][col] = letter.toUpperCase();
              }
            }
          });
        }
      });
    }

    return (
      <div
        className="crossword-grid mx-auto"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        }}
      >
        {liveGrid.map((row: string[], rowIndex: number) =>
          row.map((cell: string, colIndex: number) => {
            const isWordCell = liveProgress.wordPositions?.some((pos: any) => {
              if (pos.direction === "across") {
                return (
                  rowIndex === pos.startRow &&
                  colIndex >= pos.startCol &&
                  colIndex < pos.startCol + pos.word.length
                );
              } else {
                return (
                  colIndex === pos.startCol &&
                  rowIndex >= pos.startRow &&
                  rowIndex < pos.startRow + pos.word.length
                );
              }
            });

            const clueNumber = liveProgress.wordPositions?.find(
              (pos: any) =>
                pos.startRow === rowIndex && pos.startCol === colIndex,
            )?.clueNumber;

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`crossword-cell ${
                  !isWordCell ? "blocked" : cell ? "filled" : "empty"
                }`}
              >
                {clueNumber && (
                  <span className="clue-number">{clueNumber}</span>
                )}
                {isWordCell && <div className="cell-input">{cell}</div>}
              </div>
            );
          }),
        )}
      </div>
    );
  };

  if (!inviteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="brutal-card text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p>Loading crossword...</p>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card max-w-md w-full text-center">
          <h1 className="brutal-text-xl mb-4">Help Solve Crossword</h1>
          <p
            className="brutal-text-md mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            {inviteInfo.creatorName} needs your help with today's impossible
            crossword!
          </p>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter your name"
              value={helperName}
              onChange={(e) => setHelperName(e.target.value)}
              className="brutal-input w-full"
              maxLength={20}
            />
            <button
              onClick={handleJoin}
              disabled={!helperName.trim()}
              className="brutal-button w-full px-6 py-3"
            >
              Join as Helper
            </button>
          </div>

          <button
            onClick={onBackToHome}
            className="brutal-button secondary mt-4 px-4 py-2"
          >
            Back to Game
          </button>
        </div>
      </div>
    );
  }

  if (inviteInfo.isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card max-w-md w-full text-center">
          <h1 className="brutal-text-xl mb-4">Game Over!</h1>
          <p
            className="brutal-text-md mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            {inviteInfo.creatorName} has completed the crossword!
          </p>
          <p
            className="brutal-text-md mb-6"
            style={{ color: "var(--text-success)" }}
          >
            🎉 Crossword Solved!
          </p>

          <button
            onClick={onBackToHome}
            className="brutal-button w-full px-6 py-3"
          >
            Back to Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="brutal-card text-center">
          <h1 className="brutal-text-xl mb-2">Help Solve Crossword</h1>
          <p
            className="brutal-text-md mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Helping <strong>{inviteInfo.creatorName}</strong> with today's
            crossword puzzle
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            You're signed in as: <strong>{helperName}</strong>
          </p>
        </div>

        {/* Crossword Grid - Live Updates */}
        <div className="brutal-card">
          <h2 className="brutal-text-lg mb-4">
            Crossword Grid
            <span
              className="text-sm ml-2"
              style={{ color: "var(--text-secondary)" }}
            >
              (Live updates from {inviteInfo.creatorName})
            </span>
          </h2>
          {renderLiveGrid()}
        </div>

        {/* Suggestion Form */}
        <div className="brutal-card">
          <h2 className="brutal-text-lg mb-4">Send Suggestion</h2>
          <div className="space-y-4">
            <div>
              <label className="block brutal-text-md mb-2">Select Word:</label>
              <select
                value={selectedWord || ""}
                onChange={(e) =>
                  setSelectedWord(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="brutal-input w-full"
              >
                <option value="">Choose a word...</option>
                {inviteInfo.clues?.map((clue: any) => (
                  <option key={clue.number} value={clue.number}>
                    {clue.number}. {clue.clue} ({clue.direction})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block brutal-text-md mb-2">
                Your Suggestion:
              </label>
              <input
                type="text"
                placeholder="Enter your word suggestion"
                value={suggestion}
                onChange={(e) =>
                  setSuggestion(
                    e.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
                  )
                }
                className="brutal-input w-full"
                maxLength={15}
              />
            </div>

            <button
              onClick={handleSubmitSuggestion}
              disabled={
                !suggestion.trim() || selectedWord === null || isSubmitting
              }
              className="brutal-button w-full px-6 py-3"
            >
              {isSubmitting ? "Sending..." : "Send Suggestion"}
            </button>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <button
            onClick={onBackToHome}
            className="brutal-button secondary px-6 py-3"
          >
            Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}
