import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ScheduleForm } from "@/components/forms/schedule-form";
import { createSchedule, deleteSchedule, updateSchedule } from "@/lib/actions/schedules";
import { requireCurrentUser } from "@/lib/auth";
import { dayRange, parseDateInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/utils";

type SchedulesPageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function SchedulesPage({ searchParams }: SchedulesPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const selectedDateValue = params?.date ?? formatDateInput(new Date());
  const selectedDate = parseDateInput(selectedDateValue);

  const schedules = await prisma.schedule.findMany({
    where: {
      userId: user.id,
      date: dayRange(selectedDate)
    },
    orderBy: [{ startTime: "asc" }]
  });

  return (
    <AppShell userName={user.name}>
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Modul jadwal</p>
            <h2 className="text-3xl font-black text-ink">Jadwal</h2>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="grid gap-2">
              <label className="label" htmlFor="filter-date">
                Lihat tanggal
              </label>
              <input className="field" id="filter-date" name="date" type="date" defaultValue={selectedDateValue} />
            </div>
            <button type="submit" className="button-secondary">
              Terapkan
            </button>
          </form>
        </header>

        <section className="panel rounded-lg p-5">
          <h3 className="text-lg font-black text-ink">Tambah jadwal</h3>
          <div className="mt-4">
            <ScheduleForm action={createSchedule} submitLabel="Tambah jadwal" />
          </div>
        </section>

        <section className="grid gap-4">
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <article key={schedule.id} className="panel rounded-lg p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{schedule.source}</p>
                    <h3 className="text-lg font-black text-ink">{schedule.title}</h3>
                  </div>
                  <form action={deleteSchedule}>
                    <input type="hidden" name="id" value={schedule.id} />
                    <button className="button-danger" type="submit" title="Hapus jadwal">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Hapus
                    </button>
                  </form>
                </div>
                <ScheduleForm action={updateSchedule} submitLabel="Simpan perubahan" defaultValues={schedule} />
              </article>
            ))
          ) : (
            <p className="panel rounded-lg p-5 text-sm text-ink/60">Belum ada jadwal untuk tanggal ini.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
