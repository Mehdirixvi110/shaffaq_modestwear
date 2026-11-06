import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
  },
  // Mirror the tsconfig "@/*" -> "./src/*" path mapping so suites can load modules
  // that import via the alias (e.g. @/config/runtime, @/lib/payments/*). The alias
  // boundary-matches "@/", so scoped packages like @supabase/* are unaffected.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
