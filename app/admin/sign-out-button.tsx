"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setErrorMessage("");
    setIsSigningOut(true);

    try {
      const { error } = await authClient.signOut();

      if (error) {
        setErrorMessage("There was a problem signing out. Please try again.");
        return;
      }
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setErrorMessage(
        "The server could not be reached. Please wait a moment and try again.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3 sm:items-end">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>

      {errorMessage ? (
        <p className="max-w-sm text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
