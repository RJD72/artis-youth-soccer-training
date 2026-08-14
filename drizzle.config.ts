import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: ".env.local",
  quiet: true,
});

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing. Check the project's .env.local file.`);
  }

  return value;
}

const port = Number(requireEnvironmentVariable("DB_PORT"));

if (!Number.isInteger(port)) {
  throw new TypeError("DB_PORT must be a valid whole number");
}

export default defineConfig({
  dialect: "mysql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: requireEnvironmentVariable("DB_HOST"),
    port,
    user: requireEnvironmentVariable("DB_USER"),
    password: requireEnvironmentVariable("DB_PASSWORD"),
    database: requireEnvironmentVariable("DB_NAME"),
  },
  strict: true,
  verbose: true,
});
