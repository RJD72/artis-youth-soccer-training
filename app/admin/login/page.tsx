"use client";

import { type SubmitEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

function getTextField(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

export default function AdminLoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const email = getTextField(formData, "email").trim();
    const password = getTextField(formData, "password");

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });

      if (error) {
        setErrorMessage(
          "The email or password is incorrect. Please try again.",
        );
        return;
      }

      router.replace("/admin");
      router.refresh();
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
          Administrator login
        </h1>

        <p className="mt-4 leading-7 text-artis-slate">
          Sign in with the email address and password for your administrator
          account.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-artis-navy"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
              placeholder="name@example.com"
              className="mt-2 h-13 w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-artis-navy outline-none transition placeholder:text-artis-slate focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20"
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
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={128}
              placeholder="Enter your password"
              className="mt-2 h-13 w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-artis-navy outline-none transition placeholder:text-artis-slate focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20"
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
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
