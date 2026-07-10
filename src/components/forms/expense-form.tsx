import { ReceiptText } from "lucide-react";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatDateInput } from "@/lib/utils";

type ExpenseFormDefaults = {
  id?: string;
  amount?: number;
  category?: string;
  note?: string | null;
  date?: Date;
  source?: "manual" | "whatsapp";
};

export function ExpenseForm({
  action,
  defaultValues,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: ExpenseFormDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-3">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <input type="hidden" name="source" value={defaultValues?.source ?? "manual"} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `amount-${defaultValues.id}` : "expense-amount"}>
            Nominal
          </label>
          <input
            className="field"
            id={defaultValues?.id ? `amount-${defaultValues.id}` : "expense-amount"}
            name="amount"
            type="number"
            min="1"
            defaultValue={defaultValues?.amount}
            placeholder="25000"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `category-${defaultValues.id}` : "expense-category"}>
            Kategori
          </label>
          <select
            className="field"
            id={defaultValues?.id ? `category-${defaultValues.id}` : "expense-category"}
            name="category"
            defaultValue={defaultValues?.category ?? "Makanan & Minuman"}
          >
            {DEFAULT_EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `expense-date-${defaultValues.id}` : "expense-date"}>
            Tanggal
          </label>
          <input
            className="field"
            id={defaultValues?.id ? `expense-date-${defaultValues.id}` : "expense-date"}
            name="date"
            type="date"
            defaultValue={defaultValues?.date ? formatDateInput(defaultValues.date) : formatDateInput(new Date())}
            required
          />
        </div>
      </div>
      <div className="grid gap-2">
        <label className="label" htmlFor={defaultValues?.id ? `note-${defaultValues.id}` : "expense-note"}>
          Catatan
        </label>
        <input
          className="field"
          id={defaultValues?.id ? `note-${defaultValues.id}` : "expense-note"}
          name="note"
          defaultValue={defaultValues?.note ?? ""}
          placeholder="Kopi"
        />
      </div>
      <button type="submit" className="button-primary w-fit">
        <ReceiptText className="h-4 w-4" aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}
