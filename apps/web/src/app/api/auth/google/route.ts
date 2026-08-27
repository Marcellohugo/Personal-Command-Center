import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google-calendar";
import { requestHasSession } from "@/lib/session";

export async function GET(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.redirect(new URL("/login", request.url));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/dashboard?google=not-configured", request.url));
  const state = randomBytes(32).toString("base64url");
  const redirectUri = `${process.env.APP_URL || new URL(request.url).origin}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/calendar.events", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, ...(process.env.APP_USER_EMAIL ? { login_hint: process.env.APP_USER_EMAIL } : {}) }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("pcc_google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: redirectUri.startsWith("https://"), path: "/", maxAge: 600 });
  return response;
}
