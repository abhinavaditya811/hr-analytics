/**
 * Type definitions for the employee estimation dashboard.
 * Mirrors the JSON schema produced by estimate_employees.py.
 */

// ── Raw JSON shape (input) ──

export interface RawData {
  basic: {
    total_rows: number;
    total_columns: number;
    columns: string[];
    null_counts: Record<string, number>;
    empty_string_counts: Record<string, number>;
  };
  message: {
    count: number;
    null_count: number;
    char_length: {
      mean: number;
      median: number;
      std: number;
      min: number;
      max: number;
      p5: number;
      p25: number;
      p75: number;
      p95: number;
    };
    word_count: {
      mean: number;
      median: number;
      min: number;
      max: number;
    };
    shortest_messages: string[];
    longest_messages_preview: string[];
  };
  award_title: {
    count: number;
    null_count: number;
    empty_count: number;
    unique_count: number;
    top_10_titles: [string, number][];
    title_length: {
      mean: number;
      median: number;
      max: number;
    };
  };
  recipient_title: TitleSection;
  nominator_title: TitleSection;
  interactions: Interactions;
}

export interface TitleSection {
  label: string;
  count: number;
  null_count: number;
  unique_count: number;
  top_15_titles: [string, number][];
  seniority_distribution: Record<string, number>;
}

export interface InteractionPair {
  nominator: string;
  recipient: string;
  count: number;
}

export interface Interactions {
  total_interactions: number;
  unique_pairs: number;
  unique_recipients: number;
  unique_nominators: number;
  self_recognition_count: number;
  bidirectional_pairs: number;
  top_10_pairs: InteractionPair[];
}

// ── Processed data (output of processData) ──

export interface SeniorityRow {
  level: string;
  recipients: number;
  nominators: number;
}

export interface DeptRow {
  dept: string;
  count: number;
}

export interface BarRow {
  name: string;
  fullName: string;
  count: number;
  dept: string;
}

export interface NetworkNode {
  id: string;
  received: number;
  given: number;
  dept: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  value: number;
}

export interface HeatmapData {
  labels: string[];
  matrix: number[][];
}

export interface ProcessedData {
  seniorityData: SeniorityRow[];
  deptData: DeptRow[];
  heatmap: HeatmapData;
  network: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  };
  recipBarData: BarRow[];
  nomBarData: BarRow[];
}

export type DeptColorMap = Record<string, string>;

// ── Taxonomy ──

export interface TaxonomySubcategory {
  id: string;
  name: string;
  description: string;
  examples?: string[];
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  description: string;
  subcategories: TaxonomySubcategory[];
}

export interface Taxonomy {
  categories: TaxonomyCategory[];
  reasoning?: string;
}

// ── Phase 2 classification data ──

export interface Classification {
  batch: number;
  category: string | null;
  subcategory: string | null;
  themes: string[];
  new_category: string | null;
}

export interface CandidateCategory {
  name: string;
  count: number;
}

export interface Phase2Data {
  metadata: {
    phase: number;
    total_messages: number;
    total_classified: number;
    batch_size: number;
    model: string;
  };
  classifications: Classification[];
  candidate_categories: Record<string, number>;
}

// ── Processed Phase 2 analysis ──

export interface CategoryCount {
  category: string;
  count: number;
  pct: number;
  isValid: boolean;
}

export interface SubcategoryFormat {
  format: string;
  count: number;
  example: string;
}

export interface BatchHealth {
  batch: number;
  classified: number;
  malformed: number;
  expected: number;
}

export interface Phase2Analysis {
  totalClassified: number;
  totalMessages: number;
  successRate: number;
  categoryDistribution: CategoryCount[];
  validCategories: string[];
  malformedCount: number;
  malformedPct: number;
  subcategoryFormats: SubcategoryFormat[];
  subcategoryNullCount: number;
  batchHealth: BatchHealth[];
  missingBatches: number[];
  topThemes: { theme: string; count: number }[];
  candidateCategories: CandidateCategory[];
  c4BiasScore: number;
  biasCategory: string;
}

// ── Pipeline Run (one per LLM approach) ──

export interface PipelineSummary {
  pipeline?: {
    total_time_seconds: number;
    phases_run: number[];
    llm_provider_priority?: string[];
    phase_1_models?: Record<string, string>;
    phase_2_model?: string;
    phase_3_models?: Record<string, string>;
  };
  results?: {
    final_categories: number;
    total_subcategories: number;
    candidates_found: number;
    changes_applied: number;
  };
}

export interface PipelineRun {
  name: string;
  taxonomy?: Taxonomy;
  phase2?: Phase2Data;
  summary?: PipelineSummary;
}

// ── Cross-Pipeline Comparison ──

export interface PipelineScore {
  pipeline: string;
  successRate: number;
  malformedPct: number;
  biasScore: number;
  formatConsistency: number; // % correct subcategory format
  categoryCount: number;
  subcategoryCount: number;
  timeSeconds: number;
  candidatesFound: number;
}

export interface CategoryOverlap {
  category: string;
  pipelines: Record<string, number>; // pipeline name → count
}

export interface TaxonomyDiff {
  categoryId: string;
  categoryName: string;
  presentIn: string[]; // which pipelines have this category
  missingFrom: string[];
}

export interface ComparisonData {
  pipelines: string[];
  scores: PipelineScore[];
  categoryOverlap: CategoryOverlap[];
  taxonomyDiff: TaxonomyDiff[];
  radarMetrics: { metric: string; fullMark: number; [pipeline: string]: number | string }[];
}