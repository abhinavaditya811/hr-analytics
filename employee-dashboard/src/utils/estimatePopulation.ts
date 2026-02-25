import type { RawData } from "../types/dashboard";

// ── Result types ──

export interface TitleCountEstimate {
  uniqueRecipients: number;
  uniqueNominators: number;
  totalUnique: number;
  overlap: number;
  overlapPct: number;
}

export interface CaptureRecaptureEstimate {
  n1: number;            // recipients (first capture)
  n2: number;            // nominators (second capture)
  m: number;             // overlap (recaptured)
  chapmanEstimate: number;
  standardError: number;
  ci95: [number, number];
  sensitivity: { k: number; estimate: number }[];
  assumptions: string[];
}

export interface NetworkEstimate {
  totalEdges: number;
  uniquePairs: number;
  uniqueNodes: number;
  density: number;
  selfLoops: number;
  reciprocalPairs: number;
  avgDegree: number;
}

export interface ParticipationRate {
  label: string;
  population: number;
  awardsPerPerson: number;
}

export interface PopulationEstimate {
  titleCount: TitleCountEstimate;
  captureRecapture: CaptureRecaptureEstimate;
  network: NetworkEstimate;
  recommended: {
    low: number;
    mid: number;
    high: number;
    method: string;
  };
  participationRates: ParticipationRate[];
}

// ── Computation ──

function computeTitleCount(raw: RawData): TitleCountEstimate {
  const n1 = raw.recipient_title.unique_count;
  const n2 = raw.nominator_title.unique_count;

  // Compute overlap from titles appearing in both top lists
  // This is approximate — full overlap requires the raw data
  const recipSet = new Set(raw.recipient_title.top_15_titles.map(([t]) => t));
  const nomSet = new Set(raw.nominator_title.top_15_titles.map(([t]) => t));

  // Count overlap in top titles, then scale to full population
  let topOverlap = 0;
  for (const t of recipSet) {
    if (nomSet.has(t)) topOverlap++;
  }

  // Scale: if X% of top-15 overlap, estimate similar ratio for full set
  const topOverlapRate = topOverlap / Math.min(recipSet.size, nomSet.size);
  const estimatedOverlap = Math.round(topOverlapRate * Math.min(n1, n2));

  // If interactions data has self_recognition, that's a better overlap signal
  const overlapFromSelf = raw.interactions.self_recognition_count > 0
    ? Math.round(Math.min(n1, n2) * 0.3) // conservative estimate
    : estimatedOverlap;

  const overlap = Math.max(estimatedOverlap, overlapFromSelf, 1);
  const totalUnique = n1 + n2 - overlap;

  return {
    uniqueRecipients: n1,
    uniqueNominators: n2,
    totalUnique,
    overlap,
    overlapPct: +((overlap / Math.min(n1, n2)) * 100).toFixed(1),
  };
}

function computeCaptureRecapture(
  titleCount: TitleCountEstimate
): CaptureRecaptureEstimate {
  const { uniqueRecipients: n1, uniqueNominators: n2, overlap: m } = titleCount;

  // Chapman estimator (bias-corrected Lincoln-Petersen)
  // N̂ = ((n1 + 1)(n2 + 1) / (m + 1)) - 1
  const chapmanEstimate = ((n1 + 1) * (n2 + 1)) / (m + 1) - 1;

  // Variance (Chapman)
  // Var(N̂) = ((n1+1)(n2+1)(n1-m)(n2-m)) / ((m+1)²(m+2))
  const variance =
    ((n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m)) /
    ((m + 1) ** 2 * (m + 2));

  const se = Math.sqrt(variance);

  // 95% CI — floor at max(n1, n2) since we can't have fewer than observed
  const ciLow = Math.max(chapmanEstimate - 1.96 * se, Math.max(n1, n2));
  const ciHigh = chapmanEstimate + 1.96 * se;

  // Sensitivity: if each title maps to k people on average
  const sensitivity = [1.0, 1.25, 1.5, 2.0, 2.5].map((k) => ({
    k,
    estimate: Math.round(chapmanEstimate * k),
  }));

  return {
    n1,
    n2,
    m,
    chapmanEstimate: Math.round(chapmanEstimate),
    standardError: Math.round(se),
    ci95: [Math.round(ciLow), Math.round(ciHigh)],
    sensitivity,
    assumptions: [
      "Population is closed (no joiners/leavers during data period)",
      "Each individual has equal probability of appearing as recipient or nominator",
      "The two captures (recipient, nominator) are independent",
      "Job titles map 1:1 to individuals (sensitivity analysis relaxes this)",
    ],
  };
}

function computeNetwork(raw: RawData): NetworkEstimate {
  const inter = raw.interactions;
  const nodes = Math.max(inter.unique_recipients, inter.unique_nominators);
  const avgDegree = (2 * inter.unique_pairs) / nodes;

  return {
    totalEdges: inter.total_interactions,
    uniquePairs: inter.unique_pairs,
    uniqueNodes: inter.unique_recipients + inter.unique_nominators,
    density: inter.unique_pairs / (inter.unique_recipients * inter.unique_nominators),
    selfLoops: inter.self_recognition_count,
    reciprocalPairs: inter.bidirectional_pairs,
    avgDegree: +avgDegree.toFixed(1),
  };
}

export default function estimatePopulation(raw: RawData): PopulationEstimate {
  const titleCount = computeTitleCount(raw);
  const captureRecapture = computeCaptureRecapture(titleCount);
  const network = computeNetwork(raw);

  const cr = captureRecapture;

  const recommended = {
    low: cr.ci95[0],
    mid: cr.chapmanEstimate,
    high: cr.ci95[1],
    method: "Chapman estimator (bias-corrected Lincoln-Petersen) with 95% CI",
  };

  const participationRates: ParticipationRate[] = [
    {
      label: "Lower bound (unique titles)",
      population: titleCount.totalUnique,
      awardsPerPerson: +(raw.basic.total_rows / titleCount.totalUnique).toFixed(1),
    },
    {
      label: "Central estimate (Chapman)",
      population: cr.chapmanEstimate,
      awardsPerPerson: +(raw.basic.total_rows / cr.chapmanEstimate).toFixed(1),
    },
    {
      label: "Upper bound (95% CI)",
      population: cr.ci95[1],
      awardsPerPerson: +(raw.basic.total_rows / cr.ci95[1]).toFixed(1),
    },
  ];

  return {
    titleCount,
    captureRecapture,
    network,
    recommended,
    participationRates,
  };
}