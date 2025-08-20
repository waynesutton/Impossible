import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

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

interface ClueData {
  clueNumber: number;
  clue: string;
  word: string;
  direction: "across" | "down";
  completed: boolean;
}

export function ImpossibleCrossword({
  onGameComplete,
}: ImpossibleCrosswordProps) {
  const [selectedClue, setSelectedClue] = useState<number | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<"across" | "down">(
    "across",
  );
  const [grid, setGrid] = useState<string[][]>([]);
  const [startTime] = useState(Date.now());

  // Get current crossword with conditional querying for refresh
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const currentCrossword = useQuery(
    api.crossword.getCurrentCrossword,
    // Add a dummy dependency to force refresh
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
  const requestHint = useMutation(api.crossword.requestCrosswordHint);
  const requestClue = useMutation(api.crossword.requestCrosswordClue);
  const createInvite = useMutation(api.crossword.createCrosswordInvite);
  const useSuggestion = useMutation(api.crossword.useCrosswordSuggestion);

  // Loading states
  const [loadingHint, setLoadingHint] = useState<number | null>(null);
  const [loadingClue, setLoadingClue] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [currentClue, setCurrentClue] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(true);
  const [usedSecretCode, setUsedSecretCode] = useState<boolean>(false);
  const [currentWordInput, setCurrentWordInput] = useState<string>("");
  const [isStartingNewCrossword, setIsStartingNewCrossword] =
    useState<boolean>(false);
  const [showClearButton, setShowClearButton] = useState<boolean>(false);
  const [localCompletedWords, setLocalCompletedWords] = useState<Set<number>>(
    new Set(),
  );

  // Debounced progress update for real-time sync
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<number, string[]>>(new Map());

  // Debounced update function to sync with database
  const debouncedUpdateProgress = useCallback(
    (wordIndex: number, letters: string[]) => {
      // Store the pending update
      pendingUpdatesRef.current.set(wordIndex, letters);

      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Set new timeout to batch updates
      updateTimeoutRef.current = setTimeout(async () => {
        const updates = Array.from(pendingUpdatesRef.current.entries());
        pendingUpdatesRef.current.clear();

        // Send all pending updates
        for (const [wordIdx, wordLetters] of updates) {
          try {
            await updateProgress({
              wordIndex: wordIdx,
              letters: wordLetters,
              isCompleted: false, // Only mark as completed when word is submitted
            });
          } catch (error) {
            console.error("Error updating progress:", error);
          }
        }
      }, 300); // 300ms delay to batch keystrokes
    },
    [updateProgress],
  );

  // Function to initialize crossword (moved outside useEffect for reusability)
  const initializeCrossword = async (forceNew = false) => {
    if ((currentCrossword === null && !isGenerating) || forceNew) {
      try {
        setIsGenerating(true);
        setGenerationError(null);
        if (forceNew) {
          setIsStartingNewCrossword(true);
        }

        // Clear current hints/clues state when starting new game
        if (forceNew) {
          setCurrentHint(null);
          setCurrentClue(null);
          setShowSuggestions(true);
          setUsedSecretCode(false);
          setLocalCompletedWords(new Set());
        }

        const result = await startCrosswordGame({ forceNew });
        if (!result.puzzleReady) {
          // Puzzle is being generated, keep loading state
          console.log("Crossword generation started...");

          // If forcing new, wait for generation and then force refresh
          if (forceNew) {
            setTimeout(() => {
              setIsGenerating(false);
              setIsStartingNewCrossword(false);
              // Force the query to refetch by incrementing trigger
              setRefreshTrigger((prev) => prev + 1);
              console.log("Triggering crossword refresh after generation");
            }, 5000); // Increased timeout for better reliability
          }
        } else {
          setIsGenerating(false);
          setIsStartingNewCrossword(false);
          // If puzzle is ready immediately, force refresh to get the new data
          if (forceNew) {
            setRefreshTrigger((prev) => prev + 1);
          }
        }
      } catch (error: any) {
        setGenerationError(
          error.message || "Failed to start crossword generation",
        );
        setIsGenerating(false);
        setIsStartingNewCrossword(false);
      }
    } else if (currentCrossword && !forceNew) {
      setIsGenerating(false);
      setIsStartingNewCrossword(false);
      setGenerationError(null);
    }
  };

  // Check if grid is completely filled but no words are correct
  const shouldShowClearButton = () => {
    if (!currentCrossword || !grid.length) return false;

    // Create a set of all cells that belong to words
    const wordCells = new Set<string>();
    let anyWordCorrect = false;

    // First, identify all cells that are part of words
    for (const wordPos of currentCrossword.wordPositions) {
      let wordCorrect = true;

      for (let i = 0; i < wordPos.word.length; i++) {
        const row =
          wordPos.direction === "across"
            ? wordPos.startRow
            : wordPos.startRow + i;
        const col =
          wordPos.direction === "across"
            ? wordPos.startCol + i
            : wordPos.startCol;

        wordCells.add(`${row},${col}`);

        // Check if this letter is correct
        if (!grid[row] || !grid[row][col] || grid[row][col].trim() === "") {
          wordCorrect = false;
        } else if (
          grid[row][col].toUpperCase() !== wordPos.word[i].toUpperCase()
        ) {
          wordCorrect = false;
        }
      }

      if (wordCorrect) {
        anyWordCorrect = true;
      }
    }

    // Check if all word cells are filled
    let allWordCellsFilled = true;
    for (const cellKey of wordCells) {
      const [row, col] = cellKey.split(",").map(Number);
      if (!grid[row] || !grid[row][col] || grid[row][col].trim() === "") {
        allWordCellsFilled = false;
        break;
      }
    }

    return allWordCellsFilled && !anyWordCorrect;
  };

  const handleClearCrossword = () => {
    const emptyGrid = Array(currentCrossword?.gridSize || 7)
      .fill(null)
      .map(() => Array(currentCrossword?.gridSize || 7).fill(""));
    setGrid(emptyGrid);
    setCurrentWordInput("");
    setSelectedClue(null);
    setShowClearButton(false);
    setLocalCompletedWords(new Set());
  };

  // Trigger crossword generation if no puzzle exists
  useEffect(() => {
    initializeCrossword();
  }, [currentCrossword, isGenerating, startCrosswordGame]);

  // Initialize grid when crossword loads
  useEffect(() => {
    if (currentCrossword?.gridSize) {
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

      // Reset local completed words when crossword changes
      setLocalCompletedWords(new Set());
    }
  }, [currentCrossword]);

  // Check if we should show the clear button whenever grid changes
  useEffect(() => {
    setShowClearButton(shouldShowClearButton());
  }, [grid, currentCrossword]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
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
            You solved today's crossword! Here's your completed puzzle:
          </p>

          <div className="mb-6 flex justify-center">
            <div
              className="crossword-grid"
              style={{
                gridTemplateColumns: `repeat(${currentCrossword.gridSize}, 1fr)`,
              }}
            >
              {solvedGrid.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
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
                      className={`crossword-cell ${isWordCell ? "correct-word" : "blocked"}`}
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
          >
            {isStartingNewCrossword ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </div>
            ) : (
              "Start New Crossword"
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
          <h2 className="brutal-text-xl mb-4">Yesterday's Words</h2>
          <p
            className="brutal-text-md mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            The crossword has expired, but here's what the completed puzzle
            looked like:
          </p>

          <div className="mb-6 flex justify-center">
            <div
              className="crossword-grid"
              style={{
                gridTemplateColumns: `repeat(${currentCrossword.gridSize}, 1fr)`,
              }}
            >
              {solvedGrid.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
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
                      className={`crossword-cell ${isWordCell ? "correct-word" : "blocked"}`}
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
          >
            {isStartingNewCrossword ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </div>
            ) : (
              "Start New Crossword"
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
    return (
      <div className="brutal-card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p style={{ color: "var(--text-secondary)" }}>
          {generationError
            ? "Failed to generate crossword. Please try again."
            : "Generating your daily crossword..."}
        </p>
        {generationError && (
          <div className="mt-4">
            <p className="text-sm text-red-600 mb-4">{generationError}</p>
            <p className="text-xs text-gray-500 mb-4">
              The AI crossword generator is currently experiencing issues. This
              could be due to high demand or temporary service problems.
            </p>
            <button
              onClick={() => {
                setGenerationError(null);
                setIsGenerating(false);
                // Trigger retry
                initializeCrossword();
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

  // Prepare clues data
  const cluesData: ClueData[] = currentCrossword.wordPositions.map(
    (pos: WordPosition) => ({
      clueNumber: pos.clueNumber,
      clue: currentCrossword.clues[currentCrossword.wordPositions.indexOf(pos)],
      word: pos.word,
      direction: pos.direction,
      completed:
        currentCrossword.userProgress?.currentProgress?.find(
          (p) => p.wordIndex === currentCrossword.wordPositions.indexOf(pos),
        )?.completed || false,
    }),
  );

  const handleCellClick = (row: number, col: number) => {
    if (!currentCrossword || !grid.length) return;

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

    let selectedWord = possibleWords[0];

    // If multiple words intersect at this cell, choose based on current selection
    if (possibleWords.length > 1) {
      // If we already have a word selected at this intersection, cycle to the other one
      const currentWord = possibleWords.find(
        (pos: WordPosition) =>
          pos.clueNumber === selectedClue &&
          pos.direction === selectedDirection,
      );

      if (currentWord) {
        // Cycle to the other word at this intersection
        selectedWord =
          possibleWords.find((pos: WordPosition) => pos !== currentWord) ||
          possibleWords[0];
      } else {
        // Default to across first, then down
        selectedWord =
          possibleWords.find(
            (pos: WordPosition) => pos.direction === "across",
          ) || possibleWords[0];
      }
    }

    setSelectedClue(selectedWord.clueNumber);
    setSelectedDirection(selectedWord.direction);

    // Update current word input display
    const wordLetters: string[] = [];
    for (let i = 0; i < selectedWord.word.length; i++) {
      const letterRow =
        selectedWord.direction === "across"
          ? selectedWord.startRow
          : selectedWord.startRow + i;
      const letterCol =
        selectedWord.direction === "across"
          ? selectedWord.startCol + i
          : selectedWord.startCol;
      wordLetters.push(grid[letterRow]?.[letterCol] || "");
    }
    setCurrentWordInput(wordLetters.join(""));
  };

  const handleSubmitWord = async () => {
    if (!selectedClue || !currentCrossword || !grid.length) return;

    const wordPos = currentCrossword.wordPositions.find(
      (pos: WordPosition) =>
        pos.clueNumber === selectedClue && pos.direction === selectedDirection,
    );

    if (!wordPos) return;

    const wordIndex = currentCrossword.wordPositions.findIndex(
      (pos: WordPosition) => pos === wordPos,
    );

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

    // Check if word is completed
    const isCompleted =
      wordLetters.every((letter) => letter !== "") &&
      wordLetters.join("").toLowerCase() === wordPos.word.toLowerCase();

    // Update progress
    await updateProgress({
      wordIndex,
      letters: wordLetters,
      isCompleted,
    });

    // Immediately update local state for instant visual feedback
    if (isCompleted) {
      setLocalCompletedWords((prev) => new Set([...prev, wordIndex]));
    }

    // Check if entire crossword is completed
    if (isCompleted) {
      const allCompleted = currentCrossword.wordPositions.every(
        (_: WordPosition, index: number) => {
          if (index === wordIndex) return true; // This word is now completed
          return (
            currentCrossword.userProgress?.currentProgress?.find(
              (p) => p.wordIndex === index,
            )?.completed || false
          );
        },
      );

      if (allCompleted) {
        const timeMinutes = Math.round((Date.now() - startTime) / (1000 * 60));
        const hintsUsed = currentCrossword.userProgress?.hintsUsed?.length || 0;
        const cluesUsed = currentCrossword.userProgress?.cluesUsed?.length || 0;
        const finalScore = calculateScore(timeMinutes, hintsUsed, cluesUsed);

        onGameComplete?.({
          completed: true,
          timeMinutes,
          hintsUsed,
          cluesUsed,
          finalScore,
          usedSecretCode,
        });
      }
    }

    // Clear current word input
    setCurrentWordInput("");
  };

  const handleCellInput = async (row: number, col: number, value: string) => {
    if (!currentCrossword || !grid.length) return;

    // Allow empty string for deletion, letters for input
    if (value !== "" && !value.match(/[a-zA-Z]/)) return;

    // Admin cheat code: auto-solve when all z's are entered
    if (value.toLowerCase() === "z") {
      const gridCopy = [...grid];
      gridCopy[row][col] = "Z";
      const allZs = gridCopy.every((row) =>
        row.every((cell) => cell === "Z" || cell === ""),
      );

      if (
        allZs &&
        gridCopy.flat().filter((cell) => cell === "Z").length >=
          currentCrossword.gridSize * 2
      ) {
        // Mark that secret code was used
        setUsedSecretCode(true);

        // Auto-solve the crossword
        const solvedGrid = Array(currentCrossword.gridSize)
          .fill(null)
          .map(() => Array(currentCrossword.gridSize).fill(""));

        currentCrossword.wordPositions.forEach((wordPos: WordPosition) => {
          for (let i = 0; i < wordPos.word.length; i++) {
            const letterRow =
              wordPos.direction === "across"
                ? wordPos.startRow
                : wordPos.startRow + i;
            const letterCol =
              wordPos.direction === "across"
                ? wordPos.startCol + i
                : wordPos.startCol;
            if (
              solvedGrid[letterRow] &&
              solvedGrid[letterRow][letterCol] !== undefined
            ) {
              solvedGrid[letterRow][letterCol] = wordPos.word[i].toUpperCase();
            }
          }
        });

        setGrid(solvedGrid);

        // Mark all words as completed
        for (let i = 0; i < currentCrossword.wordPositions.length; i++) {
          await updateProgress({
            wordIndex: i,
            letters: currentCrossword.wordPositions[i].word.split(""),
            isCompleted: true,
            usedSecretCode:
              i === currentCrossword.wordPositions.length - 1
                ? true
                : undefined, // Only set on the last word
          });
        }

        // Complete the game
        const timeMinutes = Math.round((Date.now() - startTime) / (1000 * 60));
        const hintsUsed = currentCrossword.userProgress?.hintsUsed?.length || 0;
        const cluesUsed = currentCrossword.userProgress?.cluesUsed?.length || 0;
        const finalScore = calculateScore(timeMinutes, hintsUsed, cluesUsed);

        onGameComplete?.({
          completed: true,
          timeMinutes,
          hintsUsed,
          cluesUsed,
          finalScore,
          usedSecretCode,
        });
        return;
      }
    }

    // For normal input, allow letters or empty string (deletion)
    if (value !== "" && !value.match(/[a-zA-Z]/)) return;

    // Find which word this cell belongs to and update grid
    const wordIndex = currentCrossword.wordPositions.findIndex(
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

    if (wordIndex >= 0) {
      const wordPos = currentCrossword.wordPositions[wordIndex];
      const newGrid = [...grid];
      if (newGrid[row] && newGrid[row][col] !== undefined) {
        newGrid[row][col] = value.toUpperCase();
        setGrid(newGrid);

        // Update current word input display
        const wordLetters: string[] = [];
        for (let i = 0; i < wordPos.word.length; i++) {
          const letterRow =
            wordPos.direction === "across"
              ? wordPos.startRow
              : wordPos.startRow + i;
          const letterCol =
            wordPos.direction === "across"
              ? wordPos.startCol + i
              : wordPos.startCol;
          wordLetters.push(newGrid[letterRow]?.[letterCol] || "");
        }
        setCurrentWordInput(wordLetters.join(""));

        // Set selection to this word
        setSelectedClue(wordPos.clueNumber);
        setSelectedDirection(wordPos.direction);

        // Update progress in database for real-time sync with helper (debounced)
        debouncedUpdateProgress(wordIndex, wordLetters);
      }
    }
  };

  const handleRequestHint = async (wordIndex: number) => {
    setLoadingHint(wordIndex);
    try {
      await requestHint({ wordIndex });
      // Get the hint from the user progress after it's updated
      const hintContent =
        currentCrossword.userProgress?.aiHintsContent?.[wordIndex];
      if (hintContent) {
        setCurrentHint(hintContent);
      }
    } catch (error) {
      console.error("Error requesting hint:", error);
    } finally {
      setLoadingHint(null);
    }
  };

  const handleRequestClue = async (wordIndex: number) => {
    setLoadingClue(wordIndex);
    try {
      await requestClue({ wordIndex });
      // Get the clue from the user progress after it's updated
      const clueContent =
        currentCrossword.userProgress?.aiCluesContent?.[wordIndex];
      if (clueContent) {
        setCurrentClue(clueContent);
      }
    } catch (error) {
      console.error("Error requesting clue:", error);
    } finally {
      setLoadingClue(null);
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
                  !isWordCell
                    ? "blocked"
                    : (() => {
                        const { isCorrectLetter, isCompletedWord } =
                          getCellCorrectness(rowIndex, colIndex);
                        if (isCompletedWord) return "correct-word";
                        if (isCorrectLetter) return "correct-letter";
                        if (isSelectedWord(rowIndex, colIndex))
                          return "in-selected-word";
                        return cell ? "filled" : "empty";
                      })()
                } ${belongsToCompletedWord ? "locked-cell" : ""}`}
                onClick={() =>
                  isWordCell &&
                  !belongsToCompletedWord &&
                  handleCellClick(rowIndex, colIndex)
                }
              >
                {clueNumber && (
                  <span className="clue-number">{clueNumber}</span>
                )}
                {isWordCell && (
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) =>
                      !belongsToCompletedWord &&
                      handleCellInput(rowIndex, colIndex, e.target.value)
                    }
                    maxLength={1}
                    className="cell-input"
                    disabled={!isWordCell || belongsToCompletedWord}
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

  const renderClues = () => {
    const acrossClues = cluesData.filter((c) => c.direction === "across");
    const downClues = cluesData.filter((c) => c.direction === "down");

    return (
      <div className="space-y-6">
        <div className="brutal-card">
          <h3 className="brutal-text-lg mb-4 font-bold">ACROSS</h3>
          {acrossClues.map((clueData, index) => {
            const wordIndex = currentCrossword.wordPositions.findIndex(
              (pos: WordPosition) =>
                pos.clueNumber === clueData.clueNumber &&
                pos.direction === "across",
            );
            const hint =
              currentCrossword.userProgress?.aiHintsContent?.[wordIndex];
            const clue =
              currentCrossword.userProgress?.aiCluesContent?.[wordIndex];

            return (
              <ClueItem
                key={`across-${clueData.clueNumber}`}
                clueData={clueData}
                wordIndex={wordIndex}
                hint={hint}
                clue={clue}
                isSelected={
                  selectedClue === clueData.clueNumber &&
                  selectedDirection === "across"
                }
                onSelect={() => {
                  setSelectedClue(clueData.clueNumber);
                  setSelectedDirection("across");
                }}
                onRequestHint={() => handleRequestHint(wordIndex)}
                onRequestClue={() => handleRequestClue(wordIndex)}
                loadingHint={loadingHint === wordIndex}
                loadingClue={loadingClue === wordIndex}
              />
            );
          })}
        </div>

        <div className="brutal-card">
          <h3 className="brutal-text-lg mb-4 font-bold">DOWN</h3>
          {downClues.map((clueData, index) => {
            const wordIndex = currentCrossword.wordPositions.findIndex(
              (pos: WordPosition) =>
                pos.clueNumber === clueData.clueNumber &&
                pos.direction === "down",
            );
            const hint =
              currentCrossword.userProgress?.aiHintsContent?.[wordIndex];
            const clue =
              currentCrossword.userProgress?.aiCluesContent?.[wordIndex];

            return (
              <ClueItem
                key={`down-${clueData.clueNumber}`}
                clueData={clueData}
                wordIndex={wordIndex}
                hint={hint}
                clue={clue}
                isSelected={
                  selectedClue === clueData.clueNumber &&
                  selectedDirection === "down"
                }
                onSelect={() => {
                  setSelectedClue(clueData.clueNumber);
                  setSelectedDirection("down");
                }}
                onRequestHint={() => handleRequestHint(wordIndex)}
                onRequestClue={() => handleRequestClue(wordIndex)}
                loadingHint={loadingHint === wordIndex}
                loadingClue={loadingClue === wordIndex}
              />
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
                GET HINTS AND CLUES,
              </p>
              <p
                className="brutal-text-md font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                OR INVITE FRIENDS FOR UNLIMITED HELP!
              </p>
            </div>
            <div className="mt-8 p-3 brutal-card bg-warning">
              <div
                className="font-bold text-sm"
                style={{ color: "var(--text-warning)" }}
              >
                ⏰ EXPIRES:{" "}
                {new Date(currentCrossword.expiresAt).toLocaleDateString()} at{" "}
                {new Date(currentCrossword.expiresAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          {/* Center Column - Main Crossword Grid Area */}
          <div className="flex flex-col items-center space-y-6">
            {/* Large Crossword Grid */}
            <div className="flex justify-center">{renderGrid()}</div>

            {/* Submit Word Button */}
            {selectedClue && currentWordInput.trim() && (
              <div className="flex justify-center">
                <button
                  onClick={handleSubmitWord}
                  className="brutal-button px-8 py-4 font-bold"
                  style={{
                    background: "var(--bg-success)",
                    border: "3px solid var(--border-success)",
                    color: "var(--text-success)",
                  }}
                >
                  SUBMIT WORD: {currentWordInput.replace(/\s/g, "·")}
                </button>
              </div>
            )}

            {/* Clear Crossword Button */}
            {showClearButton && (
              <div className="flex justify-center">
                <button
                  onClick={handleClearCrossword}
                  className="brutal-button px-8 py-4 font-bold"
                  style={{
                    background: "var(--bg-warning)",
                    border: "3px solid var(--border-warning)",
                    color: "var(--text-warning)",
                  }}
                >
                  CLEAR CROSSWORD
                </button>
              </div>
            )}

            {/* Hint/Clue Display Below Grid */}
            {(currentHint || currentClue) && (
              <div className="brutal-card w-full max-w-2xl">
                {currentHint && (
                  <div className="hint-display mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <strong>💡 Hint:</strong> {currentHint}
                      </div>
                      <button
                        onClick={() => setCurrentHint(null)}
                        className="brutal-button text-xs px-2 py-1 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
                {currentClue && (
                  <div className="clue-display">
                    <div className="flex justify-between items-start">
                      <div>
                        <strong>🔤 Letter Clue:</strong> {currentClue}
                      </div>
                      <button
                        onClick={() => setCurrentClue(null)}
                        className="brutal-button text-xs px-2 py-1 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
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
          </div>

          {/* Right Column - Clues Lists */}
          <div className="space-y-6">{renderClues()}</div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-6">
        <div className="brutal-card text-center">
          <h1 className="brutal-text-xl mb-4">Daily Impossible Crossword</h1>
          <p
            className="brutal-text-md mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Complete the crossword. Get hints and clues, or invite friends for
            unlimited help!
          </p>
          <div className="mt-4 p-2 brutal-card bg-warning">
            <div
              className="font-bold text-sm"
              style={{ color: "var(--text-warning)" }}
            >
              ⏰ EXPIRES:{" "}
              {new Date(currentCrossword.expiresAt).toLocaleString()}
            </div>
          </div>
        </div>

        {renderGrid()}

        {/* Submit Word Button (Mobile) */}
        {selectedClue && currentWordInput.trim() && (
          <div className="flex justify-center">
            <button
              onClick={handleSubmitWord}
              className="brutal-button px-6 py-3 font-bold"
              style={{
                background: "var(--bg-success)",
                border: "3px solid var(--border-success)",
                color: "var(--text-success)",
              }}
            >
              SUBMIT WORD: {currentWordInput.replace(/\s/g, "·")}
            </button>
          </div>
        )}

        {/* Clear Crossword Button (Mobile) */}
        {showClearButton && (
          <div className="flex justify-center">
            <button
              onClick={handleClearCrossword}
              className="brutal-button px-6 py-3 font-bold"
              style={{
                background: "var(--bg-warning)",
                border: "3px solid var(--border-warning)",
                color: "var(--text-warning)",
              }}
            >
              CLEAR CROSSWORD
            </button>
          </div>
        )}

        {/* Hint/Clue Display Below Grid (Mobile) */}
        {(currentHint || currentClue) && (
          <div className="brutal-card">
            {currentHint && (
              <div className="hint-display mb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <strong>💡 Hint:</strong> {currentHint}
                  </div>
                  <button
                    onClick={() => setCurrentHint(null)}
                    className="brutal-button text-xs px-2 py-1 ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {currentClue && (
              <div className="clue-display">
                <div className="flex justify-between items-start">
                  <div>
                    <strong>🔤 Letter Clue:</strong> {currentClue}
                  </div>
                  <button
                    onClick={() => setCurrentClue(null)}
                    className="brutal-button text-xs px-2 py-1 ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Friend Suggestions */}
        {renderSuggestions()}

        {/* Clues Lists */}
        {renderClues()}

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
      </div>
    </div>
  );
}

// Individual clue component
interface ClueItemProps {
  clueData: ClueData;
  wordIndex: number;
  hint?: string;
  clue?: string;
  isSelected: boolean;
  onSelect: () => void;
  onRequestHint: () => void;
  onRequestClue: () => void;
  loadingHint: boolean;
  loadingClue: boolean;
}

function ClueItem({
  clueData,
  wordIndex,
  hint,
  clue,
  isSelected,
  onSelect,
  onRequestHint,
  onRequestClue,
  loadingHint,
  loadingClue,
}: ClueItemProps) {
  return (
    <div
      className={`clue-item ${isSelected ? "selected" : ""} ${
        clueData.completed ? "completed" : ""
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <span className="font-bold">{clueData.clueNumber}.</span>{" "}
          {clueData.clue}
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestHint();
            }}
            disabled={loadingHint}
            className="brutal-button secondary text-xs px-2 py-1"
          >
            {loadingHint ? "..." : "Hint"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestClue();
            }}
            disabled={loadingClue}
            className="brutal-button secondary text-xs px-2 py-1"
          >
            {loadingClue ? "..." : "Clue"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
