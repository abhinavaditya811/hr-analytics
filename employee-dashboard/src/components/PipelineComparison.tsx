"use client";

import { useMemo } from "react";
import styled from "styled-components";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis,
  CartesianGrid,
} from "recharts";
import StatCard from "./StatCard";
import processComparison from "../utils/processComparison";
import type { PipelineRun } from "../types/dashboard";

interface Props {
  runs: PipelineRun[];
}

// ── Styled ──

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Card = styled.div`
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 24px;
`;

const Heading = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 4px;
`;

const SubText = styled.p`
  font-size: 12px;
  color: #64748b;
  margin-bottom: 20px;
  line-height: 1.6;
`;

const StatRow = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
`;

const Th = styled.th<{ $align?: string }>`
  text-align: ${(p) => p.$align || "left"};
  padding: 10px 12px;
  color: #94a3b8;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  white-space: nowrap;
`;

const Td = styled.td<{ $align?: string; $highlight?: boolean; $best?: boolean; $worst?: boolean }>`
  padding: 10px 12px;
  text-align: ${(p) => p.$align || "left"};
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: ${(p) => p.$best ? "#10b981" : p.$worst ? "#f87171" : p.$highlight ? "#a5b4fc" : "#e2e8f0"};
  font-weight: ${(p) => (p.$best || p.$worst || p.$highlight) ? 600 : 400};
`;

const DiffGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const DiffBadge = styled.div<{ $present: boolean }>`
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  background: ${(p) => p.$present ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)"};
  color: ${(p) => p.$present ? "#10b981" : "#ef4444"};
  border: 1px solid ${(p) => p.$present ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"};
`;

const ChartGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

// ── Colors per pipeline ──

const PIPELINE_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899",
  "#06b6d4", "#8b5cf6", "#ef4444", "#14b8a6",
];

function getPipelineColor(idx: number): string {
  return PIPELINE_COLORS[idx % PIPELINE_COLORS.length];
}

// ── Component ──

