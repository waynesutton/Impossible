import { useState, useEffect } from "react";

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

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  const themes = [
    { id: "neobrutalism", icon: "🎨", label: "Brutal" },
    { id: "original", icon: "📝", label: "Clean" },
    { id: "dark", icon: "🌙", label: "Dark" },
  ] as const;

  return (
    <div className="theme-switcher">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => handleThemeChange(theme.id)}
          className={`theme-button ${currentTheme === theme.id ? "active" : ""}`}
          title={`Switch to ${theme.label} theme`}
          aria-label={`Switch to ${theme.label} theme`}
        >
          {theme.icon}
        </button>
      ))}
    </div>
  );
}
