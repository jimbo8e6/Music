"use client";

import { useActionState } from "react";

import { loginUser } from "@/lib/actions";

const inputClass =
  "w-full rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-sm placeholder:text-mist-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginUser, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="identifier" className="mb-1 block text-sm font-medium">
          Email or username
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username email"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-accent-400 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
