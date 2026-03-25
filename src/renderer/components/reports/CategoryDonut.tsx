import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface CategoryData {
  name: string;
  seconds: number;
  color: string;
}

interface Props {
  data: CategoryData[];
  totalSeconds: number;
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as CategoryData;
  return (
    <div className="px-3 py-2 rounded-lg bg-elevated border border-border-subtle shadow-lg text-xs">
      <p className="font-medium" style={{ color: d.color }}>{d.name}</p>
      <p className="text-txt-secondary mt-0.5">{formatDuration(d.seconds)}</p>
    </div>
  );
}

export default function CategoryDonut({ data, totalSeconds }: Props) {
  return (
    <div>
      <h3 className="text-xs font-medium text-txt-secondary uppercase tracking-wider mb-4">
        Category Breakdown
      </h3>

      {data.length === 0 ? (
        <p className="text-xs text-txt-muted h-[200px] flex items-center justify-center">
          No categorized activities
        </p>
      ) : (
        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative" style={{ width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="seconds"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  isAnimationActive={true}
                  animationDuration={600}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-sm font-semibold text-txt-primary">
                {formatDuration(totalSeconds)}
              </span>
              <span className="text-[10px] text-txt-muted">total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-txt-secondary truncate flex-1">{d.name}</span>
                <span className="text-xs font-mono text-txt-muted shrink-0">
                  {formatDuration(d.seconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type { CategoryData };
