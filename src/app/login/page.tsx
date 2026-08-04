import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">Sign in to Wax</h1>
        <div className="surface p-6">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-mist-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-accent-400 hover:text-accent-300 transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
