"""PDF → output/json/{songs,clubs,sections}.json."""

from __future__ import annotations

import json
from pathlib import Path

from . import overrides
from .layout import open_pdf, read_page
from .parse import (
    INDEX_START,
    SECTIONS,
    Parser,
    assign_ids,
    assign_sort_titles,
    parse_index,
)


def extract(pdf_path: Path) -> tuple[dict[str, list], list[str]]:
    parser = Parser()
    with open_pdf(str(pdf_path)) as pdf:
        for n in range(SECTIONS[0][2], INDEX_START):
            parser.feed(read_page(pdf.pages[n - 1]))
        parser.finish()
        index = parse_index([read_page(pdf.pages[n - 1]) for n in range(INDEX_START, len(pdf.pages) + 1)])

    assign_sort_titles(parser.songs, index, parser.warnings)
    assign_ids(parser.songs)
    parser.warnings.extend(overrides.apply(parser.songs))
    data = {
        "sections": [
            {"id": sid, "title": title, "position": i, "startPage": page}
            for i, (sid, title, page, _lang) in enumerate(SECTIONS)
        ],
        "clubs": [c.to_json() for c in parser.clubs],
        "songs": [s.to_json() for s in parser.songs],
    }
    return data, parser.warnings


def write_json(data: dict[str, list], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in data.items():
        with open(out_dir / f"{name}.json", "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
            f.write("\n")
