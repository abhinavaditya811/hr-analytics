"use client";

import { useMemo } from "react";
import styled from "styled-components";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import StatCard from "./StatCard";
import processPhase2 from "../utils/processPhase2";
import type { Phase2Data, Taxonomy } from "../types/dashboard";

interface Props {
  data: Phase2Data;
  taxonomy?: Taxonomy;
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
  margin-top: 12px;
`;

const Th = styled.th<{ $align?: string }>`
  text-align: ${(p) => p.$align || "left"};
  padding: 10px 16px;
  color: #94a3b8;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Td = styled.td<{ $align?: string; $highlight?: boolean; $warn?: boolean }>`
  padding: 10px 16px;
  color: ${(p) => (p.$warn ? "#f87171" : p.$highlight ? "#a5b4fc" : "#e2e8f0")};
  font-weight: ${(p) => (p.$highlight || p.$warn ? 600 : 400)};
  text-align: ${(p) => p.$align || "left"};
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
`;

const Badge = styled.span<{ $color: string }>`
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: ${(p) => p.$color}20;
  color: ${(p) => p.$color};
`;

const InsightBox = styled.div<{ $type: "warning" | "info" | "success" }>`
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 13px;
  line-height: 1.6;
  color: #e2e8f0;
  background: ${(p) =>
    p.$type === "warning" ? "rgba(245, 158, 11, 0.08)" :
    p.$type === "info" ? "rgba(99, 102, 241, 0.08)" :
    "rgba(16, 185, 129, 0.08)"};
  border: 1px solid ${(p) =>
    p.$type === "warning" ? "rgba(245, 158, 11, 0.2)" :
    p.$type === "info" ? "rgba(99, 102, 241, 0.2)" :
    "rgba(16, 185, 129, 0.2)"};
`;

const InsightTitle = styled.span<{ $type: "warning" | "info" | "success" }>`
  font-weight: 600;
  color: ${(p) =>
    p.$type === "warning" ? "#f59e0b" :
    p.$type === "info" ? "#818cf8" :
    "#10b981"};
`;

const ThemeGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const ThemeTag = styled.div<{ $size: number }>`
  padding: 4px 12px;
  border-radius: 8px;
  font-size: ${(p) => 10 + p.$size * 2}px;
  background: rgba(99, 102, 241, ${(p) => 0.08 + p.$size * 0.06});
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, ${(p) => 0.1 + p.$size * 0.08});
`;

// ── Colors ──

// ── Colors — dynamically assigned based on taxonomy ──

const COLOR_PALETTE = [
  "#06b6d4", "#6366f1", "#10b981", "#f59e0b",
  "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444",
];

function buildCatColors(validCategories: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  validCategories.forEach((cat, i) => {
    map[cat] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });
  return map;
}

const INVALID_COLOR = "#ef4444";

// ── Component ──

export default function ClassificationAnalysis({ data, taxonomy }: Props) {
  const analysis = useMemo(() => processPhase2(data, taxonomy), [data, taxonomy]);

  const catColors = useMemo(
    () => buildCatColors(analysis.validCategories),
    [analysis.validCategories]
  );

  // Find the taxonomy name for the biased category
  const biasCatName = taxonomy?.categories.find(
    (c) => c.id === analysis.biasCategory
  )?.name || analysis.biasCategory;

  // Bar data for valid categories only
  const validCatData = analysis.categoryDistribution.filter((c) => c.isValid);
  const invalidCatData = analysis.categoryDistribution.filter((c) => !c.isValid);

  // Expected uniform line
  const expectedUniform = +(analysis.totalClassified / analysis.validCategories.length).toFixed(0);

  // Subcategory format bar data
  const subFormatBar = analysis.subcategoryFormats.map((f) => ({
    name: f.format,
    count: f.count,
    pct: +((f.count / analysis.totalClassified) * 100).toFixed(1),
  }));

  const SUB_COLORS: Record<string, string> = {
    "Correct (matches taxonomy)": "#10b981",
    "Null / Empty": "#ef4444",
    "Letter only (A, B, C)": "#f59e0b",
    "Letter+number (A1, B2)": "#f97316",
    "Alt prefix (A2b, B1a)": "#8b5cf6",
    "Lowercase letter (a, b, c)": "#ec4899",
    "Category ID as subcategory": "#06b6d4",
    "Wrong category prefix": "#e879f9",
    "Other / Unrecognized": "#64748b",
  };

  return (
    <Section>
      {/* ── Overview stats ── */}
      <StatRow>
        <StatCard
          label="Classified"
          value={`${analysis.totalClassified} / ${analysis.totalMessages}`}
          sub={`${analysis.successRate}% success rate`}
          color="#6366f1"
        />
        <StatCard
          label="Malformed IDs"
          value={analysis.malformedCount}
          sub={`${analysis.malformedPct}% of classifications`}
          color="#ef4444"
        />
        <StatCard
          label="Missing Batches"
          value={analysis.missingBatches.length}
          sub="Batches with no parseable output"
          color="#f59e0b"
        />
        <StatCard
          label={`${analysis.biasCategory} Bias`}
          value={`+${analysis.c4BiasScore}%`}
          sub="Above expected uniform distribution"
          color="#f59e0b"
        />
      </StatRow>

      {/* ── Category Distribution ── */}
      <Card>
        <Heading>Category Distribution</Heading>
        <SubText>
          How Llama classified {analysis.totalMessages} messages across the {analysis.validCategories.length} taxonomy
          categories. The dashed line shows what a uniform distribution would look like.
          {analysis.biasCategory && ` ${analysis.biasCategory} (${biasCatName}) dominates — a sign of category bias or overly broad definition.`}
        
        </SubText>

        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={validCatData} margin={{ left: 10, right: 10, bottom: 5 }}>
            <XAxis
              dataKey="category"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
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
                    <p style={{ fontWeight: 600 }}>{d.category}</p>
                    <p>Count: {d.count} ({d.pct}%)</p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={expectedUniform}
              stroke="#475569"
              strokeDasharray="6 4"
              label={{ value: `Uniform: ${expectedUniform}`, fill: "#64748b", fontSize: 10, position: "right" }}
            />
            <Bar dataKey="count" name="Messages" radius={[6, 6, 0, 0]}>
              {validCatData.map((d) => (
                <Cell key={d.category} fill={catColors[d.category] || "#6366f1"} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <InsightBox $type="warning" style={{ marginTop: 16 }}>
          <InsightTitle $type="warning">Category Bias Detected: </InsightTitle>
          {analysis.biasCategory} ({biasCatName}) received {analysis.c4BiasScore}% more messages
          than a uniform distribution would predict. This suggests the SLM defaults to this category
          when uncertain — a common pattern with base models that fine-tuning can correct.
        </InsightBox>
      </Card>

      {/* ── Invalid Categories ── */}
      {invalidCatData.length > 0 && (
        <Card>
          <Heading>Malformed Category IDs</Heading>
          <SubText>
            {analysis.malformedCount} classifications ({analysis.malformedPct}%) used category IDs
            not in the taxonomy. These represent hallucinated or misformatted outputs from the SLM.

          </SubText>

          <Table>
            <thead>
              <tr>
                <Th>Invalid ID</Th>
                <Th $align="right">Count</Th>
                <Th $align="right">% of Total</Th>
                <Th>Likely Intended</Th>
              </tr>
            </thead>
            <tbody>
              {invalidCatData.map((d) => (
                <tr key={d.category}>
                  <Td $warn>
                    <code>{d.category}</code>
                  </Td>
                  <Td $align="right" $highlight>{d.count}</Td>
                  <Td $align="right">{d.pct}%</Td>
                  <Td>
                    {(() => {
                      const id = d.category;
                      // Check if it looks like a subcategory used as category
                      const matchedCat = analysis.validCategories.find(
                        (vc) => id.startsWith(vc) && id.length > vc.length
                      );
                      if (matchedCat) {
                        const catName = taxonomy?.categories.find((c) => c.id === matchedCat)?.name || matchedCat;
                        return `Used subcategory as category — likely ${matchedCat} (${catName})`;
                      }
                      const matchedByNum = analysis.validCategories.find(
                        (vc) => id.replace(/^[A-Z]+/, "") === vc.replace(/^[A-Z]+/, "")
                      );
                      if (matchedByNum) {
                        const catName = taxonomy?.categories.find((c) => c.id === matchedByNum)?.name || matchedByNum;
                        return `Wrong prefix — likely ${matchedByNum} (${catName})`;
                      }
                      if (id === "(empty)" || !id) return "Parse failure — no output";
                      return "Unknown mapping — model hallucinated ID";
                    })()}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ── Subcategory Format Consistency ── */}
      <Card>
        <Heading>Subcategory Format Consistency</Heading>
        <SubText>
          The SLM should output subcategory IDs like &quot;C1a&quot;, &quot;C2b&quot;, etc.
          Instead, it used {analysis.subcategoryFormats.length} different formats —
          a major consistency problem that fine-tuning directly addresses.
        </SubText>

        <ResponsiveContainer width="100%" height={Math.max(200, subFormatBar.length * 40)}>
          <BarChart
            data={subFormatBar}
            layout="vertical"
            margin={{ left: 200, right: 40 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              width={200}
              axisLine={false}
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
                    <p>{d.count} occurrences ({d.pct}%)</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {subFormatBar.map((d) => (
                <Cell
                  key={d.name}
                  fill={SUB_COLORS[d.name] || "#64748b"}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <InsightBox $type="info" style={{ marginTop: 16 }}>
          <InsightTitle $type="info">Fine-tuning impact: </InsightTitle>
          Training the SLM on Gemini&apos;s consistently formatted outputs should collapse these
          {" "}{analysis.subcategoryFormats.length} format variants down to 1 — &quot;Correct (matches taxonomy)&quot;.
          This alone makes the classification output programmatically usable.
        </InsightBox>
      </Card>

      {/* ── Theme Cloud ── */}
      <Card>
        <Heading>Top Themes Extracted</Heading>
        <SubText>
          Most frequent themes across all classifications. Size indicates frequency.
        </SubText>
        <ThemeGrid>
          {analysis.topThemes.map((t) => {
            const maxCount = analysis.topThemes[0].count;
            const size = Math.round((t.count / maxCount) * 4);
            return (
              <ThemeTag key={t.theme} $size={size}>
                {t.theme} ({t.count})
              </ThemeTag>
            );
          })}
        </ThemeGrid>
      </Card>

      {/* ── Candidate Categories ── */}
      <Card>
        <Heading>Candidate New Categories</Heading>
        <SubText>
          When the SLM couldn&apos;t fit a message into the taxonomy, it proposed a new category.
          Most appeared only once (noise), but patterns emerge around personal recognition
          and leadership.
        </SubText>

        <Table>
          <thead>
            <tr>
              <Th>Proposed Category</Th>
              <Th $align="right">Frequency</Th>
              <Th>Assessment</Th>
            </tr>
          </thead>
          <tbody>
            {analysis.candidateCategories.map((c) => (
              <tr key={c.name}>
                <Td $highlight>{c.name}</Td>
                <Td $align="right">{c.count}</Td>
                <Td>
                  {analysis.validCategories.includes(c.name) ? (
                    <Badge $color="#f59e0b">Existing category — model failed to match</Badge>
                  ) : c.count >= 3 ? (
                    <Badge $color="#10b981">Potentially valid — review</Badge>
                  ) : (
                    <Badge $color="#64748b">Noise — single occurrence</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {(() => {
          const existingAsNew = analysis.candidateCategories.filter((c) =>
            analysis.validCategories.includes(c.name)
          );
          if (existingAsNew.length === 0) return null;
          const names = existingAsNew.map((c) => c.name).join(", ");
          return (
            <InsightBox $type="info" style={{ marginTop: 16 }}>
              <InsightTitle $type="info">Key finding: </InsightTitle>
              The SLM proposed {names} as new categories — these already exist in the
              taxonomy. The model recognized the messages belonged to these categories but
              couldn&apos;t match them by ID. This suggests the taxonomy descriptions need
              clearer wording, or the SLM needs fine-tuning to learn the mapping.
            </InsightBox>
          );
        })()}
      </Card>

      <Card>
        <Heading>Summary: The Case for Fine-Tuning</Heading>
        <Table>
          <thead>
            <tr>
              <Th>Issue</Th>
              <Th>Base Llama (Current)</Th>
              <Th>Expected After Fine-Tuning</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Output format</Td>
              <Td $warn>{analysis.subcategoryFormats.length} different formats</Td>
              <Td $highlight>1 consistent format (C1a style)</Td>
            </tr>
            <tr>
              <Td>Malformed IDs</Td>
              <Td $warn>{analysis.malformedPct}% invalid</Td>
              <Td $highlight>{"<"}1% invalid</Td>
            </tr>
            <tr>
              <Td>{analysis.biasCategory} bias</Td>
              <Td $warn>+{analysis.c4BiasScore}% over uniform</Td>
              <Td $highlight>Closer to teacher distribution</Td>
            </tr>
            <tr>
              <Td>Missing subcategories</Td>
              <Td $warn>{analysis.subcategoryNullCount} null values</Td>
              <Td $highlight>Near-zero null values</Td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </Section>
  );
}