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
  const inputRef = useRef<HTMLInputElement>(null);

  // Update current input when game state changes
  useEffect(() => {
    if (currentGame?.currentGuess !== undefined) {
      setCurrentInput(currentGame.currentGuess);
    }
  }, [currentGame?.currentGuess]);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current && currentGame?.canPlay) {
      inputRef.current.focus();
    }
  }, [currentGame?.canPlay]);

  // Start new game if no current game (but don't auto-start if we have a completed game)
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
    if (currentGame?.completed && !showNameEntry) {
      setShowNameEntry(true);
    }
  }, [currentGame?.completed, showNameEntry]);

  const handleInputChange = async (value: string) => {
    if (!currentGame || !currentGame.canPlay) return;

    // Only allow letters and limit to word length
    const cleanValue = value
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .slice(0, currentGame.word.length);
    setCurrentInput(cleanValue);

    // Update in database
    await updateGuess({ guess: cleanValue });

    // Check for wrong letters
    const targetWord = currentGame.word.toLowerCase();
    for (let i = 0; i < cleanValue.length; i++) {
      if (cleanValue[i] !== targetWord[i]) {
        setShowWrong(true);
        setTimeout(() => {
          setShowWrong(false);
          setCurrentInput("");
          updateGuess({ guess: "" });
        }, 1000);

        // Submit as failed attempt
        try {
          setIsSubmitting(true);
          const result = await submitGuess({ guess: cleanValue });
          if (!result.correct) {
            toast.error(`Wrong! Keep trying!`);
          }
        } catch (error) {
          toast.error("Failed to submit guess");
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
    }

    // If they've typed the complete word correctly
    if (cleanValue.length === targetWord.length && cleanValue === targetWord) {
      try {
        setIsSubmitting(true);
        const result = await submitGuess({ guess: cleanValue });
        if (result.correct) {
          // Trigger confetti
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
          toast.success("Incredible! You solved the impossible! 🎉");
        }
      } catch (error) {
        toast.error("Failed to submit guess");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGetHint = async () => {
    try {
      setIsGettingHint(true);
      await requestHint();
      toast.success("Hint requested! Check back in a moment.");
    } catch (error) {
      toast.error("Hints only available after 2 attempts");
    } finally {
      setIsGettingHint(false);
    }
  };

  const handleCreateInvite = async () => {
    try {
      setIsCreatingInvite(true);
      const inviteId = await createInviteLink();
      const link = `${window.location.origin}?invite=${inviteId}`;
      setInviteLink(link);
      toast.success("Invite link created!");
    } catch (error) {
      toast.error("Failed to create invite link");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setShowCopySuccess(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      // Fallback for mobile browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setShowCopySuccess(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  const handleUseSuggestion = async (suggestionId: string) => {
    try {
      const suggestion = await useSuggestion({
        suggestionId: suggestionId as any,
      });
      await handleInputChange(suggestion);
      toast.info("Using friend's suggestion!");
    } catch (error) {
      toast.error("Failed to use suggestion");
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim()) {
      await updateDisplayName({ displayName: displayName.trim() });
      toast.success("Name saved!");
    }
    setShowNameEntry(false);
  };

  const handleSkipNameEntry = async () => {
    // Save as anonymous player to leaderboard
    await updateDisplayName({ displayName: "Anonymous" });
    setShowNameEntry(false);
    toast.info("Added as anonymous player!");
  };

  const handleStartNewGame = async () => {
    // Reset all component state
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

    // Start new game
    await startNewGame();
    toast.info("Starting new game with a fresh word!");
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
    const letters = currentGame.letters;
    const currentGuess = currentInput.toLowerCase();

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

  const renderLetterHints = () => {
    if (
      !currentGame.shuffledLetters ||
      currentGame.shuffledLetters.length === 0
    ) {
      return (
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-2">Letters in the word:</p>
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">Loading letters...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 mb-2">Letters in the word:</p>
        <div className="flex justify-center gap-1 flex-wrap">
          {currentGame.shuffledLetters.map((letter, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm font-mono uppercase"
            >
              {letter}
            </span>
          ))}
        </div>
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

          {showNameEntry && (
            <div className="space-y-3 mt-4">
              <p className="text-sm text-gray-600">Add your name (optional):</p>
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

          <button
            onClick={handleStartNewGame}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Start New Game
          </button>
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

          {showNameEntry && (
            <div className="space-y-3 mt-4">
              <p className="text-sm text-gray-600">Add your name (optional):</p>
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

          <button
            onClick={handleStartNewGame}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Start New Game
          </button>
        </div>
      );
    }

    return (
      <div className="text-center space-y-4">
        <p className="text-gray-600">Attempts: {currentGame.attempts}/3</p>
        <p className="text-sm text-gray-500">
          Type the word letter by letter. Wrong letters reset your progress.
        </p>
      </div>
    );
  };

  const isGameOver = currentGame.completed;

  return (
    <div className="space-y-8">
      {renderLetterHints()}

      {/* Hint display right below letters */}
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

      {/* Last chance warning and timer */}
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

          {/* Help button appears after 2 attempts */}
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
