"""
run_comparison.py — Run the taxonomy pipeline with multiple LLM configurations.

Creates separate output directories under outputs/runs/ so the dashboard's
Pipeline Comparison tab can display side-by-side analysis.

Usage:
    python run_comparison.py              # Run all configured pipelines
    python run_comparison.py --dry-run    # Show what would run without executing
"""

import subprocess
import sys
import time
from pathlib import Path

# ── Pipeline configurations to compare ──
# Each entry produces a separate run in outputs/runs/<name>/

RUNS = [
    {
        "name": "gemini_with_llama",
        "description": "Gemini (Phase 1+3) + Llama3 local (Phase 2)",
        "provider": "gemini",
        "skip_phase2": False,
    },
    {
        "name": "gemini_only",
        "description": "Gemini only (Phase 1+3, skip Phase 2)",
        "provider": "gemini",
        "skip_phase2": True,
    },
]

PIPELINE_SCRIPT = Path(__file__).parent / "run_pipeline.py"


def build_command(run_config: dict) -> list[str]:
    """Build the CLI command for a single pipeline run."""
    cmd = [
        sys.executable, str(PIPELINE_SCRIPT),
        "--run-name", run_config["name"],
        "--provider", run_config["provider"],
    ]
    if run_config.get("skip_phase2"):
        cmd.append("--skip-phase2")
    return cmd


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run multiple pipeline configurations")
    parser.add_argument("--dry-run", action="store_true", help="Show commands without executing")
    args = parser.parse_args()

    print("=" * 70)
    print("MULTI-PIPELINE COMPARISON RUNNER")
    print("=" * 70)
    print(f"Configurations: {len(RUNS)}")
    for i, run in enumerate(RUNS, 1):
        print(f"  {i}. {run['name']}: {run['description']}")
    print("=" * 70)

    if args.dry_run:
        print("\n[DRY RUN] Commands that would be executed:\n")
        for run in RUNS:
            cmd = build_command(run)
            print(f"  {' '.join(cmd)}\n")
        return

    results = []
    total_start = time.time()

    for i, run_config in enumerate(RUNS, 1):
        name = run_config["name"]
        print(f"\n{'─' * 70}")
        print(f"  RUN {i}/{len(RUNS)}: {name}")
        print(f"  {run_config['description']}")
        print(f"{'─' * 70}\n")

        cmd = build_command(run_config)
        start = time.time()

        try:
            result = subprocess.run(
                cmd,
                cwd=str(PIPELINE_SCRIPT.parent),
                check=True,
            )
            elapsed = time.time() - start
            results.append({"name": name, "status": "OK", "time": round(elapsed, 1)})
            print(f"\n  ✓ {name} completed in {elapsed:.1f}s")

        except subprocess.CalledProcessError as e:
            elapsed = time.time() - start
            results.append({"name": name, "status": "FAILED", "time": round(elapsed, 1)})
            print(f"\n  ✗ {name} failed after {elapsed:.1f}s (exit code {e.returncode})")

    # Summary
    total_elapsed = time.time() - total_start
    print(f"\n{'=' * 70}")
    print("COMPARISON COMPLETE")
    print(f"{'=' * 70}")
    print(f"  Total time: {total_elapsed:.1f}s\n")

    for r in results:
        icon = "✓" if r["status"] == "OK" else "✗"
        print(f"  {icon} {r['name']}: {r['status']} ({r['time']}s)")

    ok_count = sum(1 for r in results if r["status"] == "OK")
    print(f"\n  {ok_count}/{len(results)} runs succeeded")
    print(f"  Results saved to: outputs/runs/")
    print(f"\n  Start the dashboard to compare:")
    print(f"    cd ../employee-dashboard && npm run dev")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
