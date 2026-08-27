"use client";

import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileCheck2,
  LockKeyhole,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Upload,
  WalletCards
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { TransactionsPanel } from "@/components/command-center/transactions-panel";
import {
  budgetReport,
  cashFlowForecast,
  debtProjection,
  exportTransactionsCsv,
  financeReport,
  financialInsights,
  importTransactionsCsv,
  investmentSummary,
  monthKey,
  netWorth,
  paydayPlan,
  yearlyFinanceReport
} from "@/lib/finance-insights";
import type { InvestmentHolding, OfflineWorkspace } from "@/lib/offline-workspace";
import { applyReconciliation, importTransactions, setFinanceMonthLock } from "@/lib/workspace-finance";
import { formatCurrency } from "@/lib/utils";

type FinanceTab = "overview" | "transactions" | "budget" | "forecast" | "wealth" | "records";
type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
  onNavigate: (section: "sources" | "goals" | "recurring" | "categories" | "pengaturan") => void;
};

const tabs: Array<{ id: FinanceTab; label: string }> = [
  { id: "overview", label: "Ringkasan" },
  { id: "transactions", label: "Transaksi" },
  { id: "budget", label: "Anggaran" },
  { id: "forecast", label: "Arus kas" },
  { id: "wealth", label: "Utang & aset" },
  { id: "records", label: "Impor & audit" }
];

function dateOnly() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function download(name: string, value: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function amount(value: number, hidden: boolean, currency: string) {
  return hidden ? "••••••" : formatCurrency(value, currency);
}

function Metric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "red" }) {
  const color = tone === "green" ? "text-emerald-700 dark:text-emerald-300" : tone === "red" ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300";
  return <article className="panel rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">{label}</p><p className={`mt-2 text-xl font-black ${color}`}>{value}</p></article>;
}

