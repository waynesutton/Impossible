import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface ImpossibleGameProps {
  onGameComplete?: (gameData: {
    won: boolean;
    word: string;
    attempts: number;
    usedSecretWord?: boolean;
  }) => void;
}

export function ImpossibleGame({ onGameComplete }: ImpossibleGameProps) {
  const currentGame = useQuery(api.game.getCurrentGame);
  const suggestions = useQuery(api.game.getSuggestions);
  const updateGuess = useMutation(api.game.updateCurrentGuess);
  const submitGuess = useMutation(api.game.submitGuess);
  const startNewGame = useMutation(api.game.startNewGame);
  const requestHint = useMutation(api.game.requestHint);
  const requestClue = useMutation(api.game.requestClue);
  const updateDisplayName = useMutation(api.game.updateDisplayName);
  const createInviteLink = useMutation(api.game.createInviteLink);
  const useSuggestion = useMutation(api.game.useSuggestion);
  const startThirdAttemptTimer = useMutation(api.game.startThirdAttemptTimer);

  const [currentInput, setCurrentInput] = useState("");
  const [showWrong, setShowWrong] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [isGettingClue, setIsGettingClue] = useState(false);
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update current input when game state changes
  useEffect(() => {
    if (currentGame?.currentGuess !== undefined) {
      setCurrentInput(currentGame.currentGuess);
    }
  }, [currentGame?.currentGuess]);

  // Auto-focus input when playable
  useEffect(() => {
    if (inputRef.current && currentGame?.canPlay) {
      inputRef.current.focus();
    }
  }, [currentGame?.canPlay]);

  // Start new game if no current game (only when currentGame is null)
  useEffect(() => {
    if (currentGame === null) {
      startNewGame();
    }
  }, [currentGame, startNewGame]);

  // Start timer when user reaches third attempt
  useEffect(() => {
    if (
      currentGame?.attempts === 2 &&
      !currentGame.thirdAttemptStartTime &&
      currentGame.canPlay
    ) {
      startThirdAttemptTimer();
    }
  }, [
    currentGame?.attempts,
    currentGame?.thirdAttemptStartTime,
    currentGame?.canPlay,
    startThirdAttemptTimer,
  ]);

  // Timer countdown for third attempt
  useEffect(() => {
    if (
      currentGame?.thirdAttemptStartTime &&
      currentGame.attempts === 2 &&
      currentGame.canPlay
    ) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - currentGame.thirdAttemptStartTime!;
        const remaining = Math.max(0, 60000 - elapsed); // 60 seconds
        setTimeRemaining(remaining);

        if (remaining === 0) {
          clearInterval(interval);
          // Handle timeout as final attempt
          handleTimeoutSubmission();
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [
    currentGame?.thirdAttemptStartTime,
    currentGame?.attempts,
    currentGame?.canPlay,
    submitGuess,
  ]);

  // No longer need game completion useEffect since we redirect to leaderboard

  const handleTimeoutSubmission = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const result = await submitGuess({ guess: "" });
      console.log("⏰ Timeout submission result:", result);

      // Since this is the third attempt timing out, the game should be over
      if (result.attemptsRemaining === 0) {
        console.log("⏰ Timeout - game over, redirecting to leaderboard");
        onGameComplete?.({
          won: false,
          word: currentGame?.word || "",
          attempts: 3,
          usedSecretWord: false,
        });
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to submit timeout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = async (value: string) => {
    if (!currentGame) return;

    // Allow input even if game is completed (for viewing purposes)
    // but prevent submission logic for completed games
    if (currentGame.completed) return;

    // Only allow letters and limit to word length (except for secret word "vex")
    let cleanValue = value.toLowerCase().replace(/[^a-z]/g, "");

    // If it's not the secret word, limit to word length
    if (cleanValue !== "vex") {
      cleanValue = cleanValue.slice(0, currentGame.word.length);
    }

    // Prevent backspacing - only allow adding characters
    if (cleanValue.length < currentInput.length) {
      return;
    }

    setCurrentInput(cleanValue);

    // Clear error message when user starts typing a new word
    if (cleanValue.length === 1) {
      setErrorMessage(null);
    }

    // Persist current guess for realtime sync
    await updateGuess({ guess: cleanValue });

    // Only submit when they've typed a complete word or the secret word
    const targetWord = currentGame.word.toLowerCase();
    if (cleanValue.length === targetWord.length || cleanValue === "vex") {
      try {
        setIsSubmitting(true);
        setErrorMessage(null);
        const result = await submitGuess({ guess: cleanValue });
        console.log("📤 Submit guess result:", result);

        if (result.correct) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          // If correct, redirect to leaderboard after a brief celebration
          const usedSecretWord = cleanValue.toLowerCase() === "vex";
          setTimeout(() => {
            onGameComplete?.({
              won: true,
              word: usedSecretWord ? currentGame.word : cleanValue,
              attempts: currentGame.attempts + 1,
              usedSecretWord: usedSecretWord,
            });
          }, 2000);
        } else {
          // Check if this was the final attempt (attemptsRemaining will be 0)
          if (result.attemptsRemaining === 0) {
            console.log(
              "🎯 Final attempt - game over, redirecting to leaderboard",
            );
            // Game is over - redirect to leaderboard immediately
            onGameComplete?.({
              won: false,
              word: currentGame.word,
              attempts: 3,
              usedSecretWord: false,
            });
          } else {
            console.log(`❌ Wrong attempt ${3 - result.attemptsRemaining}/3`);
            setErrorMessage("Not it. Try another word!");
            setCurrentInput("");
            await updateGuess({ guess: "" });
          }
        }
      } catch (error: any) {
        setErrorMessage(error.message || "Failed to submit guess");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGetHint = async () => {
    try {
      setIsGettingHint(true);
      setErrorMessage(null);
      await requestHint();
    } catch (error: any) {
      setErrorMessage(error.message || "Hints only available after 1 attempt");
    } finally {
      setIsGettingHint(false);
    }
  };

  const handleGetClue = async () => {
    try {
      setIsGettingClue(true);
      setErrorMessage(null);
      await requestClue();
    } catch (error: any) {
      setErrorMessage(error.message || "Clues only available after 2 attempts");
    } finally {
      setIsGettingClue(false);
    }
  };

  const handleCreateInvite = async () => {
    try {
      setIsCreatingInvite(true);
      setErrorMessage(null);
      const inviteId = await createInviteLink();
      const link = `${window.location.origin}?invite=${inviteId}`;
      setInviteLink(link);
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to create invite link");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (_error) {
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

  const handleUseSuggestion = async (suggestionId: string) => {
    try {
      const suggestion = await useSuggestion({
        suggestionId: suggestionId as any,
      });
      await handleInputChange(suggestion);
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to use suggestion");
    }
  };

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

  const handleStartNewGame = async () => {
    console.log("Starting new game...");
    // Reset component state
    setCurrentInput("");
    setInviteLink(null);
    setShowNameEntry(false);
    setDisplayName("");
    setShowWrong(false);
    setIsSubmitting(false);
    setIsGettingHint(false);
    setIsGettingClue(false);
    setIsCreatingInvite(false);
    setTimeRemaining(null);
    setShowCopySuccess(false);
    setErrorMessage(null);

    await startNewGame();
  };

  if (!currentGame) {
    return (
      <div className="brutal-card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p style={{ color: "var(--text-secondary)" }}>
          Generating your impossible word...
        </p>
      </div>
    );
  }

  const renderWordDisplay = () => {
    const letters = currentGame.letters || [];
    const currentGuess = currentInput.toLowerCase();

    if (letters.length === 0) {
      return (
        <div
          className="text-center mb-8"
          style={{ color: "var(--text-secondary)" }}
        >
          Loading word...
        </div>
      );
    }

    return (
      <div className="flex justify-center gap-2 mb-8">
        {letters.map((letter, index) => {
          const isRevealed = currentGuess[index] === letter;
          const hasGuess = currentGuess[index];
          return (
            <div
              key={index}
              className={`brutal-word-box ${
                isRevealed ? "correct" : hasGuess ? "filled" : "empty"
              }`}
            >
              {isRevealed ? letter : hasGuess ? currentGuess[index] : ""}
            </div>
          );
        })}
      </div>
    );
  };

  // Show shuffled letters as clues above the word boxes
  const renderLetterHints = () => {
    if (
      !currentGame.shuffledLetters ||
      currentGame.shuffledLetters.length === 0
    ) {
      return null;
    }

    return (
      <div className="text-center mb-6">
        <p
          className="brutal-text-md mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Letters in the word:
        </p>
        <div className="flex justify-center gap-2 flex-wrap mb-4">
          {currentGame.shuffledLetters.map((letter, index) => (
            <span
              key={index}
              className="brutal-badge"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
              }}
            >
              {letter}
            </span>
          ))}
        </div>
        {/* Error messages appear here instead of toasts */}
        {errorMessage && (
          <div className="brutal-card error mt-4">
            <p
              className="brutal-text-md"
              style={{ color: "var(--text-inverse)" }}
            >
              {errorMessage}
            </p>
          </div>
        )}
        {isSubmitting && (
          <div
            className="brutal-card mt-4"
            style={{ background: "var(--bg-surface)" }}
          >
            <p
              className="brutal-text-md"
              style={{ color: "var(--text-primary)" }}
            >
              Submitting guess...
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderSuggestions = () => {
    if (!suggestions || suggestions.length === 0) return null;
    return (
      <div
        className="brutal-card mb-4"
        style={{ background: "var(--bg-surface)" }}
      >
        <div
          className="brutal-text-md mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Friend Suggestions:
        </div>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
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
                  className="brutal-text-md"
                  style={{ color: "var(--text-secondary)" }}
                >
                  from {suggestion.helperName}
                </span>
              </div>
              <button
                onClick={() => handleUseSuggestion(suggestion._id)}
                className="brutal-button secondary px-3 py-1 text-sm"
              >
                Try
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGameStatus = () => {
    return (
      <div className="brutal-stats-card">
        <p
          className="brutal-text-lg mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Attempts: {currentGame.attempts}/3
        </p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Type the word. A full attempt is counted when you enter a complete
          word.
        </p>
      </div>
    );
  };

  const isGameOver = currentGame.completed;

  return (
    <div className="space-y-8">
      {renderLetterHints()}
      {currentGame.hint === "Generating hint..." && (
        <div
          className="brutal-card text-center"
          style={{ background: "var(--bg-surface)" }}
        >
          <div
            className="brutal-text-md"
            style={{ color: "var(--text-primary)" }}
          >
            Hint is loading...
          </div>
        </div>
      )}
      {currentGame.hint && currentGame.hint !== "Generating hint..." && (
        <div
          className="brutal-card text-center"
          style={{ background: "var(--bg-warning)" }}
        >
          <div
            className="brutal-text-md mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Hint:
          </div>
          <div
            className="brutal-text-md"
            style={{ color: "var(--text-primary)" }}
          >
            {currentGame.hint}
          </div>
        </div>
      )}
      {currentGame.clue && (
        <div
          className="brutal-card text-center"
          style={{ background: "var(--bg-success)" }}
        >
          <div
            className="brutal-text-md mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Clue:
          </div>
          <div
            className="brutal-text-lg"
            style={{ color: "var(--text-primary)", fontFamily: "monospace" }}
          >
            {currentGame.clue}
          </div>
        </div>
      )}
      {renderSuggestions()}
      {currentGame.attempts === 2 && currentGame.canPlay && !showWrong && (
        <div
          className="brutal-card text-center last-chance-box"
          style={{ background: "var(--bg-error)" }}
        >
          <div
            className="brutal-text-xl"
            style={{ color: "var(--text-inverse)" }}
          >
            Last Chance!
          </div>
          {timeRemaining !== null && (
            <div className="space-y-2">
              <div
                className="brutal-text-md"
                style={{ color: "var(--text-inverse)" }}
              >
                Time remaining: {Math.ceil(timeRemaining / 1000)}s
              </div>
              <div
                className="brutal-container h-3"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${(timeRemaining / 60000) * 100}%`,
                    background: "var(--bg-accent)",
                    borderRadius: "var(--border-radius)",
                  }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className={isGameOver ? "" : ""}>{renderWordDisplay()}</div>
      {showWrong && (
        <div
          className="brutal-card text-center"
          style={{ background: "var(--bg-error)" }}
        >
          <span
            className="brutal-text-xl animate-pulse"
            style={{ color: "var(--text-inverse)" }}
          >
            WRONG
          </span>
        </div>
      )}
      {currentGame.canPlay && !showWrong && (
        <div className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && currentInput.toLowerCase() === "vex") {
                  handleInputChange("vex");
                }
              }}
              disabled={isSubmitting || isGameOver}
              className="brutal-input w-full text-center text-xl disabled:opacity-50"
              placeholder="Type the word..."
              maxLength={Math.max(currentGame.word.length, 3)}
            />
          </div>
          {/* Invite Friend Button */}
          <div className="text-center space-y-4">
            {!inviteLink ? (
              <button
                onClick={handleCreateInvite}
                disabled={isCreatingInvite || isGameOver}
                className="brutal-button px-6 py-3 disabled:opacity-50"
              >
                {isCreatingInvite ? "Creating invite..." : "Invite a Friend"}
              </button>
            ) : (
              <div className="brutal-card">
                <div className="flex items-center gap-2 mb-3">
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
                  Share this link with a friend to get help!
                </p>
              </div>
            )}
          </div>
          {currentGame.attempts >= 1 && (
            <div className="text-center space-y-4">
              <button
                onClick={handleGetHint}
                disabled={
                  currentGame.hint === "Generating hint..." || isGameOver
                }
                className="brutal-button warning px-6 py-3 disabled:opacity-50"
              >
                {currentGame.hint === "Generating hint..."
                  ? "Getting hint..."
                  : "Ask for Help"}
              </button>
              {currentGame.attempts >= 2 && (
                <button
                  onClick={handleGetClue}
                  disabled={isGettingClue || isGameOver || !!currentGame.clue}
                  className="brutal-button secondary px-6 py-3 disabled:opacity-50"
                >
                  {isGettingClue
                    ? "Getting clue..."
                    : currentGame.clue
                      ? "Clue Used"
                      : "Give me a clue"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div>{renderGameStatus()}</div>
    </div>
  );
}
