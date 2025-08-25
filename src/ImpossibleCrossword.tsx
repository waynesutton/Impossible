import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { ConfirmDialog } from "./components/ConfirmDialog";

const CrosswordLoader = () => (
  <div className="brutal-card text-center max-w-md mx-auto">
    <div className="crossword-loader-container mx-auto mb-4">
      <div
        className="crossword-grid animate-pulse"
        style={{ gridTemplateColumns: `repeat(7, 1fr)` }}
      >
        {Array.from({ length: 49 }).map((_, i) => (
          <div
            key={i}
            className="crossword-cell empty !bg-gray-300 dark:!bg-gray-700"
          ></div>
        ))}
      </div>
    </div>
    <p className="brutal-text-md" style={{ color: "var(--text-secondary)" }}>
      Generating your new crossword...
    </p>
  </div>
);

interface ImpossibleCrosswordProps {
  onGameComplete?: (data: {
    completed: boolean;
    timeMinutes: number;
    hintsUsed: number;
    cluesUsed: number;
    finalScore: number;
    usedSecretCode: boolean;
  }) => void;
}

interface WordPosition {
  word: string;
  startRow: number;
  startCol: number;
  direction: "across" | "down";
  clueNumber: number;
}

// Removed ClueData interface - no longer needed for simplified gameplay

