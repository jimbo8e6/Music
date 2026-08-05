import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { db, ready, schema } from "@/db";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  await ready();
  const row = await db
    .select()
    .from(schema.emailTokens)
    .where(eq(schema.emailTokens.token, token))
    .get();

  const valid = row && row.type === "reset" && row.expiresAt >= new Date();

  if (!valid) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="mb-2 text-2xl font-bold">Link expired</h1>
          <p className="text-mist-400 mb-6 text-sm">
            This reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="text-accent-400 hover:text-accent-300 text-sm transition-colors"
          >
            Request a new link →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">Set a new password</h1>
        <div className="surface p-6">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </div>
  );
}
