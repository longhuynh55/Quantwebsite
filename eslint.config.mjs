import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",
    ".next-ci/**",
    ".next-ci-*/**",
    ".next-ci-webpack/**",
    "out/**",
    "build/**",
    // Nested worktrees (should never be linted as source)
    ".wt-*/**",
    ".wt*/**",
    "**/.wt-*/**",
    "**/.wt*/**",
    // Repo-local scratch files/directories (generated during eval/dev runs):
    ".pw-*/**",
    ".pw-test-results*/**",
    "_tmp*",
    "**/_tmp*",
    "tmp/**",
    ".tmp/**",
    "tmp-type-probe.js",
    "tmp_qa/**",
    "artifacts/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
