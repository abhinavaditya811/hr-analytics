"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import type { RawData, Phase2Data, Taxonomy, PipelineRun } from "../types/dashboard";
import processCSVToRawData from "../utils/processCSV";

interface AppData {
  eda: RawData;
  runs: PipelineRun[];
}

interface Props {
  onLoad: (data: AppData) => void;
}

type Status = "checking" | "not-found" | "parsing" | "error";

const REQUIRED_COLUMNS = ["message", "award_title", "recipient_title", "nominator_title"];

// ── CSV parsing (handles quoted fields with commas/newlines) ──

function parseCSV(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        current.push(field);
        field = "";
        if (current.some((f) => f.trim())) lines.push(current);
        current = [];
        if (ch === "\r") i++; // skip \r\n
      } else {
        field += ch;
      }
    }
  }
  // Last field/line
  current.push(field);
  if (current.some((f) => f.trim())) lines.push(current);

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.trim());
  return lines.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] || "").trim();
    });
    return obj;
  });
}

// ── Styles ──

const Wrapper = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
  color: #e2e8f0;
  font-family: "Inter", -apple-system, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Inner = styled.div`
  max-width: 560px;
  width: 100%;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  text-align: center;
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: #64748b;
  text-align: center;
  margin-bottom: 32px;
  font-size: 14px;
  line-height: 1.6;
`;

const Code = styled.code`
  background: rgba(99, 102, 241, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  color: #a5b4fc;
  font-size: 12px;
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  margin: 0 auto 16px;
`;

const StatusText = styled.p`
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
`;

const DropZone = styled.div<{ $active: boolean }>`
  border: 2px dashed ${(p) => (p.$active ? "#6366f1" : "rgba(255,255,255,0.12)")};
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${(p) => (p.$active ? "rgba(99,102,241,0.08)" : "rgba(0,0,0,0.15)")};

  &:hover {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(99, 102, 241, 0.05);
  }
`;

const DropLabel = styled.p`
  color: #94a3b8;
  font-size: 14px;
  margin-bottom: 8px;
`;

const DropSub = styled.p`
  color: #475569;
  font-size: 12px;
`;

const HiddenInput = styled.input`
  display: none;
`;

const ErrorBox = styled.div`
  color: #f87171;
  font-size: 13px;
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 12px;
  line-height: 1.5;
`;

const Columns = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 16px;
`;

const ColBadge = styled.span`
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
`;

// ── Component ──

export default function DataLoader({ onLoad }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check for existing JSON on mount
  useEffect(() => {
    async function checkFile() {
      try {
        const res = await fetch("/api/data");
        const json = await res.json();

        if (json.found && json.eda) {
          // Parse pipeline runs
          const runs: PipelineRun[] = [];
          if (json.runs && typeof json.runs === "object") {
            for (const [name, runData] of Object.entries(json.runs as Record<string, Record<string, unknown>>)) {
              let taxonomy = runData.taxonomy as Taxonomy | undefined;
              if (taxonomy && !taxonomy.categories) {
                const nested = taxonomy as unknown as { final_taxonomy?: Taxonomy };
                if (nested.final_taxonomy) taxonomy = nested.final_taxonomy;
              }
              runs.push({
                name,
                taxonomy,
                phase2: runData.phase2 as Phase2Data | undefined,
                summary: runData.summary as PipelineRun["summary"],
              });
            }
          }

          onLoad({
            eda: json.eda as RawData,
            runs,
          });
        } else {
          setStatus("not-found");
        }
      } catch {
        setStatus("not-found");
      }
    }
    checkFile();
  }, [onLoad]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a .csv file");
        return;
      }

      setStatus("parsing");
      setError("");

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const rows = parseCSV(text);

          if (rows.length === 0) {
            setError("CSV appears empty or could not be parsed");
            setStatus("not-found");
            return;
          }

          // Validate columns
          const headers = Object.keys(rows[0]);
          const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
          if (missing.length) {
            setError(
              `Missing required columns: ${missing.join(", ")}. ` +
              `Found: ${headers.join(", ")}`
            );
            setStatus("not-found");
            return;
          }

          const data = processCSVToRawData(
            rows as { message: string; award_title: string; recipient_title: string; nominator_title: string }[]
          );
          onLoad({ eda: data, runs: [] });
        } catch (err) {
          setError(`Failed to process CSV: ${(err as Error).message}`);
          setStatus("not-found");
        }
      };

      reader.onerror = () => {
        setError("Failed to read file");
        setStatus("not-found");
      };

      reader.readAsText(file);
    },
    [onLoad]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Checking state ──
  if (status === "checking") {
    return (
      <Wrapper>
        <Inner>
          <Spinner />
          <StatusText>Checking for existing report...</StatusText>
        </Inner>
      </Wrapper>
    );
  }

  // ── Parsing state ──
  if (status === "parsing") {
    return (
      <Wrapper>
        <Inner>
          <Spinner />
          <StatusText>Processing CSV...</StatusText>
        </Inner>
      </Wrapper>
    );
  }

  // ── Upload state ──
  return (
    <Wrapper>
      <Inner>
        <Title>Employee Estimation Dashboard</Title>
        <Subtitle>
          No report found at <Code>eda_report.json</Code>.
          <br />
          Upload your awards CSV to generate the dashboard.
        </Subtitle>

        <DropZone
          $active={dragActive}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <DropLabel>
            {dragActive ? "Drop CSV here" : "Drag and drop your CSV, or click to browse"}
          </DropLabel>
          <DropSub>.csv file with the following columns:</DropSub>
          <Columns>
            {REQUIRED_COLUMNS.map((col) => (
              <ColBadge key={col}>{col}</ColBadge>
            ))}
          </Columns>
        </DropZone>

        <HiddenInput
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
        />

        {error && <ErrorBox>{error}</ErrorBox>}
      </Inner>
    </Wrapper>
  );
}