import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ShareableScoreHandlerProps {
  gameScoreId?: Id<"gameResults">;
  challengeScoreId?: Id<"challengeBattles">;
}

export function ShareableScoreHandler({
  gameScoreId,
  challengeScoreId,
}: ShareableScoreHandlerProps) {
  const gameScore = useQuery(
    api.game.getPublicGameScore,
    gameScoreId ? { gameResultId: gameScoreId } : "skip",
  );

  const challengeScore = useQuery(
    api.challengeBattle.getPublicChallengeScore,
    challengeScoreId ? { challengeId: challengeScoreId } : "skip",
  );

  useEffect(() => {
    if (gameScore) {
      // Update meta tags for game score sharing
      const title = `${gameScore.playerName || "Player"} ${gameScore.completed ? "solved" : "failed"} "${gameScore.word.toUpperCase()}"`;
      const description = `${gameScore.completed ? "✅ Solved" : "❌ Failed"} in ${gameScore.attempts} attempts${gameScore.usedSecretWord ? " (used secret word)" : ""} | Try to beat this score on Impossible Word!`;

      updateMetaTags(title, description);
    } else if (challengeScore) {
      // Update meta tags for challenge score sharing
      const winner = challengeScore.winner;
      const winnerName =
        winner === "challenger"
          ? challengeScore.challengerName
          : winner === "opponent"
            ? challengeScore.opponentName
            : "Tie";

      const title = `${challengeScore.challengerName} vs ${challengeScore.opponentName} - Challenge Battle`;
      const description = `🏆 Winner: ${winnerName} | Score: ${challengeScore.challengerScore} - ${challengeScore.opponentScore} | Play your own Challenge Battle on Impossible Word!`;

      updateMetaTags(title, description);
    }
  }, [gameScore, challengeScore]);

  return null; // This component doesn't render anything
}

function updateMetaTags(title: string, description: string) {
  // Update document title
  document.title = title;

  // Update Open Graph tags
  updateMetaTag("og:title", title);
  updateMetaTag("og:description", description);
  updateMetaTag("description", description);
  updateMetaTag("twitter:title", title);
  updateMetaTag("twitter:description", description);
}

function updateMetaTag(property: string, content: string) {
  // Handle both property and name attributes
  let selector = `meta[property="${property}"]`;
  let element = document.querySelector(selector);

  if (!element) {
    selector = `meta[name="${property}"]`;
    element = document.querySelector(selector);
  }

  if (element) {
    element.setAttribute("content", content);
  } else {
    // Create new meta tag if it doesn't exist
    const meta = document.createElement("meta");
    if (property.startsWith("og:") || property.startsWith("twitter:")) {
      meta.setAttribute("property", property);
    } else {
      meta.setAttribute("name", property);
    }
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  }
}
