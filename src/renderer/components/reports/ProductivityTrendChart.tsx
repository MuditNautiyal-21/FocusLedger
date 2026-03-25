import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { SessionStats } from '../../../../shared/types';

interface DayData {
  date: string;
  label: string;
  score: number;
  totalHours: number;
}

interface Props {
  data: DayData[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DayData;
  return (
    <div className="px-3 py-2 rounded-lg bg-elevated border border-border-subtle shadow-lg text-xs">
      <p className="font-medium text-txt-primary">{d.label}</p>
      <p className="text-productive mt-1">{d.score.toFixed(1)}% productive</p>
      <p className="text-txt-muted">{d.totalHours.toFixed(1)}h tracked</p>
    </div>
  );
}

export default function ProductivityTrendChart({ data }: Props) {
  return (
    <div>
      <h3 className="text-xs font-medium text-txt-secondary uppercase tracking-wider mb-4">
        Productivity Trend
      </h3>
      {data.length === 0 ? (
        <p className="text-xs text-txt-muted h-[200px] flex items-center justify-center">
          No data for this range
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--productive)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--productive)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--productive)"
              strokeWidth={2}
              fill="url(#greenGrad)"
              dot={{ r: 3, fill: 'var(--productive)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--productive)' }}
              isAnimationActive={true}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export type { DayData };
