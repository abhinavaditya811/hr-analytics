"""
phase_1_seed.py — Claude discovers taxonomy from sample messages.

Key change from original: NO pre-defined categories.
Claude derives the structure purely from message content.

Input:  Sample of award messages (size from config)
Output: Initial taxonomy JSON saved to outputs/phase_1_taxonomy.json
Cost:   ~50K tokens, one Claude API call
"""

import config as cfg
from utils import load_awards, call_llm, extract_json, save_json, get_logger

logger = get_logger("phase_1")


def build_prompt(messages: list[str]) -> str:
    """
    Construct the taxonomy discovery prompt.

    Deliberately avoids naming any categories — Claude must
    derive them from patterns in the messages.
    """
    sample_block = "\n\n---\n\n".join(
        f"Message {i+1}: {msg[:cfg.P1_MSG_TRUNCATE]}"
        for i, msg in enumerate(messages)
    )

    return f"""You are a researcher designing a taxonomy for employee recognition awards.

Below are {len(messages)} real award messages from a company's recognition platform.
Read them carefully, then design a hierarchical taxonomy that captures the
distinct TYPES of recognition present in this data.

MESSAGES:
{sample_block}

INSTRUCTIONS:
1. Identify 5-8 main categories that emerge naturally from these messages.
   Do NOT use generic HR labels — derive categories from what people
   actually recognize each other for in this specific dataset.
2. For each main category, create 2-4 subcategories.
3. Provide clear descriptions grounded in the messages you read.
4. Include 1-2 brief example phrases (not full messages) per subcategory.

Output ONLY valid JSON with this structure:
{{
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
          "examples": ["short phrase from messages", "another phrase"]
        }}
      ]
    }}
  ],
  "reasoning": "2-3 sentences explaining why this structure fits the data"
}}"""


def run(sample_size: int = None, random_state: int = None) -> dict:
    """
    Execute Phase 1: sample messages → Claude → initial taxonomy.

    Args:
        sample_size:  Override config P1_SAMPLE_SIZE
        random_state: Override config P1_RANDOM_STATE (None = true random)

    Returns:
        Taxonomy dict with categories, subcategories, and reasoning
    """
    sample_size = sample_size or cfg.P1_SAMPLE_SIZE
    random_state = random_state if random_state is not None else cfg.P1_RANDOM_STATE

    logger.info(f"Phase 1: Sampling {sample_size} messages (seed={random_state})")

    # Load and sample
    df = load_awards()
    sample = df.sample(
        n=min(sample_size, len(df)),
        random_state=random_state,
    )
    messages = sample[cfg.COL_MESSAGE].tolist()

    logger.info(f"Sampled {len(messages)} messages, building prompt...")

    # Call LLM (Claude or Gemini, with automatic fallback)
    prompt = build_prompt(messages)
    response = call_llm(
        prompt=prompt,
        models=cfg.P1_MODELS,
        max_tokens=cfg.P1_MAX_TOKENS,
    )

    # Parse response
    try:
        taxonomy = extract_json(response)
    except ValueError as e:
        logger.error(f"Failed to parse Claude response: {e}")
        logger.warning("Falling back to default taxonomy")
        from defaults import DEFAULT_TAXONOMY
        taxonomy = DEFAULT_TAXONOMY

    # Validate structure
    categories = taxonomy.get("categories", [])
    if not categories:
        logger.warning("Empty categories returned, using defaults")
        from defaults import DEFAULT_TAXONOMY
        taxonomy = DEFAULT_TAXONOMY
        categories = taxonomy["categories"]

    # Log summary
    logger.info(f"Taxonomy created: {len(categories)} categories")
    for cat in categories:
        subs = cat.get("subcategories", [])
        logger.info(f"  {cat['id']}: {cat['name']} ({len(subs)} subcategories)")

    # Save
    if cfg.SAVE_INTERMEDIATE:
        output = {
            "metadata": {
                "phase": 1,
                "sample_size": len(messages),
                "random_state": random_state,
                "models": cfg.P1_MODELS,
            },
            "taxonomy": taxonomy,
        }
        save_json(output, cfg.OUTPUT_DIR / "phase_1_taxonomy.json", "Phase 1 taxonomy")

    return taxonomy


if __name__ == "__main__":
    run()