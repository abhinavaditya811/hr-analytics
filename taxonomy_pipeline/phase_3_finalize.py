"""
phase_3_finalize.py — Claude merges candidate categories into final taxonomy.

Input:  Phase 1 taxonomy + Phase 2 candidate new categories
Output: Final polished taxonomy saved to outputs/final_taxonomy.json
Cost:   ~5-10K tokens (lightweight review task)
"""

import json

import config as cfg
from utils import call_llm, extract_json, save_json, load_json, get_logger

logger = get_logger("phase_3")


def filter_candidates(
    candidates: dict[str, int],
    min_freq: int = None,
) -> dict[str, int]:
    """
    Keep only candidates that appeared frequently enough to matter.

    Returns filtered dict sorted by frequency descending.
    """
    min_freq = min_freq or cfg.P3_MIN_CANDIDATE_FREQ

    filtered = {
        name: count
        for name, count in candidates.items()
        if count >= min_freq
    }

    logger.info(
        f"Filtered candidates: {len(candidates)} total → "
        f"{len(filtered)} with freq >= {min_freq}"
    )

    return dict(sorted(filtered.items(), key=lambda x: x[1], reverse=True))


def build_prompt(taxonomy: dict, candidates: dict[str, int]) -> str:
    """Construct the finalization prompt for Claude."""
    tax_json = json.dumps(taxonomy, indent=2)
    cand_json = json.dumps(candidates, indent=2) if candidates else "{}"

    return f"""You are finalizing a taxonomy for employee recognition awards.

CURRENT TAXONOMY (from initial analysis of 100 sample messages):
{tax_json}

CANDIDATE NEW CATEGORIES (discovered by classifying all 1000 messages):
{cand_json}

Each candidate includes its frequency count (how many messages suggested it).

YOUR TASK:
1. Review each candidate category.
2. For each, decide ONE of:
   a) ADD — it's genuinely distinct from all existing categories
   b) MERGE — it overlaps with an existing category (specify which one)
   c) DISCARD — too vague, too rare, or a duplicate
3. If adding, assign it a proper ID, name, and description.
4. If merging, update the existing category's description to encompass it.
5. Ensure the final taxonomy has {cfg.P3_MAX_MAIN_CATEGORIES} or fewer
   main categories, each with 2-{cfg.P3_MAX_SUBCATEGORIES} subcategories.
6. Every category must have clear, non-overlapping boundaries.

Output ONLY valid JSON:
{{
  "final_taxonomy": {{
    "categories": [
      {{
        "id": "A",
        "name": "...",
        "description": "...",
        "subcategories": [
          {{
            "id": "A1",
            "name": "...",
            "description": "...",
            "examples": ["...", "..."]
          }}
        ]
      }}
    ]
  }},
  "changes": [
    {{
      "action": "add|merge|discard",
      "candidate": "candidate name",
      "target": "category ID (for merge) or new ID (for add)",
      "reason": "brief explanation"
    }}
  ],
  "summary": "2-3 sentences summarizing what changed and why"
}}"""


def validate_taxonomy(taxonomy: dict) -> bool:
    """Basic structural validation of the final taxonomy."""
    cats = taxonomy.get("categories", [])
    if not cats:
        logger.error("Taxonomy has no categories")
        return False

    if len(cats) > cfg.P3_MAX_MAIN_CATEGORIES:
        logger.warning(
            f"Taxonomy has {len(cats)} categories "
            f"(max {cfg.P3_MAX_MAIN_CATEGORIES})"
        )

    ids_seen = set()
    for cat in cats:
        if "id" not in cat or "name" not in cat:
            logger.error(f"Category missing id or name: {cat}")
            return False

        if cat["id"] in ids_seen:
            logger.error(f"Duplicate category ID: {cat['id']}")
            return False
        ids_seen.add(cat["id"])

        subs = cat.get("subcategories", [])
        if len(subs) < 1:
            logger.warning(f"Category {cat['id']} has no subcategories")

        for sub in subs:
            if sub["id"] in ids_seen:
                logger.error(f"Duplicate subcategory ID: {sub['id']}")
                return False
            ids_seen.add(sub["id"])

    return True


def run(
    taxonomy: dict = None,
    candidates: dict[str, int] = None,
) -> dict:
    """
    Execute Phase 3: merge candidates into final taxonomy.

    Args:
        taxonomy:   Phase 1 taxonomy (loaded from file if None)
        candidates: Phase 2 candidate categories (loaded from file if None)

    Returns:
        Final result dict with taxonomy, changes, and summary
    """
    # Load inputs if not provided
    if taxonomy is None:
        phase_1 = load_json(cfg.OUTPUT_DIR / "phase_1_taxonomy.json")
        taxonomy = phase_1["taxonomy"]
        logger.info("Loaded Phase 1 taxonomy from file")

    if candidates is None:
        phase_2 = load_json(cfg.OUTPUT_DIR / "phase_2_results.json")
        candidates = phase_2.get("candidate_categories", {})
        logger.info(f"Loaded {len(candidates)} candidates from Phase 2")

    # Filter candidates by frequency
    significant = filter_candidates(candidates)

    if not significant:
        logger.info("No significant candidates — using Phase 1 taxonomy as final")
        final = {
            "final_taxonomy": taxonomy,
            "changes": [],
            "summary": "No new categories met the frequency threshold. "
                       "Phase 1 taxonomy used as-is.",
        }
    else:
        # Call Claude
        logger.info(f"Sending {len(significant)} candidates to LLM for review")

        prompt = build_prompt(taxonomy, significant)
        response = call_llm(
            prompt=prompt,
            models=cfg.P3_MODELS,
            max_tokens=cfg.P3_MAX_TOKENS,
        )

        try:
            final = extract_json(response)
        except ValueError as e:
            logger.error(f"Failed to parse Claude response: {e}")
            logger.warning("Using Phase 1 taxonomy as final")
            final = {
                "final_taxonomy": taxonomy,
                "changes": [],
                "summary": f"Parse error: {e}. Phase 1 taxonomy used as-is.",
            }

    # Validate
    final_tax = final.get("final_taxonomy", {})
    if not validate_taxonomy(final_tax):
        logger.warning("Validation issues detected — review output manually")

    # Log summary
    cats = final_tax.get("categories", [])
    changes = final.get("changes", [])

    logger.info(f"Final taxonomy: {len(cats)} categories")
    for cat in cats:
        subs = len(cat.get("subcategories", []))
        logger.info(f"  {cat['id']}: {cat['name']} ({subs} subcategories)")

    if changes:
        logger.info(f"Changes applied: {len(changes)}")
        for ch in changes:
            logger.info(f"  {ch.get('action', '?').upper()}: {ch.get('candidate', '?')} → {ch.get('target', '?')}")

    if final.get("summary"):
        logger.info(f"Summary: {final['summary']}")

    # Save
    if cfg.SAVE_INTERMEDIATE:
        output = {
            "metadata": {
                "phase": 3,
                "models": cfg.P3_MODELS,
                "candidates_reviewed": len(significant),
                "changes_applied": len(changes),
            },
            "input_taxonomy_categories": len(taxonomy.get("categories", [])),
            "candidates_submitted": significant,
            "result": final,
        }
        save_json(output, cfg.OUTPUT_DIR / "phase_3_final.json", "Phase 3 final")

    # Also save a clean standalone taxonomy file
    save_json(
        final_tax,
        cfg.OUTPUT_DIR / "final_taxonomy.json",
        "Final taxonomy (standalone)",
    )

    return final


if __name__ == "__main__":
    run()