import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "wax_session";
const HEADER = "x-wax-session";

/**
 * Assigns every browser its own session ID so user data is isolated per
 * device. The cookie persists for 10 years (effectively permanent).
 *
 * The first request for a browser has no cookie yet, so the generated ID is
 * also injected as a request header so getCurrentUser() can read it on that
 * very first render before the cookie lands.
 */
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(COOKIE)?.value;
  if (existing) return NextResponse.next();

  const id = crypto.randomUUID();

  const response = NextResponse.next({
    request: {
      headers: new Headers({ ...Object.fromEntries(request.headers), [HEADER]: id }),
    },
  });

  response.cookies.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 10,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
