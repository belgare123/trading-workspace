import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchChart } from '../../../api/chart';
import type { Candle } from '../../../api/chart';

// ── Sample data fallback ─────────────────────────────────────────

const FALLBACK_CANDLES: Candle[] = [
  { time: 0, open: 66120, high: 66340, low: 66080, close: 66280, volume: 1280 },
  { time: 0, open: 66280, high: 66450, low: 66190, close: 66370, volume: 1510 },
  { time: 0, open: 66370, high: 66510, low: 66320, close: 66440, volume: 1410 },
  { time: 0, open: 66440, high: 66480, low: 66210, close: 66260, volume: 1820 },
  { time: 0, open: 66260, high: 66420, low: 66150, close: 66390, volume: 1120 },
  { time: 0, open: 66390, high: 66560, low: 66340, close: 66510, volume: 1650 },
  { time: 0, open: 66510, high: 66680, low: 66470, close: 66620, volume: 1940 },
  { time: 0, open: 66620, high: 66700, low: 66410, close: 66450, volume: 1350 },
  { time: 0, open: 66450, high: 66530, low: 66280, close: 66320, volume: 1420 },
  { time: 0, open: 66320, high: 66410, low: 66110, close: 66180, volume: 1680 },
];

export function ChartWidget() {
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['chart', 'BTCUSDT'],
    queryFn: () => fetchChart('BTCUSDT', '1h', 30),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const candles = useMemo(() => {
    if (apiData?.candles?.length) return apiData.candles.slice(-12);
    return FALLBACK_CANDLES;
  }, [apiData]);

  const { minP, maxP, minV, maxV } = useMemo(() => {
    const prices = candles.flatMap((c: Candle) => [c.high, c.low]);
    const volumes = candles.map((c: Candle) => c.volume);
    return {
      minP: Math.min(...prices),
      maxP: Math.max(...prices),
      minV: Math.min(...volumes),
      maxV: Math.max(...volumes),
    };
  }, [candles]);

  const w = 340, h = 140, pad = { t: 8, r: 8, b: 24, l: 44 };
  const cw = (w - pad.l - pad.r) / candles.length;
  const scaleP = (v: number) => pad.t + (1 - (v - minP) / (maxP - minP || 1)) * (h - pad.t - pad.b);
  const scaleV = (v: number) => h - pad.b - ((v - minV) / (maxV - minV || 1)) * 20;

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const p = minP + (maxP - minP) * (i / 4);
    const y = scaleP(p);
    return { y, label: p.toLocaleString('en-US', { maximumFractionDigits: 0 }) };
  });

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-4 h-4 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ maxHeight: 160 }}>
        {/* Grid */}
        {gridLines.map(({ y, label }) => (
          <g key={y}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#1e1f28" strokeWidth={1} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" fill="#5b6a7a" fontSize={9}>
              {label}
            </text>
          </g>
        ))}

        {/* Volume bars */}
        {candles.map((c: Candle, i: number) => (
          <rect
            key={i}
            x={pad.l + i * cw + cw * 0.25}
            y={scaleV(c.volume)}
            width={cw * 0.5}
            height={h - pad.b - scaleV(c.volume)}
            fill={c.close >= c.open ? '#1a3a2a' : '#3a1a1a'}
            rx={1}
          />
        ))}

        {/* Candles */}
        {candles.map((c: Candle, i: number) => {
          const x = pad.l + i * cw + cw * 0.3;
          const isUp = c.close >= c.open;
          const bodyTop = scaleP(Math.max(c.open, c.close));
          const bodyBot = scaleP(Math.min(c.open, c.close));
          const wickTop = scaleP(c.high);
          const wickBot = scaleP(c.low);
          const color = isUp ? '#22c55e' : '#ef4444';
          return (
            <g key={i} className="candle-group">
              <line
                className="candle-wick transition-all duration-100"
                x1={x + cw * 0.2} y1={wickTop}
                x2={x + cw * 0.2} y2={wickBot}
                stroke={color} strokeWidth={1}
              />
              <rect
                className="candle-body transition-all duration-100"
                x={x} y={bodyTop}
                width={cw * 0.4}
                height={Math.max(bodyBot - bodyTop, 1)}
                fill={color} rx={1}
              />
              {/* Tooltip on hover */}
              <title>{`O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`}</title>
            </g>
          );
        })}

        {/* Current price line */}
        <line
          x1={pad.l} y1={scaleP(candles[candles.length - 1].close)}
          x2={w - pad.r} y2={scaleP(candles[candles.length - 1].close)}
          stroke="#5b8def" strokeWidth={1} strokeDasharray="3 2" opacity={0.5}
        />
      </svg>
    </div>
  );
}
