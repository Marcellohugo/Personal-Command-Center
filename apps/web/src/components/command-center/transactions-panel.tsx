"use client";

import { ArrowLeftRight, Pencil, Plus, ReceiptText, Search, Trash2, Wallet } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { putTransaction, removeTransaction } from "@/lib/workspace-finance";
import type { OfflineWorkspace, Transaction } from "@/lib/offline-workspace";
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

function money(value: number, hidden: boolean) {
  return hidden ? "••••••" : formatCurrency(value);
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
  const editing = workspace.transactions.find(({ id }) => id === editingId);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    return [...workspace.transactions]
      .filter((item) => kindFilter === "all" || item.kind === kindFilter)
      .filter((item) => !sourceFilter || item.sourceId === sourceFilter || item.destinationSourceId === sourceFilter)
      .filter((item) => !categoryFilter || item.categoryId === categoryFilter)
      .filter((item) => !fromDate || item.date >= fromDate)
      .filter((item) => !toDate || item.date <= toDate)
      .filter((item) => !minimum || item.amount >= Number(minimum))
      .filter((item) => !maximum || item.amount <= Number(maximum))
      .filter((item) => !normalized || `${item.note} ${item.date}`.toLocaleLowerCase("id-ID").includes(normalized))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [categoryFilter, fromDate, kindFilter, maximum, minimum, query, sourceFilter, toDate, workspace.transactions]);
  const totals = useMemo(() => workspace.transactions.reduce((result, item) => {
    if (item.kind === "income") result.income += item.amount;
    if (item.kind === "expense") result.expense += item.amount;
    return result;
  }, { income: 0, expense: 0 }), [workspace.transactions]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const transaction: Transaction = {
      id: editing?.id ?? crypto.randomUUID(),
      kind: data.get("kind") as Transaction["kind"],
      amount: Math.max(1, Number(data.get("amount")) || 0),
      date: String(data.get("date") || today()),
      sourceId: String(data.get("sourceId") || ""),
      destinationSourceId: String(data.get("destinationSourceId") || "") || undefined,
      categoryId: String(data.get("categoryId") || "") || undefined,
      note: String(data.get("note") || "").trim(),
      createdAt: editing?.createdAt ?? new Date().toISOString()
    };
    if (transaction.kind === "transfer" && (!transaction.destinationSourceId || transaction.destinationSourceId === transaction.sourceId)) {
      window.alert("Pilih sumber tujuan transfer yang berbeda.");
      return;
    }
    updateWorkspace((current) => putTransaction(current, transaction, current.transactions.find(({ id }) => id === editing?.id)));
    setEditingId(null);
    setShowForm(false);
  }

  function remove(id: string) {
    if (!confirm("Hapus transaksi ini dan kembalikan saldo sumber uang?")) return;
    updateWorkspace((current) => removeTransaction(current, id));
  }

  function startEdit(item: Transaction) {
    setEditingId(item.id);
    setShowForm(true);
  }

  const field = editing;

  return (
    <section className="grid gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-clay">Keuangan terpadu</p><h2 className="text-3xl font-black">Transaksi</h2></div>
        <button type="button" className="button-primary" onClick={() => { setEditingId(null); setShowForm((current) => !current); }}><Plus className="h-4 w-4" />Tambah transaksi</button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Ringkasan transaksi">
        <article className="panel rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Pemasukan</p><p className="mt-2 text-lg font-black text-moss">{money(totals.income, hideBalances)}</p></article>
        <article className="panel rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Pengeluaran</p><p className="mt-2 text-lg font-black text-clay">{money(totals.expense, hideBalances)}</p></article>
        <article className="panel col-span-2 rounded-xl p-4 sm:col-span-1"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Selisih</p><p className="mt-2 text-lg font-black">{money(totals.income - totals.expense, hideBalances)}</p></article>
      </section>

      {showForm ? (
        <form className="panel grid gap-4 rounded-xl p-5 sm:grid-cols-2" onSubmit={save}>
          <div className="sm:col-span-2 flex items-center justify-between"><h3 className="text-lg font-black">{field ? "Ubah transaksi" : "Transaksi baru"}</h3><button type="button" className="button-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Batal</button></div>
          <label className="grid gap-2"><span className="label">Jenis</span><select className="field" name="kind" defaultValue={field?.kind ?? "expense"}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option></select></label>
          <label className="grid gap-2"><span className="label">Nominal</span><input className="field" name="amount" type="number" min="1" step="1000" defaultValue={field?.amount} required /></label>
          <label className="grid gap-2"><span className="label">Tanggal</span><input className="field" name="date" type="date" defaultValue={field?.date ?? today()} required /></label>
          <label className="grid gap-2"><span className="label">Sumber uang</span><select className="field" name="sourceId" defaultValue={field?.sourceId ?? ""} required><option value="">Pilih sumber</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
          <label className="grid gap-2"><span className="label">Tujuan transfer</span><select className="field" name="destinationSourceId" defaultValue={field?.destinationSourceId ?? ""}><option value="">Tidak ada</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
          <label className="grid gap-2"><span className="label">Kategori</span><select className="field" name="categoryId" defaultValue={field?.categoryId ?? ""}><option value="">Tanpa kategori</option>{workspace.categoryGroups.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.kind === "expense" ? "Pengeluaran" : "Pemasukan"}</option>)}</select></label>
          <label className="grid gap-2 sm:col-span-2"><span className="label">Catatan</span><input className="field" name="note" defaultValue={field?.note} placeholder="Contoh: Belanja mingguan" maxLength={160} /></label>
          <button type="submit" className="button-primary w-fit">{field ? "Simpan perubahan" : "Simpan transaksi"}</button>
        </form>
      ) : null}

      <div className="panel grid gap-3 rounded-xl p-3 sm:grid-cols-[1fr_180px]">
        <label className="flex items-center gap-2"><Search className="h-4 w-4 text-ink/40" /><span className="sr-only">Cari transaksi</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari catatan atau tanggal…" /></label>
        <select className="field" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}><option value="all">Semua jenis</option><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option></select>
      </div>
      <details className="panel rounded-xl p-4"><summary className="cursor-pointer text-sm font-bold">Filter lanjutan</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="grid gap-2"><span className="label">Sumber uang</span><select className="field" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="">Semua sumber</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label><label className="grid gap-2"><span className="label">Kategori</span><select className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Semua kategori</option>{workspace.categoryGroups.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="grid gap-2"><span className="label">Dari tanggal</span><input className="field" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="grid gap-2"><span className="label">Sampai tanggal</span><input className="field" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label><label className="grid gap-2"><span className="label">Nominal minimum</span><input className="field" type="number" min="0" value={minimum} onChange={(event) => setMinimum(event.target.value)} /></label><label className="grid gap-2"><span className="label">Nominal maksimum</span><input className="field" type="number" min="0" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></label></div></details>

      <div className="grid gap-3">
        {visible.map((item) => {
          const source = workspace.moneySources.find(({ id }) => id === item.sourceId)?.name ?? "Sumber lama";
          const destination = workspace.moneySources.find(({ id }) => id === item.destinationSourceId)?.name;
          const category = workspace.categoryGroups.find(({ id }) => id === item.categoryId)?.name;
          const icon = item.kind === "transfer" ? <ArrowLeftRight className="h-5 w-5" /> : item.kind === "income" ? <Wallet className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />;
          const generated = Boolean(item.goalMovementId || item.recurringItemId);
          return <article className="panel flex items-start gap-4 rounded-xl p-4" key={item.id}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.kind === "expense" ? "bg-clay/10 text-clay" : "bg-moss/10 text-moss dark:text-emerald-300"}`}>{icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="truncate font-black">{item.note || category || "Transaksi"}</h3><strong className={item.kind === "expense" ? "text-clay" : "text-moss"}>{item.kind === "expense" ? "−" : "+"}{money(item.amount, hideBalances)}</strong></div><p className="mt-1 text-xs text-ink/50 dark:text-paper/50">{item.date} · {source}{destination ? ` → ${destination}` : ""}{category ? ` · ${category}` : ""}{generated ? " · otomatis" : ""}</p></div><div className="flex gap-1">{!generated ? <button className="button-secondary px-2.5" type="button" onClick={() => startEdit(item)} aria-label="Ubah transaksi"><Pencil className="h-4 w-4" /></button> : null}<button className="button-danger px-2.5" type="button" onClick={() => remove(item.id)} aria-label="Hapus transaksi"><Trash2 className="h-4 w-4" /></button></div></article>;
        })}
        {visible.length === 0 ? <div className="panel rounded-xl p-8 text-center text-sm text-ink/50 dark:text-paper/50">Belum ada transaksi yang cocok.</div> : null}
      </div>
    </section>
  );
}
