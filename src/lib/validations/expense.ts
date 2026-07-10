import { z } from "zod";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";

export const expenseSchema = z.object({
  amount: z.coerce.number().int().positive("Nominal harus lebih dari 0."),
  category: z.enum(DEFAULT_EXPENSE_CATEGORIES),
  note: z.string().trim().optional(),
  date: z.string().min(1, "Tanggal wajib diisi."),
  source: z.enum(["manual", "whatsapp"]).default("manual")
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
