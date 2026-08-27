import { describe, expect, it } from "vitest";
import { loginRetryAfter, passwordMatches, recordLoginResult, requestHasSession, sessionToken } from "@/lib/session";

describe("single-user session", () => {
  it("membuat token stabil dan menolak kata sandi berbeda", async () => {
    expect(await sessionToken("rahasia", "salt")).toBe(await sessionToken("rahasia", "salt"));
    expect(await passwordMatches("rahasia", "rahasia")).toBe(true);
    expect(await passwordMatches("salah", "rahasia")).toBe(false);
  });

  it("menerima kata sandi native melalui bearer", async () => {
    const previous = process.env.APP_PASSWORD;
    process.env.APP_PASSWORD = "rahasia";
    await expect(requestHasSession(new Request("http://localhost", { headers: { authorization: "Bearer rahasia" } }))).resolves.toBe(true);
    await expect(requestHasSession(new Request("http://localhost", { headers: { authorization: "Bearer salah" } }))).resolves.toBe(false);
    if (previous === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = previous;
  });

  it("memblokir percobaan berulang dan dapat dibersihkan setelah berhasil", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) recordLoginResult(key, false, 1_000);
    expect(loginRetryAfter(key, 1_000)).toBe(60);
    recordLoginResult(key, true, 1_000);
    expect(loginRetryAfter(key, 1_000)).toBe(0);
  });
});
