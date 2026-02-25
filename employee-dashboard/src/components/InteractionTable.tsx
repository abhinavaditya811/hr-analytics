"use client";

import styled from "styled-components";
import type { InteractionPair } from "../types/dashboard";

interface Props {
  pairs: InteractionPair[];
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
`;

const Th = styled.th<{ $align?: string }>`
  text-align: ${(p) => p.$align || "left"};
  padding: 8px 12px;
  color: #94a3b8;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Td = styled.td<{ $align?: string }>`
  padding: 8px 12px;
  color: #e2e8f0;
  text-align: ${(p) => p.$align || "left"};
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
`;

const Arrow = styled.td<{ $self: boolean }>`
  text-align: center;
  font-size: 11px;
  color: ${(p) => (p.$self ? "#f87171" : "#6366f1")};
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
`;

const Badge = styled.span`
  background: rgba(99, 102, 241, 0.2);
  padding: 3px 10px;
  border-radius: 12px;
  color: #a5b4fc;
  font-weight: 600;
  font-size: 12px;
`;

export default function InteractionTable({ pairs }: Props) {
  if (!pairs?.length) return null;

  return (
    <Card>
      <Heading>Top Interaction Pairs</Heading>
      <div style={{ overflowX: "auto" }}>
        <Table>
          <thead>
            <tr>
              <Th>Nominator</Th>
              <Th $align="center" />
              <Th>Recipient</Th>
              <Th $align="right">Count</Th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p, i) => {
              const isSelf = p.nominator === p.recipient;
              return (
                <tr key={i}>
                  <Td>{p.nominator}</Td>
                  <Arrow $self={isSelf}>{isSelf ? "self" : ">"}</Arrow>
                  <Td>{p.recipient}</Td>
                  <Td $align="right">
                    <Badge>{p.count}</Badge>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}