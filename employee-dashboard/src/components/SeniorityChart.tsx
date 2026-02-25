"use client";

import styled from "styled-components";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import type { SeniorityRow } from "../types/dashboard";

interface Props {
  data: SeniorityRow[];
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
  margin-bottom: 16px;
`;

export default function SeniorityChart({ data }: Props) {
  if (!data?.length) return null;

  return (
    <Card>
      <Heading>Seniority Distribution: Recipients vs Nominators</Heading>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ left: 10, right: 10, bottom: 5 }}>
          <XAxis
            dataKey="level"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          <Bar dataKey="recipients" name="Recipients" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="nominators" name="Nominators" fill="#06b6d4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}