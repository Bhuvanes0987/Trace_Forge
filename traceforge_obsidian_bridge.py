"""
TraceForge → Obsidian → Gemini Brain Bridge
============================================
Connects your TraceForge memory fabric to an Obsidian vault
via the Local REST API plugin, synthesizing live telemetry +
vault notes into a unified brain summary using Gemini 2.5 Flash.

Requirements:
    pip install requests google-generativeai schedule python-dotenv

Obsidian setup:
    1. Install "Local REST API" plugin from Obsidian community plugins
    2. Enable it → copy the API key from its settings panel
    3. Keep Obsidian open while this script runs (or use filesystem mode)

Usage:
    python traceforge_obsidian_bridge.py              # run once immediately
    python traceforge_obsidian_bridge.py --loop       # run every 15 min
    python traceforge_obsidian_bridge.py --session <id>  # specific session
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime, date
from typing import Optional

import requests
import schedule
import time
import google.generativeai as genai
from dotenv import load_dotenv
# Load environment variables. First check the local folder, then fall back to backend/.env
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("backend/.env"):
    load_dotenv("backend/.env")
else:
    load_dotenv()


# ---------------------------------------------------------------------------
# Configuration — edit these or set them in a .env file
# ---------------------------------------------------------------------------

TRACEFORGE_BASE   = os.getenv("TRACEFORGE_BASE",   "http://localhost:8003")
TRACEFORGE_APIKEY = os.getenv("TRACEFORGE_APIKEY", "")          # your TraceForge app API key

OBSIDIAN_BASE     = os.getenv("OBSIDIAN_BASE",     "http://localhost:27123")
OBSIDIAN_APIKEY   = os.getenv("OBSIDIAN_APIKEY",   "")          # from Obsidian Local REST API plugin
OBSIDIAN_VAULT    = os.getenv("OBSIDIAN_VAULT",    "")          # absolute path to vault folder (filesystem fallback)

GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY",    "")          # Google AI Studio key
GEMINI_MODEL      = os.getenv("GEMINI_MODEL",      "gemini-2.5-flash")

# Where in your vault the daily note lives
DAILY_NOTE_FOLDER = os.getenv("DAILY_NOTE_FOLDER", "Daily Notes")
SYNC_INTERVAL_MIN = int(os.getenv("SYNC_INTERVAL_MIN", "15"))

# How many recent sessions to pull from TraceForge
MAX_SESSIONS      = int(os.getenv("MAX_SESSIONS", "5"))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bridge")

# ---------------------------------------------------------------------------
# TraceForge client
# ---------------------------------------------------------------------------

class TraceForgeClient:
    """Thin wrapper around TraceForge's /api/v1/intelligence/* endpoints."""

    def __init__(self, base: str, api_key: str):
        self.base = base.rstrip("/")
        self.headers = {"X-OTEL-API-KEY": api_key} if api_key else {}

    def _get(self, path: str, params: dict = None) -> dict:
        url = f"{self.base}{path}"
        try:
            r = requests.get(url, headers=self.headers, params=params, timeout=10)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            log.error("TraceForge GET %s failed: %s", path, e)
            return {}

    def get_memory_summary(self) -> dict:
        """All 6 memory tier stats + samples."""
        return self._get("/api/v1/intelligence/memory")

    def get_session_context(self, session_id: str) -> dict:
        """Synthesized context for a specific session."""
        return self._get(f"/api/v1/intelligence/context/{session_id}")

    def get_insights(self) -> dict:
        """Discovered behavioral patterns and predictions."""
        return self._get("/api/v1/intelligence/insights")

    def get_graph(self) -> dict:
        """Knowledge graph nodes + edges."""
        return self._get("/api/v1/intelligence/graph")



    def get_platform_summary(self) -> dict:
        """Health KPIs: total traces, error rates, active alerts."""
        return self._get("/api/v1/dashboards/overview")

    def get_recent_alerts(self) -> list:
        data = self._get("/api/v1/alerts")
        return data.get("alerts", data) if isinstance(data, dict) else (data or [])

    def get_recent_sessions(self) -> list[str]:
        """
        TraceForge doesn't expose a /sessions list endpoint by default.
        We extract unique session IDs from recent hot memory samples.
        """
        memory = self.get_memory_summary()
        hot_samples = (
            memory.get("hot", {}).get("samples", [])
            or memory.get("tiers", {}).get("hot", {}).get("samples", [])
        )
        seen = []
        for s in hot_samples:
            sid = s.get("session_id") or s.get("id")
            if sid and sid not in seen:
                seen.append(sid)
        return seen[:MAX_SESSIONS]

    def get_active_patterns(self) -> list[str]:
        """Return top learning patterns as plain strings."""
        insights = self.get_insights()
        patterns = (
            insights.get("patterns", [])
            or insights.get("insights", [])
            or []
        )
        result = []
        for p in patterns[:5]:
            if isinstance(p, str):
                result.append(p)
            elif isinstance(p, dict):
                desc = p.get("description") or p.get("pattern") or str(p)
                conf = p.get("confidence", "")
                result.append(f"{desc} (confidence: {conf})" if conf else desc)
        return result


