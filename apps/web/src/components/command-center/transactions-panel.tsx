"use client";

import { ArrowLeftRight, Paperclip, Pencil, Plus, ReceiptText, Search, Trash2, Wallet } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { putTransaction, removeTransaction } from "@/lib/workspace-finance";
import type { OfflineWorkspace, Transaction, WorkspaceAttachment } from "@/lib/offline-workspace";
import { ensureAttachmentBudget, fileToAttachment } from "@/lib/attachments";
import { categorySuggestion } from "@/lib/finance-insights";
import { formatCurrency } from "@/lib/utils";

type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
  hideBalances: boolean;
};

function today() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function money(value: number, hidden: boolean, currency: string) {
  return hidden ? "••••••" : formatCurrency(value, currency);
}

export function TransactionsPanel({ workspace, updateWorkspace, hideBalances }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | Transaction["kind"]>("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | NonNullable<Transaction["status"]>>("all");
  const [receipts, setReceipts] = useState<WorkspaceAttachment[]>([]);
  const editing = workspace.transactions.find(({ id }) => id === editingId);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    return [...workspace.transactions]
      .filter((item) => kindFilter === "all" || item.kind === kindFilter)
      .filter((item) => !sourceFilter || item.sourceId === sourceFilter || item.destinationSourceId === sourceFilter)
      .filter((item) => !categoryFilter || item.categoryId === categoryFilter || item.splits?.some(({ categoryId }) => categoryId === categoryFilter))
      .filter((item) => statusFilter === "all" || (item.status ?? "cleared") === statusFilter)
      .filter((item) => !fromDate || item.date >= fromDate)
      .filter((item) => !toDate || item.date <= toDate)
      .filter((item) => !minimum || item.amount >= Number(minimum))
      .filter((item) => !maximum || item.amount <= Number(maximum))
      .filter((item) => !normalized || `${item.payee ?? ""} ${item.note} ${item.date}`.toLocaleLowerCase("id-ID").includes(normalized))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [categoryFilter, fromDate, kindFilter, maximum, minimum, query, sourceFilter, statusFilter, toDate, workspace.transactions]);
  const totals = useMemo(() => workspace.transactions.reduce((result, item) => {
    if (item.kind === "income") result.income += item.amount;
    if (item.kind === "expense") result.expense += item.amount;
    return result;
  }, { income: 0, expense: 0 }), [workspace.transactions]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date") || today());
    if (workspace.settings.lockedFinanceMonths.includes(date.slice(0, 7))) {
      window.alert("Periode ini sudah dikunci. Buka kunci melalui tab Impor & audit.");
      return;
    }
    const amount = Math.max(1, Number(data.get("amount")) || 0);
    const splitLines = String(data.get("splits") || "").split("\n").map((line) => line.trim()).filter(Boolean);
    const splits = splitLines.map((line) => {
      const [categoryName, value, ...note] = line.split("=").map((item) => item.trim());
      return { id: crypto.randomUUID(), categoryId: workspace.categoryGroups.find((item) => item.name.toLocaleLowerCase("id-ID") === categoryName.toLocaleLowerCase("id-ID"))?.id, amount: Math.max(0, Number(value) || 0), note: note.join("=") || undefined };
    });
    if (splits.length && (splits.some((item) => !item.categoryId || !item.amount) || Math.abs(splits.reduce((sum, item) => sum + item.amount, 0) - amount) > 0.01)) {
      window.alert("Split harus memakai nama kategori yang tepat dan totalnya sama dengan nominal transaksi.");
      return;
    }
    const note = String(data.get("note") || "").trim();
    const payee = String(data.get("payee") || "").trim();
    const selectedCategory = String(data.get("categoryId") || "") || undefined;
    const transaction: Transaction = {
      id: editing?.id ?? crypto.randomUUID(),
      kind: data.get("kind") as Transaction["kind"],
      amount,
      date,
      sourceId: String(data.get("sourceId") || ""),
      destinationSourceId: String(data.get("destinationSourceId") || "") || undefined,
      categoryId: selectedCategory ?? categorySuggestion(workspace, `${payee} ${note}`),
      note,
      payee: payee || undefined,
      status: String(data.get("status")) as NonNullable<Transaction["status"]>,
      linkedNoteId: String(data.get("linkedNoteId") || "") || undefined,
      splits: splits.length ? splits : undefined,
      receiptAttachments: receipts.length ? receipts : undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (transaction.kind === "transfer" && (!transaction.destinationSourceId || transaction.destinationSourceId === transaction.sourceId)) {
      window.alert("Pilih sumber tujuan transfer yang berbeda.");
      return;
    }
    updateWorkspace((current) => putTransaction(current, transaction, current.transactions.find(({ id }) => id === editing?.id)));
    setEditingId(null);
    setReceipts([]);
    setShowForm(false);
  }

  function remove(id: string) {
    const item = workspace.transactions.find((transaction) => transaction.id === id);
    if (item && workspace.settings.lockedFinanceMonths.includes(item.date.slice(0, 7))) {
      window.alert("Transaksi berada di periode yang dikunci.");
      return;
    }
    if (!confirm("Hapus transaksi ini dan kembalikan saldo sumber uang?")) return;
    updateWorkspace((current) => removeTransaction(current, id));
  }

  function startEdit(item: Transaction) {
    setEditingId(item.id);
    setReceipts(item.receiptAttachments ?? []);
    setShowForm(true);
  }

  const field = editing;

  return (
    <section className="grid gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-clay">Keuangan terpadu</p><h2 className="text-3xl font-black">Transaksi</h2></div>
        <button type="button" className="button-primary" onClick={() => { setEditingId(null); setReceipts([]); setShowForm((current) => !current); }}><Plus className="h-4 w-4" />Tambah transaksi</button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Ringkasan transaksi">
        <article className="panel rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Pemasukan</p><p className="mt-2 text-lg font-black text-moss">{money(totals.income, hideBalances, workspace.settings.defaultCurrency)}</p></article>
        <article className="panel rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Pengeluaran</p><p className="mt-2 text-lg font-black text-clay">{money(totals.expense, hideBalances, workspace.settings.defaultCurrency)}</p></article>
        <article className="panel col-span-2 rounded-xl p-4 sm:col-span-1"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Selisih</p><p className="mt-2 text-lg font-black">{money(totals.income - totals.expense, hideBalances, workspace.settings.defaultCurrency)}</p></article>
      </section>

      {showForm ? (
        <form className="panel grid gap-4 rounded-xl p-5 sm:grid-cols-2" onSubmit={save}>
          <div className="sm:col-span-2 flex items-center justify-between"><h3 className="text-lg font-black">{field ? "Ubah transaksi" : "Transaksi baru"}</h3><button type="button" className="button-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Batal</button></div>
          <label className="grid gap-2"><span className="label">Jenis</span><select className="field" name="kind" defaultValue={field?.kind ?? "expense"}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option></select></label>
          <label className="grid gap-2"><span className="label">Nominal</span><input className="field" name="amount" type="number" min="1" step="1000" defaultValue={field?.amount} required /></label>
          <label className="grid gap-2"><span className="label">Tanggal</span><input className="field" name="date" type="date" defaultValue={field?.date ?? today()} required /></label>
          <label className="grid gap-2"><span className="label">Sumber uang</span><select className="field" name="sourceId" defaultValue={field?.sourceId ?? ""} required><option value="">Pilih sumber</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
          <label className="grid gap-2"><span className="label">Tujuan transfer</span><select className="field" name="destinationSourceId" defaultValue={field?.destinationSourceId ?? ""}><option value="">Tidak ada</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
          <label className="grid gap-2"><span className="label">Kategori</span><select className="field" name="categoryId" defaultValue={field?.categoryId ?? ""}><option value="">Otomatis / tanpa kategori</option>{workspace.categoryGroups.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.kind === "expense" ? "Pengeluaran" : "Pemasukan"}</option>)}</select></label>
          <label className="grid gap-2"><span className="label">Status</span><select className="field" name="status" defaultValue={field?.status ?? "cleared"}><option value="pending">Menunggu</option><option value="cleared">Sudah tercatat</option><option value="reconciled">Sudah direkonsiliasi</option></select></label>
          <label className="grid gap-2"><span className="label">Merchant / penerima</span><input className="field" name="payee" defaultValue={field?.payee} placeholder="Contoh: Supermarket" maxLength={100} /></label>
          <label className="grid gap-2"><span className="label">Tautkan note</span><select className="field" name="linkedNoteId" defaultValue={field?.linkedNoteId ?? ""}><option value="">Tidak ada</option>{workspace.notes.filter((note) => (note.status ?? "active") === "active").map((note) => <option value={note.id} key={note.id}>{note.title}</option>)}</select></label>
          <label className="grid gap-2 sm:col-span-2"><span className="label">Catatan</span><input className="field" name="note" defaultValue={field?.note} placeholder="Contoh: Belanja mingguan" maxLength={160} /></label>
          <label className="grid gap-2 sm:col-span-2"><span className="label">Split kategori (opsional)</span><textarea className="field min-h-24" name="splits" defaultValue={field?.splits?.map((split) => `${workspace.categoryGroups.find(({ id }) => id === split.categoryId)?.name ?? ""}=${split.amount}${split.note ? `=${split.note}` : ""}`).join("\n")} placeholder={"Makanan=75000\nTransportasi=25000"} /><span className="text-xs text-ink/40 dark:text-paper/40">Satu baris Kategori=Nominal. Total harus sama dengan nominal transaksi.</span></label>
          <div className="grid gap-2 sm:col-span-2"><span className="label">Struk / bukti</span><label className="button-secondary w-fit cursor-pointer"><Paperclip className="h-4 w-4" />Tambah lampiran<input className="sr-only" type="file" accept="image/*,.pdf,text/plain" disabled={receipts.length >= 4} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void fileToAttachment(file).then((attachment) => ensureAttachmentBudget(workspace, attachment)).then((attachment) => setReceipts((current) => [...current, attachment].slice(0, 4))).catch((error: unknown) => window.alert(error instanceof Error ? error.message : "Lampiran gagal diproses.")); event.target.value = ""; }} /></label>{receipts.length ? <div className="flex flex-wrap gap-2">{receipts.map((attachment) => <span className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-400/10 dark:text-blue-200" key={attachment.id}>{attachment.name}<button type="button" onClick={() => setReceipts((current) => current.filter(({ id }) => id !== attachment.id))} aria-label={`Hapus ${attachment.name}`}>×</button></span>)}</div> : null}<span className="text-xs text-ink/40 dark:text-paper/40">Gambar dikompresi dan OCR digunakan bila browser mendukungnya. Maksimal 4 lampiran.</span></div>
          <button type="submit" className="button-primary w-fit">{field ? "Simpan perubahan" : "Simpan transaksi"}</button>
        </form>
      ) : null}

      <div className="panel grid gap-3 rounded-xl p-3 sm:grid-cols-[1fr_180px]">
        <label className="flex items-center gap-2"><Search className="h-4 w-4 text-ink/40" /><span className="sr-only">Cari transaksi</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari catatan atau tanggal…" /></label>
        <select className="field" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}><option value="all">Semua jenis</option><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option></select>
      </div>
      <details className="panel rounded-xl p-4"><summary className="cursor-pointer text-sm font-bold">Filter lanjutan</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="grid gap-2"><span className="label">Status</span><select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">Semua status</option><option value="pending">Menunggu</option><option value="cleared">Tercatat</option><option value="reconciled">Direkonsiliasi</option></select></label><label className="grid gap-2"><span className="label">Sumber uang</span><select className="field" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="">Semua sumber</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label><label className="grid gap-2"><span className="label">Kategori</span><select className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Semua kategori</option>{workspace.categoryGroups.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="grid gap-2"><span className="label">Dari tanggal</span><input className="field" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="grid gap-2"><span className="label">Sampai tanggal</span><input className="field" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label><label className="grid gap-2"><span className="label">Nominal minimum</span><input className="field" type="number" min="0" value={minimum} onChange={(event) => setMinimum(event.target.value)} /></label><label className="grid gap-2"><span className="label">Nominal maksimum</span><input className="field" type="number" min="0" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></label></div></details>

      <div className="grid gap-3">
        {visible.map((item) => {
          const source = workspace.moneySources.find(({ id }) => id === item.sourceId)?.name ?? "Sumber lama";
          const destination = workspace.moneySources.find(({ id }) => id === item.destinationSourceId)?.name;
          const category = workspace.categoryGroups.find(({ id }) => id === item.categoryId)?.name;
          const icon = item.kind === "transfer" ? <ArrowLeftRight className="h-5 w-5" /> : item.kind === "income" ? <Wallet className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />;
          const generated = Boolean(item.goalMovementId || item.recurringItemId);
          return <article className="panel flex items-start gap-4 rounded-xl p-4" key={item.id}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.kind === "expense" ? "bg-clay/10 text-clay" : "bg-moss/10 text-moss dark:text-emerald-300"}`}>{icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="truncate font-black">{item.payee || item.note || category || "Transaksi"}</h3><strong className={item.kind === "expense" ? "text-clay" : "text-moss"}>{item.kind === "expense" ? "−" : "+"}{money(item.amount, hideBalances, workspace.settings.defaultCurrency)}</strong></div><p className="mt-1 text-xs text-ink/50 dark:text-paper/50">{item.date} · {source}{destination ? ` → ${destination}` : ""}{category ? ` · ${category}` : ""}{item.splits?.length ? ` · ${item.splits.length} split` : ""}{item.receiptAttachments?.length ? ` · ${item.receiptAttachments.length} bukti` : ""}{generated ? " · otomatis" : ""} · {item.status === "pending" ? "menunggu" : item.status === "reconciled" ? "direkonsiliasi" : "tercatat"}</p>{item.payee && item.note ? <p className="mt-1 text-sm">{item.note}</p> : null}</div><div className="flex gap-1">{!generated ? <button className="button-secondary px-2.5" type="button" onClick={() => startEdit(item)} aria-label="Ubah transaksi"><Pencil className="h-4 w-4" /></button> : null}<button className="button-danger px-2.5" type="button" onClick={() => remove(item.id)} aria-label="Hapus transaksi"><Trash2 className="h-4 w-4" /></button></div></article>;
        })}
        {visible.length === 0 ? <div className="panel rounded-xl p-8 text-center text-sm text-ink/50 dark:text-paper/50">Belum ada transaksi yang cocok.</div> : null}
      </div>
    </section>
  );
}
