"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="panel max-w-lg rounded-lg p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Terjadi error</p>
        <h1 className="mt-2 text-2xl font-black text-ink">Aplikasi tidak bisa memproses permintaan.</h1>
        <p className="mt-3 text-sm text-ink/60">{error.message || "Silakan coba ulang."}</p>
        <button type="button" onClick={reset} className="button-primary mt-5">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Coba lagi
        </button>
      </section>
    </main>
  );
}
