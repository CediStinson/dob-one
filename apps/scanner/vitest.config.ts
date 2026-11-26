import { defineProject } from "vitest/config";

export default defineProject({ test: { name: "scanner", include: ["test/**/*.test.ts"] } });
