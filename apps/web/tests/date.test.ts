import { describe, expect, it } from "vitest";
import { calendarRange } from "@/lib/date";

describe("calendarRange", () => {
  it("memilih rentang harian, mingguan, dan bulanan dari tanggal acuan", () => {
    const date = new Date("2026-07-19T12:00:00");

    expect(calendarRange("day", date).gte.getDate()).toBe(19);
    expect(calendarRange("week", date).gte.getDate()).toBe(13);
    expect(calendarRange("month", date).gte.getDate()).toBe(1);
  });
});
