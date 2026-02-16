import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

interface ChartProps {
  type: 'line' | 'bar' | 'area' | 'pie';
  data: any[];
  dataKey?: string;
  xAxisKey?: string;
  title?: string;
  colors?: string[];
  height?: number;
  showGrid?: boolean;
}

const defaultColors = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA'];

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-border dark:border-border-dark
                     rounded-lg px-3 py-2 shadow-lg">
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function Chart({
  type,
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  title,
  colors = defaultColors,
  height = 300,
  showGrid = true,
}: ChartProps) {
  const ChartComponent = {
    line: LineChart,
    bar: BarChart,
    area: AreaChart,
    pie: PieChart,
  }[type];

  return (
    <div className="card p-6">
      {title && (
        <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>
      )}

      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' && (
          <LineChart data={data}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,0,0,0.06)"
                vertical={false}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke="rgba(0,0,0,0.3)"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="rgba(0,0,0,0.3)" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ fill: colors[0], r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        )}

        {type === 'bar' && (
          <BarChart data={data}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,0,0,0.06)"
                vertical={false}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke="rgba(0,0,0,0.3)"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="rgba(0,0,0,0.3)" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey={dataKey} fill={colors[0]} radius={[8, 8, 0, 0]} />
          </BarChart>
        )}

        {type === 'area' && (
          <AreaChart data={data}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,0,0,0.06)"
                vertical={false}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke="rgba(0,0,0,0.3)"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="rgba(0,0,0,0.3)" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey={dataKey}
              fill={colors[0]}
              stroke={colors[0]}
              fillOpacity={0.3}
            />
          </AreaChart>
        )}

        {type === 'pie' && (
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
