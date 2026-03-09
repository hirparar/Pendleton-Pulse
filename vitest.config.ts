import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/**/*.ts"],
      exclude: [
        "lib/prisma.ts",
        "app/**/*.tsx",
        "app/**/layout.tsx",
        "app/**/page.tsx",
        "app/**/ui.tsx",
        "app/**/table.tsx",
        "app/**/toolbar.tsx",
        "app/**/views/**",
        "app/**/client-redirect.tsx",
        "next-env.d.ts",
      ],
    },
  },
});
