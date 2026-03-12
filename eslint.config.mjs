import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Faux positifs : setState dans useEffect est valide pour l'initialisation
      "react-hooks/set-state-in-effect": "off",
      // Faux positifs : `any` explicite nécessaire pour les adapters génériques
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
