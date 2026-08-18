// This page protects the admin dashboard and only allows approved administrators to view it.
// It checks the current user session, redirects anyone who is not signed in or not on the allowlist,
// and then shows the admin UI for approved users.

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

export default async function AdminPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/admin/login");
  }

  const normalizedEmail = session.user.email.trim().toLowerCase();
  const allowedAdminEmails = getAllowedAdminEmails();

  if (!allowedAdminEmails.has(normalizedEmail)) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          ARTIS Soccer Academy
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Administrator dashboard
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          Welcome, {session.user.name}. Your administrator session is active and
          your email is approved for access.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-800">Signed in as</p>
          <p className="mt-1 text-slate-600">{session.user.email}</p>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-8">
          <h2 className="text-xl font-semibold text-slate-950">
            Dashboard tools are coming next
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Customer records, registrations, group capacity, and other academy
            controls will be added here one feature at a time.
          </p>
        </div>
      </section>
    </main>
  );
}
