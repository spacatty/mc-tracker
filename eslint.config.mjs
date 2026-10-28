import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // API responses must go through the leak masker (src/lib/security/api-response.ts).
    files: ["src/app/api/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "NextResponse", property: "json", message: "Use maskedJson() from @/lib/security/api-response." },
        { object: "Response", property: "json", message: "Use maskedJson() from @/lib/security/api-response." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
