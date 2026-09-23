// eslint.config.js — backend (server/src, scripts/), Node CommonJS.
// Light, correctness-only, same as frontend config; tsconfig.eslint.json (allowJs, checkJs off) gives type info for JS without TS emitting JS-authoring diagnostics.

"use strict";

const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const nodePlugin = require("eslint-plugin-n");
const globals = require("globals");

module.exports = tseslint.config(
  {
    ignores: ["node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["*.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      n: nodePlugin,
    },
    rules: {
      // Catches real bugs hit here: unawaited Mongoose write/queue calls whose rejection went nowhere.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off", // superseded by the TS-aware version above

      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["error", "smart"],
      "no-async-promise-executor": "error",
      // "warn" not "error": audited all 28 first-run hits, all local vars or accepted-tradeoff TTL caches, none real races; kept at warn so a future real one still surfaces.
      "require-atomic-updates": "warn",
      "no-return-await": "off",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],

      // builtinGlobals off: intentional `require`s like `crypto`/`Location` shadow Node/TS-lib globals by name, not real redeclares.
      "no-redeclare": ["error", { builtinGlobals: false }],

      // eslint-plugin-n: Node-specific correctness (bad requires, wrong-version APIs), not style.
      "n/no-missing-require": "error",
      "n/no-extraneous-require": "error",
      "n/no-unpublished-require": "off", // scripts/ and dev tooling routinely require devDependencies
      "n/no-process-exit": "off", // used deliberately in scripts/ and worker bootstraps
    },
  },
  {
    // Suite uses node:test (`node --test`), not Mocha — no globals.mocha, since its `test` global would collide with each file's own `require("node:test")`.
    files: ["**/*.test.js"],
    rules: {
      // Warn not off: top-level `test(...)`'s returned Promise is meant to go unawaited (node:test manages it), but a real floating promise inside a test body should still surface.
      "@typescript-eslint/no-floating-promises": "warn",
      // Test fixtures intentionally construct throwaway mocks/promises that
      // don't always need every misuse-shape check the app code does.
      "@typescript-eslint/no-misused-promises": "warn",
    },
  },
);
