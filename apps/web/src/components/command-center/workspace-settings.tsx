"use client";

import { Download, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import type { OfflineWorkspace } from "@/lib/offline-workspace";
import { parseWorkspace } from "@/lib/offline-workspace";
import { IntegrationSettings } from "@/components/command-center/integration-settings";

type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
  syncState: "offline" | "syncing" | "synced" | "conflict" | "error";
  conflict: boolean;
  onUseRemote: () => void;
  onKeepLocal: () => void;
  onEnableNotifications: () => Promise<void>;
  onResetWorkspace: () => Promise<void>;
};

const syncLabels = {
  offline: "Offline",
  syncing: "Menyinkronkan…",
  synced: "Tersinkron",
  conflict: "Konflik data",
  error: "Sinkronisasi gagal"
};

export function WorkspaceSettings({ workspace, updateWorkspace, syncState, conflict, onUseRemote, onKeepLocal, onEnableNotifications, onResetWorkspace }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  function exportWorkspace() {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `command-center-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = parseWorkspace(await file.text());
      if (!data) throw new Error("Backup tidak valid.");
      updateWorkspace(() => data);
      setImportError("");
    } catch {
      setImportError("File backup tidak dapat dibaca.");
    }
    event.target.value = "";
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: String(data.get("currentPassword") || ""), newPassword: String(data.get("newPassword") || "") }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setPasswordMessage(response.ok ? "Password berhasil diubah." : result.error || "Password belum dapat diubah.");
    if (response.ok) event.currentTarget.reset();
  }

  return <section className="grid gap-5">
    <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-clay">Sistem</p><h2 className="text-3xl font-black">Pengaturan</h2></header>
    <section className="panel grid gap-4 rounded-xl p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-moss/10 text-moss"><RefreshCw className="h-5 w-5" /></span><div><h3 className="font-black">Sinkronisasi</h3><p className="mt-1 text-sm text-ink/55 dark:text-paper/50">Data lokal akan dikirim saat koneksi tersedia.</p></div><span className="ml-auto rounded-full bg-ink/5 px-3 py-1 text-xs font-bold dark:bg-white/10">{syncLabels[syncState]}</span></div>{conflict ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-bold">Data berubah di perangkat lain.</p><p className="mt-1">Pilih data remote atau pertahankan data perangkat ini.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="button-secondary" onClick={onUseRemote}>Gunakan remote</button><button type="button" className="button-primary" onClick={onKeepLocal}>Pertahankan lokal</button></div></div> : null}</section>
    <IntegrationSettings />
    <section className="panel grid gap-4 rounded-xl p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-clay/10 text-clay"><Eye className="h-5 w-5" /></span><div><h3 className="font-black">Privasi tampilan</h3><p className="mt-1 text-sm text-ink/55 dark:text-paper/50">Sembunyikan nominal saat membuka aplikasi di tempat umum.</p></div></div><label className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 dark:border-white/10"><span className="flex items-center gap-2 text-sm font-bold">{workspace.settings.hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} Sembunyikan saldo</span><input type="checkbox" checked={workspace.settings.hideBalances} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, hideBalances: event.target.checked } }))} /></label></section>
    <section className="panel grid gap-4 rounded-xl p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-moss/10 text-moss"><ShieldCheck className="h-5 w-5" /></span><div><h3 className="font-black">Anggaran & pengingat</h3><p className="mt-1 text-sm text-ink/55 dark:text-paper/50">Atur batas pengeluaran, mata uang, dan waktu ritual pribadi.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2"><span className="label">Anggaran bulanan umum</span><input className="field" type="number" min="0" step="100000" value={workspace.settings.monthlyBudget || ""} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, monthlyBudget: Number(event.target.value) || 0 } }))} placeholder="0" /></label><label className="grid gap-2"><span className="label">Mata uang utama</span><select className="field" value={workspace.settings.defaultCurrency} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, defaultCurrency: event.target.value } }))}><option value="IDR">IDR · Rupiah</option><option value="USD">USD · Dolar AS</option><option value="SGD">SGD · Dolar Singapura</option><option value="EUR">EUR · Euro</option></select></label></div><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-2"><span className="label">Ritual pagi</span><input className="field" type="time" value={workspace.settings.morningReminder ?? "08:00"} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, morningReminder: event.target.value } }))} /></label><label className="grid gap-2"><span className="label">Ritual malam</span><input className="field" type="time" value={workspace.settings.eveningReminder ?? "20:00"} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, eveningReminder: event.target.value } }))} /></label><label className="grid gap-2"><span className="label">Review mingguan</span><input className="field" type="time" value={workspace.settings.weeklyReviewReminder ?? "18:00"} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, weeklyReviewReminder: event.target.value } }))} /></label></div><button type="button" className="button-secondary w-fit" onClick={onEnableNotifications}>Aktifkan pengingat lokal</button><p className="text-xs text-ink/45 dark:text-paper/45">Pengingat lokal berjalan ketika aplikasi tersedia; sinkronisasi push dipakai saat perangkat online.</p></section>
    <section className="panel grid gap-4 rounded-xl p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300"><KeyRound className="h-5 w-5" /></span><div><h3 className="font-black">Keamanan akses</h3><p className="mt-1 text-sm text-ink/55 dark:text-paper/50">Ubah password tanpa sign in atau membuat akun baru.</p></div></div><form className="grid gap-3 sm:grid-cols-2" onSubmit={changePassword}><input className="field" name="currentPassword" type="password" minLength={6} placeholder="Password saat ini" required /><input className="field" name="newPassword" type="password" minLength={8} placeholder="Password baru (min. 8)" required /><button type="submit" className="button-primary w-fit">Simpan password</button></form>{passwordMessage ? <p className="text-sm font-semibold text-blue-700 dark:text-blue-200">{passwordMessage}</p> : null}</section>
    <section className="panel grid gap-4 rounded-xl p-5"><div><h3 className="font-black">Backup seluruh workspace</h3><p className="mt-1 text-sm text-ink/55 dark:text-paper/50">Simpan notes, transaksi, agenda, kebiasaan, tabungan, dan pengaturan sebagai satu file.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="button-primary" onClick={exportWorkspace}><Download className="h-4 w-4" />Export JSON</button><button type="button" className="button-secondary" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Import JSON</button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importWorkspace} /></div>{importError ? <p className="text-sm font-semibold text-clay">{importError}</p> : null}</section>
    <section className="panel grid gap-4 rounded-xl border-red-200 p-5 dark:border-red-900/50"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"><Trash2 className="h-5 w-5" /></span><div><h3 className="font-black">Reset workspace</h3><p className="mt-1 text-sm text-ink/55 dark:text-paper/50">Menghapus seluruh data internal tanpa menghapus acara Google Calendar.</p></div></div><button type="button" className="button-danger w-fit" onClick={onResetWorkspace}>Reset semua data</button></section>
  </section>;
}
