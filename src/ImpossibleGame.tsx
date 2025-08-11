import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export function ImpossibleGame() {
  const currentGame = useQuery(api.game.getCurrentGame);
  const suggestions = useQuery(api.game.getSuggestions);
  const updateGuess = useMutation(api.game.updateCurrentGuess);
  const submitGuess = useMutation(api.game.submitGuess);
  const startNewGame = useMutation(api.game.startNewGame);
  const requestHint = useMutation(api.game.requestHint);
  const updateDisplayName = useMutation(api.game.updateDisplayName);
  const createInviteLink = useMutation(api.game.createInviteLink);
  const useSuggestion = useMutation(api.game.useSuggestion);
  const startThirdAttemptTimer = useMutation(api.game.startThirdAttemptTimer);

  const [currentInput, setCurrentInput] = useState("");
  const [showWrong, setShowWrong] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingHint, setIsGettingHint] = useState(false);
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
        const remaining = Math.max(0, 120000 - elapsed); // 2 minutes
        setTimeRemaining(remaining);

        if (remaining === 0) {
          clearInterval(interval);
          submitGuess({ guess: "" });
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

  // Show name entry when game completes (win or loss)
  useEffect(() => {
    console.log("Game completion useEffect triggered", {
      completed: currentGame?.completed,
      showNameEntry,
      attempts: currentGame?.attempts,
      won: currentGame?.won,
      canPlay: currentGame?.canPlay,
    });

    if (currentGame?.completed && !showNameEntry) {
      console.log("✅ Game completed, showing name entry", {
        completed: currentGame.completed,
        won: currentGame.won,
        attempts: currentGame.attempts,
      });
      setShowNameEntry(true);
      setErrorMessage(null); // Clear any error messages when game completes
      setCurrentInput(""); // Clear input when game completes
    }
  }, [currentGame?.completed, showNameEntry]);

  const handleInputChange = async (value: string) => {
    if (!currentGame) return;

    // Allow input even if game is completed (for viewing purposes)
    // but prevent submission logic for completed games
    if (currentGame.completed) return;

    // Only allow letters and limit to word length
    const cleanValue = value
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .slice(0, currentGame.word.length);
    setCurrentInput(cleanValue);

    // Clear error message when user starts typing a new word
    if (cleanValue.length === 1) {
      setErrorMessage(null);
    }

    // Persist current guess for realtime sync
    await updateGuess({ guess: cleanValue });

    // Only submit when they've typed a complete word
    const targetWord = currentGame.word.toLowerCase();
    if (cleanValue.length === targetWord.length) {
      try {
        setIsSubmitting(true);
        setErrorMessage(null);
        const result = await submitGuess({ guess: cleanValue });
        console.log("📤 Submit guess result:", result);

        if (result.correct) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else {
          // Check if this was the final attempt (attemptsRemaining will be 0)
          if (result.attemptsRemaining === 0) {
            console.log("🎯 Final attempt - game should complete now");
            // Game is over - don't show "try another word", let the completion flow handle it
            setCurrentInput("");
            await updateGuess({ guess: "" });

            // Force show name entry since this is the final attempt
            // In case the useEffect doesn't trigger immediately due to Convex query delay
            setTimeout(() => {
              console.log("🔄 Forcing name entry after 500ms delay");
              setShowNameEntry(true);
              setErrorMessage(null);
            }, 500);
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
      setErrorMessage(error.message || "Hints only available after 2 attempts");
    } finally {
      setIsGettingHint(false);
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
    setIsCreatingInvite(false);
    setTimeRemaining(null);
    setShowCopySuccess(false);
    setErrorMessage(null);

    await startNewGame();
  };

  if (!currentGame) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p className="text-gray-600">Generating your impossible word...</p>
      </div>
    );
  }

  const renderWordDisplay = () => {
    const letters = currentGame.letters || [];
    const currentGuess = currentInput.toLowerCase();

    if (letters.length === 0) {
      return (
        <div className="text-center text-gray-500 mb-8">Loading word...</div>
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
              className={`w-12 h-12 border-2 flex items-center justify-center text-xl font-bold uppercase transition-all duration-200 ${
                isRevealed
                  ? "border-green-500 bg-green-100 text-green-800"
                  : hasGuess
                    ? "border-red-500 bg-red-100 text-red-800"
                    : "border-gray-300 bg-white text-gray-400"
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
        <p className="text-sm text-gray-600 mb-3">Letters in the word:</p>
        <div className="flex justify-center gap-1 flex-wrap">
          {currentGame.shuffledLetters.map((letter, index) => (
            <span
              key={index}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-lg font-mono uppercase border"
            >
              {letter}
            </span>
          ))}
        </div>
        {/* Error messages appear here instead of toasts */}
        {errorMessage && (
          <div className="mt-3 px-4 py-2 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}
        {isSubmitting && (
          <div className="mt-3 text-sm text-blue-600">Submitting guess...</div>
        )}
      </div>
    );
  };

  const renderSuggestions = () => {
    if (!suggestions || suggestions.length === 0) return null;
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="text-sm text-blue-800 font-semibold mb-2">
          Friend Suggestions:
        </div>
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion._id}
              className="flex items-center justify-between"
            >
              <div className="text-sm">
                <span className="font-mono uppercase text-blue-700">
                  {suggestion.suggestion}
                </span>
                <span className="text-blue-600 ml-2">
                  from {suggestion.helperName}
                </span>
              </div>
              <button
                onClick={() => handleUseSuggestion(suggestion._id)}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
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
    if (currentGame.completed && currentGame.won) {
      return (
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold text-green-600">
            🎉 Congratulations!
          </div>
          <p className="text-gray-600">You guessed the impossible word!</p>
          {!showNameEntry && (
            <button
              onClick={handleStartNewGame}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Start New Game
            </button>
          )}
        </div>
      );
    }

    if (currentGame.completed && !currentGame.won) {
      return (
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-red-600">Game Over</div>
          <p className="text-gray-600">You've used all 3 attempts!</p>
          <p className="text-sm text-gray-500">
            The word was:{" "}
            <span className="font-bold uppercase">{currentGame.word}</span>
          </p>
          {!showNameEntry && (
            <button
              onClick={handleStartNewGame}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Start New Game
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="text-center space-y-4">
        <p className="text-gray-600">Attempts: {currentGame.attempts}/3</p>
        <p className="text-sm text-gray-500">
          Type the word. A full attempt is counted when you enter a complete
          word.
        </p>
      </div>
    );
  };

  const isGameOver = currentGame.completed;

  return (
    <div className="space-y-8">
      {/* Name entry at top when game completes */}
      {showNameEntry && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 mb-3">
            Add your name to the leaderboard (optional):
          </p>
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-gray-800 focus:outline-none"
              maxLength={20}
            />
            <div className="flex gap-2 justify-center">
              <button
                type="submit"
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleSkipNameEntry}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Skip
              </button>
            </div>
          </form>
        </div>
      )}

      {renderLetterHints()}
      {currentGame.hint === "Generating hint..." && (
        <div className="text-center">
          <div className="text-sm text-blue-600">Hint is loading...</div>
        </div>
      )}
      {currentGame.hint && currentGame.hint !== "Generating hint..." && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-sm text-yellow-800 font-semibold mb-1">
            Hint:
          </div>
          <div className="text-yellow-700">{currentGame.hint}</div>
        </div>
      )}
      {renderSuggestions()}
      {currentGame.attempts === 2 && currentGame.canPlay && !showWrong && (
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 mb-2">
              Last Chance!
            </div>
            {timeRemaining !== null && (
              <div className="space-y-2">
                <div className="text-sm text-red-600">
                  Time remaining: {Math.ceil(timeRemaining / 1000)}s
                </div>
                <div className="w-full bg-red-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${(timeRemaining / 120000) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={isGameOver ? "" : ""}>{renderWordDisplay()}</div>
      {showWrong && (
        <div className="text-center">
          <span className="text-2xl font-bold text-red-600 animate-pulse">
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
              disabled={isSubmitting || isGameOver}
              className="w-full px-4 py-3 text-center text-xl font-mono uppercase border-2 border-gray-300 rounded-lg focus:border-gray-800 focus:outline-none transition-colors disabled:opacity-50"
              placeholder="Type the word..."
              maxLength={currentGame.word.length}
            />
          </div>
          {/* Invite Friend Button */}
          <div className="text-center space-y-2">
            {!inviteLink ? (
              <button
                onClick={handleCreateInvite}
                disabled={isCreatingInvite || isGameOver}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isCreatingInvite ? "Creating invite..." : "Invite a Friend"}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      showCopySuccess
                        ? "bg-green-600 text-white"
                        : "bg-black text-white hover:bg-gray-800"
                    }`}
                  >
                    {showCopySuccess ? "✓ Copied!" : "📋 Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  Share this link with a friend to get help!
                </p>
              </div>
            )}
          </div>
          {currentGame.attempts >= 2 && (
            <div className="text-center">
              <button
                onClick={handleGetHint}
                disabled={
                  currentGame.hint === "Generating hint..." || isGameOver
                }
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {currentGame.hint === "Generating hint..."
                  ? "Getting hint..."
                  : "Ask for Help"}
              </button>
            </div>
          )}
        </div>
      )}
      <div>{renderGameStatus()}</div>
    </div>
  );
}
