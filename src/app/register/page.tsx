import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "@/components/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">Create an account</h1>
        <div className="surface p-6">
          <RegisterForm />
        </div>
        <p className="mt-4 text-center text-sm text-mist-400">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-400 hover:text-accent-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
