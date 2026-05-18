export function ThemeScript() {
  // Inline script in document head — runs early to avoid theme flash (no `beforeInteractive` outside `_document`).
  const code = `
  (function() {
    try {
      var key = "ppg-theme";
      var saved = localStorage.getItem(key);
      var theme = saved === "light" || saved === "dark" ? saved : "system";
      var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var isDark = theme === "dark" || (theme === "system" && systemDark);
      var root = document.documentElement;
      if (isDark) root.classList.add("dark"); else root.classList.remove("dark");
    } catch (e) {}
  })();
  `;

  return <script id="ppg-theme-init" dangerouslySetInnerHTML={{ __html: code }} />;
}

