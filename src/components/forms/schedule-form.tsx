import { CalendarPlus } from "lucide-react";
import { formatDateInput } from "@/lib/utils";

type ScheduleFormDefaults = {
  id?: string;
  title?: string;
  description?: string | null;
  date?: Date;
  startTime?: string;
  endTime?: string | null;
  location?: string | null;
  source?: "manual" | "whatsapp" | "google_calendar";
};

export function ScheduleForm({
  action,
  defaultValues,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: ScheduleFormDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-3">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <input type="hidden" name="source" value={defaultValues?.source ?? "manual"} />
      <div className="grid gap-2">
        <label className="label" htmlFor={defaultValues?.id ? `title-${defaultValues.id}` : "schedule-title"}>
          Judul
        </label>
        <input
          className="field"
          id={defaultValues?.id ? `title-${defaultValues.id}` : "schedule-title"}
          name="title"
          defaultValue={defaultValues?.title}
          placeholder="Rapat bimbingan"
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `date-${defaultValues.id}` : "schedule-date"}>
            Tanggal
          </label>
          <input
            className="field"
            id={defaultValues?.id ? `date-${defaultValues.id}` : "schedule-date"}
            name="date"
            type="date"
            defaultValue={defaultValues?.date ? formatDateInput(defaultValues.date) : formatDateInput(new Date())}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `start-${defaultValues.id}` : "schedule-start"}>
            Mulai
          </label>
          <input
            className="field"
            id={defaultValues?.id ? `start-${defaultValues.id}` : "schedule-start"}
            name="startTime"
            type="time"
            defaultValue={defaultValues?.startTime ?? "09:00"}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `end-${defaultValues.id}` : "schedule-end"}>
            Selesai
          </label>
          <input
            className="field"
            id={defaultValues?.id ? `end-${defaultValues.id}` : "schedule-end"}
            name="endTime"
            type="time"
            defaultValue={defaultValues?.endTime ?? ""}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `location-${defaultValues.id}` : "schedule-location"}>
            Lokasi
          </label>
          <input
            className="field"
            id={defaultValues?.id ? `location-${defaultValues.id}` : "schedule-location"}
            name="location"
            defaultValue={defaultValues?.location ?? ""}
            placeholder="Kampus"
          />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor={defaultValues?.id ? `desc-${defaultValues.id}` : "schedule-description"}>
            Deskripsi
          </label>
          <input
            className="field"
            id={defaultValues?.id ? `desc-${defaultValues.id}` : "schedule-description"}
            name="description"
            defaultValue={defaultValues?.description ?? ""}
            placeholder="Catatan singkat"
          />
        </div>
      </div>
      <button type="submit" className="button-primary w-fit">
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}
