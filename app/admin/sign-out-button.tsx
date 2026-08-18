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
        className="min-h-12 rounded-[10px] bg-artis-gold px-6 py-3 text-sm font-semibold text-artis-deep-navy transition hover:bg-artis-gold/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-navy/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>

      {errorMessage ? (
        <p
          className="max-w-sm rounded-[10px] border border-artis-error bg-artis-error/10 px-3 py-2 text-sm leading-6 text-artis-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
