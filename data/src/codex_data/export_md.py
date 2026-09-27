"""JSON rows → output/md/<section>/<song-id>.md, plus an index README.md.

Each file has YAML front matter (strings JSON-encoded, which is valid YAML)
followed by the lyrics. Verses are plain lines, choruses are blockquotes, and
lines end with a backslash for a hard line break (CommonMark/GFM).
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

_INLINE = re.compile(r"([\\`*_\[\]<>|])")
_LEADING = re.compile(r"^(\s*)([#>+\-=])")
_ORDERED = re.compile(r"^(\s*\d+)([.)])")


def escape(text: str) -> str:
    text = _INLINE.sub(r"\\\1", text)
    text = _LEADING.sub(r"\1\\\2", text)
    # "1. Levate" would become a list item; escape the dot, not the digit.
    return _ORDERED.sub(r"\1\\\2", text)


_TIMES = {2: "BIS", 3: "TER", 4: "QUATER"}


def _yaml(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def _span_note(span: dict) -> str:
    n = span["to"] - span["from"] + 1
    return span["marker"] if n == 1 else f"{span['marker'][:-1]}, {n} regels)"


def _stanza_lines(st: dict) -> list[str]:
    lines = [escape(t) for t in st.get("lines", [])]
    # A marker goes at the end of the last line it covers.
    for span in st.get("repeats", []):
        lines[span["to"]] += " " + escape(_span_note(span))
    return lines


def _block(lines: list[str], prefix: str = "") -> str:
    return "\n".join(prefix + ln + ("\\" if i < len(lines) - 1 else "") for i, ln in enumerate(lines))


def render_song(song: dict, club: dict | None) -> str:
    fm = {
        "id": song["id"],
        "title": song["title"],
        "sortTitle": song["sortTitle"],
        "section": song["section"],
        "language": song["language"],
        "club": club["name"] if club else None,
        "pages": [song["pages"]["start"], song["pages"]["end"]],
        "lyricist": song["lyricist"],
        "melody": song["melody"],
    }
    out = ["---"]
    out += [f"{k}: {_yaml(v)}" for k, v in fm.items() if v is not None]
    out += ["---", "", f"# {escape(song['title'])}", ""]

    meta = []
    if club:
        meta.append(f"**Kring:** {escape(club['name'])}")
    if song["lyricist"]:
        meta.append(f"**T:** {escape(song['lyricist'])}")
    if song["melody"]:
        meta.append(f"**M:** {escape(song['melody'])}")
    p = song["pages"]
    meta.append(f"p. {p['start']}" if p["start"] == p["end"] else f"pp. {p['start']}–{p['end']}")
    out += [" · ".join(meta), ""]

    if song["notes"]:
        for para in song["notes"].split("\n"):
            out += [f"*{escape(para)}*", ""]

    for st in song["stanzas"]:
        kind = st["kind"]
        times = f" ({_TIMES.get(st['repeat'], str(st['repeat']) + '×')})" if st.get("repeat") else ""
        if kind == "verse":
            out.append(_block(_stanza_lines(st)))
        elif kind == "chorus":
            out.append(_block(_stanza_lines(st), "> "))
        elif kind == "chorus-ref":
            extra = f" {escape(st['instruction'])}" if st.get("instruction") else ""
            out.append(f"> *Refrein{extra}*{times}")
        else:  # direction
            out.append(f"*{escape(st['instruction'])}*{times}")
        out.append("")
    return "\n".join(out)


def render_index(data: dict[str, list]) -> str:
    out = ["# Codex Bruxellensis", ""]
    for sec in data["sections"]:
        songs = sorted(
            (s for s in data["songs"] if s["section"] == sec["id"]),
            key=lambda s: s["sortTitle"],
        )
        out += [f"## {escape(sec['title'])}", ""]
        out += [
            f"- [{escape(s['sortTitle'])}]({sec['id']}/{s['id']}.md) — p. {s['pages']['start']}"
            for s in songs
        ]
        out.append("")
    return "\n".join(out)


def write_md(data: dict[str, list], out_dir: Path) -> None:
    # Start clean so renamed or removed songs don't leave stale files behind.
    if out_dir.exists():
        shutil.rmtree(out_dir)
    clubs = {c["id"]: c for c in data["clubs"]}
    for song in data["songs"]:
        path = out_dir / song["section"] / f"{song['id']}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_song(song, clubs.get(song["clubId"])), encoding="utf-8")
    (out_dir / "README.md").write_text(render_index(data), encoding="utf-8")
