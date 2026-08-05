"use client";

import { useActionState } from "react";

import { resetPassword } from "@/lib/actions";

const inputClass =
  "w-full rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-sm placeholder:text-mist-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

export function ResetPasswordForm({ token }: { token: string }) {
  const action = resetPassword.bind(null, token);
  const [state, boundAction, pending] = useActionState(action, {});

  return (
    <form action={boundAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          New password
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
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-accent-400 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
