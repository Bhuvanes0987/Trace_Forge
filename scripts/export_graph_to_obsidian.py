#!/usr/bin/env python3
"""Export the TraceForge knowledge graph as Mermaid and write to the Obsidian vault

Usage: python scripts/export_graph_to_obsidian.py
"""
import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv


def load_env():
    env_path = Path(__file__).resolve().parents[1] / "backend" / ".env"
    if env_path.exists():
        load_dotenv(env_path)


def fetch_graph(api_base: str):
    url = f"{api_base.rstrip('/')}/api/v1/intelligence/graph"
    try:
        r = requests.get(url, timeout=8, verify=False)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"Failed to fetch graph from {url}: {e}")
        return None


def graph_to_mermaid(graph_json: dict) -> str:
    nodes = graph_json.get("nodes", [])
    links = graph_json.get("links", [])

    # Map node id to sanitized id
    def sid(nid):
        return nid.replace(':', '_').replace(' ', '_')

    lines = ["graph LR"]

    # Node definitions
    for n in nodes:
        nid = sid(n.get("id", "n"))
        label = (n.get("label") or n.get("id") or nid).replace('"', '')
        lines.append(f"  {nid}[\"{label}\"]")

    # Links
    for l in links:
        s = sid(l.get("source"))
        t = sid(l.get("target"))
        rel = (l.get("relationship") or "rel").replace('"', '')
        lines.append(f"  {s} -->|{rel}| {t}")

    return "\n".join(lines)


def write_to_obsidian(vault_path: str, mermaid_md: str):
    vault = Path(vault_path)
    if not vault.exists():
        print(f"Obsidian vault path does not exist: {vault}")
        return False

    out_file = vault / "Cross-App-Context-Graph.md"
    content = "# Cross-App Context Knowledge Graph\n\n" + "```mermaid\n" + mermaid_md + "\n```\n"
    out_file.write_text(content, encoding="utf-8")
    print(f"Wrote {out_file}")
    return True


def write_static_files(static_dir: str, mermaid_md: str):
    sdir = Path(static_dir)
    sdir.mkdir(parents=True, exist_ok=True)
    md_file = sdir / "graph.md"
    md_file.write_text("```mermaid\n" + mermaid_md + "\n```\n", encoding="utf-8")

    html_file = sdir / "graph.html"
    html_content = f"""
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cross-App Context Knowledge Graph</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>body{{font-family:Inter,system-ui,Arial; padding:20px}}</style>
</head>
<body>
<h3>Cross-App Context Knowledge Graph</h3>
<div class="mermaid">
{mermaid_md}
</div>
<script>mermaid.initialize({{startOnLoad:true}});</script>
</body>
</html>
"""
    html_file.write_text(html_content, encoding="utf-8")
    print(f"Wrote static files to {sdir}")


def main():
    load_env()
    api_base = os.getenv("TRACEFORGE_BASE", "http://localhost:8003")
    vault = os.getenv("OBSIDIAN_VAULT", "")
    static_dir = Path(__file__).resolve().parents[1] / "backend" / "static"

    graph = fetch_graph(api_base)
    if not graph:
        print("No graph data available; aborting")
        return

    mermaid = graph_to_mermaid(graph)

    if vault:
        write_to_obsidian(vault, mermaid)
    else:
        print("No OBISDIAN_VAULT configured; skipping vault write")

    write_static_files(static_dir, mermaid)


if __name__ == "__main__":
    main()
