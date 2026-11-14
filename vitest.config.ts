import { configDefaults, defineConfig } from "vitest/config";

// Agent worktrees under .claude/ are separate checkouts with their own copies of the tests.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, ".claude/**"] },
});
