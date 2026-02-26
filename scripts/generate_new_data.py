import argparse
import json
import time
import random
import sys
from pathlib import Path

# Ensure taxonomy_pipeline is importable
_pipeline_dir = str(Path(__file__).resolve().parent.parent / "taxonomy_pipeline")
if _pipeline_dir not in sys.path:
    sys.path.insert(0, _pipeline_dir)

_pipeline_dir = str(Path(__file__).resolve().parent.parent / "taxonomy_pipeline")
if _pipeline_dir not in sys.path:
    sys.path.insert(0, _pipeline_dir)

import pandas as pd
import config as cfg
from utils import call_llm, get_logger

logger = get_logger("generate_data")

BATCH_SIZE = 10
RATE_LIMIT_DELAY = 5

# NEW DEPARTMENTS & ROLES (not in original data)
NEW_DEPARTMENTS = {
    "Data Science & Analytics": [
        "Data Scientist",
        "Senior Data Scientist",
        "ML Engineer",
        "Analytics Manager",
        "Data Engineering Lead",
        "Junior Data Analyst",
        "Director, Data Science",
    ],
    "DevOps & Infrastructure": [
        "Site Reliability Engineer",
        "DevOps Engineer",
        "Cloud Infrastructure Manager",
        "Senior Platform Engineer",
        "Director, DevOps",
    ],
    "Legal & Compliance": [
        "Corporate Counsel",
        "Compliance Analyst",
        "Senior Compliance Manager",
        "Legal Operations Specialist",
        "Director, Legal Affairs",
    ],
    "People & Culture": [
        "Talent Acquisition Specialist",
        "Senior HR Business Partner",
        "DEI Program Manager",
        "Learning & Development Lead",
        "Director, People Operations",
    ],
    "Security": [
        "Security Engineer",
        "Senior Security Analyst",
        "CISO",
        "Application Security Lead",
        "Security Operations Manager",
    ],
}

# Mix in some existing departments with new roles
EXISTING_DEPT_NEW_ROLES = {
    "Engineering": [
        "Staff Engineer",
        "Engineering Program Manager",
        "Technical Lead, Mobile",
        "Senior Backend Engineer",
    ],
    "Marketing": [
        "Growth Marketing Manager",
        "Senior SEO Strategist",
        "Marketing Analytics Lead",
        "Performance Marketing Specialist",
    ],
    "Product": [
        "Senior Product Manager",
        "Product Design Lead",
        "Technical Product Manager",
        "Director, Product Strategy",
    ],
}

TONES = ["casual", "formal", "heartfelt", "brief", "detailed", "enthusiastic"]

SCENARIOS = [
    "helping during a production incident",
    "onboarding a new team member",
    "delivering a complex project ahead of schedule",
    "sharing knowledge in a tech talk or brown bag session",
    "going above and beyond for a customer",
    "organizing a team-building event",
    "mentoring a junior colleague",
    "leading a cross-functional initiative",
    "automating a painful manual process",
    "handling a crisis with calm and clarity",
    "contributing to an open source project",
    "volunteering for a company-wide initiative",
    "celebrating a personal milestone (work anniversary, promotion)",
    "supporting a colleague through a difficult time",
    "building a new internal tool that saved hours of work",
    "presenting at an industry conference",
    "driving a successful product launch",
    "improving team documentation",
    "stepping in to cover during someone's leave",
    "proposing and implementing a cost-saving measure",
]


def build_role_pool() -> list[dict]:
    """Build a pool of (recipient_title, nominator_title, department) tuples."""
    pool = []

    # New departments
    for dept, roles in NEW_DEPARTMENTS.items():
        for role in roles:
            pool.append({"role": role, "dept": dept, "is_new_dept": True})

    # Existing departments with new roles
    for dept, roles in EXISTING_DEPT_NEW_ROLES.items():
        for role in roles:
            pool.append({"role": role, "dept": dept, "is_new_dept": False})

    return pool


def generate_pairs(pool: list[dict], count: int) -> list[dict]:
    """Generate recipient/nominator pairs with some cross-department recognition."""
    pairs = []
    random.seed(42)

    for _ in range(count):
        recipient = random.choice(pool)
        # 60% same department, 40% cross-department
        if random.random() < 0.6:
            same_dept = [p for p in pool if p["dept"] == recipient["dept"] and p["role"] != recipient["role"]]
            nominator = random.choice(same_dept) if same_dept else random.choice(pool)
        else:
            diff_dept = [p for p in pool if p["dept"] != recipient["dept"]]
            nominator = random.choice(diff_dept) if diff_dept else random.choice(pool)

        pairs.append({
            "recipient_title": recipient["role"],
            "nominator_title": nominator["role"],
            "recipient_dept": recipient["dept"],
            "nominator_dept": nominator["dept"],
            "tone": random.choice(TONES),
            "scenario": random.choice(SCENARIOS),
        })

    return pairs


def build_batch_prompt(pairs: list[dict], batch_idx: int) -> str:
    """Prompt Gemini to generate award messages for a batch of pairs."""
    entries = []
    for i, p in enumerate(pairs):
        entries.append(
            f"Entry {i + 1}:\n"
            f"  Recipient: {p['recipient_title']} ({p['recipient_dept']})\n"
            f"  Nominator: {p['nominator_title']} ({p['nominator_dept']})\n"
            f"  Tone: {p['tone']}\n"
            f"  Scenario: {p['scenario']}"
        )

    entries_block = "\n\n".join(entries)

    return f"""Generate employee recognition award messages for a company peer recognition platform.

For each entry below, create:
1. A realistic award message (50-400 words depending on tone)
2. A creative award title (2-6 words, like "The Template Masterminds!" or "Above and Beyond")

Rules:
- Messages should sound like real people writing to real colleagues
- "casual" tone: short, friendly, uses contractions
- "formal" tone: professional, structured, uses full sentences
- "heartfelt" tone: emotional, personal, mentions specific impact
- "brief" tone: 1-3 sentences, direct
- "detailed" tone: 200-400 words, specific examples
- "enthusiastic" tone: high energy, exclamation marks, superlatives
- Mention the recipient by a made-up first name naturally in the message
- Reference specific (fictional) projects, tools, or events to add realism
- Do NOT use generic phrases like "great job" alone — be specific about what was done
- Cross-department messages should mention the collaboration aspect

ENTRIES:
{entries_block}

Respond with ONLY a JSON array, no other text:
[
  {{
    "entry": 1,
    "message": "the award message text...",
    "award_title": "Creative Title Here"
  }}
]"""


