// eslint.config.js — frontend (src/), React + TypeScript.
// Deliberately light: correctness rules that catch real bugs, not style/formatting (no
// Prettier here either). react-hooks/recommended-latest + no-floating-promises/
// no-misused-promises are the two doing the real work, catching unawaited async calls.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "build/**", "server/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs["recommended-latest"],
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catches a queue/DB call fired without await. Kept at "warn" not "error" — 84 of the
      // first 90 hits were idiomatic fire-and-forget invalidateQueries() calls, not bugs.
      "@typescript-eslint/no-floating-promises": "warn",
      // checksVoidReturn.attributes disabled — react-hook-form's onSubmit={handleSubmit(...)}
      // pattern isn't a bug; the rule stays armed for other misuse shapes.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],

      // TS's own noUnusedLocals/noUnusedParameters are off; this is the actual unused-vars check.
      // `_`-prefixed args/vars are the existing convention for intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off", // superseded by the TS-aware version above

      // Real bug shapes, not style.
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["error", "smart"],
      "no-async-promise-executor": "error",
      "no-return-await": "off", // superseded by @typescript-eslint's version
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/no-explicit-any": "off", // not a correctness rule — this is an incremental-adoption codebase

      // allowEmptyCatch: legitimate for best-effort localStorage access (ThemeToggle.tsx) that
      // can throw in private-browsing contexts, and elsewhere ignoring a storage/DOM exception.
      "no-empty": ["error", { allowEmptyCatch: true }],

      // react-hooks/recommended-latest already brings rules-of-hooks/exhaustive-deps, left at defaults.
    },
  },
  {
    // Vite/Tailwind/PostCSS config files — Node, not browser, not part of the app bundle.
    files: ["*.config.{js,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
