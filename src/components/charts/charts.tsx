import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart,
} from 'recharts'
import { formatDateMedium } from '@/lib/dates'
import { formatNumber } from '@/lib/units'
import { TooltipPanel } from './ChartTooltip'
import { activeDotProps, axisProps, chart, compactTick, dotProps, fromTime, gridProps, timeTick } from './theme'

type TooltipArg = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }
const first = <T,>(arg: TooltipArg): T | null => (arg.active && arg.payload?.[0]?.payload ? (arg.payload[0].payload as T) : null)

const margin = { top: 8, right: 12, bottom: 0, left: 0 }
const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const animation = { isAnimationActive: !reduceMotion, animationDuration: 300 }

// ---------------------------------------------------------------- weight

export interface WeightDatum {
  t: number
  weight: number
  avg: number | null
}

/** Scale weigh-ins as dots; trailing average as a line that breaks where data is too sparse. */
export function WeightChart({ data, unit }: { data: WeightDatum[]; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={margin}>
        <CartesianGrid {...gridProps} />
        <XAxis {...axisProps} dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={timeTick} minTickGap={32} />
        <YAxis {...axisProps} width={44} domain={['auto', 'auto']} tickFormatter={compactTick} unit="" label={undefined} />
        <Tooltip
          cursor={{ stroke: chart.grid, strokeWidth: 1 }}
          content={(arg: TooltipArg) => {
            const d = first<WeightDatum>(arg)
            if (!d) return null
            return (
              <TooltipPanel title={formatDateMedium(fromTime(d.t))} rows={[
                { label: 'Weigh-in', value: `${formatNumber(d.weight, 1)} ${unit}`, color: chart.tealMid },
                { label: '7-day average', value: d.avg == null ? 'Not enough data' : `${formatNumber(d.avg, 1)} ${unit}`, color: chart.teal },
              ]} />
            )
          }}
        />
        <Line dataKey="weight" stroke="transparent" dot={dotProps(chart.tealMid)} activeDot={activeDotProps(chart.tealMid)} {...animation} />
        <Line dataKey="avg" stroke={chart.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={false} connectNulls={false} {...animation} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------- single series

export interface SeriesDatum {
  t: number
  value: number
}

/** Single-series trend over time (one exercise metric). */
export function SeriesChart({ data, unit, label }: { data: SeriesDatum[]; unit: string; label: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={margin}>
        <CartesianGrid {...gridProps} />
        <XAxis {...axisProps} dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={timeTick} minTickGap={32} />
        <YAxis {...axisProps} width={44} domain={['auto', 'auto']} tickFormatter={compactTick} />
        <Tooltip
          cursor={{ stroke: chart.grid, strokeWidth: 1 }}
          content={(arg: TooltipArg) => {
            const d = first<SeriesDatum>(arg)
            return d ? <TooltipPanel title={formatDateMedium(fromTime(d.t))} rows={[{ label, value: `${formatNumber(d.value, 1)} ${unit}` }]} /> : null
          }}
        />
        <Line dataKey="value" stroke={chart.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={dotProps(chart.teal)} activeDot={activeDotProps(chart.teal)} {...animation} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------- weekly bars

export interface WeekDatum {
  week: string
  value: number
}

export function WeeklyBarChart({ data, valueLabel, format }: { data: WeekDatum[]; valueLabel: string; format: (n: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={margin} barCategoryGap="20%">
        <CartesianGrid {...gridProps} />
        <XAxis {...axisProps} dataKey="week" tickFormatter={(w: string) => formatDateMedium(w).replace(/ \d{4}$/, '')} minTickGap={24} />
        <YAxis {...axisProps} width={44} allowDecimals={false} tickFormatter={compactTick} />
        <Tooltip
          cursor={{ fill: '#f6f6f8' }}
          content={(arg: TooltipArg) => {
            const d = first<WeekDatum>(arg)
            return d ? <TooltipPanel title={`Week of ${formatDateMedium(d.week)}`} rows={[{ label: valueLabel, value: format(d.value) }]} /> : null
          }}
        />
        <Bar dataKey="value" fill={chart.teal} maxBarSize={24} radius={[4, 4, 0, 0]} {...animation} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------- nutrition

export interface CalorieDatum {
  date: string
  calories: number | null
  target: number | null
}

/** Daily calories as bars (missing days stay empty) against the target in effect, as a step line. */
export function CalorieChart({ data }: { data: CalorieDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={margin} barCategoryGap="15%">
        <CartesianGrid {...gridProps} />
        <XAxis {...axisProps} dataKey="date" tickFormatter={(d: string) => formatDateMedium(d).replace(/ \d{4}$/, '')} minTickGap={24} />
        <YAxis {...axisProps} width={44} tickFormatter={compactTick} />
        <Tooltip
          cursor={{ fill: '#f6f6f8' }}
          content={(arg: TooltipArg) => {
            const d = first<CalorieDatum>(arg)
            if (!d) return null
            return (
              <TooltipPanel title={formatDateMedium(d.date)} rows={[
                { label: 'Logged', value: d.calories == null ? 'Nothing logged' : `${formatNumber(d.calories, 0)} kcal`, color: chart.teal },
                { label: 'Target', value: d.target == null ? 'None' : `${formatNumber(d.target, 0)} kcal`, color: chart.navy },
              ]} />
            )
          }}
        />
        <Bar dataKey="calories" fill={chart.teal} maxBarSize={24} radius={[4, 4, 0, 0]} {...animation} />
        <Line dataKey="target" type="stepAfter" stroke={chart.navy} strokeWidth={2} dot={false} activeDot={false} connectNulls={false} {...animation} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------- horizontal bars

export interface CategoryDatum {
  label: string
  value: number
}

/** Horizontal bars for comparing categories with readable labels (NN/g: long labels). */
export function HorizontalBarChart({ data, valueLabel }: { data: CategoryDatum[]; valueLabel: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap="25%">
        <CartesianGrid stroke={chart.grid} horizontal={false} />
        <XAxis {...axisProps} type="number" allowDecimals={false} />
        <YAxis {...axisProps} type="category" dataKey="label" width={84} axisLine={false} />
        <Tooltip
          cursor={{ fill: '#f6f6f8' }}
          content={(arg: TooltipArg) => {
            const d = first<CategoryDatum>(arg)
            return d ? <TooltipPanel title={d.label} rows={[{ label: valueLabel, value: String(d.value) }]} /> : null
          }}
        />
        <Bar dataKey="value" fill={chart.teal} maxBarSize={20} radius={[0, 4, 4, 0]} {...animation} />
      </BarChart>
    </ResponsiveContainer>
  )
}
