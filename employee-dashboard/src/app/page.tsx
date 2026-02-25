"use client";

import { useState, useCallback } from "react";
import DataLoader from "../components/DataLoader";
import Dashboard from "../components/Dashboard";
import type { RawData, PipelineRun } from "../types/dashboard";

export interface AppData {
  eda: RawData;
  runs: PipelineRun[];
}

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);

  const handleLoad = useCallback((d: AppData) => setData(d), []);

  if (!data) {
    return <DataLoader onLoad={handleLoad} />;
  }

  return <Dashboard data={data.eda} runs={data.runs} />;
}