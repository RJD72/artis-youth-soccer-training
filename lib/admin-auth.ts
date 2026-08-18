// This file contains the shared server-side security checks for administrator access.
// Future admin pages, Server Actions, and API routes can use the same rules instead
// of each implementing their own session and allowlist checks.

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

function getAllowedAdminEmails(): Set<string> {
  const configuredEmails = process.env.ADMIN_EMAIL_ALLOWLIST ?? "";

  return new Set(
    configuredEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getAdminSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const normalizedEmail = session.user.email.trim().toLowerCase();
  const allowedAdminEmails = getAllowedAdminEmails();

  if (!allowedAdminEmails.has(normalizedEmail)) {
    return null;
  }

  return session;
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }
}
