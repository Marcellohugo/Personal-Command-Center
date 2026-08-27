import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ requestHasSession: vi.fn(async () => false) }));

import { proxy } from "@/proxy";

describe("proxy", () => {
  it("meneruskan scheduler agar CRON_SECRET diperiksa oleh endpoint", async () => {
    const response = await proxy(new NextRequest("http://localhost/api/notifications/run"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
