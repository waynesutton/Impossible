import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

interface ChallengeSetupProps {
  onChallengeCreated: (challengeId: Id<"challengeBattles">) => void;
  onCancel: () => void;
}

export function ChallengeSetup({
  onChallengeCreated,
  onCancel,
}: ChallengeSetupProps) {
  const [challengerName, setChallengerName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeLink, setChallengeLink] = useState<string>("");
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const createChallenge = useMutation(api.challengeBattle.createChallenge);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!challengerName.trim()) {
      setError("Please enter your name");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const result = await createChallenge({
        challengerName: challengerName.trim(),
      });

      setChallengeLink(result.challengeLink);
      onChallengeCreated(result.challengeId);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

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
      <div className="brutal-card max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-4">Create Challenge</h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Challenge another player to a 1v1 word battle!
          </p>
        </div>

        {!challengeLink ? (
          <form onSubmit={handleCreateChallenge} className="space-y-6">
            <div>
              <label
                htmlFor="challengerName"
                className="block text-sm font-medium mb-2"
              >
                Your Name:
              </label>
              <input
                id="challengerName"
                type="text"
                value={challengerName}
                onChange={(e) => setChallengerName(e.target.value)}
                placeholder="Enter your name"
                className="brutal-input w-full"
                disabled={isCreating}
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
                onClick={onCancel}
                className="brutal-button secondary flex-1"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="brutal-button primary flex-1"
                disabled={isCreating || !challengerName.trim()}
              >
                {isCreating ? "Creating..." : "Create Challenge"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div
              className="p-6 text-center"
              style={{
                background: "var(--bg-success)",
                border: "3px solid var(--border-success)",
                color: "var(--text-success)",
              }}
            >
              <h2 className="text-xl font-bold mb-2">Challenge Created!</h2>
              <p>Share this link with your opponent to start the battle.</p>
            </div>

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
                border: "3px solid var(--border-secondary)",
                color: "var(--text-secondary)",
              }}
            >
              <h3 className="font-bold mb-2">How it works:</h3>
              <ul className="space-y-1">
                <li>• Share the link with someone you want to challenge</li>
                <li>• They'll enter their name and accept the challenge</li>
                <li>• Both players will need to click "Ready" to start</li>
                <li>• You'll compete on 3 words with 60 seconds each</li>
                <li>• Highest total score wins!</li>
              </ul>
            </div>

            <button onClick={onCancel} className="brutal-button primary w-full">
              Continue to Challenge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
