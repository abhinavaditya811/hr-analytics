import argparse
import time

import config as cfg
from utils import save_json, ensure_dir, get_logger

logger = get_logger("pipeline")


def setup_run(run_name: str = None, provider: str = None):
    """
    Apply runtime overrides BEFORE any phase modules are imported.

    Args:
        run_name:  If set, redirect outputs to outputs/runs/<run_name>/
        provider:  If set, force this LLM provider ("claude" or "gemini")
    """
    if run_name:
        cfg.OUTPUT_DIR = cfg.PROJECT_ROOT / "outputs" / "runs" / run_name
        cfg.P2_CHECKPOINT_DIR = cfg.OUTPUT_DIR / "checkpoints"
        logger.info(f"Run name: {run_name}")
        logger.info(f"Output redirected to: {cfg.OUTPUT_DIR}")

    if provider:
        cfg.LLM_PROVIDER_PRIORITY = [provider]
        logger.info(f"Provider forced to: {provider}")


def run_phase_1():
    """Seed taxonomy with LLM."""
    logger.info("=" * 60)
    logger.info(f"PHASE 1: {cfg.LLM_PROVIDER_PRIORITY[0].title()} Discovers Taxonomy")
    logger.info("=" * 60)

    from phase_1_seed import run as phase_1_run
    return phase_1_run()


def run_phase_2(taxonomy: dict = None):
    """Bulk classify with local SLM."""
    logger.info("=" * 60)
    logger.info("PHASE 2: Llama Bulk Classification")
    logger.info("=" * 60)

    from phase_2_bulk import run as phase_2_run
    return phase_2_run(taxonomy=taxonomy)


def run_phase_3(taxonomy: dict = None, candidates: dict = None):
    """Finalize taxonomy with LLM."""
    logger.info("=" * 60)
    logger.info(f"PHASE 3: {cfg.LLM_PROVIDER_PRIORITY[0].title()} Finalizes Taxonomy")
    logger.info("=" * 60)

    from phase_3_finalize import run as phase_3_run
    return phase_3_run(taxonomy=taxonomy, candidates=candidates)


def run_full(skip_phase2: bool = False):
    """Execute the complete pipeline."""
    ensure_dir(cfg.OUTPUT_DIR)
    start = time.time()

    logger.info("=" * 60)
    logger.info("TAXONOMY REFINEMENT PIPELINE")
    logger.info("=" * 60)
    logger.info(f"Data:   {cfg.AWARDS_CSV}")
    logger.info(f"Output: {cfg.OUTPUT_DIR}")
    logger.info(f"LLM priority: {cfg.LLM_PROVIDER_PRIORITY}")
    logger.info(f"Phase 1 models: {cfg.P1_MODELS}")
    logger.info(f"Phase 2 model: {cfg.P2_MODEL} (local Ollama)")
    logger.info(f"Phase 3 models: {cfg.P3_MODELS}")
    logger.info("=" * 60)

    # Phase 1
    t1 = time.time()
    taxonomy = run_phase_1()
    logger.info(f"Phase 1 completed in {time.time() - t1:.1f}s\n")

    # Phase 2
    candidates = {}
    if not skip_phase2:
        t2 = time.time()
        _, candidates = run_phase_2(taxonomy=taxonomy)
        logger.info(f"Phase 2 completed in {time.time() - t2:.1f}s\n")
    else:
        logger.info("Phase 2 skipped (--skip-phase2 flag)")
        logger.info("Phase 3 will finalize Phase 1 taxonomy without new candidates\n")

    # Phase 3
    t3 = time.time()
    final = run_phase_3(taxonomy=taxonomy, candidates=candidates)
    logger.info(f"Phase 3 completed in {time.time() - t3:.1f}s\n")

    # Summary
    elapsed = time.time() - start
    final_cats = final.get("final_taxonomy", {}).get("categories", [])
    changes = final.get("changes", [])

    summary = {
        "pipeline": {
            "total_time_seconds": round(elapsed, 1),
            "phases_run": [1, 3] if skip_phase2 else [1, 2, 3],
            "llm_provider_priority": cfg.LLM_PROVIDER_PRIORITY,
            "phase_1_models": cfg.P1_MODELS,
            "phase_2_model": cfg.P2_MODEL if not skip_phase2 else "skipped",
            "phase_3_models": cfg.P3_MODELS,
        },
        "results": {
            "final_categories": len(final_cats),
            "total_subcategories": sum(
                len(c.get("subcategories", [])) for c in final_cats
            ),
            "candidates_found": len(candidates),
            "changes_applied": len(changes),
        },
    }

    save_json(summary, cfg.OUTPUT_DIR / "pipeline_summary.json", "Pipeline summary")

    logger.info("=" * 60)
    logger.info("PIPELINE COMPLETE")
    logger.info("=" * 60)
    logger.info(f"  Time:           {elapsed:.1f}s")
    logger.info(f"  Final categories: {len(final_cats)}")
    logger.info(f"  Changes applied:  {len(changes)}")
    logger.info(f"  Outputs in:     {cfg.OUTPUT_DIR}")
    logger.info("=" * 60)

    return final


def main():
    parser = argparse.ArgumentParser(
        description="Taxonomy Refinement Pipeline",
    )
    parser.add_argument(
        "--phase",
        type=int,
        choices=[1, 2, 3],
        help="Run only a specific phase (default: run all)",
    )
    parser.add_argument(
        "--skip-phase2",
        action="store_true",
        help="Skip Phase 2 (useful if Ollama not available)",
    )
    parser.add_argument(
        "--run-name",
        type=str,
        default=None,
        help="Save outputs to outputs/runs/<name>/ for comparison",
    )
    parser.add_argument(
        "--provider",
        type=str,
        choices=["claude", "gemini"],
        default=None,
        help="Force a specific LLM provider (overrides config priority)",
    )
    args = parser.parse_args()

    # Apply runtime overrides BEFORE importing phase modules
    setup_run(run_name=args.run_name, provider=args.provider)

    ensure_dir(cfg.OUTPUT_DIR)

    if args.phase == 1:
        run_phase_1()
    elif args.phase == 2:
        run_phase_2()
    elif args.phase == 3:
        run_phase_3()
    else:
        run_full(skip_phase2=args.skip_phase2)


if __name__ == "__main__":
    main()