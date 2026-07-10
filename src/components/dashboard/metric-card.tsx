import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
}) {
  return (
    <section className="panel rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</p>
          <p className="mt-3 text-2xl font-black text-ink">{value}</p>
          {detail ? <p className="mt-1 text-sm text-ink/60">{detail}</p> : null}
        </div>
        <div className="rounded-md bg-moss/10 p-2 text-moss">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