export function ImpossibleCrossword({
  onGameComplete,
}: ImpossibleCrosswordProps) {
  const [selectedClue, setSelectedClue] = useState<number | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<"across" | "down">(
    "across",
  );
  const [grid, setGrid] = useState<string[][]>([]);
  const [startTime] = useState(Date.now());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current crossword with conditional querying for refresh
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const currentCrossword = useQuery(
    api.crossword.getCurrentCrossword,
    refreshTrigger >= 0 ? {} : "skip",
  );

  // Get friend suggestions
  const suggestions = useQuery(
    api.crossword.getCrosswordSuggestions,
    currentCrossword ? { puzzleId: currentCrossword.puzzleId } : "skip",
  );

  // Mutations
  const startCrosswordGame = useMutation(api.crossword.startCrosswordGame);
  const updateProgress = useMutation(api.crossword.updateCrosswordProgress);
  const createInvite = useMutation(api.crossword.createCrosswordInvite);
  const useSuggestion = useMutation(api.crossword.useCrosswordSuggestion);

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isStartingNewCrossword, setIsStartingNewCrossword] =
    useState<boolean>(false);
  const [localCompletedWords, setLocalCompletedWords] = useState<Set<number>>(
    new Set(),
  );
  const [completionMessage, setCompletionMessage] = useState<string | null>(
    null,
  );
  const [submissionNotification, setSubmissionNotification] = useState<{
    show: boolean;
    message: string;
    isCorrect: boolean;
  }>({ show: false, message: "", isCorrect: false });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(true);
  // Removed interactive hint/clue system for simplified gameplay
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false);
  const initialLoadRef = useRef(true); // Ref to prevent re-initialization

  // Debounced progress update for real-time sync - REMOVED FOR SIMPLICITY AND RELIABILITY

  // Function to initialize crossword, wrapped in useCallback to stabilize its identity
  const initializeCrossword = useCallback(
    async (forceNew = false) => {
      if ((currentCrossword === null && !isGenerating) || forceNew) {
        try {
          setIsGenerating(true);
          setGenerationError(null);
          if (forceNew) {
            setIsStartingNewCrossword(true);
          }

          // Clear current state when starting new game
          if (forceNew) {
            setLocalCompletedWords(new Set());
          }

          const result = await startCrosswordGame({ forceNew });
          if (!result.puzzleReady) {
            console.log("Crossword generation started...");

            // Clear any existing poller before starting a new one
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            // Start polling for the new puzzle
            pollIntervalRef.current = setInterval(() => {
              console.log("Polling for new crossword...");
              setRefreshTrigger((prev) => prev + 1);
            }, 1000); // Poll every second
          } else {
            setIsGenerating(false);
            setIsStartingNewCrossword(false);
            if (forceNew) {
              setRefreshTrigger((prev) => prev + 1);
            }
          }
        } catch (error: any) {
          console.error("Error starting crossword:", error);
          const errorMessage =
            error.message?.includes("AI_CROSSWORD_GENERATION_FAILED") ||
            error.message?.includes("AI failed")
              ? "AI failed"
              : error.message || "Failed to start crossword generation";
          setGenerationError(errorMessage);
          setIsGenerating(false);
          setIsStartingNewCrossword(false);
        }
      }
    },
    [startCrosswordGame, currentCrossword, isGenerating],
  );

  // This effect now only runs on initial load if a crossword is needed.
  useEffect(() => {
    if (initialLoadRef.current && currentCrossword === null && !isGenerating) {
      initializeCrossword();
      initialLoadRef.current = false; // This ensures it only runs once
    }
  }, [currentCrossword, isGenerating, initializeCrossword]);

  // This effect now correctly handles stopping the poll and timeouts
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (isGenerating) {
      // If a crossword appears while we're generating, stop the poll.
      if (currentCrossword) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsGenerating(false);
        setIsStartingNewCrossword(false);
        console.log("New crossword found, stopping poll.");
      } else {
        // If still generating, set a timeout to prevent infinite polling.
        timeoutId = setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setGenerationError("Generation timed out. Please try again.");
            setIsGenerating(false);
            setIsStartingNewCrossword(false);
            console.error("Crossword generation timed out.");
          }
        }, 15000); // 15-second timeout
      }
    }

    return () => {
      // Cleanup timeout on component unmount or dependency change
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentCrossword, isGenerating]);

  // Initialize grid when crossword loads
  useEffect(() => {
    if (currentCrossword?.gridSize) {
      // Validate crossword structure before using it
      const validationErrors: string[] = [];

      // Check grid size is exactly 7x7
      if (currentCrossword.gridSize !== 7) {
        validationErrors.push(
          `Invalid grid size: ${currentCrossword.gridSize}, expected 7`,
        );
      }

      // Validate each word position
      currentCrossword.wordPositions.forEach(
        (wordPos: WordPosition, index: number) => {
          const word = wordPos.word; // Use word from wordPos, not from separate words array
          if (!word) {
            validationErrors.push(`Missing word for position ${index}`);
            return;
          }

          // Check word length constraint (3-6 letters)
          if (word.length < 3 || word.length > 6) {
            validationErrors.push(
              `Word "${word}" has invalid length ${word.length} (must be 3-6)`,
            );
          }

          // Check if word fits in grid bounds
          if (wordPos.direction === "across") {
            if (wordPos.startCol + word.length > 7) {
              validationErrors.push(
                `Word "${word}" (across) exceeds grid width: starts at col ${wordPos.startCol}, length ${word.length}`,
              );
            }
            if (wordPos.startRow >= 7) {
              validationErrors.push(
                `Word "${word}" (across) starts outside grid: row ${wordPos.startRow}`,
              );
            }
          } else if (wordPos.direction === "down") {
            if (wordPos.startRow + word.length > 7) {
              validationErrors.push(
                `Word "${word}" (down) exceeds grid height: starts at row ${wordPos.startRow}, length ${word.length}`,
              );
            }
            if (wordPos.startCol >= 7) {
              validationErrors.push(
                `Word "${word}" (down) starts outside grid: col ${wordPos.startCol}`,
              );
            }
          }
        },
      );

      if (validationErrors.length > 0) {
        console.error(
          "Frontend crossword validation failed:",
          validationErrors,
        );
        console.error("Crossword data:", {
          gridSize: currentCrossword.gridSize,
          wordPositions: currentCrossword.wordPositions,
          wordsCount: currentCrossword.wordPositions?.length || 0,
        });

        // If it's an old 15x15 puzzle, force generation of a new 7x7 puzzle
        if (
          validationErrors.some((error) =>
            error.includes("Invalid grid size: 15"),
          )
        ) {
          console.log(
            "Detected old 15x15 puzzle, forcing new 7x7 generation...",
          );
          setGenerationError(null);
          initializeCrossword(true); // Force new puzzle generation
          return;
        }

        setGenerationError(
          `Invalid crossword received: ${validationErrors.join("; ")}`,
        );
        return;
      }

      // Create empty grid
      const newGrid = Array(currentCrossword.gridSize)
        .fill(null)
        .map(() => Array(currentCrossword.gridSize).fill(""));

      // Fill in user progress if available
      if (currentCrossword.userProgress?.currentProgress) {
        currentCrossword.userProgress.currentProgress.forEach((progress) => {
          const wordPos = currentCrossword.wordPositions[progress.wordIndex];
          if (wordPos) {
            progress.letters.forEach((letter, index) => {
              if (letter) {
                const row =
                  wordPos.direction === "across"
                    ? wordPos.startRow
                    : wordPos.startRow + index;
                const col =
                  wordPos.direction === "across"
                    ? wordPos.startCol + index
                    : wordPos.startCol;
                if (row < newGrid.length && col < newGrid[0].length) {
                  newGrid[row][col] = letter.toUpperCase();
                }
              }
            });
          }
        });
      }

      setGrid(newGrid);
      setLocalCompletedWords(new Set());
    }
  }, [currentCrossword]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      // Also clear polling interval on unmount
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Check if crossword is already completed
  if (currentCrossword && currentCrossword.userProgress?.completed) {
    const solvedGrid = Array(currentCrossword.gridSize)
      .fill(null)
      .map(() => Array(currentCrossword.gridSize).fill(""));

    currentCrossword.wordPositions.forEach((pos: WordPosition) => {
      for (let i = 0; i < pos.word.length; i++) {
        const letterRow =
          pos.direction === "across" ? pos.startRow : pos.startRow + i;
        const letterCol =
          pos.direction === "across" ? pos.startCol + i : pos.startCol;
        if (
          solvedGrid[letterRow] &&
          solvedGrid[letterRow][letterCol] !== undefined
        ) {
          solvedGrid[letterRow][letterCol] = pos.word[i].toUpperCase();
        }
      }
    });

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card text-center max-w-2xl">
          <h2 className="brutal-text-xl mb-4">🎉 Crossword Complete!</h2>
          <p
            className="brutal-text-md mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            Congratulations! You can now play unlimited crosswords. Here's your
            completed puzzle:
          </p>

          <div className="mb-6 flex justify-center">
            <div
              className="crossword-grid"
              style={{
                gridTemplateColumns: `repeat(${currentCrossword.gridSize}, 1fr)`,
              }}
            >
              {solvedGrid.map((row: string[], rowIndex: number) =>
                row.map((cell: string, colIndex: number) => {
                  const isWordCell = currentCrossword.wordPositions.some(
                    (pos: WordPosition) => {
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
                    },
                  );

                  const clueNumber = currentCrossword.wordPositions.find(
                    (pos: WordPosition) =>
                      pos.startRow === rowIndex && pos.startCol === colIndex,
                  )?.clueNumber;

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`crossword-cell ${isWordCell ? "correct-word" : "empty"}`}
                    >
                      {clueNumber && (
                        <span className="clue-number">{clueNumber}</span>
                      )}
                      {isWordCell && <div className="cell-letter">{cell}</div>}
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <button
            onClick={() => initializeCrossword(true)}
            className="brutal-button px-8 py-4 mb-4"
            disabled={isStartingNewCrossword}
            style={{
              background: "var(--bg-success)",
              border: "3px solid var(--border-success)",
              color: "var(--text-success)",
            }}
          >
            {isStartingNewCrossword ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </div>
            ) : (
              "🎉 Play Another Crossword!"
            )}
          </button>
          <button
            onClick={() =>
              onGameComplete?.({
                completed: false,
                timeMinutes: 0,
                hintsUsed: 0,
                cluesUsed: 0,
                finalScore: 0,
                usedSecretCode: false,
              })
            }
            className="brutal-button secondary px-6 py-3"
          >
            Back to Game
          </button>
        </div>
      </div>
    );
  }

  // Check if crossword has expired
  if (currentCrossword && Date.now() > currentCrossword.expiresAt) {
    const solvedGrid = Array(currentCrossword.gridSize)
      .fill(null)
      .map(() => Array(currentCrossword.gridSize).fill(""));

    currentCrossword.wordPositions.forEach((pos: WordPosition) => {
      for (let i = 0; i < pos.word.length; i++) {
        const letterRow =
          pos.direction === "across" ? pos.startRow : pos.startRow + i;
        const letterCol =
          pos.direction === "across" ? pos.startCol + i : pos.startCol;
        if (
          solvedGrid[letterRow] &&
          solvedGrid[letterRow][letterCol] !== undefined
        ) {
          solvedGrid[letterRow][letterCol] = pos.word[i].toUpperCase();
        }
      }
    });

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card text-center max-w-2xl">
          <h2 className="brutal-text-xl mb-4">Previous Crossword</h2>
          <p
            className="brutal-text-md mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            Ready for a new challenge? Here's what the previous puzzle looked
            like:
          </p>

          <div className="mb-6 flex justify-center">
            <div
              className="crossword-grid"
              style={{
                gridTemplateColumns: `repeat(${currentCrossword.gridSize}, 1fr)`,
              }}
            >
              {solvedGrid.map((row: string[], rowIndex: number) =>
                row.map((cell: string, colIndex: number) => {
                  const isWordCell = currentCrossword.wordPositions.some(
                    (pos: WordPosition) => {
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
                    },
                  );

                  const clueNumber = currentCrossword.wordPositions.find(
                    (pos: WordPosition) =>
                      pos.startRow === rowIndex && pos.startCol === colIndex,
                  )?.clueNumber;

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`crossword-cell ${isWordCell ? "correct-word" : "empty"}`}
                    >
                      {clueNumber && (
                        <span className="clue-number">{clueNumber}</span>
                      )}
                      {isWordCell && <div className="cell-letter">{cell}</div>}
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <button
            onClick={() => initializeCrossword(true)}
            className="brutal-button px-8 py-4 mb-4"
            disabled={isStartingNewCrossword}
            style={{
              background: "var(--bg-accent)",
              border: "3px solid var(--border-accent)",
              color: "var(--text-accent)",
            }}
          >
            {isStartingNewCrossword ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </div>
            ) : (
              "🆕 Start New Crossword"
            )}
          </button>
          <button
            onClick={() =>
              onGameComplete?.({
                completed: false,
                timeMinutes: 0,
                hintsUsed: 0,
                cluesUsed: 0,
                finalScore: 0,
                usedSecretCode: false,
              })
            }
            className="brutal-button secondary px-6 py-3"
          >
            Back to Game
          </button>
        </div>
      </div>
    );
  }

  if (!currentCrossword) {
    if (isGenerating || isStartingNewCrossword) {
      return <CrosswordLoader />;
    }
    return (
      <div className="brutal-card text-center">
        {!generationError && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        )}
        <p
          style={{
            color: generationError
              ? "var(--text-error)"
              : "var(--text-secondary)",
          }}
        >
          {generationError || "Loading your crossword..."}
        </p>
        {generationError && (
          <div className="mt-4">
            <button
              onClick={() => {
                setGenerationError(null);
                setIsGenerating(false);
                initializeCrossword(true); // Force new generation on retry
              }}
              className="brutal-button px-4 py-2"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  // Removed cluesData preparation - no longer needed for simplified gameplay

  // Check if a cell is part of any word
  const isWordCell = (row: number, col: number) => {
    return currentCrossword.wordPositions.some((pos: WordPosition) => {
      if (pos.direction === "across") {
        return (
          row === pos.startRow &&
          col >= pos.startCol &&
          col < pos.startCol + pos.word.length
        );
      } else {
        return (
          col === pos.startCol &&
          row >= pos.startRow &&
          row < pos.startRow + pos.word.length
        );
      }
    });
  };

  const handleSubmitWord = async () => {
    if (!selectedClue || !currentCrossword || !grid.length) return;

    const wordPos = currentCrossword.wordPositions.find(
      (pos: WordPosition) =>
        pos.clueNumber === selectedClue && pos.direction === selectedDirection,
    );

    if (!wordPos) return;

    const wordIndex = currentCrossword.wordPositions.indexOf(wordPos);
    if (wordIndex === -1) return;

    // Get current letters for this word from the grid
    const wordLetters: string[] = [];
    for (let i = 0; i < wordPos.word.length; i++) {
      const row =
        wordPos.direction === "across"
          ? wordPos.startRow
          : wordPos.startRow + i;
      const col =
        wordPos.direction === "across"
          ? wordPos.startCol + i
          : wordPos.startCol;
      wordLetters.push(grid[row]?.[col] || "");
    }

    // Check if word is completed (all letters filled and correct)
    const userWord = wordLetters.join("").toLowerCase();
    const correctWord = wordPos.word.toLowerCase();
    const isCompleted =
      userWord === correctWord && userWord.length === correctWord.length;

    // Show notification
    if (isCompleted) {
      setSubmissionNotification({
        show: true,
        message: `🎉 "${correctWord.toUpperCase()}" is correct! Fits the ${currentCrossword.theme} theme perfectly!`,
        isCorrect: true,
      });
      setLocalCompletedWords((prev) => new Set([...prev, wordIndex]));
      setSelectedClue(null); // Deselect to show completion
    } else {
      setSubmissionNotification({
        show: true,
        message: `❌ "${userWord.toUpperCase() || "incomplete"}" is not correct. Keep trying for the ${currentCrossword.theme} theme!`,
        isCorrect: false,
      });
    }

    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      setSubmissionNotification({ show: false, message: "", isCorrect: false });
    }, 3000);

    // Update progress in backend
    await updateProgress({
      wordIndex,
      letters: wordLetters,
      isCompleted,
    });

    // Check if entire crossword is completed
    if (isCompleted) {
      checkCrosswordCompletion(wordIndex);
    }
  };

  const handleCreateInvite = async () => {
    try {
      const inviteId = await createInvite();
      const link = `${window.location.origin}?crossword-invite=${inviteId}`;
      setInviteLink(link);
    } catch (error) {
      console.error("Error creating invite:", error);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      // Fallback for mobile
      const textArea = document.createElement("textarea");
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  const handleUseSuggestion = async (suggestionId: any) => {
    try {
      const result = await useSuggestion({ suggestionId });
      if (result.success) {
        // Apply the suggestion to the grid
        const wordPos = currentCrossword.wordPositions[result.wordIndex];
        if (wordPos) {
          const newGrid = [...grid];
          const suggestionLetters = result.suggestion.toUpperCase().split("");

          // Fill in the suggestion
          for (
            let i = 0;
            i < Math.min(suggestionLetters.length, wordPos.word.length);
            i++
          ) {
            const row =
              wordPos.direction === "across"
                ? wordPos.startRow
                : wordPos.startRow + i;
            const col =
              wordPos.direction === "across"
                ? wordPos.startCol + i
                : wordPos.startCol;
            if (newGrid[row] && newGrid[row][col] !== undefined) {
              newGrid[row][col] = suggestionLetters[i];
            }
          }

          setGrid(newGrid);

          // Update progress
          await updateProgress({
            wordIndex: result.wordIndex,
            letters: suggestionLetters.slice(0, wordPos.word.length),
            isCompleted:
              result.suggestion.toLowerCase() === wordPos.word.toLowerCase(),
          });
        }
      }
    } catch (error) {
      console.error("Error using suggestion:", error);
    }
  };

  // Removed hint/clue handlers for simplified gameplay

  const handleStartOver = () => {
    setShowStartOverConfirm(true);
  };

  const renderSuggestions = () => {
    if (!suggestions || suggestions.length === 0 || !showSuggestions)
      return null;

    const unusedSuggestions = suggestions.filter((s) => !s.used);
    if (unusedSuggestions.length === 0) return null;

    return (
      <div className="brutal-card" style={{ background: "var(--bg-surface)" }}>
        <div className="flex justify-between items-center mb-4">
          <div
            className="brutal-text-md"
            style={{ color: "var(--text-primary)" }}
          >
            Friend Suggestions:
          </div>
          <button
            onClick={() => setShowSuggestions(false)}
            className="brutal-button secondary text-xs px-2 py-1"
            style={{
              background: "var(--bg-error)",
              color: "var(--text-inverse)",
            }}
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          {unusedSuggestions.map((suggestion) => {
            const wordPos =
              currentCrossword.wordPositions[suggestion.wordIndex];
            const clueNumber = wordPos?.clueNumber;
            const direction = wordPos?.direction;

            return (
              <div
                key={suggestion._id}
                className="brutal-leaderboard-item flex items-center justify-between"
              >
                <div>
                  <span
                    className="brutal-badge mr-2"
                    style={{
                      background: "var(--bg-accent)",
                      color: "var(--text-inverse)",
                    }}
                  >
                    {suggestion.suggestion}
                  </span>
                  <span
                    className="brutal-text-md mr-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    from {suggestion.helperName}
                  </span>
                  {clueNumber && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      (for {clueNumber} {direction})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleUseSuggestion(suggestion._id)}
                  className="brutal-button secondary px-3 py-1 text-sm"
                >
                  Try
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleCellClick = (row: number, col: number) => {
    if (!currentCrossword || !grid.length || !isWordCell(row, col)) return;

    // Find all words this cell belongs to
    const possibleWords = currentCrossword.wordPositions.filter(
      (pos: WordPosition) => {
        if (pos.direction === "across") {
          return (
            row === pos.startRow &&
            col >= pos.startCol &&
            col < pos.startCol + pos.word.length
          );
        } else {
          return (
            col === pos.startCol &&
            row >= pos.startRow &&
            row < pos.startRow + pos.word.length
          );
        }
      },
    );

    if (possibleWords.length === 0) return;

    // Simple selection: if clicking same word, toggle direction. Otherwise, pick first available.
    let selectedWord = possibleWords[0];

    if (possibleWords.length > 1) {
      // If current selection is one of the words at this cell, toggle to the other
      const currentWord = possibleWords.find(
        (pos: WordPosition) =>
          pos.clueNumber === selectedClue &&
          pos.direction === selectedDirection,
      );

      if (currentWord) {
        // Toggle to the other word
        selectedWord =
          possibleWords.find((pos: WordPosition) => pos !== currentWord) ||
          possibleWords[0];
      } else {
        // Default preference: across first
        selectedWord =
          possibleWords.find(
            (pos: WordPosition) => pos.direction === "across",
          ) || possibleWords[0];
      }
    }

    setSelectedClue(selectedWord.clueNumber);
    setSelectedDirection(selectedWord.direction);
  };

  const handleCellInput = async (row: number, col: number, value: string) => {
    if (!currentCrossword || !grid.length || !isWordCell(row, col)) return;

    // Simple validation: only allow single letters or empty string (for deletion)
    if (value !== "" && (!value.match(/^[a-zA-Z]$/) || value.length > 1))
      return;

    // Allow clearing the cell regardless
    if (value === "") {
      const newGrid = [...grid];
      newGrid[row][col] = "";
      setGrid(newGrid);
      return;
    }

    // Update the grid immediately for responsive feedback
    const newGrid = [...grid];
    newGrid[row][col] = value.toUpperCase();
    setGrid(newGrid);

    // Find the word that contains this cell and auto-select it
    const containingWord = currentCrossword.wordPositions.find(
      (pos: WordPosition) => {
        if (pos.direction === "across") {
          return (
            row === pos.startRow &&
            col >= pos.startCol &&
            col < pos.startCol + pos.word.length
          );
        } else {
          return (
            col === pos.startCol &&
            row >= pos.startRow &&
            row < pos.startRow + pos.word.length
          );
        }
      },
    );

    if (containingWord) {
      // Auto-select this word for user clarity
      setSelectedClue(containingWord.clueNumber);
      setSelectedDirection(containingWord.direction);
    }
  };

  // Helper function to check if crossword is fully completed
  const checkCrosswordCompletion = (newlyCompletedIndex: number) => {
    const allCompleted = currentCrossword?.wordPositions.every(
      (_: WordPosition, index: number) => {
        if (index === newlyCompletedIndex) return true; // This word is now completed
        return (
          currentCrossword.userProgress?.currentProgress?.find(
            (p) => p.wordIndex === index,
          )?.completed || localCompletedWords.has(index)
        );
      },
    );

    if (allCompleted) {
      const timeMinutes = Math.round((Date.now() - startTime) / (1000 * 60));
      const hintsUsed = currentCrossword?.userProgress?.hintsUsed?.length || 0;
      const cluesUsed = currentCrossword?.userProgress?.cluesUsed?.length || 0;
      const finalScore = calculateScore(timeMinutes, hintsUsed, cluesUsed);

      onGameComplete?.({
        completed: true,
        timeMinutes,
        hintsUsed,
        cluesUsed,
        finalScore,
        usedSecretCode: false,
      });
    }
  };

  const getCellCorrectness = (row: number, col: number) => {
    if (!currentCrossword)
      return { isCorrectLetter: false, isCompletedWord: false };

    // Find all words that contain this cell
    const containingWords = currentCrossword.wordPositions.filter(
      (wordPos: WordPosition) => {
        if (wordPos.direction === "across") {
          return (
            row === wordPos.startRow &&
            col >= wordPos.startCol &&
            col < wordPos.startCol + wordPos.word.length
          );
        } else {
          return (
            col === wordPos.startCol &&
            row >= wordPos.startRow &&
            row < wordPos.startRow + wordPos.word.length
          );
        }
      },
    );

    let isCorrectLetter = false;
    let isCompletedWord = false;

    for (const wordPos of containingWords) {
      const letterIndex =
        wordPos.direction === "across"
          ? col - wordPos.startCol
          : row - wordPos.startRow;

      const expectedLetter = wordPos.word[letterIndex]?.toUpperCase();
      const actualLetter = grid[row][col]?.toUpperCase();

      if (expectedLetter === actualLetter) {
        isCorrectLetter = true;

        // Check if entire word is completed
        const wordIndex = currentCrossword.wordPositions.findIndex(
          (pos: WordPosition) => pos === wordPos,
        );
        const wordProgress =
          currentCrossword.userProgress?.currentProgress?.find(
            (p) => p.wordIndex === wordIndex,
          );

        // Check both backend data and local state for completion
        if (wordProgress?.completed || localCompletedWords.has(wordIndex)) {
          isCompletedWord = true;
          break; // If word is completed, that takes precedence
        }
      }
    }

    return { isCorrectLetter, isCompletedWord };
  };

  const isSelectedWord = (row: number, col: number) => {
    if (!selectedClue) return false;

    const wordPos = currentCrossword.wordPositions.find(
      (pos: WordPosition) =>
        pos.clueNumber === selectedClue && pos.direction === selectedDirection,
    );

    if (!wordPos) return false;

    if (wordPos.direction === "across") {
      return (
        row === wordPos.startRow &&
        col >= wordPos.startCol &&
        col < wordPos.startCol + wordPos.word.length
      );
    } else {
      return (
        col === wordPos.startCol &&
        row >= wordPos.startRow &&
        row < wordPos.startRow + wordPos.word.length
      );
    }
  };

  const renderGrid = () => {
    const gridSize = currentCrossword?.gridSize || 7;
    return (
      <div
        className="crossword-grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            // Check if this cell is part of any word
            const cellIsWordCell = isWordCell(rowIndex, colIndex);

            const clueNumber = currentCrossword.wordPositions.find(
              (pos: WordPosition) =>
                pos.startRow === rowIndex && pos.startCol === colIndex,
            )?.clueNumber;

            // Check if this cell belongs to any completed word
            const belongsToCompletedWord = currentCrossword.wordPositions.some(
              (pos: WordPosition) => {
                const wordIndex = currentCrossword.wordPositions.findIndex(
                  (p: WordPosition) => p === pos,
                );
                const wordProgress =
                  currentCrossword.userProgress?.currentProgress?.find(
                    (p) => p.wordIndex === wordIndex,
                  );
                const isCompleted =
                  wordProgress?.completed || localCompletedWords.has(wordIndex);

                if (!isCompleted) return false;

                // Check if this cell is part of this word
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
              },
            );

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`crossword-cell ${
                  !cellIsWordCell
                    ? "empty" // Empty cells that are not part of any word
                    : (() => {
                        const { isCompletedWord } = getCellCorrectness(
                          rowIndex,
                          colIndex,
                        );
                        if (isCompletedWord) return "correct-word";
                        if (isSelectedWord(rowIndex, colIndex))
                          return "selected";
                        return "word-cell";
                      })()
                } ${belongsToCompletedWord ? "locked-cell" : ""}`}
                style={{
                  backgroundColor: !cellIsWordCell
                    ? "var(--bg-muted)"
                    : (() => {
                        const { isCompletedWord } = getCellCorrectness(
                          rowIndex,
                          colIndex,
                        );
                        if (isCompletedWord) return "var(--bg-success)";
                        if (isSelectedWord(rowIndex, colIndex))
                          return "var(--bg-accent)";
                        return "var(--bg-secondary)";
                      })(),
                }}
                onClick={() =>
                  cellIsWordCell &&
                  !belongsToCompletedWord &&
                  handleCellClick(rowIndex, colIndex)
                }
              >
                {cellIsWordCell && clueNumber && (
                  <span className="clue-number">{clueNumber}</span>
                )}
                {cellIsWordCell && (
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) =>
                      !belongsToCompletedWord &&
                      handleCellInput(rowIndex, colIndex, e.target.value)
                    }
                    onKeyDown={(e) => {
                      // Handle Backspace and Delete keys for better UX
                      if (
                        (e.key === "Backspace" || e.key === "Delete") &&
                        !belongsToCompletedWord
                      ) {
                        e.preventDefault();
                        handleCellInput(rowIndex, colIndex, "");
                      }
                    }}
                    maxLength={1}
                    className="cell-input"
                    disabled={!cellIsWordCell || belongsToCompletedWord}
                    readOnly={belongsToCompletedWord}
                  />
                )}
              </div>
            );
          }),
        )}
      </div>
    );
  };

  const renderHints = () => {
    if (!currentCrossword?.hints) return null;

    return (
      <div className="brutal-card">
        <h3 className="brutal-text-lg mb-4 font-bold">WORD HINTS</h3>
        <div className="space-y-3">
          {currentCrossword.hints.map((hint, index) => {
            const word = currentCrossword.words[index];
            const wordPos = currentCrossword.wordPositions[index];
            const isCompleted =
              localCompletedWords.has(index) ||
              currentCrossword.userProgress?.currentProgress?.find(
                (p) => p.wordIndex === index,
              )?.completed;

            return (
              <div
                key={index}
                className="p-3 border-2 border-solid"
                style={{
                  borderRadius: "8px",
                  background: isCompleted ? "var(--bg-success)" : "transparent",
                  border: isCompleted
                    ? "2px solid var(--border-success)"
                    : "2px solid var(--border-color)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">
                    {word.length} letters
                  </span>
                  {isCompleted && (
                    <span
                      className="font-bold text-sm"
                      style={{ color: "var(--text-success)" }}
                    >
                      ✓ COMPLETE
                    </span>
                  )}
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {hint}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Desktop Layout */}
      <div className="hidden md:block w-full px-6 py-4">
        <div className="grid grid-cols-[320px_1fr_400px] gap-8 max-w-[1400px] mx-auto">
          {/* Left Column - Title & Info */}
          <div className="brutal-card h-fit">
            <h1 className="brutal-text-xl mb-6 font-black">
              DAILY IMPOSSIBLE CROSSWORD
            </h1>

            <div className="space-y-4">
              {currentCrossword?.theme && (
                <div
                  className="p-4 border-3 border-solid"
                  style={{
                    background: "var(--bg-accent)",
                    border: "3px solid var(--border-accent)",
                    borderRadius: "8px",
                  }}
                >
                  <p
                    className="brutal-text-md font-black text-center"
                    style={{ color: "var(--text-inverse)" }}
                  >
                    THEME: {currentCrossword.theme.toUpperCase()}
                  </p>
                </div>
              )}
              <p
                className="brutal-text-md font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                COMPLETE THE CROSSWORD.
              </p>
              <p
                className="brutal-text-md font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                WORDS INTERSECT LIKE TRADITIONAL CROSSWORDS.
              </p>
            </div>
          </div>

          {/* Center Column - Main Crossword Grid Area */}
          <div className="flex flex-col items-center space-y-6">
            {/* Word Submission Notification */}
            {submissionNotification.show && (
              <div className="flex justify-center">
                <div
                  className="brutal-card px-6 py-3"
                  style={{
                    background: submissionNotification.isCorrect
                      ? "#22c55e"
                      : "#ef4444",
                    border: "3px solid #000",
                    boxShadow: "4px 4px 0px #000",
                  }}
                >
                  <div
                    className="font-bold text-lg"
                    style={{
                      color: "#ffffff",
                    }}
                  >
                    {submissionNotification.message}
                  </div>
                </div>
              </div>
            )}

            {/* Removed hint/clue displays for simplified gameplay */}

            {/* Large Crossword Grid */}
            <div className="flex justify-center">{renderGrid()}</div>

            {/* Submit Word Button - Show when word is selected */}
            {selectedClue && (
              <div className="flex justify-center">
                <button
                  onClick={handleSubmitWord}
                  className="brutal-button px-8 py-4 font-bold"
                  style={{
                    background: "var(--bg-accent)",
                    border: "3px solid var(--border-accent)",
                    color: "var(--text-inverse)",
                  }}
                >
                  SUBMIT WORD ({selectedClue} {selectedDirection.toUpperCase()})
                </button>
              </div>
            )}

            {/* Completion Message */}
            {completionMessage && (
              <div className="flex justify-center">
                <div
                  className="brutal-card px-6 py-3"
                  style={{ background: "var(--bg-success)" }}
                >
                  <div
                    className="font-bold text-lg"
                    style={{ color: "var(--text-success)" }}
                  >
                    {completionMessage}
                  </div>
                </div>
              </div>
            )}

            {/* Friend Suggestions */}
            <div className="w-full max-w-2xl">{renderSuggestions()}</div>

            {/* Need Help Section */}
            <div className="brutal-card w-full max-w-2xl">
              <h3 className="brutal-text-lg mb-4 font-bold">NEED HELP?</h3>
              {!inviteLink ? (
                <button
                  onClick={handleCreateInvite}
                  className="brutal-button px-8 py-4 w-full font-bold"
                >
                  ASK A FRIEND FOR HELP
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="brutal-input flex-1 text-xs"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`brutal-button px-3 py-2 text-xs ${
                        showCopySuccess ? "success" : ""
                      }`}
                    >
                      {showCopySuccess ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Share this link with friends for unlimited suggestions!
                  </p>
                </div>
              )}
            </div>

            {/* Start New Crossword Button - Show for completed crosswords */}
            {currentCrossword?.userProgress?.completed && (
              <div className="flex justify-center">
                <button
                  onClick={() => initializeCrossword(true)}
                  className="brutal-button px-8 py-4"
                  disabled={isStartingNewCrossword}
                  style={{
                    background: "var(--bg-success)",
                    border: "3px solid var(--border-success)",
                    color: "var(--text-success)",
                  }}
                >
                  {isStartingNewCrossword ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating...
                    </div>
                  ) : (
                    "🎉 Play Another Crossword!"
                  )}
                </button>
              </div>
            )}

            {/* Start Over Button - new section for consistent width */}
            <div className="brutal-card w-full max-w-2xl text-center">
              <h3 className="brutal-text-lg mb-4 font-bold">GAME ACTIONS</h3>
              <button
                onClick={handleStartOver}
                className="brutal-button warning w-full"
                disabled={isStartingNewCrossword}
              >
                {isStartingNewCrossword
                  ? "Generating New Puzzle..."
                  : "Start a New Crossword"}
              </button>
            </div>
          </div>

          {/* Right Column - Hints List */}
          <div className="space-y-6">{renderHints()}</div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-6">
        <div className="brutal-card text-center">
          <h1 className="brutal-text-xl mb-4">Daily Impossible Crossword</h1>

          {currentCrossword?.theme && (
            <div
              className="p-3 border-3 border-solid mb-4"
              style={{
                background: "var(--bg-accent)",
                border: "3px solid var(--border-accent)",
                borderRadius: "8px",
              }}
            >
              <p
                className="brutal-text-sm font-black"
                style={{ color: "var(--text-inverse)" }}
              >
                THEME: {currentCrossword.theme.toUpperCase()}
              </p>
            </div>
          )}

          <p
            className="brutal-text-md mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Complete the crossword. Words intersect like traditional crosswords.
          </p>
        </div>

        {/* Word Submission Notification (Mobile) */}
        {submissionNotification.show && (
          <div className="flex justify-center">
            <div
              className="brutal-card px-4 py-2"
              style={{
                background: submissionNotification.isCorrect
                  ? "#22c55e"
                  : "#ef4444",
                border: "3px solid #000",
                boxShadow: "4px 4px 0px #000",
              }}
            >
              <div
                className="font-bold text-sm"
                style={{
                  color: "#ffffff",
                }}
              >
                {submissionNotification.message}
              </div>
            </div>
          </div>
        )}

        {renderGrid()}

        {/* Submit Word Button (Mobile) */}
        {selectedClue && (
          <div className="flex justify-center">
            <button
              onClick={handleSubmitWord}
              className="brutal-button px-6 py-3 font-bold"
              style={{
                background: "var(--bg-accent)",
                border: "3px solid var(--border-accent)",
                color: "var(--text-inverse)",
              }}
            >
              SUBMIT ({selectedClue} {selectedDirection.toUpperCase()})
            </button>
          </div>
        )}

        {/* Completion Message (Mobile) */}
        {completionMessage && (
          <div className="flex justify-center">
            <div
              className="brutal-card px-4 py-2"
              style={{ background: "var(--bg-success)" }}
            >
              <div
                className="font-bold text-sm"
                style={{ color: "var(--text-success)" }}
              >
                {completionMessage}
              </div>
            </div>
          </div>
        )}

        {/* Friend Suggestions */}
        {renderSuggestions()}

        {/* Hints List */}
        {renderHints()}

        {/* Need Help Section - Below clues on mobile */}
        <div className="brutal-card text-center">
          <h3 className="brutal-text-lg mb-4">Need Help?</h3>
          {!inviteLink ? (
            <button
              onClick={handleCreateInvite}
              className="brutal-button px-6 py-3"
            >
              Ask a Friend for Help
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="brutal-input flex-1 text-xs"
                />
                <button
                  onClick={handleCopyLink}
                  className={`brutal-button px-3 py-2 text-xs ${
                    showCopySuccess ? "success" : ""
                  }`}
                >
                  {showCopySuccess ? "✓ Copied!" : "📋 Copy"}
                </button>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Share this link with friends for unlimited suggestions!
              </p>
            </div>
          )}
        </div>

        {/* Start New Crossword Button (Mobile) - Show for completed crosswords */}
        {currentCrossword?.userProgress?.completed && (
          <div className="flex justify-center">
            <button
              onClick={() => initializeCrossword(true)}
              className="brutal-button px-6 py-3"
              disabled={isStartingNewCrossword}
              style={{
                background: "var(--bg-success)",
                border: "3px solid var(--border-success)",
                color: "var(--text-success)",
              }}
            >
              {isStartingNewCrossword ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </div>
              ) : (
                "🎉 Play Another!"
              )}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showStartOverConfirm}
        title="Start a New Crossword?"
        message="Are you sure? Your current progress will be lost and a new puzzle will be generated."
        onConfirm={() => {
          setShowStartOverConfirm(false);
          initializeCrossword(true);
        }}
        onCancel={() => setShowStartOverConfirm(false)}
        confirmText="Start New Puzzle"
        cancelText="Cancel"
      />
    </div>
  );
}

// Removed ClueItem component - no longer needed for simplified gameplay

// Helper function to calculate score
function calculateScore(
  timeMinutes: number,
  hintsUsed: number,
  cluesUsed: number,
): number {
  let baseScore = 1000;

  // Deduct for time (1 point per minute after first 10 minutes)
  if (timeMinutes > 10) {
    baseScore -= timeMinutes - 10;
  }

  // Deduct for hints and clues
  baseScore -= hintsUsed * 50;
  baseScore -= cluesUsed * 25;

  return Math.max(baseScore, 100); // Minimum score of 100
}
