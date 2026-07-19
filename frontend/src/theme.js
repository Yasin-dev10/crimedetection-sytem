const THEMES = new Set(["dark", "light"]);

export function normalizeTheme(theme) {
  return THEMES.has(theme) ? theme : "dark";
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function getInitialTheme() {
  const storedUser = getStoredUser();
  return normalizeTheme(localStorage.getItem("theme") || storedUser?.theme);
}

export function updateStoredUserTheme(theme) {
  const storedUser = getStoredUser();

  if (storedUser) {
    localStorage.setItem("user", JSON.stringify({ ...storedUser, theme }));
  }
}

export function applyTheme(theme, options = {}) {
  const { persist = true, updateUser = false, emit = true } = options;
  const nextTheme = normalizeTheme(theme);
  const root = document.documentElement;

  root.dataset.theme = nextTheme;
  root.classList.toggle("dark", nextTheme === "dark");
  root.classList.toggle("light", nextTheme === "light");

  if (persist) {
    localStorage.setItem("theme", nextTheme);
  }

  if (updateUser) {
    updateStoredUserTheme(nextTheme);
  }

  if (emit) {
    window.dispatchEvent(
      new CustomEvent("themechange", { detail: { theme: nextTheme } })
    );
  }

  return nextTheme;
}
