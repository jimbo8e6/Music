import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 text-4xl">📬</div>
        <h1 className="mb-2 text-2xl font-bold">Check your email</h1>
        <p className="text-mist-400 mb-6 text-sm">
          We&apos;ve sent you a verification link. Click it to confirm your email address.
        </p>
        <Link href="/" className="text-accent-400 hover:text-accent-300 text-sm transition-colors">
          Continue to Wax →
        </Link>
      </div>
    </div>
  );
}
