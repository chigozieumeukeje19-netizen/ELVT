import { formatValue, smooth, type Series } from "@/lib/progress/metrics";

/**
 * One metric over time. One series per chart, always.
 *
 * Small multiples rather than a multi series chart, and that falls out of two
 * rules meeting rather than from taste. DESIGN.md Part 2: nothing gets color
 * unless the color carries a meaning, so there is no categorical palette to
 * hand out to a second series. And weight against steps is two scales, which
 * would be a dual axis chart, which is never the answer.
 *
 * So: a single series in --txt-mute, a seven day mean over the raw points, the
 * end value direct labelled and nothing else, hairline solid gridlines, and the
 * signal colors used only on the delta, where they already mean something.
 *
 * Mark specs: 2px line, round join and cap, an 8px end marker carrying a 2px
 * ring in the surface color so it stays readable where it crosses the line, and
 * an area wash at 10 percent.
 */

const WIDTH = 280;
const HEIGHT = 96;
const PAD = { top: 10, right: 44, bottom: 16, left: 4 };

export function TrendChart({ series }: { series: Series }) {
  const points = smooth(series.points).filter(
    (point): point is { date: string; value: number } => point.value !== null,
  );

  if (points.length < 2) {
    return (
      <figure className="m-0" data-testid="trend-chart" data-metric={series.metric}>
        <figcaption className="flex items-baseline justify-between gap-3">
          <span className="elvt-label">{series.spec.label}</span>
        </figcaption>
        <p className="mt-2 text-txt-dim" data-testid="chart-empty">
          Two readings make a line. This fills in once there are.
        </p>
      </figure>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero and, worse, would draw as a line at the
  // top of the box rather than through the middle of it.
  const span = max - min || Math.abs(max) || 1;

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const x = (index: number) =>
    PAD.left + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) =>
    PAD.top + plotHeight - ((value - min) / span) * plotHeight;

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");

  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD.top + plotHeight).toFixed(1)} L${PAD.left},${(PAD.top + plotHeight).toFixed(1)} Z`;

  const last = points[points.length - 1];
  const endX = x(points.length - 1);
  const endY = y(last.value);

  const deltaClass =
    series.improving === null
      ? "text-txt-dim"
      : series.improving
        ? "text-ok"
        : "text-flag";

  return (
    <figure className="m-0" data-testid="trend-chart" data-metric={series.metric}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="elvt-label">{series.spec.label}</span>
        <span className="flex items-baseline gap-3">
          <span className="elvt-num text-emphasis" data-testid="chart-latest">
            {formatValue(series.latest, series.spec)}
          </span>
          {series.change === null ? null : (
            <span className={`elvt-num ${deltaClass}`} data-testid="chart-delta">
              {/*
                The word, not just the color. A status color never carries a
                meaning on its own: a reader who cannot tell red from green
                still has to know which way this went.
              */}
              {series.change > 0 ? "up" : "down"}{" "}
              {formatValue(Math.abs(series.change), series.spec)}
            </span>
          )}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-1 w-full"
        role="img"
        aria-label={`${series.spec.label} over ${points.length} days, now ${formatValue(series.latest, series.spec)}`}
      >
        {/* Hairline, solid, recessive. Two rules, not a grid: the high and the low. */}
        {[min, max].map((value) => (
          <line
            key={value}
            x1={PAD.left}
            x2={PAD.left + plotWidth}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="var(--txt-mute)" fillOpacity="0.1" />
        <path
          d={line}
          fill="none"
          stroke="var(--txt-mute)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* The end marker, with a 2px ring in the surface color so it stays
            legible where it sits on the line. */}
        <circle cx={endX} cy={endY} r="6" fill="var(--panel)" />
        <circle cx={endX} cy={endY} r="4" fill="var(--txt)" />

        {/* One label, at the end. A number on every point is chaos and goes
            unread; the axis rules and the figure above carry the rest. */}
        <text
          x={endX + 8}
          y={endY + 4}
          className="elvt-num"
          fontSize="11"
          fill="var(--txt-mute)"
        >
          {formatValue(last.value, series.spec)}
        </text>
      </svg>
    </figure>
  );
}
