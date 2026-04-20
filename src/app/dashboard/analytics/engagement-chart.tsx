'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  data: { name: string; value: number; color: string }[]
}

export function EngagementChart({ data }: Props) {
  if (data.every((d) => d.value === 0)) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        No engagement data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barCategoryGap="40%">
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6', fontSize: 12 }}
          cursor={{ fill: '#f9fafb' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
