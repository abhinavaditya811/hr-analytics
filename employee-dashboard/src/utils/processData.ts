import type {
  RawData, ProcessedData, SeniorityRow,
  DeptRow, BarRow, HeatmapData, NetworkNode, NetworkEdge,
} from "../types/dashboard";
import extractDept from "./extractDept";

const SENIORITY_ORDER = [
  "Junior", "Associate", "Specialist", "Lead",
  "Senior", "Manager", "Director", "Principal", "VP/C-Suite",
];

function mergeSeniority(dist: Record<string, number>): Record<string, number> {
  const merged = { ...dist };
  if (merged["VP"] || merged["Vice President"]) {
    merged["VP/C-Suite"] = (merged["VP"] || 0) + (merged["Vice President"] || 0);
    delete merged["VP"];
    delete merged["Vice President"];
  }
  return merged;
}

function buildSeniorityData(raw: RawData): SeniorityRow[] {
  const recipMerged = mergeSeniority(raw.recipient_title.seniority_distribution);
  const nomMerged = mergeSeniority(raw.nominator_title.seniority_distribution);
  const allKeys = new Set([...Object.keys(recipMerged), ...Object.keys(nomMerged)]);

  return SENIORITY_ORDER
    .filter((k) => allKeys.has(k))
    .map((level) => ({
      level,
      recipients: recipMerged[level] || 0,
      nominators: nomMerged[level] || 0,
    }));
}

function buildDeptData(raw: RawData): DeptRow[] {
  const counts: Record<string, number> = {};

  const addTitles = (titles: [string, number][]) => {
    titles.forEach(([title, count]) => {
      const d = extractDept(title);
      counts[d] = (counts[d] || 0) + count;
    });
  };

  addTitles(raw.recipient_title.top_15_titles);
  addTitles(raw.nominator_title.top_15_titles);

  return Object.entries(counts)
    .map(([dept, count]) => ({ dept, count }))
    .sort((a, b) => b.count - a.count);
}

function buildHeatmap(raw: RawData): HeatmapData {
  const flows: Record<string, number> = {};

  raw.interactions.top_10_pairs.forEach(({ nominator, recipient, count }) => {
    const key = `${extractDept(nominator)}|${extractDept(recipient)}`;
    flows[key] = (flows[key] || 0) + count;
  });

  const depts = [
    ...new Set([
      ...raw.interactions.top_10_pairs.map((p) => extractDept(p.nominator)),
      ...raw.interactions.top_10_pairs.map((p) => extractDept(p.recipient)),
    ]),
  ].sort();

  const matrix = depts.map((from) =>
    depts.map((to) => flows[`${from}|${to}`] || 0)
  );

  return { labels: depts, matrix };
}

function buildNetworkData(raw: RawData): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const nodeMap: Record<string, NetworkNode> = {};

  raw.recipient_title.top_15_titles.forEach(([t, c]) => {
    nodeMap[t] = { id: t, received: c, given: 0, dept: extractDept(t) };
  });
  raw.nominator_title.top_15_titles.forEach(([t, c]) => {
    if (nodeMap[t]) nodeMap[t].given = c;
    else nodeMap[t] = { id: t, received: 0, given: c, dept: extractDept(t) };
  });

  return {
    nodes: Object.values(nodeMap),
    edges: raw.interactions.top_10_pairs.map((p) => ({
      source: p.nominator,
      target: p.recipient,
      value: p.count,
    })),
  };
}

function buildBarData(titles: [string, number][], max = 12): BarRow[] {
  return titles.slice(0, max).map(([t, c]) => ({
    name: t.length > 30 ? t.slice(0, 28) + "..." : t,
    fullName: t,
    count: c,
    dept: extractDept(t),
  }));
}

export default function processData(raw: RawData): ProcessedData {
  return {
    seniorityData: buildSeniorityData(raw),
    deptData: buildDeptData(raw),
    heatmap: buildHeatmap(raw),
    network: buildNetworkData(raw),
    recipBarData: buildBarData(raw.recipient_title.top_15_titles),
    nomBarData: buildBarData(raw.nominator_title.top_15_titles),
  };
}