export default function PipelineComparison({ runs }: Props) {
  const comparison = useMemo(() => processComparison(runs), [runs]);
  const { pipelines, scores, categoryOverlap, taxonomyDiff, radarMetrics } = comparison;

  const colorMap: Record<string, string> = {};
  pipelines.forEach((p, i) => { colorMap[p] = getPipelineColor(i); });

  // Helper: find best/worst for a metric
  const isBest = (pipeline: string, metric: keyof typeof scores[0], lower = false) => {
    const vals = scores.map((s) => ({ p: s.pipeline, v: s[metric] as number }));
    const target = lower ? Math.min(...vals.map((v) => v.v)) : Math.max(...vals.map((v) => v.v));
    return vals.find((v) => v.p === pipeline)?.v === target;
  };

  // Cost vs quality scatter data
  const scatterData = scores.map((s) => ({
    pipeline: s.pipeline,
    x: s.timeSeconds,
    y: s.successRate - s.malformedPct + s.formatConsistency,
    z: s.categoryCount * 10,
  }));

  // Grouped bar chart data for category distribution
  const groupedBarData = categoryOverlap.map((co) => ({
    category: co.category.length > 25 ? co.category.slice(0, 23) + "..." : co.category,
    fullName: co.category,
    ...co.pipelines,
  }));

  // Subcategory consistency data
  const consistencyData = scores.map((s) => ({
    pipeline: s.pipeline,
    correct: s.formatConsistency,
    incorrect: +(100 - s.formatConsistency).toFixed(1),
  }));

  return (
    <Section>
      {/* ── Pipeline legend ── */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {pipelines.map((p, i) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 4,
              background: colorMap[p],
            }} />
            <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{p}</span>
          </div>
        ))}
      </div>

      {/* ── Scorecard Table ── */}
      <Card>
        <Heading>Pipeline Scorecard</Heading>
        <SubText>
          Side-by-side comparison of key quality and efficiency metrics.
          Green = best performer for that metric. Red = worst.
        </SubText>

        <div style={{ overflowX: "auto" }}>
          <Table>
            <thead>
              <tr>
                <Th>Metric</Th>
                {pipelines.map((p) => (
                  <Th key={p} $align="center" style={{ color: colorMap[p] }}>{p}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Success Rate", key: "successRate" as const, unit: "%", lower: false },
                { label: "Malformed Output", key: "malformedPct" as const, unit: "%", lower: true },
                { label: "Category Bias", key: "biasScore" as const, unit: "%", lower: true },
                { label: "Format Consistency", key: "formatConsistency" as const, unit: "%", lower: false },
                { label: "Categories Discovered", key: "categoryCount" as const, unit: "", lower: false },
                { label: "Subcategories", key: "subcategoryCount" as const, unit: "", lower: false },
                { label: "Run Time", key: "timeSeconds" as const, unit: "s", lower: true },
                { label: "New Categories Found", key: "candidatesFound" as const, unit: "", lower: false },
              ].map((row) => (
                <tr key={row.key}>
                  <Td $highlight>{row.label}</Td>
                  {scores.map((s) => (
                    <Td
                      key={s.pipeline}
                      $align="center"
                      $best={isBest(s.pipeline, row.key, row.lower)}
                      $worst={isBest(s.pipeline, row.key, !row.lower)}
                    >
                      {s[row.key]}{row.unit}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <ChartGrid>
        {/* ── Radar Chart ── */}
        <Card>
          <Heading>Quality Radar</Heading>
          <SubText>
            Multi-axis comparison. Higher is better on all axes.
            Malformed % and bias are inverted (lower raw = higher score).
          </SubText>

          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarMetrics}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
              />
              <PolarRadiusAxis
                tick={{ fill: "#475569", fontSize: 9 }}
                axisLine={false}
              />
              {pipelines.map((p, i) => (
                <Radar
                  key={p}
                  name={p}
                  dataKey={p}
                  stroke={colorMap[p]}
                  fill={colorMap[p]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                formatter={(value: string) => <span style={{ color: "#94a3b8" }}>{value}</span>}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── Cost vs Quality Scatter ── */}
        <Card>
          <Heading>Cost vs Quality</Heading>
          <SubText>
            X = run time (seconds). Y = composite quality score
            (success rate + format consistency - malformed %).
            Top-left = best (fast + high quality).
          </SubText>

          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                type="number"
                dataKey="x"
                name="Time (s)"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#334155" }}
                label={{ value: "Run Time (seconds)", position: "bottom", fill: "#64748b", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Quality"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#334155" }}
                label={{ value: "Quality Score", angle: -90, position: "left", fill: "#64748b", fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[100, 400]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{
                      background: "#1e293b", border: "1px solid #334155",
                      borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#e2e8f0",
                    }}>
                      <p style={{ fontWeight: 600, color: colorMap[d.pipeline] }}>{d.pipeline}</p>
                      <p>Time: {d.x}s</p>
                      <p>Quality: {d.y.toFixed(1)}</p>
                    </div>
                  );
                }}
              />
              {scatterData.map((d, i) => (
                <Scatter
                  key={d.pipeline}
                  name={d.pipeline}
                  data={[d]}
                  fill={colorMap[d.pipeline]}
                >
                  <Cell fill={colorMap[d.pipeline]} />
                </Scatter>
              ))}
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                formatter={(value: string) => <span style={{ color: "#94a3b8" }}>{value}</span>}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </ChartGrid>

      {/* ── Category Distribution Overlay ── */}
      <Card>
        <Heading>Category Distribution by Pipeline</Heading>
        <SubText>
          Grouped bar chart showing how each pipeline distributed messages across categories.
          Categories are matched by name across different taxonomies.
        </SubText>

        <ResponsiveContainer width="100%" height={Math.max(300, categoryOverlap.length * 45)}>
          <BarChart
            data={groupedBarData}
            layout="vertical"
            margin={{ left: 180, right: 20 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              width={180}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const fullName = payload[0]?.payload?.fullName || label;
                return (
                  <div style={{
                    background: "#1e293b", border: "1px solid #334155",
                    borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#e2e8f0",
                  }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{fullName}</p>
                    {payload.map((p) => (
                      <p key={p.name} style={{ color: p.color as string }}>
                        {p.name}: {p.value}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
              formatter={(value: string) => <span style={{ color: "#94a3b8" }}>{value}</span>}
            />
            {pipelines.map((p, i) => (
              <Bar
                key={p}
                dataKey={p}
                name={p}
                fill={colorMap[p]}
                fillOpacity={0.8}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Subcategory Consistency Comparison ── */}
      <Card>
        <Heading>Subcategory Format Consistency</Heading>
        <SubText>
          What percentage of subcategory IDs matched the taxonomy exactly?
          Higher = more reliable, programmatically usable output.
        </SubText>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={consistencyData} margin={{ left: 10, right: 10 }}>
            <XAxis
              dataKey="pipeline"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{
                    background: "#1e293b", border: "1px solid #334155",
                    borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#e2e8f0",
                  }}>
                    <p style={{ fontWeight: 600 }}>{d.pipeline}</p>
                    <p style={{ color: "#10b981" }}>Correct: {d.correct}%</p>
                    <p style={{ color: "#ef4444" }}>Incorrect: {d.incorrect}%</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="correct" name="Correct %" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="incorrect" name="Incorrect %" stackId="a" fill="#ef4444" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Taxonomy Structure Diff ── */}
      <Card>
        <Heading>Taxonomy Structure Comparison</Heading>
        <SubText>
          Which categories did each pipeline discover? Categories matched by name.
          Shared categories indicate genuine patterns; unique categories show model-specific biases.
        </SubText>

        <Table>
          <thead>
            <tr>
              <Th>Category</Th>
              {pipelines.map((p) => (
                <Th key={p} $align="center" style={{ color: colorMap[p] }}>{p}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {taxonomyDiff.map((row) => (
              <tr key={row.categoryName}>
                <Td $highlight>{row.categoryName}</Td>
                {pipelines.map((p) => (
                  <Td key={p} $align="center">
                    <DiffBadge $present={row.presentIn.includes(p)}>
                      {row.presentIn.includes(p) ? "Yes" : "No"}
                    </DiffBadge>
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>

        <div style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
          {(() => {
            const shared = taxonomyDiff.filter((d) => d.presentIn.length === pipelines.length);
            const unique = taxonomyDiff.filter((d) => d.presentIn.length === 1);
            return (
              <>
                {shared.length} categories shared by all pipelines.
                {unique.length > 0 && ` ${unique.length} categories unique to a single pipeline.`}
              </>
            );
          })()}
        </div>
      </Card>
    </Section>
  );
}