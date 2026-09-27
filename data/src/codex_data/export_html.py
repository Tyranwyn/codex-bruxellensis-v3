"""JSON rows → output/html/<section>/<song-id>.html, plus index.html and style.css.

A static site with no build step and no external requests, so it also works
from file://. Choruses are italic and indented, like the book. A repeat marker
over one line goes at the end of that line. A marker over several lines becomes
a bracket beside them, drawn in the lyrics grid. Nested or overlapping brackets
get their own columns ("lanes").
"""

from __future__ import annotations

import shutil
from html import escape
from pathlib import Path

_TIMES = {2: "BIS", 3: "TER", 4: "QUATER"}


def _times(n: int | None) -> str:
    return f" ({_TIMES.get(n, f'{n}×')})" if n else ""


def _pages(p: dict) -> str:
    return f"p. {p['start']}" if p["start"] == p["end"] else f"pp. {p['start']}–{p['end']}"


def _lanes(spans: list[dict]) -> list[int]:
    """Give each multi-line span the first lane free over its whole range."""
    taken: list[list[tuple[int, int]]] = []
    out = []
    for s in spans:
        for i, lane in enumerate(taken):
            if all(s["to"] < a or s["from"] > b for a, b in lane):
                break
        else:
            i = len(taken)
            taken.append([])
        taken[i].append((s["from"], s["to"]))
        out.append(i)
    return out


def _lyrics(st: dict) -> str:
    lines = st.get("lines", [])
    spans = st.get("repeats", [])
    inline: dict[int, list[str]] = {}
    brackets = []
    for s in spans:
        if s["from"] == s["to"]:
            inline.setdefault(s["to"], []).append(s["marker"])
        else:
            brackets.append(s)
    # Shorter (inner) spans take the lanes nearest the text.
    brackets.sort(key=lambda s: (s["to"] - s["from"], s["from"]))
    lanes = _lanes(brackets)

    cells = []
    for i, text in enumerate(lines):
        marks = "".join(f' <span class="mark">{escape(m)}</span>' for m in inline.get(i, []))
        cells.append(f'<span class="line" style="grid-row:{i + 1}">{escape(text)}{marks}</span>')
    for s, lane in zip(brackets, lanes):
        n = s["to"] - s["from"] + 1
        cells.append(
            f'<span class="bracket" style="grid-row:{s["from"] + 1}/{s["to"] + 2};grid-column:{lane + 2}"'
            f' title="{escape(s["marker"])}, {n} regels">{escape(s["marker"])}</span>'
        )
    # Let the text column shrink and wrap on narrow screens; brackets stay beside it.
    style = f' style="grid-template-columns:minmax(0,max-content) repeat({max(lanes) + 1},auto)"' if lanes else ""
    return f'<div class="lines"{style}>{"".join(cells)}</div>'


def _stanza(st: dict) -> str:
    kind = st["kind"]
    if kind in ("verse", "chorus"):
        return f'<div class="stanza {kind}">{_lyrics(st)}</div>'
    times = _times(st.get("repeat"))
    if kind == "chorus-ref":
        extra = f" {escape(st['instruction'])}" if st.get("instruction") else ""
        return f'<p class="stanza chorus-ref">Refrein{extra}{times}</p>'
    return f'<p class="stanza direction">{escape(st["instruction"])}{times}</p>'


