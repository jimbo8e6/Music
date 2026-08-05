"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/lib/actions";

const inputClass =
  "w-full rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-sm placeholder:text-mist-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  if (state.success) {
    return (
      <div className="rounded-md bg-green-900/30 border border-green-800 px-4 py-3 text-sm text-green-300">
        If that email is registered, you&apos;ll receive a reset link shortly. Check your inbox.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-accent-400 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
