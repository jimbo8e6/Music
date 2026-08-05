"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-mist-400 hover:text-mist-100 -ml-0.5 flex items-center gap-1 text-sm transition-colors"
    >
      ← Back
    </button>
  );
}