def _page(title: str, css: str, body: str, lang: str = "nl") -> str:
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<link rel="stylesheet" href="{css}">
</head>
<body>
{body}
</body>
</html>
"""


def _club_card(club: dict) -> str:
    rows = []
    if club["motto"]:
        rows.append(f'<p class="motto">{escape(club["motto"])}</p>')
    if club["description"]:
        # Keep the book's line breaks; they are meaningful (name, faculty, ...).
        text = escape(club["description"]).replace("\n", "<br>")
        rows.append(f"<p>{text}</p>")
    facts = []
    if club["founded"]:
        facts.append(f"<dt>Gesticht</dt><dd>{club['founded']}</dd>")
    if club["founders"]:
        facts.append(f"<dt>Stichters</dt><dd>{escape(', '.join(club['founders']))}</dd>")
    if club["colours"]:
        facts.append(f"<dt>Kleuren</dt><dd>{escape(' – '.join(club['colours']))}</dd>")
    if facts:
        rows.append(f"<dl>{''.join(facts)}</dl>")
    return f'<aside class="club"><h2>{escape(club["name"])}</h2>{"".join(rows)}</aside>'


def render_song(
    song: dict, club: dict | None, section: dict, prev: dict | None, nxt: dict | None
) -> str:
    meta = []
    if song["lyricist"]:
        meta.append(f"<dt>T</dt><dd>{escape(song['lyricist'])}</dd>")
    if song["melody"]:
        meta.append(f"<dt>M</dt><dd>{escape(song['melody'])}</dd>")

    def link(s: dict | None, rel: str, label: str) -> str:
        if not s:
            return "<span></span>"
        return f'<a rel="{rel}" href="{s["id"]}.html">{label}</a>'

    body = [
        '<nav class="crumbs">'
        f'<a href="../index.html">Codex Bruxellensis</a> › '
        f'<a href="../index.html#{section["id"]}">{escape(section["title"])}</a></nav>',
        f'<main lang="{song["language"]}">',
        "<header>",
        f"<h1>{escape(song['title'])}</h1>",
        f'<p class="pages">{_pages(song["pages"])}</p>',
    ]
    if meta:
        body.append(f'<dl class="meta">{"".join(meta)}</dl>')
    body.append("</header>")
    if club:
        body.append(_club_card(club))
    if song["notes"]:
        body += [f'<p class="note">{escape(p)}</p>' for p in song["notes"].split("\n")]
    body += [_stanza(st) for st in song["stanzas"]]
    body += [
        "</main>",
        '<nav class="pager">'
        + link(prev, "prev", f"← {escape(prev['title']) if prev else ''}")
        + link(nxt, "next", f"{escape(nxt['title']) if nxt else ''} →")
        + "</nav>",
    ]
    return _page(song["title"], "../style.css", "\n".join(body), song["language"])


_SEARCH = """<script>
const q = document.getElementById("q");
const norm = s => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
for (const li of document.querySelectorAll("li")) li.dataset.k = norm(li.textContent);
q.addEventListener("input", () => {
  const t = norm(q.value.trim());
  for (const sec of document.querySelectorAll("section")) {
    let n = 0;
    for (const li of sec.querySelectorAll("li")) {
      const hit = li.dataset.k.includes(t);
      li.hidden = !hit;
      n += hit;
    }
    sec.hidden = n === 0;
  }
});
</script>"""


def render_index(data: dict[str, list]) -> str:
    body = [
        "<main>",
        "<header><h1>Codex Bruxellensis</h1>",
        f'<p class="pages">{len(data["songs"])} liederen</p></header>',
        '<input id="q" type="search" placeholder="Zoeken…" aria-label="Zoeken" autocomplete="off">',
        '<nav class="toc">'
        + " · ".join(f'<a href="#{s["id"]}">{escape(s["title"])}</a>' for s in data["sections"])
        + "</nav>",
    ]
    for sec in data["sections"]:
        songs = sorted(
            (s for s in data["songs"] if s["section"] == sec["id"]),
            key=lambda s: s["sortTitle"],
        )
        items = "".join(
            f'<li><a href="{sec["id"]}/{s["id"]}.html">{escape(s["sortTitle"])}</a>'
            f'<span class="pg">{s["pages"]["start"]}</span></li>'
            for s in songs
        )
        body.append(f'<section id="{sec["id"]}"><h2>{escape(sec["title"])}</h2><ul>{items}</ul></section>')
    body += ["</main>", _SEARCH]
    return _page("Codex Bruxellensis", "style.css", "\n".join(body))


CSS = """\
:root {
  --bg: #fbf8f1; --fg: #222; --muted: #6b6559; --accent: #8a2b1d; --rule: #d9d1c1; --card: #f3eee2;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #1b1a17; --fg: #e8e3d8; --muted: #9c9587; --accent: #e28a6e; --rule: #3b3831; --card: #25231f; }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0; padding: 1.5rem 1rem 4rem; background: var(--bg); color: var(--fg);
  font: 1.0625rem/1.55 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
}
main, nav { max-width: 40rem; margin: 0 auto; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1 { font-size: 1.6rem; letter-spacing: .04em; margin: .5rem 0 0; line-height: 1.2; }
h2 { font-size: 1.1rem; letter-spacing: .04em; }
.crumbs, .pages, .toc, .pager, .meta, .direction, .chorus-ref, .club, .note, .pg, .mark, .bracket, #q {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .85rem;
}
.crumbs, .pages, .pg { color: var(--muted); }
.pages { margin: .25rem 0 1rem; }
.meta { display: grid; grid-template-columns: auto 1fr; gap: .15rem .6rem; margin: 0 0 1.25rem; }
.meta dt { font-weight: 600; color: var(--muted); }
.meta dd { margin: 0; }
.club { background: var(--card); border-radius: .5rem; padding: .75rem 1rem; margin: 0 0 1.5rem; }
.club h2 { margin: 0 0 .25rem; font-size: .95rem; }
.club p { margin: .25rem 0; }
.club .motto { font-style: italic; }
.club dl { display: grid; grid-template-columns: auto 1fr; gap: .1rem .6rem; margin: .5rem 0 0; }
.club dt { color: var(--muted); }
.club dd { margin: 0; }
.note { font-style: italic; color: var(--muted); }
.stanza { margin: 0 0 1.25rem; }
.chorus { font-style: italic; padding-left: 1.5rem; }
.chorus-ref { font-style: italic; padding-left: 1.5rem; color: var(--muted); }
.direction { color: var(--muted); }
.lines { display: grid; grid-template-columns: minmax(0, max-content); column-gap: .75rem; }
.line { grid-column: 1; padding-left: 1.5em; text-indent: -1.5em; }
.mark, .bracket { font-style: normal; color: var(--muted); white-space: nowrap; }
.bracket { border-left: 1px solid var(--muted); padding-left: .4rem; display: flex; align-items: center; }
.pager { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2.5rem;
  padding-top: 1rem; border-top: 1px solid var(--rule); }
