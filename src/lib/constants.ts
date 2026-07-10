export const DEFAULT_EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Pendidikan",
  "Kesehatan",
  "Hiburan",
  "Tagihan",
  "Lainnya"
] as const;

export const DEFAULT_EXPENSE_CATEGORY = DEFAULT_EXPENSE_CATEGORIES[0];

export type ExpenseCategory = (typeof DEFAULT_EXPENSE_CATEGORIES)[number];
