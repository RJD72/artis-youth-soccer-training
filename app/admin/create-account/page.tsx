// This page lets approved ARTIS administrators create a new admin account.
// It shows a form, checks the password fields, and sends the signup request through the auth client.

"use client";

import { type SubmitEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

function getTextField(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

export default function CreateAdminAccountPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const name = getTextField(formData, "name").trim();
    const email = getTextField(formData, "email").trim();
    const password = getTextField(formData, "password");
    const confirmPassword = getTextField(formData, "confirmPassword");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (error) {
        setErrorMessage(
          "The account could not be created. Make sure the email is approved and has not already been registered.",
        );
        return;
      }

      setAccountCreated(true);
    } catch {
      setErrorMessage(
        "The server could not be reached. Please wait a moment and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-artis-off-white px-4 py-12 sm:px-6">
      <section className="w-full max-w-lg rounded-2xl border border-artis-border bg-artis-white p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-artis-gold">
          ARTIS Soccer Academy
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-artis-navy">
          Create an admin account
        </h1>

        <p className="mt-4 leading-7 text-artis-slate">
          This private setup page is only for approved ARTIS administrators. The
          email address must appear in the server allowlist.
        </p>

        {accountCreated ? (
          <output className="mt-8 block rounded-xl border border-artis-success bg-artis-success/10 p-5">
            <span className="block font-semibold text-artis-success">
              Account created successfully
            </span>
          </output>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="name"
                className="text-sm font-semibold text-artis-navy"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={255}
                placeholder="Enter full name"
                className="mt-2 h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-artis-navy outline-none transition placeholder:text-artis-slate focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-sm font-semibold text-artis-navy"
              >
                Approved email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                placeholder="name@example.com"
                className="mt-2 h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-artis-navy outline-none transition placeholder:text-artis-slate focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold text-artis-navy"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                aria-describedby="password-help"
                placeholder="Enter a password"
                className="mt-2 h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-artis-navy outline-none transition placeholder:text-artis-slate focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20"
              />
              <p id="password-help" className="mt-2 text-sm text-artis-slate">
                Use at least 12 characters.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="text-sm font-semibold text-artis-navy"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                placeholder="Re-enter your password"
                className="mt-2 h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-artis-navy outline-none transition placeholder:text-artis-slate focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20"
              />
            </div>

            {errorMessage ? (
              <p
                className="rounded-[10px] border border-artis-error bg-artis-error/10 px-4 py-3 text-sm leading-6 text-artis-error"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3 font-semibold text-artis-white transition hover:bg-artis-deep-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating account…" : "Create admin account"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
