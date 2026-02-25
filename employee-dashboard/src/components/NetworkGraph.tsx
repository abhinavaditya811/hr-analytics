"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import * as d3 from "d3";
import StatCard from "./StatCard";
import type { NetworkNode, NetworkEdge, Interactions, DeptColorMap } from "../types/dashboard";

interface Props {
  network: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  };
  deptColors: DeptColorMap;
  interactions: Interactions;
}

interface SimNode extends NetworkNode {
  x?: number;
  y?: number;
}

const Card = styled.div`
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 24px;
  margin-bottom: 24px;
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
  margin-bottom: 16px;
`;

const Canvas = styled.svg`
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  width: 100%;
`;

const LegendRow = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94a3b8;
`;

const Dot = styled.div<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => p.$color};
`;

const StatRow = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`;

function nodeSize(d: SimNode): number {
  return Math.sqrt((d.received || 0) + (d.given || 0)) * 2.2 + 4;
}

function ForceGraph({
  nodes,
  edges,
  deptColors,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  deptColors: DeptColorMap;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 420 });

  useEffect(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setDims({ w: width, h: 420 });
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;
    const { w, h } = dims;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const validIds = new Set(nodes.map((n) => n.id));
    const safeEdges = edges.filter(
      (e) => validIds.has(e.source) && validIds.has(e.target)
    );

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simEdges = safeEdges.map((e) => ({ ...e }));

    const sim = d3
      .forceSimulation(simNodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(simEdges)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => nodeSize(d) + 4)
      );

    const g = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (e) => g.attr("transform", e.transform))
    );

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#475569");

    const link = g
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "#334155")
      .attr("stroke-width", (d: any) => Math.sqrt(d.value))
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrow)");

    const node = g
      .selectAll("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (d) => nodeSize(d))
      .attr("fill", (d) => deptColors[d.dept] || "#6366f1")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer");

    const labels = g
      .selectAll("text")
      .data(simNodes)
      .join("text")
      .text((d) => (d.id.length > 25 ? d.id.slice(0, 23) + "..." : d.id))
      .attr("font-size", 9)
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -nodeSize(d) - 4);

    node
      .append("title")
      .text(
        (d) =>
          `${d.id}\nDept: ${d.dept}\nReceived: ${d.received}\nGiven: ${d.given}`
      );

    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => sim.stop();
  }, [nodes, edges, dims, deptColors]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <Canvas ref={svgRef} width={dims.w} height={dims.h} />
    </div>
  );
}

export default function NetworkGraph({ network, deptColors, interactions }: Props) {
  const { nodes, edges } = network;
  const inter = interactions;

  const density = (
    (inter.unique_pairs / (inter.unique_recipients * inter.unique_nominators)) *
    100
  ).toFixed(2);

  return (
    <>
      <Card>
        <Heading>Recognition Network (Top Titles)</Heading>
        <SubText>
          Node size = total awards (given + received). Color = department.
          Edges = top interaction pairs. Scroll to zoom, drag to pan.
        </SubText>
        <ForceGraph nodes={nodes} edges={edges} deptColors={deptColors} />
        <LegendRow>
          {Object.entries(deptColors).map(([dept, color]) => (
            <LegendItem key={dept}>
              <Dot $color={color} />
              {dept}
            </LegendItem>
          ))}
        </LegendRow>
      </Card>

      <StatRow>
        <StatCard label="Total Edges" value={inter.total_interactions} sub="Award records" color="#6366f1" />
        <StatCard label="Unique Pairs" value={inter.unique_pairs} color="#06b6d4" />
        <StatCard label="Network Density" value={`${density}%`} sub="Sparse = healthy org" color="#10b981" />
        <StatCard label="Reciprocal" value={inter.bidirectional_pairs} sub="Mutual recognition pairs" color="#f59e0b" />
      </StatRow>
    </>
  );
}