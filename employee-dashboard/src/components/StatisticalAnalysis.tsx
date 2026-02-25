"use client";

import { useMemo } from "react";
import styled from "styled-components";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ErrorBar,
  ScatterChart, Scatter, ZAxis, CartesianGrid, Legend,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import StatCard from "./StatCard";
import estimatePopulation from "../utils/estimatePopulation";
import type { RawData } from "../types/dashboard";
import type { PopulationEstimate } from "../utils/estimatePopulation";

interface Props {
  data: RawData;
}

// ── Styled components ──

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

const Formula = styled.div`
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 16px 20px;
  font-family: "Courier New", monospace;
  font-size: 14px;
  color: #a5b4fc;
  text-align: center;
  margin: 16px 0;
  line-height: 1.8;
`;

const MethodLabel = styled.div`
  display: inline-block;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 12px;
`;

const Th = styled.th<{ $align?: string }>`
  text-align: ${(p) => p.$align || "left"};
  padding: 10px 16px;
  color: #94a3b8;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Td = styled.td<{ $align?: string; $highlight?: boolean }>`
  padding: 10px 16px;
  color: ${(p) => (p.$highlight ? "#a5b4fc" : "#e2e8f0")};
  font-weight: ${(p) => (p.$highlight ? 600 : 400)};
  text-align: ${(p) => p.$align || "left"};
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
`;

const AssumptionList = styled.ol`
  list-style: decimal;
  padding-left: 20px;
  margin: 12px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.8;
`;

const VennContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  gap: 0;
  position: relative;
  height: 200px;
`;

const VennCircle = styled.div<{ $color: string; $side: "left" | "right" }>`
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border: 2px solid ${(p) => p.$color};
  background: ${(p) => p.$color}15;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: absolute;
  ${(p) => (p.$side === "left" ? "left: calc(50% - 140px);" : "right: calc(50% - 140px);")}
`;

const VennLabel = styled.div<{ $side: "left" | "right" | "center" }>`
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  position: absolute;
  ${(p) => {
    if (p.$side === "left") return "left: calc(50% - 180px); top: 8px;";
    if (p.$side === "right") return "right: calc(50% - 180px); top: 8px;";
    return "left: 50%; transform: translateX(-50%); bottom: 8px;";
  }}
`;

const VennValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #f1f5f9;
`;

const VennSub = styled.div`
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
`;

const OverlapBadge = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 8px 14px;
  text-align: center;
`;

const ResultBanner = styled.div`
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.12));
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
`;

const BigNumber = styled.div`
  font-size: 48px;
  font-weight: 800;
  color: #f1f5f9;
  line-height: 1;
`;

const RangeText = styled.div`
  font-size: 14px;
  color: #94a3b8;
  margin-top: 8px;
`;

const MethodText = styled.div`
  font-size: 11px;
  color: #64748b;
  margin-top: 12px;
`;

// ── Component ──

