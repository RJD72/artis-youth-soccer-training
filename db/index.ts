// This file sets up the app's database connection.
// It loads the environment settings, creates a shared MySQL connection pool,
// and exports the Drizzle database object used throughout the app.

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";

import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

const schema = {
  ...appSchema,
  ...authSchema,
};

// Load local environment variables before we read any database settings.
// `quiet: true` keeps startup output clean when the file is imported by app code.
config({
  path: ".env.local",
  quiet: true,
});

// Centralized guard for required configuration values.
// This keeps connection setup failure modes explicit and makes missing config
// easier to diagnose than allowing the MySQL client to fail later on its own.
function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new TypeError(
      `${name} is missing. Check the project's .env.local file`,
    );
  }
  return value;
}

// Parse and validate the configured MySQL port once up front so the pool only
// receives a known-good numeric value.
const port = Number(requireEnvironmentVariable("DB_PORT"));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new TypeError(`DB_PORT must be a valid port number.`);
}

// Next.js can reload modules during development, so we cache the pool on
// `globalThis` to avoid opening a fresh connection pool on every reload.
const globalForDatabase = globalThis as typeof globalThis & {
  mysqlPool?: Pool;
};

// Reuse an existing pool when available; otherwise create the single shared
// pool used by the application. Pooling keeps connection management efficient
// and avoids repeatedly negotiating new TCP/MySQL sessions.
export const pool =
  globalForDatabase.mysqlPool ??
  mysql.createPool({
    host: requireEnvironmentVariable("DB_HOST"),
    port,
    user: requireEnvironmentVariable("DB_USER"),
    password: requireEnvironmentVariable("DB_PASSWORD"),
    database: requireEnvironmentVariable("DB_NAME"),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

// Only persist the pool globally outside production so development hot reloads
// can reuse it without affecting the long-lived production runtime model.
if (process.env.NODE_ENV !== "production") {
  globalForDatabase.mysqlPool = pool;
}

// Export a Drizzle database instance that is already wired to the shared pool
// and the project schema. Importers can use this as the single entrypoint for
// typed queries instead of recreating clients in feature code.
export const db = drizzle({
  client: pool,
  schema,
  mode: "default",
});
