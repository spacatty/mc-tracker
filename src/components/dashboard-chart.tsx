"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DashboardTrendChart({ data }: { data: Array<{ label: string; amount: number }> }) {
  return (
    <div className="h-64 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trend" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#a1a1aa" />
          <YAxis stroke="#a1a1aa" />
          <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 12 }} />
          <Area type="monotone" dataKey="amount" stroke="#a78bfa" fill="url(#trend)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
