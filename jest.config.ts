import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  clearMocks: true,
  setupFilesAfterEnv: ["<rootDir>/test/external-service-guard.ts"],
  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "app/**/actions.ts",
    "app/api/**/*.{ts,tsx}",
    "emails/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^server-only$": "<rootDir>/test/server-only-mock.ts",
  },
};

export default createJestConfig(config);
