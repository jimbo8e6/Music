import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { db, ready, schema } from "@/db";

export const metadata: Metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
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

  if (!row || row.type !== "verify" || row.expiresAt < new Date()) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="mb-2 text-2xl font-bold">Link expired</h1>
          <p className="text-mist-400 mb-6 text-sm">
            This verification link is invalid or has expired.
          </p>
          <Link href="/" className="text-accent-400 hover:text-accent-300 text-sm transition-colors">
            Go to Wax →
          </Link>
        </div>
      </div>
    );
  }

  await db
    .update(schema.users)
    .set({ emailVerified: true })
    .where(eq(schema.users.id, row.userId));
  await db.delete(schema.emailTokens).where(eq(schema.emailTokens.id, row.id));

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 text-4xl">✅</div>
        <h1 className="mb-2 text-2xl font-bold">Email verified</h1>
        <p className="text-mist-400 mb-6 text-sm">
          Your email address has been confirmed.
        </p>
        <Link href="/" className="text-accent-400 hover:text-accent-300 text-sm transition-colors">
          Continue to Wax →
        </Link>
      </div>
    </div>
  );
}
