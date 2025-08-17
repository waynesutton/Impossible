import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

interface HelperGameProps {
  inviteId: Id<"invites">;
}

export function HelperGame({ inviteId }: HelperGameProps) {
  const helperGameWord = useQuery(api.game.getHelperGameWord, { inviteId });
  const helperState = useQuery(api.game.getHelperState, { inviteId });
  const inviteInfo = useQuery(api.game.getInviteInfo, { inviteId });
  const mainPlayerGameState = useQuery(api.game.getMainPlayerGameState, {
    inviteId,
  });
  const joinAsHelper = useMutation(api.game.joinAsHelper);
  const submitSuggestion = useMutation(api.game.submitSuggestion);

  const [currentInput, setCurrentInput] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (helperState) {
      setHasJoined(true);
    }
  }, [helperState]);

  const handleJoin = async () => {
    try {
      await joinAsHelper({ inviteId });
      setHasJoined(true);
      toast.success("Joined as helper!");
    } catch (error) {
      toast.error("Failed to join as helper");
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!currentInput.trim()) return;

    try {
      setIsSubmitting(true);
      await submitSuggestion({
        inviteId,
        suggestion: currentInput.toLowerCase().replace(/[^a-z]/g, ""),
      });
      toast.success("Suggestion sent!");
      setCurrentInput("");
    } catch (error) {
      toast.error("Failed to send suggestion");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMainPlayerWordDisplay = () => {
    if (!mainPlayerGameState || !mainPlayerGameState.letters) {
      return null;
    }

    const letters = mainPlayerGameState.letters;
    const currentGuess = mainPlayerGameState.currentGuess?.toLowerCase() || "";

    return (
      <div className="brutal-card" style={{ background: "var(--bg-surface)" }}>
        <p
          className="brutal-text-md mb-4 text-center"
          style={{ color: "var(--text-primary)" }}
        >
          {inviteInfo?.creatorName}'s Current Progress:
        </p>
        <div className="flex justify-center gap-2 mb-4">
          {letters.map((letter, index) => {
            const isRevealed = currentGuess[index] === letter;
            const hasGuess = currentGuess[index];
            return (
              <div
                key={index}
                className={`brutal-word-box ${
                  isRevealed ? "correct" : hasGuess ? "filled" : "empty"
                }`}
                style={{ width: "2rem", height: "2rem", fontSize: "0.875rem" }}
              >
                {isRevealed ? letter : hasGuess ? currentGuess[index] : ""}
              </div>
            );
          })}
        </div>
        <div className="text-center">
          <span className="brutal-badge">
            Attempts: {mainPlayerGameState.attempts}/3
          </span>
        </div>
      </div>
    );
  };

  if (!inviteInfo) {
    return (
      <div className="brutal-card text-center">
        <div className="brutal-text-xl" style={{ color: "var(--bg-error)" }}>
          Loading...
        </div>
        <p
          className="brutal-text-md mt-4"
          style={{ color: "var(--text-secondary)" }}
        >
          This invite link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (!helperGameWord) {
    return (
      <div className="brutal-card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p style={{ color: "var(--text-secondary)" }}>Loading game word...</p>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="text-center space-y-8">
        <div className="brutal-card">
          <div
            className="brutal-text-xl mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            You're Invited to Help!
          </div>
          <p
            className="brutal-text-md"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="brutal-badge mr-2">{inviteInfo.creatorName}</span>
            needs your help guessing their impossible word!
          </p>
        </div>
        <div
          className="brutal-card"
          style={{ background: "var(--bg-surface)" }}
        >
          <p
            className="brutal-text-md mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Letters in the word:
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {helperGameWord.shuffledLetters?.map((letter, index) => (
              <span key={index} className="brutal-badge">
                {letter}
              </span>
            )) || (
              <span style={{ color: "var(--text-secondary)" }}>
                Loading letters...
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleJoin}
          className="brutal-button px-8 py-4 text-lg"
        >
          Join as Helper
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="brutal-card text-center">
        <div
          className="brutal-text-xl mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Helping {inviteInfo.creatorName}
        </div>
        <p
          className="brutal-text-md"
          style={{ color: "var(--text-secondary)" }}
        >
          You can suggest up to 3 words to help them guess!
        </p>
      </div>

      {/* Main player's current progress */}
      {renderMainPlayerWordDisplay()}

      <div className="brutal-card" style={{ background: "var(--bg-surface)" }}>
        <p
          className="brutal-text-md mb-4 text-center"
          style={{ color: "var(--text-primary)" }}
        >
          Letters in the word:
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          {helperGameWord.shuffledLetters?.map((letter, index) => (
            <span key={index} className="brutal-badge">
              {letter}
            </span>
          )) || (
            <span style={{ color: "var(--text-secondary)" }}>
              Loading letters...
            </span>
          )}
        </div>
      </div>

      {helperState && helperState.canSuggest && (
        <div className="brutal-card">
          <div className="text-center mb-4">
            <div className="brutal-badge">
              Suggestions remaining: {3 - helperState.suggestionsUsed}/3
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={currentInput}
              onChange={(e) =>
                setCurrentInput(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z]/g, "")
                    .slice(
                      0,
                      mainPlayerGameState?.length || helperGameWord.word.length,
                    ),
                )
              }
              disabled={isSubmitting}
              className="brutal-input w-full text-center text-xl disabled:opacity-50"
              placeholder="Suggest a word..."
              maxLength={
                mainPlayerGameState?.length || helperGameWord.word.length
              }
            />

            <div className="text-center">
              <button
                onClick={handleSubmitSuggestion}
                disabled={!currentInput.trim() || isSubmitting}
                className="brutal-button px-6 py-3 disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send Suggestion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {helperState && helperState.mainUserGameOver && (
        <div className="brutal-card text-center">
          <div
            className="brutal-text-xl mb-4"
            style={{ color: "var(--bg-error)" }}
          >
            Game Over
          </div>
          <p
            className="brutal-text-md mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            {helperState.mainUserCompleted
              ? "Your friend game is over!"
              : "Your friend used all 3 attempts."}
          </p>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Check the leaderboard for updates!
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="brutal-button px-6 py-3"
          >
            Go to Leaderboard
          </button>
        </div>
      )}

      {helperState &&
        !helperState.canSuggest &&
        !helperState.mainUserGameOver && (
          <div className="brutal-card text-center">
            <div
              className="brutal-text-lg mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              All suggestions used!
            </div>
            <p style={{ color: "var(--text-secondary)" }}>
              You've sent all 3 suggestions. Good luck to your friend!
            </p>
          </div>
        )}
    </div>
  );
}
