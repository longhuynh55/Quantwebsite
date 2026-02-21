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
    ".next-ci/**",
    ".next-ci-webpack/**",
    "out/**",
    "build/**",
    // Repo-local scratch files/directories (generated during eval/dev runs):
    "_tmp*",
    "**/_tmp*",
    "tmp/**",
    "artifacts/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
