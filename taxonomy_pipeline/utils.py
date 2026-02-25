"""
utils.py — Shared helpers for the taxonomy pipeline.

Handles: CSV loading, JSON extraction, LLM provider abstraction
         (Claude + Gemini fallback), Ollama client, file I/O, logging.
"""

import json
import re
import logging
import time
import pandas as pd
import requests
from pathlib import Path

import config as cfg

# =============================================================================
# LOGGING
# =============================================================================

def get_logger(name: str) -> logging.Logger:
    """Consistent logger across all phases."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        fmt = logging.Formatter("[%(name)s] %(levelname)s — %(message)s")
        handler.setFormatter(fmt)
        logger.addHandler(handler)
    logger.setLevel(getattr(logging, cfg.LOG_LEVEL, logging.INFO))
    return logger


# =============================================================================
# DATA LOADING
# =============================================================================

def load_awards(path: Path = None) -> pd.DataFrame:
    """
    Load and validate the awards CSV.
    Raises early with a clear message if columns are missing.
    """
    path = path or cfg.AWARDS_CSV
    logger = get_logger("utils")

    if not path.exists():
        raise FileNotFoundError(f"Awards CSV not found at {path}")

    df = pd.read_csv(path)
    logger.info(f"Loaded {len(df)} rows from {path.name}")

    required = [cfg.COL_MESSAGE, cfg.COL_AWARD_TITLE,
                cfg.COL_RECIPIENT_TITLE, cfg.COL_NOMINATOR_TITLE]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise KeyError(
            f"Missing columns: {missing}. "
            f"Available: {list(df.columns)}. "
            f"Update column names in config.py."
        )

    before = len(df)
    df = df.dropna(subset=[cfg.COL_MESSAGE]).reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        logger.warning(f"Dropped {dropped} rows with empty messages")

    return df


# =============================================================================
# JSON PARSING
# =============================================================================

def extract_json(text: str) -> dict:
    """
    Robustly extract JSON from LLM responses.
    Handles markdown fences, preamble text, nested objects.
    """
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from response:\n{text[:300]}...")


# =============================================================================
# LLM PROVIDER ABSTRACTION
# =============================================================================

_logger_llm = get_logger("utils.llm")

# ── Claude ──

_claude_client = None

def _get_claude_client():
    global _claude_client
    if _claude_client is None:
        from anthropic import Anthropic
        if not cfg.ANTHROPIC_API_KEY:
            raise EnvironmentError("ANTHROPIC_API_KEY not set")
        _claude_client = Anthropic(api_key=cfg.ANTHROPIC_API_KEY)
    return _claude_client


def _call_claude(prompt: str, model: str, max_tokens: int, system: str = None) -> str:
    """Call Claude API. Raises on auth/billing errors so fallback can trigger."""
    client = _get_claude_client()

    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system

    response = client.messages.create(**kwargs)
    text = response.content[0].text

    usage = response.usage
    _logger_llm.info(
        f"[Claude] {usage.input_tokens} in / {usage.output_tokens} out "
        f"(model={model})"
    )
    return text


# ── Gemini ──

def _call_gemini(prompt: str, model: str, max_tokens: int, system: str = None) -> str:
    """
    Call Google Gemini API via REST with retry on rate limits.
    Free tier (gemini-1.5-flash): 15 RPM, 1M tokens/day.
    """
    if not cfg.GOOGLE_API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY not set")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}"
        f":generateContent?key={cfg.GOOGLE_API_KEY}"
    )

    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    payload = {
        "contents": [
            {"parts": [{"text": full_prompt}]}
        ],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.3,
        },
    }

    max_retries = getattr(cfg, "LLM_MAX_RETRIES", 3)
    retry_delay = getattr(cfg, "LLM_RETRY_DELAY", 5)

    for attempt in range(max_retries + 1):
        response = requests.post(url, json=payload, timeout=120)

        if response.status_code == 200:
            data = response.json()
            try:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                est_in = len(full_prompt) // 4
                est_out = len(text) // 4
                _logger_llm.info(
                    f"[Gemini] ~{est_in} in / ~{est_out} out "
                    f"(model={model})"
                )
                return text
            except (KeyError, IndexError) as e:
                raise ValueError(f"Unexpected Gemini response structure: {e}\n{data}")

        elif response.status_code == 429 and attempt < max_retries:
            # Rate limited — wait and retry
            wait = retry_delay * (attempt + 1)  # linear backoff
            _logger_llm.warning(
                f"[Gemini] Rate limited (429). "
                f"Retry {attempt + 1}/{max_retries} in {wait}s..."
            )
            time.sleep(wait)
            continue

        else:
            error = response.json().get("error", {})
            raise RuntimeError(
                f"Gemini API error {response.status_code}: "
                f"{error.get('message', response.text)}"
            )


def list_gemini_models() -> list[str]:
    """List available Gemini models for your API key. Useful for debugging."""
    if not cfg.GOOGLE_API_KEY:
        print("GOOGLE_API_KEY not set")
        return []

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={cfg.GOOGLE_API_KEY}"
    r = requests.get(url, timeout=10)

    if r.status_code != 200:
        print(f"Error {r.status_code}: {r.text[:200]}")
        return []

    models = r.json().get("models", [])
    names = []
    for m in models:
        name = m.get("name", "").replace("models/", "")
        methods = m.get("supportedGenerationMethods", [])
        if "generateContent" in methods:
            names.append(name)
            print(f"  {name}")
    return names


# ── Provider dispatcher ──

PROVIDER_CALLERS = {
    "claude": _call_claude,
    "gemini": _call_gemini,
}


def call_llm(
    prompt: str,
    models: dict[str, str] = None,
    max_tokens: int = None,
    system: str = None,
) -> str:
    """
    Call an LLM with automatic provider fallback.

    Tries providers in priority order from config.
    If the primary fails (billing, auth, etc.), falls back to the next.

    Args:
        prompt:     User message content
        models:     Dict of provider → model name (e.g. P1_MODELS from config)
        max_tokens: Max response tokens
        system:     Optional system prompt

    Returns:
        Raw text response
    """
    max_tokens = max_tokens or cfg.P1_MAX_TOKENS

    # Build ordered list of providers to try
    providers_to_try = []
    for p in cfg.LLM_PROVIDER_PRIORITY:
        if p == "claude" and cfg.ANTHROPIC_API_KEY:
            providers_to_try.append(p)
        elif p == "gemini" and cfg.GOOGLE_API_KEY:
            providers_to_try.append(p)

    if not providers_to_try:
        raise EnvironmentError(
            "No LLM provider available. Set at least one API key."
        )

    last_error = None

    for i, provider in enumerate(providers_to_try):
        model = (models or {}).get(provider)
        if not model:
            defaults = {"claude": "claude-sonnet-4-5-20250929", "gemini": cfg.GEMINI_DEFAULT_MODEL}
            model = defaults.get(provider, cfg.GEMINI_DEFAULT_MODEL)

        caller = PROVIDER_CALLERS[provider]
        remaining = providers_to_try[i + 1:]

        try:
            _logger_llm.info(f"Trying provider: {provider} (model={model})")
            return caller(prompt, model, max_tokens, system)

        except EnvironmentError:
            _logger_llm.warning(f"{provider}: no API key, skipping")
            continue

        except Exception as e:
            error_str = str(e).lower()
            is_retryable = any(
                kw in error_str
                for kw in ["credit", "balance", "billing", "quota",
                           "unauthorized", "authentication",
                           "403", "401", "429", "400"]
            )

            if is_retryable and remaining:
                _logger_llm.warning(
                    f"{provider} failed ({type(e).__name__}): {str(e)[:120]}... "
                    f"Falling back to: {remaining}"
                )
                last_error = e
                continue
            elif is_retryable and not remaining:
                raise RuntimeError(
                    f"{provider} failed and no fallback provider available.\n"
                    f"Error: {e}\n\n"
                    f"To fix, set a fallback API key:\n"
                    f"  export GOOGLE_API_KEY='AIza...'  "
                    f"(free at https://aistudio.google.com/apikey)"
                ) from e
            else:
                raise

    raise RuntimeError(
        f"All LLM providers failed. Last error: {last_error}"
    )


# Backwards-compatible alias
def call_claude(prompt: str, model: str = None, max_tokens: int = None,
                system: str = None) -> str:
    """Legacy alias — now routes through call_llm with fallback."""
    models = {}
    if model:
        # Caller specified a Claude model — map it and provide Gemini default
        models["claude"] = model
        models["gemini"] = cfg.GEMINI_DEFAULT_MODEL
    return call_llm(prompt=prompt, models=models, max_tokens=max_tokens, system=system)


# =============================================================================
# OLLAMA CLIENT (unchanged — local, no API key needed)
# =============================================================================

def check_ollama() -> bool:
    """Check if Ollama service is reachable."""
    try:
        r = requests.get(cfg.P2_OLLAMA_URL.replace("/api/generate", "/"), timeout=5)
        return r.status_code == 200
    except (requests.ConnectionError, requests.Timeout):
        return False


def call_ollama(prompt: str, model: str = None, temperature: float = None) -> str | None:
    """
    Call local Ollama and return text response.
    Returns None on failure (caller decides how to handle).
    """
    logger = get_logger("utils.ollama")

    model = model or cfg.P2_MODEL
    temperature = temperature if temperature is not None else cfg.P2_TEMPERATURE

    try:
        r = requests.post(
            cfg.P2_OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "temperature": temperature,
            },
            timeout=cfg.P2_TIMEOUT,
        )
        if r.status_code == 200:
            return r.json().get("response", "")

        logger.warning(f"Ollama returned status {r.status_code}")
        return None

    except requests.Timeout:
        logger.warning(f"Ollama timed out after {cfg.P2_TIMEOUT}s")
        return None
    except requests.ConnectionError:
        logger.error("Cannot reach Ollama — is it running?")
        return None


# =============================================================================
# FILE I/O
# =============================================================================

def ensure_dir(path: Path) -> Path:
    """Create directory if it doesn't exist, return the path."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_json(data: dict, path: Path, label: str = "output") -> None:
    """Save dict as formatted JSON with logging."""
    logger = get_logger("utils.io")
    ensure_dir(path.parent)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    logger.info(f"Saved {label} → {path}")


def load_json(path: Path) -> dict:
    """Load JSON file with clear error on failure."""
    if not path.exists():
        raise FileNotFoundError(f"Expected file not found: {path}")
    with open(path, "r") as f:
        return json.load(f)