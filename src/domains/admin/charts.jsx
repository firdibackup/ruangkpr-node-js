import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import { dateShort, dayMonth } from '@/lib/format'
import { cn } from '@/lib/utils'

// Admin charts (Recharts), loaded lazily through shared.jsx so the admin pages open without it.
const FILL = { width: '100%', height: '100%' }
const TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }
const TOOLTIP = { borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 6px 24px #0b1b3314', fontSize: 13 }
const range = (from, to) => (!to || from === to ? dateShort(from) : `${dayMonth(from)} – ${dateShort(to)}`)

// Counts per date bucket ({ from, to, ...counts }) as columns on one axis; `series` is [{ key, name, color }].
// 14rem tall unless `className` lets it grow with its panel.
export function CountChart({ data, series, desc, className }) {
  return (
    <div className={cn('h-56', className)}>
      <BarChart responsive style={FILL} data={data} margin={{ top: 8, right: 14, bottom: 0, left: 0 }} barGap={2} desc={desc}>
        <CartesianGrid vertical={false} stroke="var(--chart-track)" />
        <XAxis dataKey="from" tickFormatter={dayMonth} tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval="preserveStartEnd" minTickGap={20} />
        <YAxis allowDecimals={false} width={28} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip labelFormatter={(from, payload) => range(from, payload?.[0]?.payload.to)} formatter={(v, name) => [`${v} pengajuan`, name]} contentStyle={TOOLTIP} cursor={{ fill: 'var(--chart-track)' }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} />
        ))}
      </BarChart>
    </div>
  )
}

// Part-to-whole ring with the total in its hole; `parts` is [{ name, value, color }], zeros left out of the ring.
export function OutcomeDonut({ parts, total, unit, desc }) {
  const ring = parts.filter((p) => p.value > 0)
  return (
    <div className="relative size-36 shrink-0">
      <PieChart responsive style={FILL} desc={desc}>
        <Pie data={ring} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="var(--card)" strokeWidth={2}>
          {ring.map((p) => (
            <Cell key={p.name} fill={p.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [`${v} pengajuan`, name]} contentStyle={TOOLTIP} />
      </PieChart>
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="text-[26px] leading-none font-extrabold">{total}</span>
        <span className="text-xs font-semibold text-ink-3">{unit}</span>
      </span>
    </div>
  )
}
