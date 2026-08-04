import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionFromRequest } from "@/lib/auth";

const AUTH_ONLY_PATHS = new Set(["/login", "/register"]);

const PUBLIC_PATHS = new Set(["/", "/search", "/people"]);
const PUBLIC_PREFIXES = ["/album/", "/artist/", "/profile/"];

function isPublic(pathname: string): boolean {
  // Log form always requires auth even though /album/* is otherwise public
  if (/^\/album\/[^/]+\/log(\/|$)/.test(pathname)) return false;
  if (AUTH_ONLY_PATHS.has(pathname)) return true;
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await getSessionFromRequest(request);

  // Logged-in users hitting login/register → send home
  if (session && AUTH_ONLY_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Unauthenticated users hitting protected routes → send to login
  if (!session && !isPublic(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!session) return NextResponse.next();

  // Inject user identity so server components read it without a DB round-trip.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-username", session.username);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
