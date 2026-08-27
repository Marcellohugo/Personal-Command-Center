import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { sealSecret } from "@/lib/secret-box";

export async function GET(request: NextRequest) {
  const dashboard = new URL("/dashboard", process.env.APP_URL || request.url);
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!googleConfigured() || !code || !state || state !== request.cookies.get("pcc_google_oauth_state")?.value) {
    dashboard.searchParams.set("google", "failed");
    return NextResponse.redirect(dashboard);
  }
  const redirectUri = `${process.env.APP_URL || request.nextUrl.origin}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }), cache: "no-store" });
  if (!tokenResponse.ok) { dashboard.searchParams.set("google", "failed"); return NextResponse.redirect(dashboard); }
  const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const user = await requireCurrentUser();
  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { googleRefreshToken: true } });
  await prisma.user.update({ where: { id: user.id }, data: { googleAccessToken: sealSecret(token.access_token), googleRefreshToken: token.refresh_token ? sealSecret(token.refresh_token) : existing?.googleRefreshToken, googleTokenExpiry: new Date(Date.now() + token.expires_in * 1000) } });
  dashboard.searchParams.set("google", "connected");
  const response = NextResponse.redirect(dashboard);
  response.cookies.set("pcc_google_oauth_state", "", { path: "/", maxAge: 0 });
  return response;
}
