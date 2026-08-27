import { NextResponse, type NextRequest } from "next/server";
import { requestHasSession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/session" || pathname === "/api/auth/google/callback" || pathname === "/api/notifications/run") return NextResponse.next();

  if (await requestHasSession(request)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|favicon.ico|sw.js|offline.html|manifest.webmanifest).*)"]
};
