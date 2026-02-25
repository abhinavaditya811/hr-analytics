"use client";

import styled from "styled-components";
import type { TooltipProps } from "recharts";

const Wrapper = styled.div`
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #e2e8f0;
`;

const Title = styled.p`
  font-weight: 600;
  margin-bottom: 4px;
`;

export default function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <Wrapper>
      <Title>{label}</Title>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </Wrapper>
  );
}