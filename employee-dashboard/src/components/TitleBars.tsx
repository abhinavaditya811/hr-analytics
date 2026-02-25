"use client";

import styled from "styled-components";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import type { BarRow, DeptColorMap } from "../types/dashboard";

interface Props {
  recipData: BarRow[];
  nomData: BarRow[];
  deptColors: DeptColorMap;
}

interface SingleBarProps {
  title: string;
  data: BarRow[];
  deptColors: DeptColorMap;
  barName: string;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 24px;
`;

const Heading = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 16px;
`;

function SingleBar({ title, data, deptColors, barName }: SingleBarProps) {
  return (
    <Card>
      <Heading>{title}</Heading>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
          <XAxis
            type="number"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            width={120}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name={barName} radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={deptColors[d.dept] || "#6366f1"} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default function TitleBars({ recipData, nomData, deptColors }: Props) {
  return (
    <Grid>
      <SingleBar
        title="Top Recipient Titles"
        data={recipData}
        deptColors={deptColors}
        barName="Awards Received"
      />
      <SingleBar
        title="Top Nominator Titles"
        data={nomData}
        deptColors={deptColors}
        barName="Awards Given"
      />
    </Grid>
  );
}