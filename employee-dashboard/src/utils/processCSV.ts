import type { RawData, InteractionPair } from "../types/dashboard";

interface CsvRow {
  message: string;
  award_title: string;
  recipient_title: string;
  nominator_title: string;
}

// ── Helpers ──

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function topN(counter: Record<string, number>, n: number): [string, number][] {
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function countValues(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) {
    const trimmed = v.trim();
    if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
  }
  return counts;
}

// ── Seniority extraction ──

const SENIORITY_PATTERNS: [RegExp, string][] = [
  [/\bVice President\b/i, "Vice President"],
  [/\bVP\b/, "VP"],
  [/\bDirector\b/i, "Director"],
  [/\bPrincipal\b/i, "Principal"],
  [/\bSenior Manager\b/i, "Manager"],    // "Senior Manager" → Manager seniority
  [/\bSenior\b/i, "Senior"],
  [/\bLead\b/i, "Lead"],
  [/\bManager\b/i, "Manager"],
  [/\bAssociate\b/i, "Associate"],
  [/\bJunior\b/i, "Junior"],
];

function extractSeniority(title: string): string | null {
  for (const [pattern, level] of SENIORITY_PATTERNS) {
    if (pattern.test(title)) return level;
  }
  return null;
}

function buildSeniorityDist(titles: string[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const t of titles) {
    const level = extractSeniority(t);
    if (level) dist[level] = (dist[level] || 0) + 1;
  }
  return dist;
}

// ── Main processor ──

export default function processCSVToRawData(rows: CsvRow[]): RawData {
  const messages = rows.map((r) => r.message || "");
  const awardTitles = rows.map((r) => r.award_title || "");
  const recipTitles = rows.map((r) => r.recipient_title || "");
  const nomTitles = rows.map((r) => r.nominator_title || "");

  // ── basic ──
  const nullCounts: Record<string, number> = {
    message: messages.filter((m) => !m.trim()).length,
    award_title: awardTitles.filter((t) => !t.trim()).length,
    recipient_title: recipTitles.filter((t) => !t.trim()).length,
    nominator_title: nomTitles.filter((t) => !t.trim()).length,
  };

  // ── message stats ──
  const validMessages = messages.filter((m) => m.trim());
  const charLengths = validMessages.map((m) => m.length).sort((a, b) => a - b);
  const wordCounts = validMessages.map((m) => m.split(/\s+/).filter(Boolean).length);
  const wordCountsSorted = [...wordCounts].sort((a, b) => a - b);

  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const std = (arr: number[], avg: number) =>
    Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);

  const charMean = mean(charLengths);

  // Sort messages by length for shortest/longest
  const sortedByLen = [...validMessages].sort((a, b) => a.length - b.length);

  // ── award_title stats ──
  const validAwards = awardTitles.filter((t) => t.trim());
  const awardCounts = countValues(validAwards);
  const awardLengths = validAwards.map((t) => t.length);

  // ── recipient_title stats ──
  const validRecip = recipTitles.filter((t) => t.trim());
  const recipCounts = countValues(validRecip);

  // ── nominator_title stats ──
  const validNom = nomTitles.filter((t) => t.trim());
  const nomCounts = countValues(validNom);

  // ── interactions ──
  const pairKey = (nom: string, recip: string) => `${nom.trim()}|||${recip.trim()}`;

  const pairCounts: Record<string, { nominator: string; recipient: string; count: number }> = {};

  for (const row of rows) {
    const nom = (row.nominator_title || "").trim();
    const recip = (row.recipient_title || "").trim();
    if (!nom || !recip) continue;

    const key = pairKey(nom, recip);
    if (!pairCounts[key]) {
      pairCounts[key] = { nominator: nom, recipient: recip, count: 0 };
    }
    pairCounts[key].count++;
  }

  const allPairs = Object.values(pairCounts);
  const uniquePairs = allPairs.length;

  // Self-recognition
  const selfCount = allPairs
    .filter((p) => p.nominator === p.recipient)
    .reduce((s, p) => s + p.count, 0);

  // Bidirectional: A→B exists AND B→A exists
  const pairSet = new Set(Object.keys(pairCounts));
  let biCount = 0;
  for (const p of allPairs) {
    const reverseKey = pairKey(p.recipient, p.nominator);
    if (pairSet.has(reverseKey) && p.nominator !== p.recipient) {
      biCount++;
    }
  }
  biCount = Math.floor(biCount / 2); // each pair counted twice

  const topPairs: InteractionPair[] = allPairs
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Assemble RawData ──
  return {
    basic: {
      total_rows: rows.length,
      total_columns: 4,
      columns: ["message", "award_title", "recipient_title", "nominator_title"],
      null_counts: nullCounts,
      empty_string_counts: nullCounts, // same check for CSV
    },
    message: {
      count: validMessages.length,
      null_count: nullCounts.message,
      char_length: {
        mean: +charMean.toFixed(1),
        median: +percentile(charLengths, 50).toFixed(1),
        std: +std(charLengths, charMean).toFixed(1),
        min: charLengths[0] || 0,
        max: charLengths[charLengths.length - 1] || 0,
        p5: +percentile(charLengths, 5).toFixed(1),
        p25: +percentile(charLengths, 25).toFixed(1),
        p75: +percentile(charLengths, 75).toFixed(1),
        p95: +percentile(charLengths, 95).toFixed(1),
      },
      word_count: {
        mean: +mean(wordCounts).toFixed(1),
        median: +percentile(wordCountsSorted, 50).toFixed(1),
        min: wordCountsSorted[0] || 0,
        max: wordCountsSorted[wordCountsSorted.length - 1] || 0,
      },
      shortest_messages: sortedByLen.slice(0, 5),
      longest_messages_preview: sortedByLen
        .slice(-5)
        .reverse()
        .map((m) => m.slice(0, 110) + (m.length > 110 ? "..." : "")),
    },
    award_title: {
      count: validAwards.length,
      null_count: nullCounts.award_title,
      empty_count: nullCounts.award_title,
      unique_count: Object.keys(awardCounts).length,
      top_10_titles: topN(awardCounts, 10),
      title_length: {
        mean: +(mean(awardLengths) || 0).toFixed(1),
        median: +percentile(awardLengths.sort((a, b) => a - b), 50).toFixed(1),
        max: awardLengths.length ? Math.max(...awardLengths) : 0,
      },
    },
    recipient_title: {
      label: "Recipient",
      count: validRecip.length,
      null_count: nullCounts.recipient_title,
      unique_count: Object.keys(recipCounts).length,
      top_15_titles: topN(recipCounts, 15),
      seniority_distribution: buildSeniorityDist(validRecip),
    },
    nominator_title: {
      label: "Nominator",
      count: validNom.length,
      null_count: nullCounts.nominator_title,
      unique_count: Object.keys(nomCounts).length,
      top_15_titles: topN(nomCounts, 15),
      seniority_distribution: buildSeniorityDist(validNom),
    },
    interactions: {
      total_interactions: rows.filter(
        (r) => r.nominator_title?.trim() && r.recipient_title?.trim()
      ).length,
      unique_pairs: uniquePairs,
      unique_recipients: Object.keys(recipCounts).length,
      unique_nominators: Object.keys(nomCounts).length,
      self_recognition_count: selfCount,
      bidirectional_pairs: biCount,
      top_10_pairs: topPairs,
    },
  };
}