export function FinanceCenter({ workspace, updateWorkspace, onNavigate }: Props) {
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [month, setMonth] = useState(monthKey());
  const [forecastDays, setForecastDays] = useState<30 | 60 | 90>(90);
  const [extraPayment, setExtraPayment] = useState(0);
  const [importMessage, setImportMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const hidden = workspace.settings.hideBalances;
  const currency = workspace.settings.defaultCurrency;
  const report = useMemo(() => financeReport(workspace, month), [month, workspace]);
  const yearly = useMemo(() => yearlyFinanceReport(workspace, month.slice(0, 4)), [month, workspace]);
  const budget = useMemo(() => budgetReport(workspace, month), [month, workspace]);
  const worth = useMemo(() => netWorth(workspace), [workspace]);
  const investments = useMemo(() => investmentSummary(workspace.investments), [workspace.investments]);
  const forecast = useMemo(() => cashFlowForecast(workspace, dateOnly(), forecastDays), [forecastDays, workspace]);
  const paydays = useMemo(() => paydayPlan(workspace, month), [month, workspace]);
  const debts = workspace.moneySources.filter(({ type }) => type === "debt" || type === "credit_card");
  const locked = workspace.settings.lockedFinanceMonths.includes(month);
  const maxDaily = Math.max(1, ...report.daily.map(({ income, expense }) => Math.max(income, expense)));
  const maxMonthly = Math.max(1, ...yearly.months.map(({ income, expense }) => Math.max(income, expense)));

  function saveBudgets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateWorkspace((current) => {
      const others = current.budgetPlans.filter((item) => item.month !== month);
      const rows = current.categoryGroups.filter(({ kind }) => kind === "expense").flatMap((category) => {
        const planned = Math.max(0, Number(data.get(`planned:${category.id}`)) || 0);
        const rollover = Math.max(0, Number(data.get(`rollover:${category.id}`)) || 0);
        if (!planned && !rollover) return [];
        return [{ id: `${month}:${category.id}`, month, categoryId: category.id, planned, rollover }];
      });
      return { ...current, budgetPlans: [...others, ...rows] };
    });
  }

  function saveInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const row: InvestmentHolding = {
      id: crypto.randomUUID(),
      name: String(data.get("name") || "").trim(),
      symbol: String(data.get("symbol") || "").trim().toUpperCase() || undefined,
      kind: String(data.get("kind")) as InvestmentHolding["kind"],
      sourceId: String(data.get("sourceId") || "") || undefined,
      units: Math.max(0, Number(data.get("units")) || 0),
      costBasis: Math.max(0, Number(data.get("costBasis")) || 0),
      currentPrice: Math.max(0, Number(data.get("currentPrice")) || 0),
      dividends: Math.max(0, Number(data.get("dividends")) || 0),
      updatedAt: new Date().toISOString()
    };
    if (!row.name || !row.units) return;
    updateWorkspace((current) => ({ ...current, investments: [row, ...current.investments] }));
    form.reset();
  }

  async function importCsv(file: File) {
    const parsed = importTransactionsCsv(await file.text(), workspace);
    if (!workspace.moneySources.length) {
      setImportMessage("Tambahkan sumber uang sebelum mengimpor transaksi.");
      return;
    }
    const usable = parsed.transactions.filter(({ sourceId }) => Boolean(sourceId));
    updateWorkspace((current) => importTransactions(current, usable));
    setImportMessage(`${usable.length} transaksi diimpor, ${parsed.duplicates} duplikat dilewati${parsed.errors.length ? `, ${parsed.errors.length} baris bermasalah` : ""}.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  function reconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    updateWorkspace((current) => applyReconciliation(current, String(data.get("sourceId")), String(data.get("statementDate")), Number(data.get("statementBalance")), String(data.get("note") || "")));
    form.reset();
  }

  return (
    <section className="grid gap-5">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Keuangan progresif</p><h2 className="mt-1 text-3xl font-black">Pusat Keuangan</h2><p className="mt-2 max-w-2xl text-sm text-ink/55 dark:text-paper/55">Pencatatan, anggaran, proyeksi, utang, investasi, rekonsiliasi, dan jejak perubahan dalam satu alur.</p></div>
        <label className="grid gap-1 text-sm font-bold"><span className="label">Periode laporan</span><input className="field" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Bagian pusat keuangan">
        {tabs.map((item) => <button type="button" key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? "button-primary shrink-0" : "button-secondary shrink-0"}>{item.label}</button>)}
      </nav>

      {tab === "overview" ? <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Pemasukan" value={amount(report.income, hidden, currency)} tone="green" />
          <Metric label="Pengeluaran" value={amount(report.expense, hidden, currency)} tone="red" />
          <Metric label="Arus bersih" value={amount(report.net, hidden, currency)} tone={report.net >= 0 ? "green" : "red"} />
          <Metric label="Kekayaan bersih" value={amount(worth.net, hidden, currency)} tone={worth.net >= 0 ? "blue" : "red"} />
        </section>
        <section className="panel rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300"><CalendarDays className="h-5 w-5" /></span><div><h3 className="font-black">Peta gajian & kewajiban</h3><p className="mt-1 text-xs text-ink/45 dark:text-paper/45">Tagihan, cicilan, hutang, dan tabungan otomatis dikelompokkan ke gajian sebelumnya.</p></div></div>{paydays.rows.length ? <div className="text-right"><p className="text-xs font-bold uppercase tracking-wide text-ink/40 dark:text-paper/40">{workspace.settings.paydays.length}× gajian · kewajiban {amount(paydays.totalObligations, hidden, currency)}</p><p className="font-black text-emerald-700 dark:text-emerald-300">{amount(paydays.totalIncome, hidden, currency)}</p></div> : null}</div>
          {paydays.rows.length ? <div className="mt-5 grid gap-3 lg:grid-cols-2">{paydays.rows.map((payday, index) => <article className="rounded-xl border border-line bg-blue-50/40 p-4 dark:border-white/10 dark:bg-blue-400/5" key={payday.date}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">Gajian {index + 1} · {new Date(`${payday.date}T12:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}</p><p className="mt-1 text-lg font-black">{amount(payday.salary, hidden, currency)}</p></div><div className="text-right"><p className="text-xs text-ink/45 dark:text-paper/45">Sisa setelah alokasi</p><p className={payday.remaining < 0 ? "font-black text-red-600" : "font-black text-emerald-700 dark:text-emerald-300"}>{amount(payday.remaining, hidden, currency)}</p></div></div><div className="mt-4 grid gap-2">{payday.obligations.map((item) => <div className="flex items-start justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-sm dark:bg-white/5" key={item.id}><div><p className="font-bold">{item.label}</p><p className={item.needsReserve ? "text-xs text-amber-700 dark:text-amber-300" : "text-xs text-ink/40 dark:text-paper/40"}>{item.date.slice(8, 10)} · {item.kind === "debt" ? "hutang/cicilan" : item.kind === "saving" ? "tabungan" : "tagihan"}{item.needsReserve ? " · siapkan dari bulan lalu" : ""}</p></div><strong>{amount(item.amount, hidden, currency)}</strong></div>)}{!payday.obligations.length ? <p className="text-sm text-ink/40 dark:text-paper/40">Belum ada kewajiban pada rentang gajian ini.</p> : null}</div></article>)}</div> : <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-400/10"><p className="text-sm text-blue-950 dark:text-blue-100">Atur jumlah, tanggal, dan nominal gajian agar pemetaan otomatis aktif.</p><button type="button" className="button-primary" onClick={() => onNavigate("pengaturan")}>Atur jadwal gajian</button></div>}
        </section>
        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <article className="panel rounded-2xl p-5"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-blue-700 dark:text-blue-300" /><div><h3 className="font-black">Aktivitas harian</h3><p className="text-xs text-ink/45 dark:text-paper/45">Biru pemasukan, merah pengeluaran</p></div></div><div className="mt-6 flex h-40 items-end gap-1 overflow-hidden">{report.daily.length ? report.daily.map((row) => <div className="flex min-w-2 flex-1 items-end gap-px" key={row.date} title={`${row.date}: +${formatCurrency(row.income, currency)} / -${formatCurrency(row.expense, currency)}`}><span className="w-1/2 rounded-t bg-blue-500" style={{ height: `${Math.max(2, row.income / maxDaily * 100)}%` }} /><span className="w-1/2 rounded-t bg-red-400" style={{ height: `${Math.max(2, row.expense / maxDaily * 100)}%` }} /></div>) : <p className="self-center text-sm text-ink/45 dark:text-paper/45">Belum ada transaksi pada periode ini.</p>}</div></article>
          <article className="panel rounded-2xl p-5"><h3 className="font-black">Insight otomatis</h3><div className="mt-4 grid gap-2">{financialInsights(workspace, month).map((message) => <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-950 dark:bg-blue-400/10 dark:text-blue-100" key={message}>{message}</p>)}</div></article>
        </section>
        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <article className="panel rounded-2xl p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Tren {yearly.year}</h3><p className="text-xs text-ink/45 dark:text-paper/45">Pemasukan dan pengeluaran per bulan</p></div><p className="text-sm font-black text-blue-700 dark:text-blue-300">Net {amount(yearly.net, hidden, currency)}</p></div><div className="mt-5 flex h-36 items-end gap-2">{yearly.months.map((row, index) => <div className="flex h-full flex-1 flex-col justify-end gap-1" key={row.month} title={`${row.month}: ${formatCurrency(row.net, currency)}`}><div className="flex flex-1 items-end gap-px"><span className="w-1/2 rounded-t bg-blue-500" style={{ height: `${Math.max(2, row.income / maxMonthly * 100)}%` }} /><span className="w-1/2 rounded-t bg-red-400" style={{ height: `${Math.max(2, row.expense / maxMonthly * 100)}%` }} /></div><span className="text-center text-[9px] text-ink/40 dark:text-paper/40">{index + 1}</span></div>)}</div></article>
          <article className="panel rounded-2xl p-5"><h3 className="font-black">Perbandingan bulan lalu</h3><div className="mt-4 grid gap-3 text-sm"><div className="flex justify-between"><span>Pemasukan</span><strong className={report.income >= report.previous.income ? "text-emerald-600" : "text-red-600"}>{report.previous.income ? `${Math.round((report.income - report.previous.income) / report.previous.income * 100)}%` : "—"}</strong></div><div className="flex justify-between"><span>Pengeluaran</span><strong className={report.expense <= report.previous.expense ? "text-emerald-600" : "text-red-600"}>{report.previous.expense ? `${Math.round((report.expense - report.previous.expense) / report.previous.expense * 100)}%` : "—"}</strong></div><div className="flex justify-between border-t border-line pt-3 dark:border-white/10"><span>Rasio tabungan tahun ini</span><strong>{Math.round(yearly.savingsRate * 100)}%</strong></div></div></article>
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel rounded-2xl p-5"><h3 className="font-black">Pengeluaran per kategori</h3><div className="mt-4 grid gap-3">{report.categoryBreakdown.slice(0, 8).map((row) => <div key={row.categoryId}><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{row.name}</span><span>{amount(row.amount, hidden, currency)} · {Math.round(row.share * 100)}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-white/10"><div className="h-full rounded-full bg-blue-600" style={{ width: `${row.share * 100}%` }} /></div></div>)}{!report.categoryBreakdown.length ? <p className="text-sm text-ink/45 dark:text-paper/45">Belum ada pengeluaran berkategori.</p> : null}</div></article>
          <article className="panel rounded-2xl p-5"><h3 className="font-black">Akses cepat</h3><div className="mt-4 grid grid-cols-2 gap-2">{[
            ["sources", WalletCards, "Sumber uang"], ["goals", PiggyBank, "Tujuan tabungan"], ["recurring", ReceiptText, "Transaksi berkala"], ["categories", CircleDollarSign, "Kategori"]
          ].map(([id, Icon, label]) => <button key={String(id)} className="button-secondary justify-start" type="button" onClick={() => onNavigate(id as "sources" | "goals" | "recurring" | "categories")}><Icon className="h-4 w-4" />{String(label)}</button>)}</div></article>
        </section>
      </> : null}

      {tab === "transactions" ? <TransactionsPanel workspace={workspace} updateWorkspace={updateWorkspace} hideBalances={hidden} /> : null}

      {tab === "budget" ? <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Direncanakan" value={amount(budget.planned, hidden, currency)} /><Metric label="Aktual" value={amount(budget.actual, hidden, currency)} tone={budget.remaining < 0 ? "red" : "blue"} /><Metric label="Sisa" value={amount(budget.remaining, hidden, currency)} tone={budget.remaining >= 0 ? "green" : "red"} /><Metric label="Belum dialokasikan" value={amount(budget.unallocated, hidden, currency)} /></section>
        <form className="panel grid gap-4 rounded-2xl p-5" onSubmit={saveBudgets} key={`${month}:${workspace.budgetPlans.length}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Rencana anggaran {month}</h3><p className="text-xs text-ink/45 dark:text-paper/45">Atur planned vs actual. Rollover membawa sisa bulan lalu.</p></div><div className="flex gap-2"><select className="field" value={workspace.settings.budgetMethod} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, budgetMethod: event.target.value as OfflineWorkspace["settings"]["budgetMethod"] } }))}><option value="category">Per kategori</option><option value="envelope">Amplop</option><option value="zero_based">Zero-based</option></select><label className="button-secondary"><input type="checkbox" checked={workspace.settings.budgetRollover} onChange={(event) => updateWorkspace((current) => ({ ...current, settings: { ...current.settings, budgetRollover: event.target.checked } }))} /> Rollover</label></div></div>
          <div className="grid gap-3">{budget.rows.map((row) => <div className="grid items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_160px_140px] dark:border-white/10" key={row.categoryId}><div><p className="font-bold">{row.name}</p><p className={`text-xs ${row.remaining < 0 ? "text-red-600" : "text-ink/45 dark:text-paper/45"}`}>Aktual {amount(row.actual, hidden, currency)} · sisa {amount(row.remaining, hidden, currency)}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10"><div className={row.progress > 1 ? "h-full bg-red-500" : "h-full bg-blue-600"} style={{ width: `${Math.min(100, row.progress * 100)}%` }} /></div></div><label className="grid gap-1"><span className="label">Rencana</span><input className="field" name={`planned:${row.categoryId}`} type="number" min="0" step="1000" defaultValue={row.planned} /></label><label className="grid gap-1"><span className="label">Rollover</span><input className="field" name={`rollover:${row.categoryId}`} type="number" min="0" step="1000" defaultValue={row.rollover} /></label></div>)}{!budget.rows.length ? <p className="text-sm text-ink/45 dark:text-paper/45">Tambahkan kategori pengeluaran terlebih dahulu.</p> : null}</div>
          <button type="submit" className="button-primary w-fit">Simpan anggaran</button>
        </form>
      </> : null}

      {tab === "forecast" ? <>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black">Proyeksi arus kas</h3><p className="text-sm text-ink/45 dark:text-paper/45">Menggunakan saldo likuid, transaksi berkala, dan setoran tujuan.</p></div><div className="flex gap-2">{([30, 60, 90] as const).map((days) => <button type="button" className={forecastDays === days ? "button-primary" : "button-secondary"} onClick={() => setForecastDays(days)} key={days}>{days} hari</button>)}</div></div>
        <article className="panel rounded-2xl p-5"><div className="flex h-56 items-end gap-px overflow-hidden">{forecast.map((row) => { const min = Math.min(0, ...forecast.map(({ balance }) => balance)); const max = Math.max(1, ...forecast.map(({ balance }) => balance)); const size = Math.max(3, ((row.balance - min) / (max - min || 1)) * 100); return <span key={row.date} className={`min-w-px flex-1 rounded-t ${row.balance < 0 ? "bg-red-500" : "bg-blue-600"}`} style={{ height: `${size}%` }} title={`${row.date}: ${formatCurrency(row.balance, currency)}${row.events.length ? ` · ${row.events.join(", ")}` : ""}`} />; })}</div><div className="mt-3 flex justify-between text-xs text-ink/45 dark:text-paper/45"><span>{forecast[0]?.date}</span><span>Terendah {amount(Math.min(...forecast.map(({ balance }) => balance)), hidden, currency)}</span><span>{forecast.at(-1)?.date}</span></div></article>
        <div className="grid gap-3">{forecast.filter(({ events }) => events.length).slice(0, 20).map((row) => <article className="panel flex items-center justify-between gap-4 rounded-xl p-4" key={row.date}><div><p className="font-bold">{row.date}</p><p className="text-xs text-ink/45 dark:text-paper/45">{row.events.join(" · ")}</p></div><p className={row.change < 0 ? "font-black text-red-600" : "font-black text-emerald-600"}>{amount(row.change, hidden, currency)}</p></article>)}</div>
      </> : null}

      {tab === "wealth" ? <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Aset" value={amount(worth.assets, hidden, currency)} /><Metric label="Kewajiban" value={amount(worth.liabilities, hidden, currency)} tone="red" /><Metric label="Nilai investasi" value={amount(investments.value, hidden, currency)} /><Metric label="Gain + dividen" value={amount(investments.gain, hidden, currency)} tone={investments.gain >= 0 ? "green" : "red"} /></section>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel rounded-2xl p-5"><div className="flex items-end justify-between gap-3"><div><h3 className="font-black">Strategi pelunasan utang</h3><p className="text-xs text-ink/45 dark:text-paper/45">Snowball: saldo terkecil. Avalanche: bunga tertinggi.</p></div><label className="grid gap-1"><span className="label">Bayar ekstra / bulan</span><input className="field w-40" type="number" min="0" step="50000" value={extraPayment} onChange={(event) => setExtraPayment(Number(event.target.value) || 0)} /></label></div><div className="mt-4 grid gap-3">{debts.map((debt) => { const projection = debtProjection(debt, extraPayment); return <div className="rounded-xl border border-line p-3 dark:border-white/10" key={debt.id}><div className="flex justify-between gap-3"><p className="font-bold">{debt.name}</p><p className="font-black text-red-600">{amount(Math.abs(debt.balance), hidden, currency)}</p></div><p className="mt-1 text-xs text-ink/45 dark:text-paper/45">Bunga {debt.annualInterestRate ?? 0}% · bayar {amount(projection.payment, hidden, currency)} · {projection.payoffMonths ? `lunas ${projection.payoffMonths} bulan, bunga ${amount(projection.totalInterest, hidden, currency)}` : "isi bunga dan minimum bayar agar proyeksi tersedia"}</p></div>; })}{!debts.length ? <p className="text-sm text-ink/45 dark:text-paper/45">Belum ada sumber bertipe utang atau kartu kredit.</p> : null}</div>{debts.length > 1 ? <div className="mt-4 grid gap-2 rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-400/10"><p><strong>Urutan snowball:</strong> {[...debts].sort((a, b) => Math.abs(a.balance) - Math.abs(b.balance)).map(({ name }) => name).join(" → ")}</p><p><strong>Urutan avalanche:</strong> {[...debts].sort((a, b) => (b.annualInterestRate ?? 0) - (a.annualInterestRate ?? 0)).map(({ name }) => name).join(" → ")}</p></div> : null}</article>
          <form className="panel grid gap-3 rounded-2xl p-5 sm:grid-cols-2" onSubmit={saveInvestment}><div className="sm:col-span-2"><h3 className="font-black">Tambah kepemilikan investasi</h3><p className="text-xs text-ink/45 dark:text-paper/45">Nilai diperbarui manual agar tetap mandiri dan tanpa layanan berbayar.</p></div><label className="grid gap-1"><span className="label">Nama</span><input className="field" name="name" required /></label><label className="grid gap-1"><span className="label">Simbol</span><input className="field" name="symbol" placeholder="BBCA" /></label><label className="grid gap-1"><span className="label">Jenis</span><select className="field" name="kind"><option value="stock">Saham</option><option value="fund">Reksa dana</option><option value="crypto">Kripto</option><option value="bond">Obligasi</option><option value="gold">Emas</option><option value="other">Lainnya</option></select></label><label className="grid gap-1"><span className="label">Akun</span><select className="field" name="sourceId"><option value="">Tanpa akun</option>{workspace.moneySources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label><label className="grid gap-1"><span className="label">Unit</span><input className="field" name="units" type="number" min="0" step="any" required /></label><label className="grid gap-1"><span className="label">Harga beli / unit</span><input className="field" name="costBasis" type="number" min="0" step="any" required /></label><label className="grid gap-1"><span className="label">Harga kini / unit</span><input className="field" name="currentPrice" type="number" min="0" step="any" required /></label><label className="grid gap-1"><span className="label">Total dividen</span><input className="field" name="dividends" type="number" min="0" step="any" /></label><button className="button-primary w-fit" type="submit">Tambah investasi</button></form>
        </section>
        <div className="grid gap-3 md:grid-cols-2">{workspace.investments.map((item) => { const value = item.units * item.currentPrice; const gain = value - item.units * item.costBasis + (item.dividends ?? 0); return <article className="panel rounded-xl p-4" key={item.id}><div className="flex justify-between gap-3"><div><p className="font-black">{item.name} {item.symbol ? `(${item.symbol})` : ""}</p><p className="text-xs text-ink/45 dark:text-paper/45">{item.units} unit · diperbarui {item.updatedAt.slice(0, 10)}</p></div><div className="flex gap-1"><button type="button" className="button-secondary px-3" onClick={() => { const price = Number(prompt("Harga terkini per unit", String(item.currentPrice))); if (!Number.isFinite(price) || price < 0) return; const dividends = Number(prompt("Total dividen", String(item.dividends ?? 0))); updateWorkspace((current) => ({ ...current, investments: current.investments.map((holding) => holding.id === item.id ? { ...holding, currentPrice: price, dividends: Number.isFinite(dividends) ? Math.max(0, dividends) : holding.dividends, updatedAt: new Date().toISOString() } : holding) })); }}>Perbarui</button><button type="button" className="button-danger px-3" onClick={() => updateWorkspace((current) => ({ ...current, investments: current.investments.filter(({ id }) => id !== item.id) }))}>Hapus</button></div></div><div className="mt-3 flex justify-between"><span>{amount(value, hidden, currency)}</span><strong className={gain >= 0 ? "text-emerald-600" : "text-red-600"}>{gain >= 0 ? "+" : ""}{amount(gain, hidden, currency)}</strong></div></article>; })}</div>
      </> : null}

      {tab === "records" ? <>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel rounded-2xl p-5"><div className="flex items-center gap-3"><Upload className="h-5 w-5 text-blue-700" /><h3 className="font-black">Impor dan ekspor CSV</h3></div><p className="mt-2 text-sm leading-6 text-ink/50 dark:text-paper/50">Kolom minimum: <code>date, amount</code>. Kolom opsional: type, account, category, payee, note. Duplikat dideteksi otomatis.</p><div className="mt-4 flex flex-wrap gap-2"><label className="button-primary cursor-pointer"><Upload className="h-4 w-4" />Pilih CSV<input ref={fileRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} /></label><button type="button" className="button-secondary" onClick={() => download(`transaksi-${month}.csv`, exportTransactionsCsv(workspace, workspace.transactions.filter(({ date }) => date.startsWith(month))), "text/csv;charset=utf-8")}><Download className="h-4 w-4" />Ekspor periode</button></div>{importMessage ? <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-400/10">{importMessage}</p> : null}</article>
          <form className="panel grid gap-3 rounded-2xl p-5 sm:grid-cols-2" onSubmit={reconcile}><div className="sm:col-span-2"><div className="flex items-center gap-3"><FileCheck2 className="h-5 w-5 text-blue-700" /><h3 className="font-black">Rekonsiliasi saldo</h3></div><p className="mt-2 text-xs text-ink/45 dark:text-paper/45">Cocokkan saldo aplikasi dengan rekening koran. Saldo sumber akan disesuaikan dan dicatat di audit.</p></div><label className="grid gap-1"><span className="label">Sumber</span><select className="field" name="sourceId" required><option value="">Pilih</option>{workspace.moneySources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label><label className="grid gap-1"><span className="label">Tanggal laporan</span><input className="field" name="statementDate" type="date" defaultValue={dateOnly()} required /></label><label className="grid gap-1"><span className="label">Saldo laporan</span><input className="field" name="statementBalance" type="number" step="any" required /></label><label className="grid gap-1"><span className="label">Catatan</span><input className="field" name="note" /></label><button className="button-primary w-fit" type="submit">Rekonsiliasi</button></form>
        </section>
        <article className="panel rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-blue-700" /><div><h3 className="font-black">Kunci periode & jejak audit</h3><p className="text-xs text-ink/45 dark:text-paper/45">Periode terkunci tidak dapat menerima perubahan transaksi.</p></div></div><button type="button" className={locked ? "button-danger" : "button-secondary"} onClick={() => updateWorkspace((current) => setFinanceMonthLock(current, month, !locked))}><LockKeyhole className="h-4 w-4" />{locked ? "Buka periode" : "Kunci periode"} {month}</button></div><div className="mt-4 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-ink/45 dark:text-paper/45"><tr><th className="py-2">Waktu</th><th>Aksi</th><th>Ringkasan</th></tr></thead><tbody>{workspace.financialAudit.slice(0, 100).map((item) => <tr className="border-t border-line dark:border-white/10" key={item.id}><td className="py-2 pr-3 whitespace-nowrap">{new Date(item.occurredAt).toLocaleString("id-ID")}</td><td className="pr-3 font-bold">{item.action}</td><td>{item.summary}</td></tr>)}</tbody></table>{!workspace.financialAudit.length ? <p className="py-6 text-center text-sm text-ink/45 dark:text-paper/45">Belum ada aktivitas keuangan.</p> : null}</div></article>
        <article className="panel rounded-2xl p-5"><h3 className="font-black">Riwayat rekonsiliasi</h3><div className="mt-3 grid gap-2">{workspace.reconciliations.slice(0, 20).map((item) => <div className="grid gap-1 rounded-xl border border-line p-3 text-sm sm:grid-cols-[1fr_auto] dark:border-white/10" key={item.id}><div><strong>{workspace.moneySources.find(({ id }) => id === item.sourceId)?.name ?? "Sumber lama"}</strong><p className="text-xs text-ink/45 dark:text-paper/45">{item.statementDate} · {item.note}</p></div><span className={item.difference ? "font-black text-red-600" : "font-black text-emerald-600"}>Selisih {amount(item.difference, hidden, currency)}</span></div>)}{!workspace.reconciliations.length ? <p className="text-sm text-ink/45 dark:text-paper/45">Belum ada rekonsiliasi.</p> : null}</div></article>
      </> : null}
    </section>
  );
}
