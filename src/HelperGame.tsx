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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800 font-semibold mb-2 text-center">
          {inviteInfo?.creatorName}'s Current Progress:
        </p>
        <div className="flex justify-center gap-2 mb-2">
          {letters.map((letter, index) => {
            const isRevealed = currentGuess[index] === letter;
            const hasGuess = currentGuess[index];
            return (
              <div
                key={index}
                className={`w-8 h-8 border-2 flex items-center justify-center text-sm font-bold uppercase transition-all duration-200 ${
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
        <p className="text-xs text-blue-600 text-center">
          Attempts: {mainPlayerGameState.attempts}/3
        </p>
      </div>
    );
  };

  if (!inviteInfo) {
    return (
      <div className="text-center space-y-4">
        <div className="text-xl font-bold text-red-600">Invalid Invite</div>
        <p className="text-gray-600">
          This invite link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (!helperGameWord) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading game word...</p>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="text-center space-y-6">
        <div className="text-2xl font-bold text-black">
          You're Invited to Help!
        </div>
        <p className="text-gray-600">
          <span className="font-semibold">{inviteInfo.creatorName}</span> needs
          your help guessing their impossible word!
        </p>
        <div className="bg-gray-100 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Letters in the word:</p>
          <div className="flex justify-center gap-1 flex-wrap">
            {helperGameWord.shuffledLetters?.map((letter, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm font-mono uppercase"
              >
                {letter}
              </span>
            )) || <span className="text-gray-500">Loading letters...</span>}
          </div>
        </div>
        <button
          onClick={handleJoin}
          className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
        >
          Join as Helper
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-2xl font-bold text-black mb-2">
          Helping {inviteInfo.creatorName}
        </div>
        <p className="text-gray-600">
          You can suggest up to 3 words to help them guess!
        </p>
      </div>

      {/* Main player's current progress */}
      {renderMainPlayerWordDisplay()}

      <div className="bg-gray-100 rounded-lg p-4">
        <p className="text-sm text-gray-600 mb-2 text-center">
          Letters in the word:
        </p>
        <div className="flex justify-center gap-1 flex-wrap">
          {helperGameWord.shuffledLetters?.map((letter, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm font-mono uppercase"
            >
              {letter}
            </span>
          )) || <span className="text-gray-500">Loading letters...</span>}
        </div>
      </div>

      {helperState && helperState.canSuggest && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Suggestions remaining: {3 - helperState.suggestionsUsed}/3
            </p>
          </div>

          <div className="space-y-3">
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
              className="w-full px-4 py-3 text-center text-xl font-mono uppercase border-2 border-gray-300 rounded-lg focus:border-gray-800 focus:outline-none transition-colors"
              placeholder="Suggest a word..."
              maxLength={
                mainPlayerGameState?.length || helperGameWord.word.length
              }
            />

            <div className="text-center">
              <button
                onClick={handleSubmitSuggestion}
                disabled={!currentInput.trim() || isSubmitting}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send Suggestion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {helperState && helperState.mainUserGameOver && (
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-red-600">Game Over</div>
          <p className="text-gray-600">
            {helperState.mainUserCompleted
              ? "Your friend game is over!"
              : "Your friend used all 3 attempts."}
          </p>
          <p className="text-sm text-gray-500">
            Check the leaderboard for updates!
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Go to Leaderboard
          </button>
        </div>
      )}

      {helperState &&
        !helperState.canSuggest &&
        !helperState.mainUserGameOver && (
          <div className="text-center space-y-4">
            <div className="text-lg font-semibold text-gray-600">
              All suggestions used!
            </div>
            <p className="text-gray-500">
              You've sent all 3 suggestions. Good luck to your friend!
            </p>
          </div>
        )}
    </div>
  );
}
