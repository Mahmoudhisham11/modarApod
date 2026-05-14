import { NextResponse } from "next/server";

import { decodeSessionToken, getSessionTokenFromRequest } from "./lib/auth/session.js";

/**
 * حماية المسارات بدون جلسة. متوافق مع Next 14+ (ملف middleware التقليدي).
 * @param {import("next/server").NextRequest} request
 */
export function middleware(request) {
  const url = request.nextUrl;
  const { pathname } = url;

  if (pathname.startsWith("/api")) return NextResponse.next();
  if (pathname === "/login" || pathname === "/register") return NextResponse.next();
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (/\.(ico|png|jpg|jpeg|svg|webp|gif|txt|xml|webmanifest)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const token = getSessionTokenFromRequest(request);
  const session = decodeSessionToken(token);
  if (!session) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
