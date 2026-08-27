"use client";

import { LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const password = String(new FormData(event.currentTarget).get("password") || "");
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(result.error || "Kode akses tidak cocok.");
      return;
    }
    const next = new URLSearchParams(location.search).get("next");
    location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  }

  return <main className="motivation-hero grid min-h-screen place-items-center p-5 text-ink dark:text-paper"><form className="w-full max-w-md rounded-[1.75rem] border border-white/60 bg-white/95 p-7 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-[#071a35]/95" onSubmit={submit}><span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-lg shadow-blue-900/25"><LockKeyhole className="h-7 w-7" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-200">Marco Life OS</p><h1 className="mt-2 text-3xl font-black">Buka ruang hidupmu</h1><p className="mt-2 text-sm leading-6 text-ink/55 dark:text-paper/55">Masukkan password pribadi untuk membuka dashboard, data, dan progres Anda. Tidak ada pendaftaran publik.</p><label className="mt-6 grid gap-2"><span className="label">Password</span><input className="field min-h-12 text-base tracking-wider" name="password" type="password" minLength={6} maxLength={128} autoComplete="current-password" autoFocus required /></label>{error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}<button className="button-primary mt-5 min-h-12 w-full justify-center" type="submit" disabled={loading}>{loading ? "Memeriksa…" : "Buka dengan aman"}</button><p className="mt-4 text-center text-xs text-ink/40 dark:text-paper/40">Sesi tersimpan aman selama 7 hari atau sampai aplikasi dikunci.</p></form></main>;
}
