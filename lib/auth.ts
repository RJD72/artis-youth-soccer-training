import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { db } from "../db";

import * as authSchema from "../db/auth-schema";

function getAllowedAdminEmails(): Set<string> {
  const configuredEmails = process.env.ADMIN_EMAIL_ALLOWLIST ?? "";

  return new Set(
    configuredEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema: authSchema,
  }),

  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },

  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-up/email") {
        return;
      }

      const submittedEmail =
        typeof context.body?.email === "string"
          ? context.body.email.trim().toLowerCase()
          : "";

      const allowedAdminEmails = getAllowedAdminEmails();

      if (!allowedAdminEmails.has(submittedEmail)) {
        throw new APIError("FORBIDDEN", {
          message: "Administrator registration is not available",
        });
      }
    }),
  },
});
