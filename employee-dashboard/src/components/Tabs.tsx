"use client";

import styled from "styled-components";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}

const Wrapper = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  background: ${(p) => (p.$active ? "rgba(99,102,241,0.15)" : "transparent")};
  border-bottom: 2px solid ${(p) => (p.$active ? "#6366f1" : "transparent")};
  color: ${(p) => (p.$active ? "#a5b4fc" : "#64748b")};

  &:hover {
    color: ${(p) => (p.$active ? "#a5b4fc" : "#cbd5e1")};
  }
`;

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <Wrapper>
      {tabs.map((t) => (
        <Tab key={t.id} $active={active === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </Tab>
      ))}
    </Wrapper>
  );
}