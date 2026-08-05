import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">Sign in to Wax</h1>
        {reset === "1" && (
          <p className="mb-4 rounded-md bg-green-900/30 border border-green-800 px-3 py-2 text-center text-sm text-green-300">
            Password updated — sign in with your new password.
          </p>
        )}
        <div className="surface p-6">
          <LoginForm />
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-mist-400">
          <Link href="/forgot-password" className="hover:text-mist-200 transition-colors">
            Forgot password?
          </Link>
          <span>
            No account?{" "}
            <Link href="/register" className="text-accent-400 hover:text-accent-300 transition-colors">
              Register
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