.pager a[rel=next] { text-align: right; }
#q { width: 100%; padding: .6rem .8rem; font-size: 1rem; border: 1px solid var(--rule); border-radius: .5rem;
  background: var(--card); color: var(--fg); margin: 0 0 .75rem; }
.toc { line-height: 1.9; margin-bottom: 1rem; }
section ul { list-style: none; padding: 0; margin: 0; }
section li { display: flex; justify-content: space-between; gap: 1rem; padding: .2rem 0;
  border-bottom: 1px dotted var(--rule); }
@media print {
  .crumbs, .pager, #q, .toc { display: none; }
  body { background: none; color: #000; }
}
"""


def write_html(data: dict[str, list], out_dir: Path) -> None:
    # Start clean so renamed or removed songs don't leave stale files behind.
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    clubs = {c["id"]: c for c in data["clubs"]}
    for sec in data["sections"]:
        songs = [s for s in data["songs"] if s["section"] == sec["id"]]
        (out_dir / sec["id"]).mkdir(exist_ok=True)
        for i, song in enumerate(songs):
            prev = songs[i - 1] if i > 0 else None
            nxt = songs[i + 1] if i + 1 < len(songs) else None
            html = render_song(song, clubs.get(song["clubId"]), sec, prev, nxt)
            (out_dir / sec["id"] / f"{song['id']}.html").write_text(html, encoding="utf-8")
    (out_dir / "index.html").write_text(render_index(data), encoding="utf-8")
    (out_dir / "style.css").write_text(CSS, encoding="utf-8")