export default function StatisticalAnalysis({ data }: Props) {
  const estimate = useMemo(() => estimatePopulation(data), [data]);
  const { titleCount: tc, captureRecapture: cr, network: net, recommended: rec } = estimate;

  // Chart data for sensitivity analysis
  const sensitivityData = cr.sensitivity.map((s) => ({
    name: `k = ${s.k}`,
    estimate: s.estimate,
    label: s.k === 1.0 ? "1:1 title-to-person" : `avg ${s.k} people/title`,
  }));

  // Chart data for method comparison
  const methodComparison = [
    { method: "Title Count", estimate: tc.totalUnique, color: "#06b6d4" },
    { method: "Chapman (central)", estimate: cr.chapmanEstimate, color: "#6366f1" },
    { method: "Chapman (95% low)", estimate: cr.ci95[0], color: "#8b5cf6" },
    { method: "Chapman (95% high)", estimate: cr.ci95[1], color: "#a78bfa" },
  ];

  return (
    <Section>
      {/* ── Headline result ── */}
      <ResultBanner>
        <MethodLabel>Recommended Persona Count</MethodLabel>
        <BigNumber>{rec.mid}</BigNumber>
        <RangeText>
          95% CI: [{rec.low} , {rec.high}]
        </RangeText>
        <MethodText>{rec.method}</MethodText>
      </ResultBanner>

      {/* ── Method 1: Title Counting ── */}
      <Card>
        <MethodLabel>Method 1</MethodLabel>
        <Heading>Unique Title Counting (Lower Bound)</Heading>
        <SubText>
          The simplest approach: count distinct job titles across recipients and nominators.
          This establishes a floor — there are at least this many distinct roles. However,
          multiple employees can share the same title (e.g., 53 &quot;Customer Service Executive&quot;
          records might be 1 person or 20+), so this systematically underestimates.
        </SubText>

        <VennContainer>
          <VennCircle $color="#06b6d4" $side="left">
            <VennValue>{tc.uniqueRecipients}</VennValue>
            <VennSub>recipient titles</VennSub>
          </VennCircle>
          <VennCircle $color="#10b981" $side="right">
            <VennValue>{tc.uniqueNominators}</VennValue>
            <VennSub>nominator titles</VennSub>
          </VennCircle>
          <OverlapBadge>
            <VennValue style={{ fontSize: 18 }}>{tc.overlap}</VennValue>
            <VennSub>overlap ({tc.overlapPct}%)</VennSub>
          </OverlapBadge>
          <VennLabel $side="left">Recipients (n1)</VennLabel>
          <VennLabel $side="right">Nominators (n2)</VennLabel>
          <VennLabel $side="center">
            Union: {tc.totalUnique} unique titles
          </VennLabel>
        </VennContainer>

        <StatRow>
          <StatCard label="Unique Recipients" value={tc.uniqueRecipients} color="#06b6d4" />
          <StatCard label="Unique Nominators" value={tc.uniqueNominators} color="#10b981" />
          <StatCard label="Overlap" value={tc.overlap} sub={`${tc.overlapPct}% of smaller set`} color="#f59e0b" />
          <StatCard label="Lower Bound" value={tc.totalUnique} sub="1 person per title" color="#6366f1" />
        </StatRow>
      </Card>

      {/* ── Method 2: Capture-Recapture ── */}
      <Card>
        <MethodLabel>Method 2</MethodLabel>
        <Heading>Capture-Recapture Estimation (Chapman Estimator)</Heading>
        <SubText>
          Borrowed from ecology — if you &quot;capture&quot; animals in two independent sampling events,
          the overlap tells you the total population. Here, being a recipient is &quot;capture 1&quot; and
          being a nominator is &quot;capture 2&quot;. The Chapman estimator is a bias-corrected version
          of the Lincoln-Petersen method.
        </SubText>

        <Formula>
          N&#x302; = ((n1 + 1)(n2 + 1) / (m + 1)) - 1
          <br />
          N&#x302; = (({cr.n1} + 1)({cr.n2} + 1) / ({cr.m} + 1)) - 1 = {cr.chapmanEstimate}
        </Formula>

        <Table>
          <thead>
            <tr>
              <Th>Parameter</Th>
              <Th>Symbol</Th>
              <Th $align="right">Value</Th>
              <Th>Meaning</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>First capture</Td>
              <Td>n1</Td>
              <Td $align="right" $highlight>{cr.n1}</Td>
              <Td>Unique recipient titles</Td>
            </tr>
            <tr>
              <Td>Second capture</Td>
              <Td>n2</Td>
              <Td $align="right" $highlight>{cr.n2}</Td>
              <Td>Unique nominator titles</Td>
            </tr>
            <tr>
              <Td>Recaptured</Td>
              <Td>m</Td>
              <Td $align="right" $highlight>{cr.m}</Td>
              <Td>Titles appearing in both sets</Td>
            </tr>
            <tr>
              <Td>Population estimate</Td>
              <Td>N&#x302;</Td>
              <Td $align="right" $highlight>{cr.chapmanEstimate}</Td>
              <Td>Chapman estimator</Td>
            </tr>
            <tr>
              <Td>Standard error</Td>
              <Td>SE</Td>
              <Td $align="right" $highlight>{cr.standardError}</Td>
              <Td>Estimation uncertainty</Td>
            </tr>
            <tr>
              <Td>95% Confidence interval</Td>
              <Td>CI</Td>
              <Td $align="right" $highlight>[{cr.ci95[0]}, {cr.ci95[1]}]</Td>
              <Td>Plausible range</Td>
            </tr>
          </tbody>
        </Table>

        <SubText style={{ marginTop: 20, marginBottom: 8 }}>
          Key assumptions (violations weaken the estimate):
        </SubText>
        <AssumptionList>
          {cr.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </AssumptionList>
      </Card>

      {/* ── Sensitivity Analysis ── */}
      <Card>
        <MethodLabel>Sensitivity</MethodLabel>
        <Heading>What If Titles Are Not Unique to Individuals?</Heading>
        <SubText>
          The Chapman estimator assumes each title maps to one person. In reality,
          &quot;Customer Service Executive&quot; appears 53 times as a recipient — likely multiple
          people. If on average k people share each title, the population scales proportionally.
        </SubText>

        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sensitivityData} margin={{ left: 10, right: 10, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
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
                    <p style={{ fontWeight: 600 }}>{d.name}</p>
                    <p>Estimated population: {d.estimate}</p>
                    <p style={{ color: "#64748b", fontSize: 11 }}>{d.label}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="estimate" name="Population" radius={[6, 6, 0, 0]}>
              {sensitivityData.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === 0 ? "#6366f1" : "#8b5cf6"}
                  fillOpacity={1 - i * 0.15}
                />
              ))}
            </Bar>
            <ReferenceLine
              y={cr.chapmanEstimate}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: `Base: ${cr.chapmanEstimate}`, fill: "#f59e0b", fontSize: 11, position: "right" }}
            />
          </BarChart>
        </ResponsiveContainer>

        <Table>
          <thead>
            <tr>
              <Th>Multiplier (k)</Th>
              <Th>Interpretation</Th>
              <Th $align="right">Estimated Population</Th>
              <Th $align="right">Awards per Person</Th>
            </tr>
          </thead>
          <tbody>
            {cr.sensitivity.map((s) => (
              <tr key={s.k}>
                <Td $highlight>{s.k}</Td>
                <Td>
                  {s.k === 1.0
                    ? "Each title = 1 person"
                    : s.k === 1.25
                    ? "Some titles shared (conservative)"
                    : s.k === 1.5
                    ? "Moderate title sharing"
                    : s.k === 2.0
                    ? "Significant sharing (large teams)"
                    : "Heavy sharing (call centers, etc.)"}
                </Td>
                <Td $align="right" $highlight>{s.estimate}</Td>
                <Td $align="right">
                  {(data.basic.total_rows / s.estimate).toFixed(1)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ── Method Comparison ── */}
      <Card>
        <MethodLabel>Comparison</MethodLabel>
        <Heading>All Estimates Side by Side</Heading>
        <SubText>
          Each method captures a different signal. The title count is a strict floor.
          The Chapman estimator uses the overlap between recipients and nominators to
          infer unseen employees. The confidence interval brackets the plausible range.
        </SubText>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={methodComparison}
            layout="vertical"
            margin={{ left: 140, right: 20 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              type="category"
              dataKey="method"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              width={140}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="estimate" name="Estimate" radius={[0, 6, 6, 0]}>
              {methodComparison.map((d, i) => (
                <Cell key={i} fill={d.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Participation Rates ── */}
      <Card>
        <MethodLabel>Validation</MethodLabel>
        <Heading>Participation Rate Sanity Check</Heading>
        <SubText>
          As a reasonableness check: given {data.basic.total_rows} awards, how many awards
          per person does each estimate imply? Industry benchmarks for peer recognition
          programs typically show 2-6 awards per employee per year.
        </SubText>

        <Table>
          <thead>
            <tr>
              <Th>Scenario</Th>
              <Th $align="right">Population</Th>
              <Th $align="right">Awards / Person</Th>
              <Th>Plausibility</Th>
            </tr>
          </thead>
          <tbody>
            {estimate.participationRates.map((pr) => {
              const plausible =
                pr.awardsPerPerson >= 1.5 && pr.awardsPerPerson <= 8;
              return (
                <tr key={pr.label}>
                  <Td>{pr.label}</Td>
                  <Td $align="right" $highlight>{pr.population}</Td>
                  <Td $align="right" $highlight>{pr.awardsPerPerson}</Td>
                  <Td>
                    <span
                      style={{
                        color: plausible ? "#10b981" : "#f59e0b",
                        fontWeight: 500,
                      }}
                    >
                      {plausible ? "Within typical range" : "Outside typical range"}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {/* ── Network Evidence ── */}
      <Card>
        <MethodLabel>Supporting Evidence</MethodLabel>
        <Heading>Network Structure Indicators</Heading>
        <SubText>
          The recognition network&apos;s structural properties provide additional signals
          about organizational size and connectivity.
        </SubText>

        <StatRow>
          <StatCard
            label="Unique Pairs"
            value={net.uniquePairs}
            sub={`of ${net.totalEdges} total awards`}
            color="#6366f1"
          />
          <StatCard
            label="Network Density"
            value={`${(net.density * 100).toFixed(2)}%`}
            sub="Low density = large org"
            color="#06b6d4"
          />
          <StatCard
            label="Avg Degree"
            value={net.avgDegree}
            sub="Connections per node"
            color="#10b981"
          />
          <StatCard
            label="Reciprocal Pairs"
            value={net.reciprocalPairs}
            sub="Mutual recognition"
            color="#f59e0b"
          />
        </StatRow>

        <SubText style={{ marginTop: 16, marginBottom: 0, fontSize: 11 }}>
          A network density of {(net.density * 100).toFixed(2)}% with {net.uniquePairs} unique
          interaction pairs is consistent with an organization of {rec.mid}+ employees —
          in a smaller org, we&apos;d expect higher density and more reciprocal connections.
          The {net.selfLoops} self-loops (same title on both sides) suggest either
          self-recognition or multiple people sharing those titles, supporting the
          k {">"} 1 sensitivity scenario.
        </SubText>
      </Card>
    </Section>
  );
}