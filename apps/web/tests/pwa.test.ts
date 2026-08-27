import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA", () => {
  it("menyediakan manifest yang dapat dipasang", () => {
    const value = manifest();

    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ sizes: "512x512", type: "image/png" }),
        expect.objectContaining({ purpose: "maskable" })
      ])
    );
  });

  it("menyimpan app shell tanpa menyimpan API", () => {
    const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

    expect(serviceWorker).toContain('const APP_ROUTES = ["/dashboard"]');
    expect(serviceWorker).toContain('const routeKey = url.pathname + url.search;');
    expect(serviceWorker).toContain('const CACHE_NAME = `${CACHE_PREFIX}v13`;');
    expect(serviceWorker).toContain("html.matchAll");
    expect(serviceWorker).toContain('url.pathname === "/"');
    expect(serviceWorker).toContain('url.pathname.startsWith("/_next/static/")');
    expect(serviceWorker).not.toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorker).toContain('self.addEventListener("push"');
    expect(serviceWorker).toContain('self.addEventListener("notificationclick"');
  });
});
