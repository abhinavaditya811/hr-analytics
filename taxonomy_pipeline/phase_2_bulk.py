import json
from collections import defaultdict
from pathlib import Path

import config as cfg
from utils import (
    load_awards, call_ollama, check_ollama, extract_json,
    save_json, load_json, ensure_dir, get_logger,
)

logger = get_logger("phase_2")


def build_taxonomy_schema(taxonomy: dict) -> str:
    """Format taxonomy into a compact schema string for the prompt."""
    lines = []
    for cat in taxonomy.get("categories", []):
        subs = ", ".join(
            f"{s['id']}: {s['name']}" for s in cat.get("subcategories", [])
        )
        lines.append(f"  {cat['id']}: {cat['name']} → [{subs}]")
    return "\n".join(lines)


def build_batch_prompt(schema: str, batch_messages: list[dict]) -> str:
    """
    Construct prompt for a batch of messages.

    Asks for JSON output — more reliable to parse than free-form text.
    """
    msg_block = "\n\n".join(
        f"[{item['idx']}] {item['text'][:cfg.P2_MSG_TRUNCATE]}"
        for item in batch_messages
    )

    return f"""Categorize each employee recognition message using this taxonomy.

TAXONOMY:
{schema}

MESSAGES:
{msg_block}

For each message, respond with ONLY a JSON array (no other text):
[
  {{
    "idx": 1,
    "category": "A",
    "subcategory": "A1",
    "themes": ["theme1", "theme2"],
    "new_category": null
  }}
]

Rules:
- "category" and "subcategory" must use IDs from the taxonomy above.
- "themes" should be 1-3 short keywords describing the recognition.
- "new_category" should be null UNLESS the message clearly does not fit
  ANY existing category. If so, provide a short name for the new category.
- Respond with ONLY the JSON array, no explanation."""


def parse_batch_response(response: str, batch_size: int) -> list[dict]:
    """
    Parse Llama's JSON response. Falls back to empty results on failure.

    Returns list of classification dicts (may be shorter than batch_size
    if parsing partially fails).
    """
    if not response:
        return []

    # Try parsing as JSON array
    try:
        # Strip any markdown fences or preamble
        text = response.strip()
        text = text.removeprefix("```json").removeprefix("```")
        text = text.removesuffix("```").strip()

        # Find the array
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            parsed = json.loads(text[start : end + 1])
            if isinstance(parsed, list):
                return parsed
    except json.JSONDecodeError:
        pass

    # If JSON parse fails, try extracting individual objects
    results = []
    for line in response.split("\n"):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try:
                obj = json.loads(line)
                if "category" in obj:
                    results.append(obj)
            except json.JSONDecodeError:
                continue

    if results:
        logger.debug(f"Recovered {len(results)} results via line-by-line parsing")

    return results


def load_checkpoint() -> tuple[list[dict], dict[str, int], int]:
    """
    Load checkpoint if it exists.

    Returns:
        (all_results, candidate_categories, last_batch_completed)
    """
    checkpoint_path = cfg.P2_CHECKPOINT_DIR / "phase_2_checkpoint.json"
    if checkpoint_path.exists():
        data = load_json(checkpoint_path)
        logger.info(
            f"Resuming from checkpoint: batch {data['last_batch']} "
            f"({data['messages_processed']} messages processed)"
        )
        return (
            data["results"],
            defaultdict(int, data["candidates"]),
            data["last_batch"],
        )
    return [], defaultdict(int), 0


def save_checkpoint(
    results: list[dict],
    candidates: dict[str, int],
    batch_num: int,
    messages_processed: int,
) -> None:
    """Save intermediate state for crash recovery."""
    ensure_dir(cfg.P2_CHECKPOINT_DIR)
    save_json(
        {
            "last_batch": batch_num,
            "messages_processed": messages_processed,
            "results": results,
            "candidates": dict(candidates),
        },
        cfg.P2_CHECKPOINT_DIR / "phase_2_checkpoint.json",
        label=f"checkpoint (batch {batch_num})",
    )


