"use client";

import { CalendarDays, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type GoogleState = { configured: boolean; connected: boolean };

async function responseJson<T>(response: Response) {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Permintaan gagal.");
  return body;
}

export function IntegrationSettings() {
  const [google, setGoogle] = useState<GoogleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setGoogle(await fetch("/api/integrations/google", { cache: "no-store" }).then((response) => responseJson<GoogleState>(response)));
  }

  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : "Integrasi belum dapat dibaca.")); }, []);

  async function syncGoogle() {
    setBusy(true); setMessage("");
    try {
      const result = await fetch("/api/integrations/google", { method: "POST" }).then((response) => responseJson<{ pushed: number; imported: number }>(response));
      setMessage(`Google Calendar tersinkron: ${result.pushed} agenda terhubung.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sinkronisasi gagal."); }
    finally { setBusy(false); }
  }

  async function disconnectGoogle() {
    setBusy(true); setMessage("");
    try { await fetch("/api/integrations/google", { method: "DELETE" }).then((response) => responseJson(response)); await load(); setMessage("Google Calendar diputuskan. Acara Google tidak dihapus."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Gagal memutuskan Google Calendar."); }
    finally { setBusy(false); }
  }

  return <section className="grid gap-4">
    <article className="panel relative overflow-hidden rounded-2xl border border-blue-200 p-5 dark:border-blue-900/60"><div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-500/10" /><div className="relative flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><CalendarDays className="h-5 w-5" /></span><div><h3 className="font-black">Google Calendar</h3><p className="mt-1 text-sm text-ink/55 dark:text-paper/50">Sinkronisasi agenda keluar dan import manual saat Anda memintanya.</p></div>{google?.connected ? <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" /> : null}</div><div className="relative mt-5 flex flex-wrap gap-2">{google?.connected ? <><button className="button-primary" type="button" onClick={syncGoogle} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Sinkronkan sekarang</button><button className="button-secondary" type="button" onClick={disconnectGoogle} disabled={busy}>Putuskan</button></> : google?.configured ? <a className="button-primary" href="/api/auth/google"><CalendarDays className="h-4 w-4" />Hubungkan Google</a> : <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Masukkan OAuth Client Google pada konfigurasi aplikasi terlebih dahulu.</span>}</div></article>
    {message ? <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">{message}</p> : null}
  </section>;
}
