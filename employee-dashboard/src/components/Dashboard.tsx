"use client";

import { useState, useMemo } from "react";
import styled from "styled-components";
import processData from "../utils/processData";
import Tabs from "./Tabs";
import type { TabItem } from "./Tabs";
import StatCard from "./StatCard";
import InteractionTable from "./InteractionTable";
import SeniorityChart from "./SeniorityChart";
import TitleBars from "./TitleBars";
import Heatmap from "./Heatmap";
import NetworkGraph from "./NetworkGraph";
import StatisticalAnalysis from "./StatisticalAnalysis";
import ClassificationAnalysis from "./ClassificationAnalysis";
import PipelineComparison from "./PipelineComparison";
import type { RawData, DeptColorMap, PipelineRun } from "../types/dashboard";

interface Props {
  data: RawData;
  runs: PipelineRun[];
}

const Page = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
  color: #e2e8f0;
  font-family: "Inter", -apple-system, sans-serif;
  padding: 24px 24px 48px;
`;

const Container = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 26px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
`;

const Meta = styled.p`
  color: #64748b;
  font-size: 13px;
  margin: 4px 0 0;
`;

const StatRow = styled.div<{ $mb?: number }>`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: ${(p) => p.$mb ?? 16}px;
`;

const Card = styled.div<{ $mb?: number }>`
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 24px;
  margin-bottom: ${(p) => p.$mb ?? 0}px;
`;

const CardHeading = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0 0 16px;
`;

const SubText = styled.p`
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
`;

const PercRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const PercItem = styled.div`
  text-align: center;
  flex: 1 1 70px;
`;

const PercVal = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #a5b4fc;
`;

const PercLabel = styled.div`
  font-size: 10px;
  color: #64748b;
`;

const TabContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Footer = styled.div`
  text-align: center;
  margin-top: 48px;
  color: #475569;
  font-size: 11px;
`;

const TABS: TabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "estimation", label: "Statistical Estimation" },
  { id: "classification", label: "Classification Analysis" },
  { id: "comparison", label: "Pipeline Comparison" },
  { id: "seniority", label: "Title & Seniority" },
  { id: "heatmap", label: "Dept Heatmap" },
  { id: "network", label: "Network" },
];

const DEPT_PALETTE = [
  "#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
  "#84cc16", "#e879f9",
];