def parse_response(text: str) -> list[dict]:
    """Parse Gemini's JSON array response."""
    if not text:
        return []

    text = text.strip()
    text = text.removeprefix("```json").removeprefix("```")
    text = text.removesuffix("```").strip()

    try:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            parsed = json.loads(text[start:end + 1])
            if isinstance(parsed, list):
                return parsed
    except json.JSONDecodeError:
        pass

    return []


def generate_data(count: int = 100) -> pd.DataFrame:
    """Generate synthetic award data using Gemini."""
    logger.info(f"Generating {count} new award entries")

    # Build role pool and pairs
    pool = build_role_pool()
    logger.info(f"Role pool: {len(pool)} roles across {len(NEW_DEPARTMENTS) + len(EXISTING_DEPT_NEW_ROLES)} departments")

    pairs = generate_pairs(pool, count)

    # Generate in batches
    total_batches = (count + BATCH_SIZE - 1) // BATCH_SIZE
    all_rows = []
    failures = 0

    logger.info(f"Generating messages in {total_batches} batches of {BATCH_SIZE}")

    for batch_idx in range(total_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, count)
        batch_pairs = pairs[start:end]

        prompt = build_batch_prompt(batch_pairs, batch_idx)

        try:
            response = call_llm(
                prompt=prompt,
                models={"gemini": cfg.GEMINI_DEFAULT_MODEL},
                max_tokens=4000,
            )
            parsed = parse_response(response)

            for item, pair in zip(parsed, batch_pairs):
                all_rows.append({
                    "message": item.get("message", ""),
                    "award_title": item.get("award_title", ""),
                    "recipient_title": pair["recipient_title"],
                    "nominator_title": pair["nominator_title"],
                })

            logger.info(f"  Batch {batch_idx + 1}/{total_batches}: {len(parsed)} entries generated")

        except Exception as e:
            logger.warning(f"  Batch {batch_idx + 1} failed: {type(e).__name__}: {str(e)[:100]}")
            failures += 1

            # Rate limit handling
            if "429" in str(e):
                wait = RATE_LIMIT_DELAY * 3
                logger.info(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)

        time.sleep(RATE_LIMIT_DELAY)

    logger.info(f"Generated {len(all_rows)} entries ({failures} batch failures)")

    df = pd.DataFrame(all_rows, columns=["message", "award_title", "recipient_title", "nominator_title"])

    # Filter out empty messages
    before = len(df)
    df = df[df["message"].str.strip().astype(bool)].reset_index(drop=True)
    if len(df) < before:
        logger.warning(f"Dropped {before - len(df)} empty messages")

    return df


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic award data")
    parser.add_argument("--count", type=int, default=100, help="Number of entries to generate")
    parser.add_argument("--append", action="store_true", help="Append to existing CSV instead of standalone")
    parser.add_argument("--output", type=str, default=None, help="Output file path")
    args = parser.parse_args()

    new_data = generate_data(count=args.count)

    if args.append:
        # Append to existing CSV
        existing = pd.read_csv(cfg.AWARDS_CSV)
        logger.info(f"Existing CSV: {len(existing)} rows")

        combined = pd.concat([existing, new_data], ignore_index=True)
        combined.to_csv(cfg.AWARDS_CSV, index=False)
        logger.info(f"Appended {len(new_data)} rows -> {len(combined)} total in {cfg.AWARDS_CSV.name}")

    else:
        # Save standalone
        output_path = Path(args.output) if args.output else cfg.DATA_DIR / "new_awards_100.csv"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        new_data.to_csv(output_path, index=False)
        logger.info(f"Saved {len(new_data)} entries to {output_path}")

    # Print summary
    print(f"\n{'=' * 60}")
    print(f"GENERATED DATA SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total entries: {len(new_data)}")
    print(f"Message length: {new_data['message'].str.len().mean():.0f} avg chars "
          f"({new_data['message'].str.len().min()}-{new_data['message'].str.len().max()} range)")
    print(f"Unique award titles: {new_data['award_title'].nunique()}")
    print(f"Unique recipient titles: {new_data['recipient_title'].nunique()}")
    print(f"Unique nominator titles: {new_data['nominator_title'].nunique()}")

    # Department distribution
    print(f"\nRecipient title samples:")
    for title in new_data["recipient_title"].value_counts().head(10).index:
        print(f"  {title}")

    print(f"\nSample messages:")
    for _, row in new_data.head(3).iterrows():
        print(f"\n  Title: {row['award_title']}")
        print(f"  To: {row['recipient_title']} | From: {row['nominator_title']}")
        print(f"  Message: {row['message'][:150]}...")

    print(f"\n{'=' * 60}")

    if not args.append:
        print(f"\nTo append to main CSV:")
        print(f"  python scripts/generate_new_data.py --append")
        print(f"\nTo use as standalone eval data:")
        print(f"  cp {output_path} data/raw/eval_subset.csv")


if __name__ == "__main__":
    main()