"""Turn a pdfplumber page into typed text lines.

The book is typeset in LaTeX with Computer Modern fonts, and each font marks a
role:

- CMB10 11pt   heading (song title or club name)
- CMB10 17.9pt section divider page
- CMR9         lyrics (verse)
- CMTI9        lyrics (chorus, italic)
- CMR8 7.2pt   meta block under a heading (T:, M:, club info, notes, captions)
- CMSS8        stage direction ("Adfundum", "Refrein …")
- CMR8 8pt     repeat marker "(BIS)", "(TER)", …
- CMR10 8pt    page number

Accents are separate glyphs placed over (or under) their base letter, so they
are composed back into the base letter by position before lines are built.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum

import pdfplumber

ACCENTS = {
    "`": "̀",
    "´": "́",
    "ˆ": "̂",
    "^": "̂",
    "˜": "̃",
    "~": "̃",
    "¯": "̄",
    "˘": "̆",
    "˙": "̇",
    "¨": "̈",
    "˚": "̊",
    "ˇ": "̌",
    "¸": "̧",
}
DOTLESS = {"ı": "i", "ȷ": "j"}
LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl"}

REPEAT_RE = re.compile(r"\((BIS|TER|QUATER|QUAT|[A-Z]{2,})\)")
REPEAT_TIMES = {"BIS": 2, "TER": 3, "QUAT": 4, "QUATER": 4}

# Printer crop marks sit outside this horizontal band; bracket rules sit inside it.
BRACKET_X = (360.0, 400.0)


class Role(Enum):
    HEADING = "heading"
    DIVIDER = "divider"
    VERSE = "verse"
    CHORUS = "chorus"
    META = "meta"
    DIRECTION = "direction"
    PAGE_NUMBER = "page-number"
    CAPTION = "caption"
    OTHER = "other"


@dataclass
class Repeat:
    marker: str  # e.g. "(BIS)"
    times: int | None  # None for non-numeric markers such as "(ULB)"
    top: float
    bottom: float
    x0: float

    @property
    def center(self) -> float:
        return (self.top + self.bottom) / 2


@dataclass
class Line:
    text: str
    role: Role
    x0: float
    x1: float
    top: float
    bottom: float
    repeat: Repeat | None = None  # repeat marker printed on this line

    @property
    def center(self) -> float:
        return (self.top + self.bottom) / 2


@dataclass
class Bracket:
    """A vertical rule grouping several lines, with a repeat marker next to it."""

    top: float
    bottom: float
    repeat: Repeat


@dataclass
class Page:
    number: int  # 1-based PDF page index
    lines: list[Line] = field(default_factory=list)
    brackets: list[Bracket] = field(default_factory=list)
    orphans: list[Repeat] = field(default_factory=list)  # markers with no line nearby


def _font(c: dict) -> str:
    return c["fontname"].split("+")[-1]


def _role(font: str, size: float) -> Role:
    if font.startswith("CMB10"):
        return Role.DIVIDER if size > 15 else Role.HEADING
    if font == "CMTI9":
        return Role.CHORUS
    if font == "CMR9":
        return Role.VERSE
    if font.startswith("CMSS"):
        return Role.DIRECTION
    if font == "CMR8":
        return Role.META
    if font == "CMR10" and size < 9:
        return Role.PAGE_NUMBER
    if font.startswith("MSAM"):
        return Role.CAPTION
    return Role.OTHER


def compose_accents(chars: list[dict]) -> list[dict]:
    """Merge spacing accent glyphs into the letter they sit on."""
    accents = [c for c in chars if c["text"] in ACCENTS]
    if not accents:
        return chars
    out = [dict(c) for c in chars if c["text"] not in ACCENTS]
    for a in accents:
        ax = (a["x0"] + a["x1"]) / 2
        best, best_d = None, None
        for c in out:
            if not c["text"].isalpha():
                continue
            if not (c["x0"] - 1.0 <= ax <= c["x1"] + 1.0):
                continue
            # Accents above sit at or up to ~one size above the letter's top;
            # a cedilla sits at the baseline.
            dv = c["top"] - a["top"]
            if not (-c["size"] * 0.6 <= dv <= c["size"] * 1.2):
                continue
            d = abs(ax - (c["x0"] + c["x1"]) / 2) + abs(dv) * 0.1
            if best_d is None or d < best_d:
                best, best_d = c, d
        if best is None:
            continue  # stray accent glyph; drop it
        base = DOTLESS.get(best["text"], best["text"])
        best["text"] = unicodedata.normalize("NFC", base + ACCENTS[a["text"]])
    return out


def _group_lines(chars: list[dict]) -> list[list[dict]]:
    chars = sorted(chars, key=lambda c: (round(c["bottom"], 0), c["x0"]))
    lines: list[list[dict]] = []
    for c in chars:
        for line in lines:
            ref = line[0]
            if abs(ref["bottom"] - c["bottom"]) <= 2.0:
                line.append(c)
                break
        else:
            lines.append([c])
    for line in lines:
        line.sort(key=lambda c: c["x0"])
    lines.sort(key=lambda ln: min(c["top"] for c in ln))
    return lines


def _text(chars: list[dict]) -> str:
    out = []
    prev = None
    for c in chars:
        if prev is not None:
            gap = c["x0"] - prev["x1"]
            if gap > max(prev["size"], c["size"]) * 0.2:
                out.append(" ")
        out.append(LIGATURES.get(c["text"], c["text"]))
        prev = c
    return "".join(out)


def _split_repeats(chars: list[dict]) -> tuple[list[dict], list[Repeat]]:
    """Pull "(BIS)"-style markers (CMR8 at 8pt) out of the character stream."""
    marker_chars = [c for c in chars if _font(c) == "CMR8" and c["size"] > 7.6]
    rest = [c for c in chars if not (_font(c) == "CMR8" and c["size"] > 7.6)]
    repeats: list[Repeat] = []
    leftovers: list[dict] = []
    for group in _group_lines(marker_chars):
        text = _text(group)
        pos = 0
        for m in REPEAT_RE.finditer(text):
            # Map the match back to characters (text has inserted spaces).
            span = [c for c in group if c["text"] != " "]
            n_before = len(text[: m.start()].replace(" ", ""))
            n_match = len(m.group(0).replace(" ", ""))
            used = span[n_before : n_before + n_match]
            leftovers.extend(span[pos:n_before])
            pos = n_before + n_match
            word = m.group(1)
            repeats.append(
                Repeat(
                    marker=m.group(0),
                    times=REPEAT_TIMES.get(word),
                    top=min(c["top"] for c in used),
                    bottom=max(c["bottom"] for c in used),
                    x0=min(c["x0"] for c in used),
                )
            )
        leftovers.extend([c for c in group if c["text"] != " "][pos:])
    return rest + leftovers, repeats


def _line_role(chars: list[dict]) -> Role:
    counts: dict[Role, int] = {}
    for c in chars:
        r = _role(_font(c), c["size"])
        if r is Role.OTHER:
            continue  # math-font ellipses etc. take the role of their line
        counts[r] = counts.get(r, 0) + 1
    if Role.CAPTION in counts:
        return Role.CAPTION
    if not counts:
        return Role.OTHER
    return max(counts, key=counts.__getitem__)


def read_page(page: pdfplumber.page.Page) -> Page:
    # Only TeX fonts carry text; logos use other fonts. Some pages also have
    # stray glyphs outside the page box.
    chars = [
        c
        for c in page.chars
        if _font(c).startswith(("CM", "MSAM")) and 0 <= c["x0"] <= page.width
    ]
    chars = compose_accents(chars)
    chars, repeats = _split_repeats(chars)

    lines = []
    for group in _group_lines(chars):
        text = _text(group).strip()
        if not text:
            continue
        lines.append(
            Line(
                text=text,
                role=_line_role(group),
                x0=min(c["x0"] for c in group),
                x1=max(c["x1"] for c in group),
                top=min(c["top"] for c in group),
                bottom=max(c["bottom"] for c in group),
            )
        )

    rules = [
        o
        for o in page.lines + page.rects
        if BRACKET_X[0] <= o["x0"] <= BRACKET_X[1] and o["bottom"] - o["top"] > 5
    ]
    result = Page(number=page.page_number, lines=lines)
    lyric = [ln for ln in lines if ln.role in (Role.VERSE, Role.CHORUS, Role.DIRECTION)]
    for rep in repeats:
        # A bracket's marker sits just right of the rule; inline markers to
        # its left belong to their own line even when inside the rule's span.
        rule = next(
            (
                r
                for r in rules
                if r["top"] - 2 <= rep.center <= r["bottom"] + 2 and 0 < rep.x0 - r["x0"] < 25
            ),
            None,
        )
        if rule is not None:
            result.brackets.append(Bracket(top=rule["top"], bottom=rule["bottom"], repeat=rep))
            continue
        target = min(lyric, key=lambda ln: abs(ln.center - rep.center), default=None)
        if target is not None and abs(target.center - rep.center) < 6:
            if target.repeat is None:
                target.repeat = rep
                continue
        result.orphans.append(rep)
    return result


def open_pdf(path: str) -> pdfplumber.PDF:
    return pdfplumber.open(path)
