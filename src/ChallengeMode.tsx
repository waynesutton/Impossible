import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

interface ChallengeCompletionData {
  challengeId: Id<"challengeBattles">;
  challengerName: string;
  opponentName: string;
  words: string[];
  finalScores: {
    challenger: number;
    opponent: number;
  };
  winner?: string;
}

interface ChallengeModeProps {
  challengeId: Id<"challengeBattles">;
  onBackToHome: () => void;
  onNavigateToLeaderboard?: (data?: ChallengeCompletionData) => void;
}

// Check if this is a challenge invite link (came from URL parameter)
const isChallengeInviteLink = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has("challenge");
};

// Challenge Gameplay Component
interface ChallengeGameplayProps {
  challenge: any;
  userRole: "challenger" | "opponent" | undefined;
  currentWord: any;
  challengerAttempt: any;
  opponentAttempt: any;
  challengeId: Id<"challengeBattles">;
  hasAcceptedAsOpponent: boolean;
  onBackToHome: () => void;
}

function ChallengeGameplay({
  challenge,
  userRole,
  currentWord,
  challengerAttempt,
  opponentAttempt,
  challengeId,
  hasAcceptedAsOpponent,
  onBackToHome,
}: ChallengeGameplayProps) {
  const [currentGuess, setCurrentGuess] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [helpContent, setHelpContent] = useState<string | null>(null);
  const [isGettingHelp, setIsGettingHelp] = useState(false);

  const submitGuess = useMutation(api.challengeBattle.submitChallengeGuess);
  const updateCurrentGuess = useMutation(
    api.challengeBattle.updateChallengeGuess,
  );
  const useHelp = useMutation(api.challengeBattle.useChallengeHelp);
  const skipWord = useMutation(api.challengeBattle.skipChallengeWord);
  const quitChallenge = useMutation(api.challengeBattle.quitChallenge);
  const timerState = useQuery(api.challengeBattle.getChallengeTimer, {
    challengeId,
  });

  // Real-time timer countdown - will be set by server timer state
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isLoadingNextWord, setIsLoadingNextWord] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  // Timer will be initialized by the main timer effect below

  useEffect(() => {
    if (!timerState || !timerState.started) return;

    const updateTimer = () => {
      const elapsed = Date.now() - timerState.started;
      // Use dynamic time limit based on round: round 3 (index 2) = 30s, others = 60s
      const timeLimit = timerState.wordIndex === 2 ? 30000 : 60000;
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));

      setTimeRemaining(remaining);

      // Show loader when timer expires
      if (remaining === 0 && !isLoadingNextWord) {
        setIsLoadingNextWord(true);
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [timerState?.started, timerState?.wordIndex, isLoadingNextWord]); // Include wordIndex to reset on new rounds

  // Handle window close/refresh to end game for other player
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only show warning during active gameplay
      if (challenge.status === "in_progress") {
        event.preventDefault();
        event.returnValue = ""; // Required for Chrome
        return "Leaving will end the challenge for both players. Are you sure?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [challenge.status]);

  // Hide loader when new word starts
  useEffect(() => {
    if (timerState?.started && isLoadingNextWord) {
      setIsLoadingNextWord(false);
    }
  }, [timerState?.started, isLoadingNextWord]);

  // Format timer display
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "TIME'S UP!";
    return `${seconds}s`;
  };

  // Timer color based on remaining time (theme-aware) - no white blinking
  const getTimerColor = (seconds: number) => {
    // Use orange/red tones that work with all themes without white flashing
    if (seconds <= 10) return "#dc2626"; // Red but not theme-breaking white
    if (seconds <= 30) return "#ea580c"; // Orange for warning
    return "var(--text-primary)"; // Normal theme color
  };

  // Handle input like the regular game
  const handleInputChange = async (value: string) => {
    if (!currentWord || userAttempt?.completed || userAttempt?.attempts >= 3)
      return;

    // Only allow letters and limit to word length
    let cleanValue = value.toLowerCase().replace(/[^a-z]/g, "");
    cleanValue = cleanValue.slice(0, currentWord.length);

    // Prevent backspacing - only allow adding characters
    if (cleanValue.length < currentGuess.length) {
      return;
    }

    setCurrentGuess(cleanValue.toUpperCase());

    // Persist current guess for real-time sync
    await updateCurrentGuess({
      challengeId,
      guess: cleanValue,
      isOpponentSession: hasAcceptedAsOpponent,
    });

    // Allow manual submission only - no auto-submit
  };

  const handleHelp = async (helpType: "hint" | "clue") => {
    try {
      setIsGettingHelp(true);
      setError(null);

      const result = await useHelp({
        challengeId,
        helpType,
        isOpponentSession: hasAcceptedAsOpponent,
      });

      if (result.success && result.content) {
        setHelpContent(result.content);
        // Clear help content after 5 seconds
        setTimeout(() => setHelpContent(null), 5000);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsGettingHelp(false);
    }
  };

  const handleSkipWord = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      await skipWord({
        challengeId,
        isOpponentSession: hasAcceptedAsOpponent,
      });

      // Clear current guess since word is skipped
      setCurrentGuess("");
    } catch (error: any) {
      setError(error.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExitChallenge = () => {
    setShowExitConfirmation(true);
  };

  const handleConfirmExit = async () => {
    try {
      await quitChallenge({
        challengeId,
        isOpponentSession: hasAcceptedAsOpponent,
      });
      setShowExitConfirmation(false);
      onBackToHome();
    } catch (error: any) {
      setError(error.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSubmitGuess = async () => {
    if (!currentGuess.trim() || !userRole || userAttempt?.completed) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await submitGuess({
        challengeId,
        guess: currentGuess.trim(),
        isOpponentSession: hasAcceptedAsOpponent,
      });

      if (result.correct) {
        setCurrentGuess("");
        setError(null);
        // Show success feedback
        console.log(`Correct! You scored ${result.score} points!`);
      } else {
        // Clear the guess and show they can try again
        setCurrentGuess("");
        const attemptsLeft = 3 - ((userAttempt?.attempts || 0) + 1);
        if (attemptsLeft > 0) {
          setError(`Incorrect! ${attemptsLeft} attempts remaining.`);
        } else {
          setError("Incorrect! No more attempts for this word.");
        }
        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);
      }

      if (result.wordCompleted) {
        console.log("Word completed! Moving to next word...");
      }

      if (result.gameCompleted) {
        console.log("Challenge completed! Showing results...");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current player's attempt
  const userAttempt =
    userRole === "challenger" ? challengerAttempt : opponentAttempt;
  const opponentCurrentAttempt =
    userRole === "challenger" ? opponentAttempt : challengerAttempt;

  // Sync current guess with user's attempt
  useEffect(() => {
    if (userAttempt?.currentGuess) {
      setCurrentGuess(userAttempt.currentGuess);
    }
  }, [userAttempt?.currentGuess]);

  if (!currentWord) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card max-w-lg w-full text-center">
          <h1 className="text-2xl font-black mb-4">Loading Word...</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Generating challenge words...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="brutal-card max-w-4xl w-full">
        {/* Challenge Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black mb-2">Challenge Battle!</h1>
          <div className="challenger-vs-opponent mb-4">
            <div className="challenger-score">
              <h3 className="font-bold">{challenge.challengerName}</h3>
              <p className="text-2xl font-black">{challenge.challengerScore}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Challenger
              </p>
            </div>

            <div className="vs-divider">VS</div>

            <div className="opponent-score">
              <h3 className="font-bold">{challenge.opponentName}</h3>
              <p className="text-2xl font-black">{challenge.opponentScore}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Opponent
              </p>
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Word {challenge.currentWordIndex + 1} of {challenge.maxWords}
            </p>
          </div>
        </div>

        {/* Timer */}
        <div
          className="challenge-timer mb-6"
          style={{
            color: getTimerColor(timeRemaining),
            background: "var(--bg-card)",
            border: "3px solid var(--border-color)",
            padding: "1rem",
            borderRadius: "8px",
            fontSize: "2rem",
            fontWeight: "900",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          {isLoadingNextWord ? (
            <>
              <div className="animate-spin">⏳</div>
              <span style={{ fontSize: "1.5rem" }}>Loading next word...</span>
            </>
          ) : (
            formatTime(timeRemaining)
          )}
        </div>

        {/* Available Letters */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-black mb-4">Available Letters:</h2>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {currentWord.shuffledLetters.map(
              (letter: string, index: number) => (
                <div
                  key={index}
                  className="w-10 h-10 flex items-center justify-center font-black text-lg border-3 border-solid"
                  style={{
                    border: "3px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                  }}
                >
                  {letter}
                </div>
              ),
            )}
          </div>
        </div>

        {/* Word Boxes (like regular game) */}
        <div className="text-center mb-6">
          <h3 className="font-bold mb-4">Your Guess:</h3>
          <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: currentWord.length }).map((_, index) => {
              const hasGuess = currentGuess[index];
              const isCorrect =
                hasGuess &&
                hasGuess.toLowerCase() ===
                  currentWord.letters[index]?.toLowerCase();
              return (
                <div
                  key={index}
                  className={`w-12 h-12 flex items-center justify-center font-black text-xl border-3 border-solid brutal-word-box ${
                    isCorrect ? "correct" : hasGuess ? "filled" : "empty"
                  }`}
                  style={{
                    border: "3px solid var(--border-color)",
                    background: isCorrect
                      ? "#22c55e" // Green for correct
                      : hasGuess
                        ? "#fbbf24" // Yellow for filled
                        : "var(--bg-secondary)",
                    color: isCorrect
                      ? "#ffffff" // White text on green
                      : hasGuess
                        ? "#000000" // Black text on yellow
                        : "var(--text-secondary)",
                  }}
                >
                  {hasGuess || ""}
                </div>
              );
            })}
          </div>

          {/* Hidden input for keyboard capture */}
          <input
            type="text"
            value={currentGuess}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSubmitGuess();
              }
            }}
            placeholder="Type letters..."
            className="brutal-input text-center text-xl font-black"
            maxLength={currentWord.length}
            disabled={userAttempt?.completed}
            style={{ maxWidth: "300px" }}
          />
        </div>

        {/* Action Buttons */}
        <div className="mb-6">
          <div
            className="text-center space-x-4"
            style={{ opacity: isLoadingNextWord ? 0.5 : 1 }}
          >
            <button
              onClick={handleSubmitGuess}
              disabled={
                !currentGuess.trim() ||
                userAttempt?.completed ||
                isSubmitting ||
                userAttempt?.attempts >= 3 ||
                currentGuess.length !== currentWord.length ||
                isLoadingNextWord
              }
              className="brutal-button primary challenge-button"
            >
              {isSubmitting
                ? "Submitting..."
                : userAttempt?.attempts >= 3
                  ? challenge.currentWordIndex >= 2
                    ? "Game Over"
                    : "Round Complete"
                  : `Submit Guess (${(userAttempt?.attempts || 0) + 1}/3)`}
            </button>

            <button
              onClick={handleSkipWord}
              disabled={
                userAttempt?.completed || isSubmitting || isLoadingNextWord
              }
              className="brutal-button warning challenge-button"
              style={{ marginLeft: "1rem" }}
            >
              {isSubmitting ? "Skipping..." : "Skip Word (0 pts)"}
            </button>

            <button
              onClick={() => handleHelp("hint")}
              disabled={
                isGettingHelp || userAttempt?.completed || isLoadingNextWord
              }
              className="brutal-button secondary challenge-button"
            >
              {userAttempt?.usedHint ? "Show Hint Again" : "Ask for Help"}
            </button>

            <button
              onClick={() => handleHelp("clue")}
              disabled={
                isGettingHelp || userAttempt?.completed || isLoadingNextWord
              }
              className="brutal-button secondary challenge-button"
            >
              {userAttempt?.usedClue ? "Show Clue Again" : "Ask for Clue"}
            </button>
          </div>
        </div>

        {/* Help Content Display */}
        {helpContent && (
          <div
            className="p-4 text-center font-medium mb-6"
            style={{
              background: "var(--bg-success)",
              border: "3px solid var(--border-color)",
              color: "var(--text-success)",
            }}
          >
            <h4 className="font-bold mb-2">💡 Help:</h4>
            <p>{helpContent}</p>
          </div>
        )}

        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center">
            <h4 className="font-bold mb-2">Your Progress:</h4>
            <p>Attempts: {userAttempt?.attempts || 0}/3</p>
            <p>
              Status:{" "}
              {userAttempt?.completed
                ? userAttempt?.finalScore === 0
                  ? "Skipped"
                  : "Completed"
                : userAttempt?.attempts >= 3
                  ? "No more attempts"
                  : timeRemaining <= 0
                    ? "Time's up"
                    : "In progress"}
            </p>
            {userAttempt &&
              userAttempt.attempts > 0 &&
              !userAttempt.completed &&
              userAttempt.attempts < 3 && (
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {3 - userAttempt.attempts} attempts remaining
                </p>
              )}
          </div>

          <div className="text-center">
            <h4 className="font-bold mb-2">Opponent Progress:</h4>
            <p>Attempts: {opponentCurrentAttempt?.attempts || 0}/3</p>
            <p>
              Status:{" "}
              {opponentCurrentAttempt?.completed
                ? opponentCurrentAttempt?.finalScore === 0
                  ? "Skipped"
                  : "Completed"
                : opponentCurrentAttempt?.attempts >= 3
                  ? "No more attempts"
                  : timeRemaining <= 0
                    ? "Time's up"
                    : "In progress"}
            </p>
            {opponentCurrentAttempt &&
              opponentCurrentAttempt.attempts > 0 &&
              !opponentCurrentAttempt.completed &&
              opponentCurrentAttempt.attempts < 3 && (
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {3 - opponentCurrentAttempt.attempts} attempts remaining
                </p>
              )}
          </div>
        </div>

        {error && (
          <div
            className="p-4 text-center font-medium mb-4"
            style={{
              background: "var(--bg-error)",
              border: "3px solid var(--border-color)",
              color: "var(--text-error)",
            }}
          >
            {error}
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleExitChallenge}
            className="brutal-button secondary challenge-button"
          >
            Exit Challenge
          </button>
        </div>

        {/* Exit Confirmation Modal */}
        {showExitConfirmation && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowExitConfirmation(false)}
          >
            <div
              className="brutal-card max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Exit Challenge?</h2>
                <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
                  Are you sure you want to exit? This will end the challenge for
                  both players.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setShowExitConfirmation(false)}
                    className="brutal-button secondary challenge-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmExit}
                    className="brutal-button warning challenge-button"
                  >
                    Exit Challenge
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChallengeMode({
  challengeId,
  onBackToHome,
  onNavigateToLeaderboard,
}: ChallengeModeProps) {
  const [opponentName, setOpponentName] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAcceptedAsOpponent, setHasAcceptedAsOpponent] = useState(false);

  // Function to clear opponent session data and go home
  const handleBackToHome = () => {
    const storageKey = `opponent_${challengeId}`;
    localStorage.removeItem(storageKey);
    onBackToHome();
  };
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const challengeState = useQuery(api.challengeBattle.getChallengeState, {
    challengeId,
    forceOpponentView: hasAcceptedAsOpponent, // Help identify role in demo mode
  });

  const acceptChallenge = useMutation(api.challengeBattle.acceptChallenge);
  const setPlayerReady = useMutation(api.challengeBattle.setPlayerReady);

  // Persist opponent status in localStorage
  useEffect(() => {
    const storageKey = `opponent_${challengeId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored === "true") {
      setHasAcceptedAsOpponent(true);
    }
  }, [challengeId]);

  // Save opponent status when it changes
  useEffect(() => {
    if (hasAcceptedAsOpponent) {
      const storageKey = `opponent_${challengeId}`;
      localStorage.setItem(storageKey, "true");
    }
  }, [hasAcceptedAsOpponent, challengeId]);

  if (!challengeState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="brutal-card text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p>Loading challenge...</p>
        </div>
      </div>
    );
  }

  const { challenge, userRole } = challengeState;

  const handleAcceptChallenge = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!opponentName.trim()) {
      setError("Please enter your name");
      return;
    }

    try {
      setIsAccepting(true);
      setError(null);

      await acceptChallenge({
        challengeId,
        opponentName: opponentName.trim(),
      });

      // Mark that this user has accepted as opponent
      setHasAcceptedAsOpponent(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsAccepting(false);
    }
  };

  const handlePlayerReady = async () => {
    if (!userRole) return;

    try {
      setError(null);
      await setPlayerReady({
        challengeId,
        player: userRole,
        isOpponentSession: hasAcceptedAsOpponent, // Pass opponent session info
      });
    } catch (error: any) {
      setError(error.message);
    }
  };

  // Challenge is waiting for an opponent - show accept form
  // If there's no opponent yet AND this is a challenge invite link, show accept form
  if (
    challenge.status === "waiting_for_opponent" &&
    !challenge.opponentUserId &&
    isChallengeInviteLink()
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black mb-4">Accept Challenge</h1>
            <p style={{ color: "var(--text-secondary)" }}>
              <strong>{challenge.challengerName}</strong> has challenged you to
              a word battle!
            </p>
          </div>

          <form onSubmit={handleAcceptChallenge} className="space-y-4">
            <div>
              <label
                htmlFor="opponentName"
                className="block text-sm font-medium mb-2"
              >
                Your Name:
              </label>
              <input
                id="opponentName"
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="Enter your name"
                className="brutal-input w-full"
                disabled={isAccepting}
                maxLength={50}
              />
            </div>

            {error && (
              <div
                className="p-4 text-center font-medium"
                style={{
                  background: "var(--bg-error)",
                  border: "3px solid var(--border-error)",
                  color: "var(--text-error)",
                }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleBackToHome}
                className="brutal-button secondary challenge-button flex-1"
                disabled={isAccepting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="brutal-button primary challenge-button flex-1"
                disabled={isAccepting || !opponentName.trim()}
              >
                {isAccepting ? "Accepting..." : "Accept Challenge"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Challenger is waiting for opponent to accept
  if (
    challenge.status === "waiting_for_opponent" &&
    userRole === "challenger"
  ) {
    const challengeLink = `${window.location.origin}/?challenge=${challengeId}`;

    const copyToClipboard = async (text: string) => {
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      } catch (_error) {
        // Fallback for mobile devices that don't support clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card max-w-lg w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black mb-4">Challenge Created!</h1>
            <p style={{ color: "var(--text-secondary)" }}>
              Share this link with someone to challenge them to a word battle.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Challenge Link:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={challengeLink}
                  readOnly
                  className="brutal-input flex-1"
                />
                <button
                  onClick={() => copyToClipboard(challengeLink)}
                  className="brutal-button secondary"
                >
                  {showCopySuccess ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div
              className="p-4 text-sm"
              style={{
                background: "var(--bg-info)",
                border: "3px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              <h3 className="font-bold mb-2">Waiting for opponent...</h3>
              <p>
                Once someone accepts your challenge, you'll both need to click
                "Ready" to start the 3-word battle!
              </p>
            </div>

            <button
              onClick={onBackToHome}
              className="brutal-button secondary challenge-button w-full"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Challenge is ready to start or players are getting ready
  if (
    challenge.status === "ready_to_start" ||
    challenge.status === "challenger_ready" ||
    challenge.status === "opponent_ready"
  ) {
    // Determine ready status based on current challenge status
    const challengerReady =
      challenge.status === "challenger_ready" ||
      challenge.status === "ready_to_start";
    const opponentReady =
      challenge.status === "opponent_ready" ||
      challenge.status === "ready_to_start";

    // Check if current user is ready based on status and role
    let userReady = false;
    if (userRole === "challenger") {
      userReady =
        challenge.status === "challenger_ready" ||
        challenge.status === "ready_to_start";
    } else if (userRole === "opponent") {
      userReady =
        challenge.status === "opponent_ready" ||
        challenge.status === "ready_to_start";
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card max-w-lg w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black mb-4">Challenge Ready!</h1>

            <div className="challenger-vs-opponent mb-6">
              <div className="challenger-score">
                <h3 className="font-bold">{challenge.challengerName}</h3>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Challenger
                </p>
                {userRole === "challenger" && (
                  <div className="player-status">
                    <span className="status-indicator status-ready"></span>
                    You
                  </div>
                )}
              </div>

              <div className="vs-divider">VS</div>

              <div className="opponent-score">
                <h3 className="font-bold">
                  {challenge.opponentName || "Opponent"}
                </h3>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Opponent
                </p>
                {userRole === "opponent" && (
                  <div className="player-status">
                    <span className="status-indicator status-ready"></span>
                    You
                  </div>
                )}
              </div>
            </div>

            <div
              className="p-4 mb-4"
              style={{
                background: "var(--bg-info)",
                border: "3px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              <h3 className="font-bold mb-2">Challenge Rules:</h3>
              <ul className="text-sm space-y-1">
                <li>• 3 words to guess</li>
                <li>• 60 seconds per word</li>
                <li>• Use Ask for Help & Ask for Clue features</li>
                <li>• Highest total score wins!</li>
              </ul>
            </div>

            {/* Show different buttons based on the status and user ready state */}
            {challenge.status === "ready_to_start" && (
              <button
                onClick={handlePlayerReady}
                className="brutal-button primary challenge-button w-full"
              >
                Ready to Start
              </button>
            )}

            {/* One player is ready, show appropriate UI for second player */}
            {(challenge.status === "challenger_ready" ||
              challenge.status === "opponent_ready") && (
              <>
                {userReady ? (
                  <div
                    className="p-4 text-center"
                    style={{
                      background: "var(--bg-success)",
                      border: "3px solid var(--border-success)",
                      color: "var(--text-success)",
                    }}
                  >
                    <p className="font-bold">You're ready!</p>
                    <p className="text-sm">
                      Waiting for opponent to confirm...
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handlePlayerReady}
                    className="brutal-button primary challenge-button w-full"
                  >
                    Confirm Start Game
                  </button>
                )}
              </>
            )}

            {error && (
              <div
                className="p-4 text-center font-medium mt-4"
                style={{
                  background: "var(--bg-error)",
                  border: "3px solid var(--border-error)",
                  color: "var(--text-error)",
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Game completed - show results
  if (challenge.status === "completed") {
    return (
      <ChallengeResults
        challengeId={challengeId}
        onBackToHome={handleBackToHome}
        onNavigateToLeaderboard={onNavigateToLeaderboard}
        hasAcceptedAsOpponent={hasAcceptedAsOpponent}
      />
    );
  }

  // Game in progress - show actual gameplay
  if (challenge.status === "in_progress") {
    return (
      <ChallengeGameplay
        challenge={challenge}
        userRole={userRole}
        currentWord={challengeState.currentWord}
        challengerAttempt={challengeState.challengerAttempt}
        opponentAttempt={challengeState.opponentAttempt}
        challengeId={challengeId}
        hasAcceptedAsOpponent={hasAcceptedAsOpponent}
        onBackToHome={handleBackToHome}
      />
    );
  }

  // Other states fallback
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="brutal-card max-w-lg w-full text-center">
        <h1 className="text-2xl font-black mb-4">Challenge Status Unknown</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Current status: {challenge.status}
        </p>

        <div className="mt-6">
          <button onClick={onBackToHome} className="brutal-button secondary">
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

// Challenge Results Component
interface ChallengeResultsProps {
  challengeId: Id<"challengeBattles">;
  onBackToHome: () => void;
  onNavigateToLeaderboard?: (data?: ChallengeCompletionData) => void;
  hasAcceptedAsOpponent: boolean;
}

function ChallengeResults({
  challengeId,
  onBackToHome,
  onNavigateToLeaderboard,
  hasAcceptedAsOpponent,
}: ChallengeResultsProps) {
  const [showRematchConfirm, setShowRematchConfirm] = useState(false);
  const [isCreatingRematch, setIsCreatingRematch] = useState(false);

  const results = useQuery(api.challengeBattle.getChallengeResults, {
    challengeId,
  });
  const rematchStatus = useQuery(api.challengeBattle.getRematchStatus, {
    challengeId,
  });

  const requestRematch = useMutation(api.challengeBattle.requestRematch);
  const respondToRematch = useMutation(api.challengeBattle.respondToRematch);

  // Watch for rematch acceptance and redirect both players to the new challenge
  useEffect(() => {
    if (
      rematchStatus &&
      rematchStatus.status === "accepted" &&
      rematchStatus.newChallengeId
    ) {
      // Clear current challenge session data since we're moving to a new challenge
      clearOpponentSession();
      // Also clear any session data for the new challenge ID to ensure fresh start
      const newStorageKey = `opponent_${rematchStatus.newChallengeId}`;
      localStorage.removeItem(newStorageKey);

      // Small delay to ensure the new challenge is fully created
      setTimeout(() => {
        // Redirect both players to the new challenge
        window.location.href = `/?challenge=${rematchStatus.newChallengeId}`;
      }, 500);
    }
  }, [rematchStatus?.status, rematchStatus?.newChallengeId, challengeId]);

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-card max-w-lg w-full text-center">
          <h1 className="text-2xl font-black mb-4">Loading Results...</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Calculating final scores...
          </p>
        </div>
      </div>
    );
  }

  const { challenge, wordResults } = results;

  // Check if someone quit the game
  const wasQuit = challenge.winner?.includes("_quit");

  // Determine display based on whether game was quit or completed normally
  let headerText = "Challenge Complete!";
  let winnerText = "It's a Tie!";
  let winnerColor = "var(--text-secondary)";
  let showActionButtons = true;

  if (wasQuit) {
    headerText = "Game Over";
    showActionButtons = false;

    // Determine who quit and show appropriate message
    const quitterRole = challenge.winner?.replace("_quit", "");
    const quitterName =
      quitterRole === "challenger"
        ? challenge.challengerName
        : challenge.opponentName;

    winnerText = `${quitterName} left the game`;
    winnerColor = "var(--text-warning)";
  } else {
    // Normal completion - show winner
    if (challenge.winner === "challenger") {
      winnerText = `${challenge.challengerName} Wins!`;
      winnerColor = "var(--text-success)";
    } else if (challenge.winner === "opponent") {
      winnerText = `${challenge.opponentName} Wins!`;
      winnerColor = "var(--text-success)";
    }
  }

  const handleChallengeAgain = async () => {
    try {
      setIsCreatingRematch(true);
      await requestRematch({
        challengeId,
        isOpponentSession: hasAcceptedAsOpponent,
      });
    } catch (error: any) {
      console.error("Failed to request rematch:", error);
    } finally {
      setIsCreatingRematch(false);
    }
  };

  const handleAcceptRematch = async () => {
    try {
      setIsCreatingRematch(true);
      const result = await respondToRematch({
        challengeId,
        accept: true,
        isOpponentSession: hasAcceptedAsOpponent,
      });

      if (result.success && result.newChallengeId) {
        // Clear current opponent session data before navigating to new challenge
        clearOpponentSession();
        // Also clear any session data for the new challenge ID
        const newStorageKey = `opponent_${result.newChallengeId}`;
        localStorage.removeItem(newStorageKey);

        // Navigate to the new challenge
        window.location.href = `/?challenge=${result.newChallengeId}`;
      }
    } catch (error: any) {
      console.error("Failed to accept rematch:", error);
    } finally {
      setIsCreatingRematch(false);
    }
  };

  const handleDeclineRematch = async () => {
    try {
      await respondToRematch({
        challengeId,
        accept: false,
        isOpponentSession: hasAcceptedAsOpponent,
      });
    } catch (error: any) {
      console.error("Failed to decline rematch:", error);
    }
  };

  const handleViewLeaderboard = () => {
    // Clear opponent session data to unlink players
    clearOpponentSession();

    if (onNavigateToLeaderboard && results) {
      // Pass challenge results with words to leaderboard
      const challengeCompletionData = {
        challengeId,
        challengerName: results.challenge.challengerName,
        opponentName: results.challenge.opponentName,
        words: results.wordResults.map((wr) => wr.word),
        finalScores: {
          challenger: results.challenge.challengerScore,
          opponent: results.challenge.opponentScore,
        },
        winner: results.challenge.winner,
      };
      onNavigateToLeaderboard?.(challengeCompletionData);
    } else {
      onBackToHome();
    }
  };

  const handleEndGameForBoth = () => {
    // Clear opponent session data to unlink players
    clearOpponentSession();
    onBackToHome();
  };

  // Function to clear opponent session data
  const clearOpponentSession = () => {
    const storageKey = `opponent_${challengeId}`;
    localStorage.removeItem(storageKey);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="brutal-card max-w-4xl w-full">
        {/* Results Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-4">{headerText}</h1>
          <div
            className="text-2xl font-black mb-6"
            style={{ color: winnerColor }}
          >
            {winnerText}
          </div>

          {/* Final Scores */}
          <div className="challenger-vs-opponent mb-6">
            <div className="challenger-score">
              <h3 className="font-bold">{challenge.challengerName}</h3>
              <p className="text-3xl font-black">{challenge.challengerScore}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Challenger
              </p>
            </div>

            <div className="vs-divider">VS</div>

            <div className="opponent-score">
              <h3 className="font-bold">{challenge.opponentName}</h3>
              <p className="text-3xl font-black">{challenge.opponentScore}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Opponent
              </p>
            </div>
          </div>
        </div>

        {/* Word Results Section */}
        {wordResults.length > 0 && (
          <div className="brutal-card mb-6">
            <h3
              className="text-xl font-bold mb-4 text-center"
              style={{ color: "var(--text-primary)" }}
            >
              Words Played
            </h3>
            <div className="space-y-2">
              {wordResults.map((wordResult, index) => (
                <div
                  key={index}
                  className="text-center py-3"
                  style={{
                    borderBottom:
                      index < wordResults.length - 1
                        ? "1px solid var(--border-color)"
                        : "none",
                  }}
                >
                  <div
                    className="font-bold text-lg"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Word {index + 1}: {wordResult.word}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rematch Status Section */}
        {rematchStatus && rematchStatus.hasRequest && (
          <div
            className="brutal-card mb-6"
            style={{ background: "var(--bg-info)" }}
          >
            <div className="text-center">
              {rematchStatus.status === "pending" && (
                <>
                  <h3 className="text-xl font-bold mb-4">Rematch Request</h3>
                  <p
                    className="mb-6"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {rematchStatus.requestedBy === "challenger"
                      ? `${challenge.challengerName} wants a rematch with roles swapped!`
                      : `${challenge.opponentName} wants a rematch with roles swapped!`}
                  </p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={handleAcceptRematch}
                      disabled={isCreatingRematch}
                      className="brutal-button primary challenge-button"
                    >
                      {isCreatingRematch ? "Starting..." : "Accept Challenge"}
                    </button>
                    <button
                      onClick={handleDeclineRematch}
                      className="brutal-button secondary challenge-button"
                    >
                      Decline
                    </button>
                  </div>
                </>
              )}

              {rematchStatus.status === "declined" && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Rematch Declined</h3>
                  <p style={{ color: "var(--text-secondary)" }}>
                    The rematch request was declined.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="text-center space-x-4">
          {showActionButtons &&
            rematchStatus?.hasRequest &&
            rematchStatus.status === "pending" && (
              <p className="text-sm mb-4" style={{ color: "var(--text-info)" }}>
                Rematch request pending...
              </p>
            )}

          <button
            onClick={handleEndGameForBoth}
            className="brutal-button secondary challenge-button"
          >
            Back to Home
          </button>

          {showActionButtons && (
            <button
              onClick={handleViewLeaderboard}
              className="brutal-button secondary challenge-button"
            >
              View Leaderboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