def run(taxonomy: dict = None, batch_size: int = None, resume: bool = True) -> tuple[list[dict], dict[str, int]]:
    """
    Execute Phase 2: classify all messages with local SLM.

    Args:
        taxonomy:   Phase 1 taxonomy dict (loaded from file if None)
        batch_size: Override config P2_BATCH_SIZE
        resume:     If True, resume from last checkpoint

    Returns:
        (all_classifications, candidate_new_categories)
    """
    batch_size = batch_size or cfg.P2_BATCH_SIZE

    # Load taxonomy if not provided
    if taxonomy is None:
        tax_path = cfg.OUTPUT_DIR / "phase_1_taxonomy.json"
        if tax_path.exists():
            phase_1 = load_json(tax_path)
            taxonomy = phase_1["taxonomy"]
            logger.info("Loaded Phase 1 taxonomy from file")
        else:
            logger.error(f"No taxonomy found at {tax_path}. Run Phase 1 first.")
            raise FileNotFoundError(f"Run Phase 1 first: {tax_path}")

    # Check Ollama
    if not check_ollama():
        logger.error(
            "Ollama not running. Install: https://ollama.ai\n"
            f"Then: ollama pull {cfg.P2_MODEL}"
        )
        raise ConnectionError("Ollama not available")

    logger.info(f"Ollama connected, using model: {cfg.P2_MODEL}")

    # Load data
    df = load_awards()
    schema = build_taxonomy_schema(taxonomy)
    total_messages = len(df)
    total_batches = (total_messages + batch_size - 1) // batch_size

    # Resume from checkpoint?
    if resume:
        all_results, candidates, start_batch = load_checkpoint()
    else:
        all_results, candidates, start_batch = [], defaultdict(int), 0

    start_idx = start_batch * batch_size
    processed = start_idx

    logger.info(
        f"Processing {total_messages} messages in {total_batches} batches "
        f"(size={batch_size}, starting from batch {start_batch})"
    )

    for batch_num in range(start_batch, total_batches):
        i = batch_num * batch_size
        batch_df = df.iloc[i : i + batch_size]

        # Build batch items
        batch_items = [
            {"idx": j + 1, "text": row[cfg.COL_MESSAGE]}
            for j, (_, row) in enumerate(batch_df.iterrows())
        ]

        # Call Ollama
        prompt = build_batch_prompt(schema, batch_items)
        response = call_ollama(
            prompt=prompt,
            model=cfg.P2_MODEL,
            temperature=cfg.P2_TEMPERATURE,
        )

        # Parse results
        parsed = parse_batch_response(response, len(batch_items))

        # Accumulate
        for item in parsed:
            all_results.append({
                "batch": batch_num,
                "category": item.get("category", ""),
                "subcategory": item.get("subcategory", ""),
                "themes": item.get("themes", []),
                "new_category": item.get("new_category"),
            })

            # Track candidate new categories
            new_cat = item.get("new_category")
            if new_cat and isinstance(new_cat, str) and new_cat.lower() != "null":
                candidates[new_cat] += 1

        processed += len(batch_df)

        # Progress logging
        if (batch_num + 1) % 10 == 0 or batch_num == total_batches - 1:
            pct = (processed / total_messages) * 100
            logger.info(
                f"  Batch {batch_num + 1}/{total_batches} "
                f"({processed}/{total_messages} messages, {pct:.0f}%)"
            )

        # Checkpoint
        if (batch_num + 1) % cfg.P2_CHECKPOINT_EVERY == 0:
            save_checkpoint(all_results, candidates, batch_num + 1, processed)

    # Final save
    candidates_dict = dict(candidates)

    logger.info(f"Phase 2 complete: {processed} messages processed")
    logger.info(f"  Classifications: {len(all_results)}")
    logger.info(f"  Candidate new categories: {len(candidates_dict)}")

    if candidates_dict:
        top = sorted(candidates_dict.items(), key=lambda x: x[1], reverse=True)[:10]
        for name, count in top:
            logger.info(f"    {count:3d}x  {name}")

    if cfg.SAVE_INTERMEDIATE:
        output = {
            "metadata": {
                "phase": 2,
                "total_messages": total_messages,
                "total_classified": len(all_results),
                "batch_size": batch_size,
                "model": cfg.P2_MODEL,
            },
            "classifications": all_results,
            "candidate_categories": candidates_dict,
        }
        save_json(output, cfg.OUTPUT_DIR / "phase_2_results.json", "Phase 2 results")

    # Clean up checkpoint
    checkpoint_path = cfg.P2_CHECKPOINT_DIR / "phase_2_checkpoint.json"
    if checkpoint_path.exists():
        checkpoint_path.unlink()
        logger.info("Checkpoint cleaned up")

    return all_results, candidates_dict


if __name__ == "__main__":
    run()