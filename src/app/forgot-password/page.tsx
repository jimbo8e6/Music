import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Forgot your password?</h1>
        <p className="text-mist-400 mb-6 text-center text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        <div className="surface p-6">
          <ForgotPasswordForm />
        </div>
        <p className="mt-4 text-center text-sm text-mist-400">
          Remember it?{" "}
          <Link href="/login" className="text-accent-400 hover:text-accent-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