export default function Dashboard({ data, runs }: Props) {
  const [tab, setTab] = useState("overview");

  const processed = useMemo(() => processData(data), [data]);

  const deptColors = useMemo<DeptColorMap>(() => {
    const allDepts = new Set(processed.network.nodes.map((n) => n.dept));
    const map: DeptColorMap = {};
    [...allDepts].forEach((d, i) => {
      map[d] = DEPT_PALETTE[i % DEPT_PALETTE.length];
    });
    return map;
  }, [processed]);

  const inter = data.interactions;
  const selfPct = ((inter.self_recognition_count / inter.total_interactions) * 100).toFixed(1);
  const recipPct = ((inter.bidirectional_pairs / inter.unique_pairs) * 100).toFixed(1);
  const avgMsgLen = data.message.word_count.mean.toFixed(0);

  const charLen = data.message.char_length;
  const percItems = [
    { label: "Min", val: charLen.min },
    { label: "P5", val: charLen.p5.toFixed(0) },
    { label: "P25", val: charLen.p25.toFixed(0) },
    { label: "Median", val: charLen.median.toFixed(0) },
    { label: "Mean", val: charLen.mean.toFixed(0) },
    { label: "P75", val: charLen.p75.toFixed(0) },
    { label: "P95", val: charLen.p95.toFixed(0) },
    { label: "Max", val: charLen.max },
  ];

  // Derive single-run data from first available run (for Classification Analysis)
  const firstRun = runs[0];
  const phase2Data = firstRun?.phase2;
  const taxonomy = firstRun?.taxonomy;

  return (
    <Page>
      <Container>
        <Header>
          <Title>Employee Estimation Dashboard</Title>
          <Meta>
            {data.basic.total_rows.toLocaleString()} award records
            {" · "}{data.basic.total_columns} columns
            {" · "}{inter.unique_pairs} unique interaction pairs
            {runs.length > 0 && ` · ${runs.length} pipeline run${runs.length !== 1 ? "s" : ""} loaded`}
          </Meta>
        </Header>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "overview" && (
          <>
            <StatRow>
              <StatCard label="Total Awards" value={data.basic.total_rows.toLocaleString()} sub="Recognition events in dataset" color="#6366f1" />
              <StatCard label="Unique Recipients" value={inter.unique_recipients} sub={`of ${data.recipient_title.unique_count} unique titles`} color="#06b6d4" />
              <StatCard label="Unique Nominators" value={inter.unique_nominators} sub={`of ${data.nominator_title.unique_count} unique titles`} color="#10b981" />
              <StatCard label="Unique Pairs" value={inter.unique_pairs} sub={`${selfPct}% self-recognition`} color="#f59e0b" />
            </StatRow>
            <StatRow $mb={32}>
              <StatCard label="Bidirectional Pairs" value={inter.bidirectional_pairs} sub={`${recipPct}% of unique pairs are mutual`} color="#8b5cf6" />
              <StatCard label="Avg Message Length" value={`${avgMsgLen} words`} sub={`Range: ${data.message.word_count.min} – ${data.message.word_count.max}`} color="#ec4899" />
              <StatCard label="Unique Award Titles" value={data.award_title.unique_count} sub={`of ${data.award_title.count} total awards`} color="#14b8a6" />
              <StatCard label="Self-Recognition" value={inter.self_recognition_count} sub="Same title on both sides" color="#ef4444" />
            </StatRow>

            <Card $mb={24}>
              <CardHeading>Message Length Distribution</CardHeading>
              <PercRow>
                {percItems.map(({ label, val }) => (
                  <PercItem key={label}>
                    <PercVal>{val}</PercVal>
                    <PercLabel>{label} chars</PercLabel>
                  </PercItem>
                ))}
              </PercRow>
            </Card>

            <InteractionTable pairs={inter.top_10_pairs} />
          </>
        )}

        {tab === "estimation" && (
          <StatisticalAnalysis data={data} />
        )}

        {tab === "classification" && phase2Data && (
          <ClassificationAnalysis data={phase2Data} taxonomy={taxonomy} />
        )}

        {tab === "classification" && !phase2Data && (
          <Card>
            <CardHeading>No Classification Data Available</CardHeading>
            <SubText style={{ margin: 0 }}>
              Run the taxonomy pipeline (Phase 2) to generate classification results.
              Place output files in outputs/runs/your_pipeline_name/.
            </SubText>
          </Card>
        )}

        {tab === "comparison" && runs.length >= 2 && (
          <PipelineComparison runs={runs} />
        )}

        {tab === "comparison" && runs.length < 2 && (
          <Card>
            <CardHeading>Need Multiple Pipeline Runs</CardHeading>
            <SubText style={{ margin: 0 }}>
              At least 2 pipeline runs are needed for comparison.
              Currently loaded: {runs.length} run{runs.length !== 1 ? "s" : ""}.
              Add pipeline outputs to outputs/runs/ subdirectories
              (e.g. outputs/runs/hybrid/, outputs/runs/pure_gemini/).
            </SubText>
          </Card>
        )}

        {tab === "seniority" && (
          <TabContent>
            <SeniorityChart data={processed.seniorityData} />
            <TitleBars
              recipData={processed.recipBarData}
              nomData={processed.nomBarData}
              deptColors={deptColors}
            />
          </TabContent>
        )}

        {tab === "heatmap" && (
          <Heatmap
            heatmap={processed.heatmap}
            deptData={processed.deptData}
            deptColors={deptColors}
          />
        )}

        {tab === "network" && (
          <NetworkGraph
            network={processed.network}
            deptColors={deptColors}
            interactions={inter}
          />
        )}

        <Footer>
          Workhuman Capstone — Employee Estimation Dashboard — Data-driven from {data.basic.total_rows} award records
        </Footer>
      </Container>
    </Page>
  );
}