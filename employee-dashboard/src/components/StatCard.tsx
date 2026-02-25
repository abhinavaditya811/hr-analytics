"use client";

import styled from "styled-components";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

const Card = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 20px 24px;
  flex: 1 1 180px;
  min-width: 170px;
`;

const Orb = styled.div<{ $color: string }>`
  position: absolute;
  top: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  opacity: 0.07;
  background: ${(p) => p.$color};
`;

const Label = styled.p`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #94a3b8;
  margin-bottom: 6px;
`;

const Value = styled.p`
  font-size: 32px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.1;
`;

const Sub = styled.p`
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
`;

export default function StatCard({ label, value, sub, color = "#6366f1" }: StatCardProps) {
  return (
    <Card>
      <Orb $color={color} />
      <Label>{label}</Label>
      <Value>{value}</Value>
      {sub && <Sub>{sub}</Sub>}
    </Card>
  );
}