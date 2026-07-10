import { z } from "zod";

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Nama habit wajib diisi."),
  frequency: z.enum(["daily", "weekly"]).default("daily")
});

export type HabitInput = z.infer<typeof habitSchema>;
