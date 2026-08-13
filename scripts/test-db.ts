import { config } from "dotenv";
import mysql, { type RowDataPacket } from "mysql2/promise";

config({
  path: ".env.local",
  quiet: true,
});

/**
 * Reads a required environment variable.
 *
 * process.env values have the TypeScript type:
 * string | undefined
 *
 * After this function checks the value, its return type is guaranteed
 * to be string.
 */
function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing. Check the project's .env.local file.`);
  }

  return value;
}

const port = Number(requireEnvironmentVariable("DB_PORT"));

if (!Number.isInteger(port)) {
  throw new TypeError("DB_PORT must be a valid whole number.");
}

async function testDatabaseConnection() {
  const connection = await mysql.createConnection({
    host: requireEnvironmentVariable("DB_HOST"),
    port,
    user: requireEnvironmentVariable("DB_USER"),
    password: requireEnvironmentVariable("DB_PASSWORD"),
    database: requireEnvironmentVariable("DB_NAME"),
  });

  try {
    const [rows] = await connection.query<RowDataPacket[]>(`
      SELECT
        DATABASE() AS database_name,
        CURRENT_USER() AS connected_as,
        VERSION() AS mysql_version
    `);

    console.log("Database connection successful:");
    console.table(rows);
  } finally {
    await connection.end();
  }
}

testDatabaseConnection().catch((error: unknown) => {
  console.error("Database connection failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
