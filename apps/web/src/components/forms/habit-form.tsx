import { Plus } from "lucide-react";

export function HabitForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
      <div className="grid gap-2">
        <label className="label" htmlFor="habit-name">
          Nama kebiasaan
        </label>
        <input className="field" id="habit-name" name="name" placeholder="Baca 20 menit" required />
      </div>
      <div className="grid gap-2">
        <label className="label" htmlFor="habit-frequency">
          Frekuensi
        </label>
        <select className="field" id="habit-frequency" name="frequency" defaultValue="daily">
          <option value="daily">Harian</option>
          <option value="weekly">Mingguan</option>
        </select>
      </div>
      <button type="submit" className="button-primary">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tambah
      </button>
    </form>
  );
}
