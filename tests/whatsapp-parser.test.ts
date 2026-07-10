import { describe, expect, it } from "vitest";
import { parseWhatsAppCommand } from "@/lib/whatsapp/parser";

describe("parseWhatsAppCommand", () => {
  it("parses an expense command with default food category", () => {
    const result = parseWhatsAppCommand("/uang 25000 kopi");

    expect(result).toEqual({
      type: "expense",
      amount: 25000,
      note: "kopi",
      category: "Makanan & Minuman",
      source: "whatsapp"
    });
  });

  it("parses a tomorrow schedule command", () => {
    const result = parseWhatsAppCommand("/jadwal Besok 10:00 Rapat bimbingan", {
      now: new Date("2026-04-24T08:00:00.000Z")
    });

    expect(result).toEqual({
      type: "schedule",
      date: "2026-04-25",
      startTime: "10:00",
      title: "Rapat bimbingan",
      source: "whatsapp"
    });
  });

  it("parses summary and total commands", () => {
    expect(parseWhatsAppCommand("/ringkasan hari ini")).toEqual({
      type: "summary",
      period: "today"
    });

    expect(parseWhatsAppCommand("/total minggu ini")).toEqual({
      type: "total",
      period: "week"
    });

    expect(parseWhatsAppCommand("/total bulan ini")).toEqual({
      type: "total",
      period: "month"
    });
  });

  it("returns an unknown command for unsupported text", () => {
    expect(parseWhatsAppCommand("halo")).toEqual({
      type: "unknown",
      reason: "Command tidak dikenali."
    });
  });
});
