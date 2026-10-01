export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".generated/**",
      "packages/**",
      "docs/**",
      "test-results/**",
      ".artifacts/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-unreachable": "error",
      "no-duplicate-imports": "error",
      "no-constant-condition": "error",
      eqeqeq: "error",
    },
  },
];
