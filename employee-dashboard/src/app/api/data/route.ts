import { NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const BASE_PATH = path.resolve(process.cwd(), "..", "outputs");
const RUNS_PATH = path.join(BASE_PATH, "runs");

const EDA_PATH = path.join(BASE_PATH, "reports", "eda_report.json");

// Files we look for in each run folder
const RUN_FILES = {
  taxonomy: "final_taxonomy.json",
  phase2: "phase_2_results.json",
  summary: "pipeline_summary.json",
};

async function loadJson(filepath: string): Promise<unknown | null> {
  try {
    if (!existsSync(filepath)) return null;
    const raw = await readFile(filepath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadRuns(): Promise<Record<string, Record<string, unknown>>> {
  const runs: Record<string, Record<string, unknown>> = {};

  if (!existsSync(RUNS_PATH)) return runs;

  const entries = await readdir(RUNS_PATH);

  for (const entry of entries) {
    const dirPath = path.join(RUNS_PATH, entry);
    const info = await stat(dirPath);
    if (!info.isDirectory()) continue;

    const runData: Record<string, unknown> = { name: entry };
    let hasData = false;

    for (const [key, filename] of Object.entries(RUN_FILES)) {
      const data = await loadJson(path.join(dirPath, filename));
      if (data) {
        runData[key] = data;
        hasData = true;
      }
    }

    if (hasData) {
      runs[entry] = runData;
    }
  }

  return runs;
}

export async function GET() {
  console.log("[api/data] cwd:", process.cwd());
  console.log("[api/data] BASE_PATH:", BASE_PATH);
  console.log("[api/data] RUNS_PATH:", RUNS_PATH);

  try {
    const result: Record<string, unknown> = { found: false };

    // Load EDA report
    const eda = await loadJson(EDA_PATH);
    if (eda) {
      result.eda = eda;
      result.found = true;
    }

    // Load all pipeline runs
    const runs = await loadRuns();
    if (Object.keys(runs).length > 0) {
      result.runs = runs;
      result.found = true;
      console.log(`[api/data] Found ${Object.keys(runs).length} pipeline runs: ${Object.keys(runs).join(", ")}`);
    } else {
      console.log("[api/data] No pipeline runs found in", RUNS_PATH);

      // Fallback: try loading from root outputs (legacy single-run format)
      const taxonomy = await loadJson(path.join(BASE_PATH, "final_taxonomy.json"));
      const phase2 = await loadJson(path.join(BASE_PATH, "phase_2_results.json"));
      const summary = await loadJson(path.join(BASE_PATH, "pipeline_summary.json"));

      if (taxonomy || phase2) {
        result.runs = {
          default: {
            name: "default",
            taxonomy: taxonomy,
            phase2: phase2,
            summary: summary,
          },
        };
        result.found = true;
        console.log("[api/data] Loaded legacy single-run format as 'default'");
      }
    }

    if (!result.found) {
      return NextResponse.json(
        { found: false, error: "No data files found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { found: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}