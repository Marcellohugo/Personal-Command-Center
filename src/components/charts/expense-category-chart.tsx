"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

type ChartItem = {
  category: string;
  total: number;
};

export function ExpenseCategoryChart({ data }: { data: ChartItem[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-white/60 text-sm text-ink/55">
        Belum ada data pengeluaran untuk grafik.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="#ded7c9" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="category" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${Number(value) / 1000}k`}
          />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="total" fill="#3f5b47" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
