import { useState, useEffect } from "react";
import { Palette, FileText, Moon } from "lucide-react";

type Theme = "neobrutalism" | "original" | "dark";

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<Theme>("neobrutalism");

  // Load theme from localStorage on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("impossible-theme") as Theme;
    if (
      savedTheme &&
      ["neobrutalism", "original", "dark"].includes(savedTheme)
    ) {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Default to neobrutalism
      applyTheme("neobrutalism");
    }
  }, []);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    // Remove existing theme attributes
    root.removeAttribute("data-theme");

    // Apply new theme
    if (theme === "original") {
      root.setAttribute("data-theme", "original");
    } else if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    }
    // Neobrutalism is the default (root CSS variables)

    // Save to localStorage
    localStorage.setItem("impossible-theme", theme);
  };

  const handleThemeToggle = () => {
    const themes: Theme[] = ["neobrutalism", "original", "dark"];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
      case "neobrutalism":
        return Palette;
      case "original":
        return FileText;
      case "dark":
        return Moon;
      default:
        return Palette;
    }
  };

  const getThemeLabel = () => {
    switch (currentTheme) {
      case "neobrutalism":
        return "Brutal";
      case "original":
        return "Clean";
      case "dark":
        return "Dark";
      default:
        return "Brutal";
    }
  };

  const CurrentIcon = getThemeIcon();

  return (
    <button
      onClick={handleThemeToggle}
      className="theme-button"
      title={`Current: ${getThemeLabel()} - Click to switch theme`}
      aria-label={`Current theme: ${getThemeLabel()}. Click to cycle themes.`}
      aria-live="polite"
    >
      <CurrentIcon size={20} />
    </button>
  );
}
