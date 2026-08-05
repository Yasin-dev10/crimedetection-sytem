import { useEffect, useState } from "react";
import { applyTheme, getInitialTheme } from "./theme";

/**
 * useTheme — returns { theme, isLight, toggleTheme }
 * and keeps the component in sync with global theme changes.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    // Apply the current theme to the DOM on mount
    applyTheme(theme, { emit: false });

    const syncTheme = (e) => {
      const next = e.detail?.theme || getInitialTheme();
      setTheme(next);
    };

    window.addEventListener("themechange", syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener("themechange", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const isLight = theme === "light";

  return { theme, isLight };
}
