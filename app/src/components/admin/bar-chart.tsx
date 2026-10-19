import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { fonts } from '@/components/theme';
import { formatRupees, formatRupeesShort } from '@/lib/format';

import { admin } from './ui';

export type Series = { name: string; color: string };
export type Bar = { label: string; detail: string; values: number[] };

const AXIS_W = 52;
const LABEL_H = 22;
const TOP = 12; // room for the top axis label
const RADIUS = 4;

/** Top-rounded bar standing on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * One y-axis in rupees, bars grouped per period. Hovering (web) or tapping a period shows its exact values above the
 * chart; every period has a full-height hit target, wider than its bars.
 */
export function BarChart({ data, series, height = 220, title }: { data: Bar[]; series: Series[]; height?: number; title: string }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const shown = active ?? data.length - 1;
  const plotW = Math.max(width - AXIS_W, 0);
  const plotH = height - LABEL_H - TOP;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const slot = data.length ? plotW / data.length : 0;
  const groupW = Math.max(Math.min(slot * 0.7, 44), 2);
  const gap = series.length > 1 ? 2 : 0;
  const barW = Math.max((groupW - gap * (series.length - 1)) / series.length, 1);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 64))));
  const current = data[shown];

  return (
    <View style={styles.wrap} accessibilityLabel={title}>
      <View style={styles.readout}>
        <Text style={styles.readoutDate}>{current?.detail ?? '—'}</Text>
        <View style={styles.readoutValues}>
          {series.map((s, i) => (
            <View key={s.name} style={styles.key}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.keyText}>
                {s.name} <Text style={styles.keyValue}>{current ? formatRupees(current.values[i] ?? 0) : '—'}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {ticks.map((t) => {
              const y = TOP + plotH - (t / max) * plotH;
              return (
                <Line key={t} x1={AXIS_W} x2={width} y1={y} y2={y} stroke={admin.line} strokeWidth={t === 0 ? 1.5 : 1} strokeDasharray={t === 0 ? undefined : '2 4'} />
              );
            })}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={AXIS_W - 8} y={TOP + plotH - (t / max) * plotH + 4} fill={admin.muted} fontSize={12} fontFamily={fonts.text} textAnchor="end">
                {formatRupeesShort(t)}
              </SvgText>
            ))}
            {data.map((d, i) => {
              const x0 = AXIS_W + i * slot + (slot - groupW) / 2;
              return d.values.map((v, j) => {
                const h = (Math.max(v, 0) / max) * plotH;
                return (
                  <Path
                    key={`${i}-${j}`}
                    d={barPath(x0 + j * (barW + gap), TOP + plotH - h, barW, h)}
                    fill={series[j].color}
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                );
              });
            })}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <SvgText
                  key={`x${i}`}
                  x={i === data.length - 1 ? width : AXIS_W + i * slot + slot / 2}
                  y={height - 4}
                  fill={admin.muted}
                  fontSize={12}
                  fontFamily={fonts.text}
                  textAnchor={i === data.length - 1 ? 'end' : 'middle'}>
                  {d.label}
                </SvgText>
              ) : null,
            )}
          </Svg>
        )}
        <View style={[StyleSheet.absoluteFill, styles.hits, { left: AXIS_W }]}>
          {data.map((d, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${d.detail}: ${series.map((s, j) => `${s.name} ${formatRupees(d.values[j] ?? 0)}`).join(', ')}`}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive(null)}
              onPress={() => setActive(active === i ? null : i)}
              style={styles.hit}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  readout: { gap: 6 },
  readoutDate: { color: admin.soft, fontFamily: fonts.textSemi, fontSize: 14 },
  readoutValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  keyText: { color: admin.soft, fontFamily: fonts.text, fontSize: 15 },
  keyValue: { color: admin.ink, fontFamily: fonts.textBold, fontVariant: ['tabular-nums'] },
  hits: { flexDirection: 'row' },
  hit: { flex: 1 },
});
