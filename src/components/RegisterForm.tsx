"use client";

import { useActionState } from "react";

import { registerUser } from "@/lib/actions";

const inputClass =
  "w-full rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-sm placeholder:text-mist-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerUser, {});

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
      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-mist-500">3–20 characters, letters/numbers/underscores</p>
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-mist-500">At least 8 characters</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-accent-400 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