# ---------------------------------------------------------------------------
# Obsidian client  (REST API plugin + filesystem fallback)
# ---------------------------------------------------------------------------

class ObsidianClient:
    """
    Primary: Obsidian Local REST API plugin at localhost:27123
    Fallback: direct filesystem writes when Obsidian isn't running
    """

    def __init__(self, base: str, api_key: str, vault_path: str = ""):
        self.base = base.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        self.vault_path = vault_path
        self._api_available: Optional[bool] = None

    # --- connectivity check --------------------------------------------------

    def api_available(self) -> bool:
        if self._api_available is None:
            try:
                r = requests.get(f"{self.base}/", headers=self.headers, timeout=3)
                self._api_available = r.status_code < 500
            except Exception:
                self._api_available = False
                log.warning("Obsidian REST API not reachable — using filesystem fallback")
        return self._api_available

    # --- read -----------------------------------------------------------------

    def read_note(self, path: str) -> str:
        """Return note content as plain text. path is relative to vault root."""
        if self.api_available():
            try:
                r = requests.get(
                    f"{self.base}/vault/{path}",
                    headers=self.headers,
                    timeout=8,
                )
                if r.status_code == 200:
                    data = r.json()
                    return data.get("content", data.get("text", ""))
            except Exception as e:
                log.debug("Obsidian read via API failed: %s", e)

        # filesystem fallback
        if self.vault_path:
            full = os.path.join(self.vault_path, path)
            if os.path.exists(full):
                with open(full, encoding="utf-8") as f:
                    return f.read()
        return ""

    def search_notes(self, query: str, limit: int = 5) -> list[dict]:
        """Semantic / full-text search across the vault."""
        if self.api_available():
            try:
                r = requests.post(
                    f"{self.base}/search/simple/",
                    headers=self.headers,
                    params={"query": query, "contextLength": 200},
                    timeout=10,
                )
                if r.status_code == 200:
                    results = r.json()
                    return results[:limit] if isinstance(results, list) else []
            except Exception as e:
                log.debug("Obsidian search failed: %s", e)
        return []

    # --- write ----------------------------------------------------------------

    def append_to_note(self, path: str, content: str) -> bool:
        """Append content to an existing note, creating it if missing."""
        if self.api_available():
            try:
                r = requests.post(
                    f"{self.base}/vault/{path}",
                    headers=self.headers,
                    json={"content": content},
                    timeout=10,
                )
                return r.status_code in (200, 204)
            except Exception as e:
                log.debug("Obsidian append via API failed: %s", e)

        # filesystem fallback
        if self.vault_path:
            full = os.path.join(self.vault_path, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "a", encoding="utf-8") as f:
                f.write(content)
            return True

        log.error("Cannot write to Obsidian — no API and no vault path configured")
        return False

    def overwrite_note(self, path: str, content: str) -> bool:
        """Create or fully replace a note."""
        if self.api_available():
            try:
                r = requests.put(
                    f"{self.base}/vault/{path}",
                    headers=self.headers,
                    json={"content": content},
                    timeout=10,
                )
                return r.status_code in (200, 204)
            except Exception as e:
                log.debug("Obsidian overwrite via API failed: %s", e)

        # filesystem fallback
        if self.vault_path:
            full = os.path.join(self.vault_path, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as f:
                f.write(content)
            return True

        log.error("Cannot write to Obsidian — no API and no vault path configured")
        return False


# ---------------------------------------------------------------------------
# Gemini synthesizer
# ---------------------------------------------------------------------------

class GeminiSynthesizer:
    """Calls Gemini 2.5 Flash to produce unified brain summaries."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)

    def synthesize_daily_summary(
        self,
        session_contexts: list[str],
        active_patterns: list[str],
        platform_kpis: dict,
        related_notes: list[dict],
    ) -> str:
        """
        Produce a structured daily brain summary from TraceForge data
        and relevant Obsidian notes.
        """
        note_snippets = "\n".join(
            f"- [{n.get('filename', '?')}]: {n.get('context', '')[:200]}"
            for n in related_notes
        ) or "No related notes found."

        session_block = "\n".join(
            f"- {ctx}" for ctx in session_contexts
        ) or "No active sessions."

        pattern_block = "\n".join(
            f"- {p}" for p in active_patterns
        ) or "No patterns detected."

        kpi_block = json.dumps(platform_kpis, indent=2) if platform_kpis else "{}"

        prompt = f"""You are an organizational intelligence system.
You have access to live telemetry from a production observability platform (TraceForge)
and a personal knowledge vault (Obsidian). Synthesize everything below into a structured
daily brain update.

## Active session contexts (from TraceForge hot memory)
{session_block}

## Discovered behavioral patterns (from TraceForge learning memory)
{pattern_block}

## Platform health KPIs
{kpi_block}

## Related notes from Obsidian vault
{note_snippets}

Output a Markdown note with EXACTLY these four sections:
### Today's context summary
One paragraph (3–5 sentences) synthesizing what was happening across all sessions today.

### Key patterns identified
Bullet list of 2–4 behavioral patterns worth remembering long-term.

### Connections to existing knowledge
How today's events relate to the Obsidian notes found. Be specific — reference note titles.

### Suggested next actions
2–3 concrete follow-up actions based on the patterns and context.

Be concise. Total output should be under 400 words. Use plain Markdown only."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            log.error("Gemini synthesis failed: %s", e)
            return _fallback_summary(session_contexts, active_patterns)

    def synthesize_session_note(self, session_id: str, context: dict) -> str:
        """Produce a short session memory note from a single session context."""
        raw = context.get("context", context.get("summary", str(context)))
        prompt = f"""Summarize this user session context into a 2-sentence Obsidian note.
Include: what the user was doing, any errors encountered, and outcome.
Session ID: {session_id}
Raw context: {raw}
Output only the 2-sentence note. No headers, no bullets."""
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            log.error("Gemini session note failed: %s", e)
            return str(raw)[:300]


def _fallback_summary(session_contexts: list[str], patterns: list[str]) -> str:
    """Rule-based fallback when Gemini is unavailable."""
    lines = ["### Today's context summary", ""]
    if session_contexts:
        lines.append(session_contexts[0])
    lines += ["", "### Key patterns identified", ""]
    for p in patterns[:3]:
        lines.append(f"- {p}")
    lines += ["", "### Connections to existing knowledge", "", "- (Gemini unavailable — run again with a valid API key)", ""]
    lines += ["### Suggested next actions", "", "- Review TraceForge Memory Fabric dashboard", "- Check active alerts"]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Daily note builder
# ---------------------------------------------------------------------------

def build_daily_note_section(summary: str, timestamp: str) -> str:
    """Wrap the Gemini summary in a timestamped Obsidian section."""
    return f"""

---
## 🧠 Brain sync — {timestamp}
*Auto-generated by TraceForge Brain Bridge*

{summary}

---
"""


def daily_note_path(folder: str) -> str:
    today = date.today().strftime("%Y-%m-%d")
    return f"{folder}/{today}.md"


# ---------------------------------------------------------------------------
# Session memory notes
# ---------------------------------------------------------------------------

def write_session_note(
    obsidian: ObsidianClient,
    gemini: GeminiSynthesizer,
    session_id: str,
    context: dict,
    folder: str = "Memory/Sessions",
) -> bool:
    """Write a dedicated session note to the vault."""
    note_text = gemini.synthesize_session_note(session_id, context)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    app = context.get("app_name", context.get("app", "unknown-app"))

    content = f"""---
session_id: {session_id}
app: {app}
synced_at: {timestamp}
source: traceforge
---

# Session: {session_id[:16]}…

{note_text}

*Synced from TraceForge at {timestamp}*
"""
    path = f"{folder}/{date.today().strftime('%Y-%m-%d')}-{session_id[:8]}.md"
    ok = obsidian.overwrite_note(path, content)
    if ok:
        log.info("  ✓ Session note written → %s", path)
    return ok


# ---------------------------------------------------------------------------
# Core sync logic
# ---------------------------------------------------------------------------

def run_sync(
    traceforge: TraceForgeClient,
    obsidian: ObsidianClient,
    gemini: GeminiSynthesizer,
    target_session: Optional[str] = None,
) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    log.info("─" * 60)
    log.info("Brain sync started at %s", timestamp)

    # 1. Pull TraceForge data ------------------------------------------------
    log.info("[1/5] Fetching TraceForge memory fabric…")
    platform_kpis  = traceforge.get_platform_summary()
    active_patterns = traceforge.get_active_patterns()
    log.info("      %d behavioral patterns found", len(active_patterns))

    # 2. Pull session contexts -----------------------------------------------
    log.info("[2/5] Pulling session contexts…")
    if target_session:
        session_ids = [target_session]
    else:
        session_ids = traceforge.get_recent_sessions()

    session_contexts: list[str] = []
    for sid in session_ids:
        ctx = traceforge.get_session_context(sid)
        summary = ctx.get("context") or ctx.get("summary") or ctx.get("synthesized_context", "")
        if summary:
            session_contexts.append(f"[{sid[:12]}] {summary}")
            # write individual session note
            write_session_note(obsidian, gemini, sid, ctx)

    log.info("      %d sessions synthesized", len(session_contexts))

    # 3. Search Obsidian for related notes -----------------------------------
    log.info("[3/5] Searching Obsidian vault for related notes…")
    search_terms = " ".join(active_patterns[:2]) or "memory fabric context intelligence"
    related_notes = obsidian.search_notes(search_terms, limit=4)
    log.info("      %d related notes found", len(related_notes))

    # 4. Gemini unified synthesis --------------------------------------------
    log.info("[4/5] Synthesizing with Gemini %s…", GEMINI_MODEL)
    daily_summary = gemini.synthesize_daily_summary(
        session_contexts=session_contexts,
        active_patterns=active_patterns,
        platform_kpis=platform_kpis,
        related_notes=related_notes,
    )

    # 5. Write to Obsidian daily note ----------------------------------------
    log.info("[5/5] Writing to Obsidian daily note…")
    section = build_daily_note_section(daily_summary, timestamp)
    note_path = daily_note_path(DAILY_NOTE_FOLDER)
    ok = obsidian.append_to_note(note_path, section)

    if ok:
        log.info("  ✓ Daily note updated → %s", note_path)
    else:
        log.error("  ✗ Failed to write daily note")

    # 6. Write a graph snapshot note (weekly, on Mondays) --------------------
    if date.today().weekday() == 0:  # Monday
        write_graph_snapshot(traceforge, obsidian, timestamp)

    log.info("Brain sync complete.")
    log.info("─" * 60)


def write_graph_snapshot(
    traceforge: TraceForgeClient,
    obsidian: ObsidianClient,
    timestamp: str,
) -> None:
    """Write a weekly knowledge graph snapshot note."""
    log.info("  Writing weekly graph snapshot…")
    graph = traceforge.get_graph()
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node_lines = "\n".join(
        f"- **{n.get('label', n.get('id', '?'))}** ({n.get('type', 'node')})"
        for n in nodes[:20]
    )
    edge_lines = "\n".join(
        f"- {e.get('source', '?')} → {e.get('target', '?')} `{e.get('relationship', '')}`"
        for e in edges[:20]
    )

    content = f"""---
type: graph-snapshot
generated_at: {timestamp}
node_count: {len(nodes)}
edge_count: {len(edges)}
---

# Knowledge graph snapshot — {date.today().strftime('%Y-W%V')}

## Nodes ({len(nodes)} total, showing first 20)
{node_lines or '(no nodes)'}

## Edges ({len(edges)} total, showing first 20)
{edge_lines or '(no edges)'}

*Auto-generated by TraceForge Brain Bridge*
"""
    path = f"Memory/Graphs/graph-{date.today().strftime('%Y-W%V')}.md"
    obsidian.overwrite_note(path, content)
    log.info("  ✓ Graph snapshot written → %s", path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def validate_config() -> bool:
    missing = []
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    if not OBSIDIAN_APIKEY and not OBSIDIAN_VAULT:
        missing.append("OBSIDIAN_APIKEY or OBSIDIAN_VAULT (at least one required)")
    if missing:
        log.error("Missing required config: %s", ", ".join(missing))
        log.error("Set them in a .env file or as environment variables.")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="TraceForge ↔ Obsidian brain bridge")
    parser.add_argument("--loop",    action="store_true", help="Run every SYNC_INTERVAL_MIN minutes")
    parser.add_argument("--session", metavar="SESSION_ID",  help="Sync a specific session ID only")
    parser.add_argument("--dry-run", action="store_true", help="Print output without writing to Obsidian")
    args = parser.parse_args()

    if not validate_config():
        sys.exit(1)

    traceforge = TraceForgeClient(TRACEFORGE_BASE, TRACEFORGE_APIKEY)
    obsidian   = ObsidianClient(OBSIDIAN_BASE, OBSIDIAN_APIKEY, OBSIDIAN_VAULT)
    gemini     = GeminiSynthesizer(GEMINI_API_KEY, GEMINI_MODEL)

    log.info("TraceForge  → %s", TRACEFORGE_BASE)
    log.info("Obsidian    → %s (%s)", OBSIDIAN_BASE, "API" if obsidian.api_available() else "filesystem")
    log.info("Gemini      → %s", GEMINI_MODEL)
    log.info("Daily notes → %s/", DAILY_NOTE_FOLDER)

    def _sync():
        run_sync(traceforge, obsidian, gemini, target_session=args.session)

    if args.loop:
        log.info("Running every %d minutes. Ctrl+C to stop.", SYNC_INTERVAL_MIN)
        _sync()  # run immediately on start
        schedule.every(SYNC_INTERVAL_MIN).minutes.do(_sync)
        while True:
            schedule.run_pending()
            time.sleep(30)
    else:
        _sync()


if __name__ == "__main__":
    main()
