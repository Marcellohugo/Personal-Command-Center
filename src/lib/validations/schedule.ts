import { z } from "zod";

export const scheduleSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi."),
  description: z.string().trim().optional(),
  date: z.string().min(1, "Tanggal wajib diisi."),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam mulai tidak valid."),
  endTime: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "Jam selesai tidak valid."),
  location: z.string().trim().optional(),
  source: z.enum(["manual", "whatsapp", "google_calendar"]).default("manual")
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;
