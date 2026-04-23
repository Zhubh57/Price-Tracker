import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

// Site brand colour map
const SITE_COLOURS = {
  Amazon:  '#ff9900',
  Flipkart: '#2874f0',
  Myntra:  '#ff3f6c',
  AJIO:    '#e63329',
};

/** Formats a MongoDB timestamp to a short readable label */
const formatDate = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Formats a price number as ₹XX,XXX */
const formatPrice = (v) =>
  `₹${Number(v).toLocaleString('en-IN')}`;

// Custom tooltip rendered inside the chart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="glass-modal px-4 py-3 text-xs shadow-2xl">
        <p className="text-[var(--text-muted)] mb-1">{label}</p>
        <p className="text-white font-bold text-base">
          {formatPrice(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

/**
 * PriceChart
 * Renders a Recharts line graph for a product's price history.
 *
 * @param {{ product: object }} props
 */
export default function PriceChart({ product }) {
  if (!product?.priceHistory?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
        No price history available yet.
      </div>
    );
  }

  const data = product.priceHistory.map((entry) => ({
    date:  formatDate(entry.timestamp),
    price: entry.price,
  }));

  const prices       = data.map((d) => d.price);
  const minPrice     = Math.min(...prices);
  const maxPrice     = Math.max(...prices);
  const lineColour   = SITE_COLOURS[product.siteName] || '#6c63ff';
  const priceDropped = minPrice < maxPrice;

  return (
    <div className="w-full">
      {/* Header stats */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-0.5">
            All-time low
          </p>
          <p className="text-[var(--green)] font-bold text-lg">
            {formatPrice(minPrice)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-0.5">
            All-time high
          </p>
          <p className="text-[var(--red)] font-bold text-lg">
            {formatPrice(maxPrice)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Mark the minimum price with a dashed reference line */}
          {priceDropped && (
            <ReferenceLine
              y={minPrice}
              stroke="var(--green)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: 'Low', fill: '#10b981', fontSize: 10, position: 'right' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            stroke={lineColour}
            strokeWidth={2.5}
            dot={{ r: 4, fill: lineColour, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: lineColour, stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
