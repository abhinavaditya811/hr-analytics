"use client";

import styled from "styled-components";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import type { HeatmapData, DeptRow, DeptColorMap } from "../types/dashboard";

interface Props {
  heatmap: HeatmapData;
  deptData: DeptRow[];
  deptColors: DeptColorMap;
}

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
`;

const ScrollArea = styled.div`
  overflow-x: auto;
`;

const RowWrap = styled.div`
  display: flex;
  align-items: center;
`;

const RowLabel = styled.div`
  width: 130px;
  font-size: 10px;
  color: #94a3b8;
  text-align: right;
  padding-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
`;

const ColHeader = styled.div<{ $size: number }>`
  width: ${(p) => p.$size}px;
  text-align: center;
  font-size: 9px;
  color: #64748b;
  white-space: nowrap;
  transform: rotate(-45deg);
  transform-origin: left bottom;
  height: 60px;
`;

const CellBox = styled.div<{ $size: number; $val: number; $bg: string }>`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size - 4}px;
  margin: 1px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: ${(p) => (p.$val > 0 ? "#f1f5f9" : "transparent")};
  background: ${(p) => p.$bg};
`;

const Footer = styled.p`
  font-size: 10px;
  color: #475569;
  margin-top: 8px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

function colorScale(v: number, maxVal: number): string {
  if (v === 0) return "rgba(255,255,255,0.02)";
  const t = v / maxVal;
  const r = Math.round(99 + t * 130);
  const g = Math.round(102 - t * 60);
  const b = Math.round(241 - t * 100);
  return `rgba(${r},${g},${b},${(0.3 + t * 0.7).toFixed(2)})`;
}

function HeatmapGrid({ matrix, labels }: HeatmapData) {
  const maxVal = Math.max(1, ...matrix.flat());
  const cellSize = Math.min(52, 500 / labels.length);

  return (
    <ScrollArea>
      <div style={{ display: "inline-block" }}>
        <div style={{ display: "flex", marginLeft: 130 }}>
          {labels.map((l, i) => (
            <ColHeader key={i} $size={cellSize}>{l}</ColHeader>
          ))}
        </div>
        {matrix.map((row, ri) => (
          <RowWrap key={ri}>
            <RowLabel>{labels[ri]}</RowLabel>
            {row.map((val, ci) => (
              <CellBox
                key={ci}
                $size={cellSize}
                $val={val}
                $bg={colorScale(val, maxVal)}
                title={`${labels[ri]} to ${labels[ci]}: ${val}`}
              >
                {val > 0 ? val : ""}
              </CellBox>
            ))}
          </RowWrap>
        ))}
      </div>
      <Footer>
        Rows = Nominator dept / Columns = Recipient dept. Based on top interaction pairs.
      </Footer>
    </ScrollArea>
  );
}

export default function Heatmap({ heatmap, deptData, deptColors }: Props) {
  return (
    <Section>
      <Card>
        <Heading>Cross-Department Recognition Heatmap</Heading>
        <SubText>
          Which departments recognize which? Diagonal = within-department recognition.
        </SubText>
        <HeatmapGrid matrix={heatmap.matrix} labels={heatmap.labels} />
      </Card>

      <Card>
        <Heading>Department Activity (from top titles)</Heading>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={deptData} margin={{ left: 10, bottom: 5 }}>
            <XAxis
              dataKey="dept"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={{ stroke: "#334155" }}
              angle={-30}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name="Activity" radius={[6, 6, 0, 0]}>
              {deptData.map((d, i) => (
                <Cell key={i} fill={deptColors[d.dept] || "#6366f1"} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </Section>
  );
}