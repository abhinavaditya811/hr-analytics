import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# API KEYS & LLM PROVIDER
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

# Provider priority: tries in order, falls back on failure
# Options: "claude", "gemini"
LLM_PROVIDER_PRIORITY = ["claude", "gemini"]

# If you want to force a specific provider regardless of key availability:
# LLM_PROVIDER_PRIORITY = ["gemini"]  # always use Gemini

if not ANTHROPIC_API_KEY and not GOOGLE_API_KEY:
    import warnings
    warnings.warn(
        "No LLM API key found. Set at least one:\n"
        "  export ANTHROPIC_API_KEY='sk-ant-...'  (Claude, paid)\n"
        "  export GOOGLE_API_KEY='AIza...'         (Gemini, free tier)\n\n"
        "Get keys at:\n"
        "  Claude:  https://console.anthropic.com/settings/keys\n"
        "  Gemini:  https://aistudio.google.com/apikey",
        stacklevel=2,
    )

# PATHS
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data/raw"
OUTPUT_DIR = PROJECT_ROOT / "outputs"

AWARDS_CSV = DATA_DIR / "mockup_awards.csv"

# Column mapping — update these if your CSV headers change
COL_MESSAGE = "message"
COL_AWARD_TITLE = "award_title"
COL_RECIPIENT_TITLE = "recipient_title"
COL_NOMINATOR_TITLE = "nominator_title"
GEMINI_DEFAULT_MODEL = "gemini-flash-lite-latest"

# PHASE 1 — Claude/Gemini Seeds Taxonomy
P1_SAMPLE_SIZE = 100          # messages to sample for taxonomy discovery
P1_RANDOM_STATE = 42          # reproducibility seed (set None for true random)
P1_MSG_TRUNCATE = 500         # max chars per message sent to LLM
P1_MAX_TOKENS = 3000          # headroom for 6-8 categories with descriptions + reasoning

# Model per provider (pipeline picks based on what's available)
P1_MODELS = {
    "claude": "claude-sonnet-4-5-20250929",
    "gemini": GEMINI_DEFAULT_MODEL,
}

# PHASE 2 — Local SLM Bulk Processing
P2_BATCH_SIZE = 5             # messages per Ollama call (keep ≤8 for 8K context)
P2_MSG_TRUNCATE = 400         # max chars per message (smaller window than Claude)
P2_MODEL = "llama3:8b"           # actual model tag in Ollama — NOT "llama2"
P2_TEMPERATURE = 0.15         # low temp for classification consistency
P2_TIMEOUT = 120              # seconds per Ollama request
P2_OLLAMA_URL = "http://localhost:11434/api/generate"

# Candidate filtering
P2_MIN_CANDIDATE_FREQ = 3    # minimum occurrences to surface a new category

# Checkpointing — crash recovery for long-running Phase 2
P2_CHECKPOINT_EVERY = 20     # save intermediate results every N batches
P2_CHECKPOINT_DIR = OUTPUT_DIR / "checkpoints"

# If True, simulate Phase 2 without Ollama (for testing Phase 1 + 3 flow)
P2_ALLOW_SIMULATION = False

# PHASE 3 — Claude/Gemini Finalizes Taxonomy
P3_MAX_TOKENS = 3000
P3_MAX_MAIN_CATEGORIES = 8   # upper bound on final category count
P3_MAX_SUBCATEGORIES = 4     # max subcategories per main category
P3_MIN_CANDIDATE_FREQ = 3    # redundant with P2 but explicit for Phase 3 logic

P3_MODELS = {
    "claude": "claude-sonnet-4-5-20250929",
    "gemini": GEMINI_DEFAULT_MODEL,
}

# Retry settings for rate-limited APIs
LLM_MAX_RETRIES = 3
LLM_RETRY_DELAY = 5  # seconds between retries

# PIPELINE-LEVEL
SAVE_INTERMEDIATE = True      # write phase outputs to disk between phases
LOG_LEVEL = "INFO"            # DEBUG | INFO | WARNING