/**
 * processPhase2.ts
 *
 * Analyzes Phase 2 classification results for quality metrics.
 * Surfaces the issues: C4 bias, malformed IDs, subcategory inconsistency.
 */

import type {
  Phase2Data, Phase2Analysis, CategoryCount,
  SubcategoryFormat, BatchHealth, CandidateCategory,
  Taxonomy,
} from "../types/dashboard";

function extractValidIds(taxonomy: Taxonomy): { categories: Set<string>; subcategories: Set<string> } {
  const categories = new Set<string>();
  const subcategories = new Set<string>();

  for (const cat of taxonomy.categories) {
    categories.add(cat.id);
    for (const sub of cat.subcategories) {
      subcategories.add(sub.id);
    }
  }

  return { categories, subcategories };
}

function isValidCategory(cat: string | null, validIds: Set<string>): boolean {
  if (!cat) return false;
  return validIds.has(cat.trim());
}

function detectSubcategoryFormat(sub: string | null, validSubIds: Set<string>): string {
  if (!sub || sub === "null" || sub === "None" || sub === "N/A") return "Null / Empty";
  const s = sub.trim();
  if (validSubIds.has(s)) return "Correct (matches taxonomy)";
  if (/^[A-Z]$/.test(s)) return "Letter only (A, B, C)";
  if (/^[A-Z]\d$/.test(s)) return "Letter+number (A1, B2)";
  if (/^[A-Z]\d[a-z]$/.test(s)) return "Alt prefix (A2b, B1a)";
  if (/^[a-z]$/.test(s)) return "Lowercase letter (a, b, c)";
  // Looks like a category ID used as subcategory
  const isCatId = [...validSubIds].some((vid) => {
    const catPart = vid.replace(/[a-z]+$/, "");
    return s === catPart;
  });
  if (isCatId) return "Category ID as subcategory";
  // Cross-category subcategory (e.g. C1a used under C4)
  if (validSubIds.size > 0) {
    const allCatPrefixes = new Set([...validSubIds].map((v) => v.replace(/[a-z]+$/, "")));
    for (const prefix of allCatPrefixes) {
      if (s.startsWith(prefix) && s.length > prefix.length) {
        return "Wrong category prefix";
      }
    }
  }
  return "Other / Unrecognized";
}

export default function processPhase2(data: Phase2Data, taxonomy?: Taxonomy): Phase2Analysis {
  const { classifications: clf, metadata, candidate_categories } = data;

  // ── Derive valid IDs from taxonomy ──
  const validIds = taxonomy
    ? extractValidIds(taxonomy)
    : { categories: new Set(["C1", "C2", "C3", "C4", "C5", "C6"]), subcategories: new Set<string>() };

  const validCatArray = [...validIds.categories];

  // ── Category distribution ──
  const catCounts: Record<string, number> = {};
  let malformed = 0;

  for (const c of clf) {
    const cat = c.category?.trim() || "";
    if (isValidCategory(cat, validIds.categories)) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    } else {
      catCounts[cat || "(empty)"] = (catCounts[cat || "(empty)"] || 0) + 1;
      malformed++;
    }
  }

  const categoryDistribution: CategoryCount[] = Object.entries(catCounts)
    .map(([category, count]) => ({
      category,
      count,
      pct: +((count / clf.length) * 100).toFixed(1),
      isValid: isValidCategory(category, validIds.categories),
    }))
    .sort((a, b) => b.count - a.count);

  // ── Subcategory format analysis ──
  const formatCounts: Record<string, { count: number; example: string }> = {};
  let subNullCount = 0;

  for (const c of clf) {
    const fmt = detectSubcategoryFormat(c.subcategory, validIds.subcategories);
    if (fmt === "Null / Empty") subNullCount++;
    if (!formatCounts[fmt]) {
      formatCounts[fmt] = { count: 0, example: c.subcategory || "(null)" };
    }
    formatCounts[fmt].count++;
  }

  const subcategoryFormats: SubcategoryFormat[] = Object.entries(formatCounts)
    .map(([format, { count, example }]) => ({ format, count, example }))
    .sort((a, b) => b.count - a.count);

  // ── Batch health ──
  const batchMap: Record<number, { classified: number; malformed: number }> = {};
  const totalBatches = Math.ceil(metadata.total_messages / metadata.batch_size);

  for (const c of clf) {
    if (!batchMap[c.batch]) batchMap[c.batch] = { classified: 0, malformed: 0 };
    batchMap[c.batch].classified++;
    if (!isValidCategory(c.category, validIds.categories)) batchMap[c.batch].malformed++;
  }

  const batchHealth: BatchHealth[] = [];
  const missingBatches: number[] = [];

  for (let i = 0; i < totalBatches; i++) {
    if (batchMap[i]) {
      batchHealth.push({
        batch: i,
        classified: batchMap[i].classified,
        malformed: batchMap[i].malformed,
        expected: metadata.batch_size,
      });
    } else {
      missingBatches.push(i);
    }
  }

  // ── Theme analysis ──
  const themeCounts: Record<string, number> = {};
  for (const c of clf) {
    for (const t of c.themes || []) {
      const normalized = t.toLowerCase().trim().replace(/_/g, " ");
      if (normalized) themeCounts[normalized] = (themeCounts[normalized] || 0) + 1;
    }
  }

  const topThemes = Object.entries(themeCounts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // ── Candidate categories ──
  const candidateCategories: CandidateCategory[] = Object.entries(candidate_categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── Bias score: how much the top category exceeds expected uniform ──
  const validOnlyCounts = categoryDistribution.filter((c) => c.isValid);
  const expectedUniform = clf.length / validCatArray.length;
  const topCategory = validOnlyCounts[0];
  const biasScore = topCategory
    ? +((topCategory.count / expectedUniform - 1) * 100).toFixed(1)
    : 0;
  const biasCategory = topCategory?.category || "";

  return {
    totalClassified: metadata.total_classified,
    totalMessages: metadata.total_messages,
    successRate: +((metadata.total_classified / metadata.total_messages) * 100).toFixed(1),
    categoryDistribution,
    validCategories: validCatArray,
    malformedCount: malformed,
    malformedPct: +((malformed / clf.length) * 100).toFixed(1),
    subcategoryFormats,
    subcategoryNullCount: subNullCount,
    batchHealth,
    missingBatches,
    topThemes,
    candidateCategories,
    c4BiasScore: biasScore,
    biasCategory,
  };
}