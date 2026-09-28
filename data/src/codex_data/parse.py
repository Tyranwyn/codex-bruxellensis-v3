"""Build clubs and songs from the typed lines of the song pages."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from .language import detect_language
from .layout import Line, Page, Role

# PDF page numbers equal printed page numbers in this book.
SECTIONS = [
    # id, title, first page (the divider), language or None to detect
    ("kringliederen", "Kringliederen", 31, None),
    ("officiele-liederen", "Officiële liederen", 89, None),
    ("nederlandstalige-liederen", "Nederlandstalige liederen", 101, "nl"),
    ("franstalige-liederen", "Franstalige liederen", 257, "fr"),
    ("duitstalige-liederen", "Duitstalige liederen", 413, "de"),
    ("engelstalige-liederen", "Engelstalige liederen", 463, "en"),
    ("anderstalige-liederen", "Anderstalige liederen", 517, None),
]
INDEX_START = 533

# A new stanza starts when a line sits further below the previous one than this.
STANZA_GAP = 16.0
# Consecutive heading/direction/meta lines closer than this belong together.
BLOCK_GAP = 14.0
# A meta line reaching this far right was wrapped; the next line continues it.
WRAP_X1 = 395.0

CLUB_KEYS = re.compile(r"^(Gesticht|Kleur|Stichter)", re.I)
REFRAIN = re.compile(r"^refrein\b[\s:]*", re.I)
# Footnotes sit at the foot of the page and start with the marker used in the
# lyrics ("Brussels* bier"). They are set in the lyric or the direction font.
FOOTNOTE = re.compile(r"^\*\s")


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def join_wrapped(parts: list[str]) -> str:
    out = ""
    for p in parts:
        if not out:
            out = p
        elif out.endswith("-") and p[:1].islower():
            out = out[:-1] + p
        else:
            out += " " + p
    return out


def _names(text: str) -> list[str]:
    text = re.sub(r"^\s*en\s+", "", text)
    return [n.strip() for n in re.split(r",|\s+en\s+|\s+&\s+", text) if n.strip()]


def paragraphs(lines: list[Line]) -> list[str]:
    """Group meta/direction lines into paragraphs using line wrapping."""
    paras: list[list[str]] = []
    prev: Line | None = None
    for ln in lines:
        if prev is not None and prev.x1 >= WRAP_X1:
            paras[-1].append(ln.text)
        else:
            paras.append([ln.text])
        prev = ln
    return [join_wrapped(p) for p in paras]


@dataclass
class PlacedLine:
    page: int
    center: float
    stanza: "Stanza"
    index: int


@dataclass
class Stanza:
    kind: str
    lines: list[str] = field(default_factory=list)
    repeats: list[dict] = field(default_factory=list)
    repeat: int | None = None
    instruction: str | None = None

    def to_json(self) -> dict:
        d: dict = {"kind": self.kind}
        if self.lines:
            d["lines"] = self.lines
        if self.repeats:
            d["repeats"] = sorted(self.repeats, key=lambda r: (r["from"], r["to"]))
        if self.repeat:
            d["repeat"] = self.repeat
        if self.instruction:
            d["instruction"] = self.instruction
        return d


@dataclass
class Song:
    title: str
    section: str
    language: str | None
    club_id: str | None
    page_start: int
    page_end: int
    lyricist: str | None = None
    melody: str | None = None
    notes: list[str] = field(default_factory=list)
    stanzas: list[Stanza] = field(default_factory=list)
    footnotes: list[str] = field(default_factory=list)
    sort_title: str | None = None
    id: str = ""

    def text_sample(self) -> str:
        return " ".join(ln for s in self.stanzas for ln in s.lines)

    def to_json(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "sortTitle": self.sort_title or self.title,
            "section": self.section,
            "language": self.language,
            "clubId": self.club_id,
            "pages": {"start": self.page_start, "end": self.page_end},
            "lyricist": self.lyricist,
            "melody": self.melody,
            "notes": "\n".join(self.notes) or None,
            "stanzas": [s.to_json() for s in self.stanzas],
            "footnotes": self.footnotes,
        }


@dataclass
class Club:
    id: str
    name: str
    motto: str | None = None
    description: list[str] = field(default_factory=list)
    founded: int | None = None
    founders: list[str] = field(default_factory=list)
    colours: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "motto": self.motto,
            "description": "\n".join(self.description) or None,
            "founded": self.founded,
            "founders": self.founders,
            "colours": self.colours,
        }


class Parser:
    def __init__(self) -> None:
        self.songs: list[Song] = []
        self.clubs: list[Club] = []
        self.section: tuple | None = None
        self.club: Club | None = None
        self.song: Song | None = None
        self.stanza: Stanza | None = None
        self.last_lyric: Line | None = None
        self._last_page: int | None = None
        self.placed: list[PlacedLine] = []
        self.warnings: list[str] = []

    # -- page level -------------------------------------------------------

    def feed(self, page: Page) -> None:
        for sec in SECTIONS:
            if sec[2] == page.number:
                self._close_song()
                self.section, self.club = sec, None
                return
        if self.section is None:
            return

        lines = self._drop_captions([ln for ln in page.lines if ln.role is not Role.PAGE_NUMBER])
        i = 0
        while i < len(lines):
            ln = lines[i]
            if ln.role is Role.HEADING:
                heading = self._take_block(lines, i, {Role.HEADING})
                meta = self._take_block(lines, i + len(heading), {Role.META})
                i += len(heading) + len(meta)
                followed_by_heading = i < len(lines) and lines[i].role is Role.HEADING
                self._start_heading(heading, meta, page.number, followed_by_heading)
            elif ln.role is Role.DIRECTION:
                block = self._take_block(lines, i, {Role.DIRECTION})
                if FOOTNOTE.match(ln.text):
                    self._add_footnote(block, page.number)
                else:
                    self._add_direction(block, page.number)
                i += len(block)
            elif ln.role in (Role.VERSE, Role.CHORUS):
                if FOOTNOTE.match(ln.text):
                    block = self._take_block(lines, i, {Role.VERSE, Role.CHORUS})
                    self._add_footnote(block, page.number)
                    i += len(block)
                    continue
                # A few "Refrein" instructions are set in the lyric font.
                if REFRAIN.match(ln.text) and len(ln.text) < 40:
                    self._add_direction([ln], page.number)
                else:
                    self._add_lyric(ln, page.number)
                i += 1
            elif ln.role is Role.META:
                block = self._take_block(lines, i, {Role.META})
                if self.song is not None:
                    self.song.notes.extend(paragraphs(block))
                    self.song.page_end = page.number
                else:
                    self.warnings.append(f"p{page.number}: meta outside a song: {ln.text!r}")
                i += len(block)
            else:
                self.warnings.append(f"p{page.number}: unhandled {ln.role.value} line: {ln.text!r}")
                i += 1

        self._apply_brackets(page)
        for rep in page.orphans:
            self.warnings.append(f"p{page.number}: repeat marker {rep.marker} not attached to any line")

    def finish(self) -> None:
        self._close_song()

    @staticmethod
    def _drop_captions(lines: list[Line]) -> list[Line]:
        out, skipping = [], False
        for ln in lines:
            if ln.role is Role.CAPTION:
                skipping = True
                continue
            if skipping and ln.role in (Role.DIRECTION, Role.META):
                continue
            skipping = False
            out.append(ln)
        return out

    @staticmethod
    def _take_block(lines: list[Line], start: int, roles: set[Role]) -> list[Line]:
        block: list[Line] = []
        for ln in lines[start:]:
            if ln.role not in roles:
                break
            if block and ln.top - block[-1].top > BLOCK_GAP:
                break
            block.append(ln)
        return block

    # -- headings ---------------------------------------------------------

    def _start_heading(
        self, heading: list[Line], meta: list[Line], page: int, followed_by_heading: bool
    ) -> None:
        self._close_song()
        # Club headers list founding year/colours. A few only have a
        # description; those are recognised by leading straight into a song.
        has_tm = any(re.match(r"^[TM]:", m.text) for m in meta)
        if any(CLUB_KEYS.match(m.text) for m in meta) or (meta and not has_tm and followed_by_heading):
            self._start_club(heading, meta)
            return
        assert self.section is not None
        song = Song(
            title=" ".join(h.text for h in heading),
            section=self.section[0],
            language=self.section[3],
            club_id=self.club.id if self.club else None,
            page_start=page,
            page_end=page,
        )
        field_name: str | None = None
        for para in paragraphs(meta):
            m = re.match(r"^([TM]):\s*(.*)$", para)
            if m:
                field_name = "lyricist" if m.group(1) == "T" else "melody"
                setattr(song, field_name, m.group(2))
            else:
                song.notes.append(para)
        self.song = song

    def _start_club(self, heading: list[Line], meta: list[Line]) -> None:
        # A second heading line is a motto when quoted ("GEEN TAAL GEEN
        # VRIJHEID"), otherwise the name wrapped ("PSYCHOPEDAGOGISCHE KRING").
        name_parts = [heading[0].text]
        motto_parts = []
        for h in heading[1:]:
            (motto_parts if motto_parts or h.text[:1] in "“\"‘" else name_parts).append(h.text)
        name = " ".join(name_parts)
        club = Club(id=slugify(name), name=name, motto=" ".join(motto_parts) or None)

        # Club headers are hand-broken lines, so work line by line. A line
        # without a key continues the previous key (founders wrap).
        key = None
        founders: list[str] = []
        for ln in meta:
            text = ln.text
            low = text.lower()
            if low.startswith("gesticht"):
                key = "founded"
                year = re.search(r"\b(1[0-9]{3}|20[0-9]{2})\b", text)
                if year and club.founded is None:
                    club.founded = int(year.group(1))
                # Keep anything richer than "Gesticht in 1977" as description.
                if not re.fullmatch(r"Gesticht( in|:)? *[0-9]{4}\.?", text):
                    club.description.append(text)
            elif low.startswith("sticht"):  # Stichter(s), Stichtster(s)
                key = "founders"
                founders.append(text.split(":", 1)[1] if ":" in text else "")
            elif low.startswith("kleur"):
                key = "colours"
                value = text.split(":", 1)[1] if ":" in text else ""
                club.colours = [c.strip() for c in re.split(r"[–-]", value) if c.strip()]
            elif key == "founders":
                founders.append(text)
            elif club.description and (club.description[-1].endswith("-") or text[:1].islower()):
                club.description[-1] = join_wrapped([club.description[-1], text])
            else:
                key = None
                club.description.append(text)
        club.founders = _names(join_wrapped([f.strip() for f in founders if f.strip()]))
        self.clubs.append(club)
        self.club = club

    # -- lyrics -----------------------------------------------------------

    def _add_lyric(self, ln: Line, page: int) -> None:
        if self.song is None:
            self.warnings.append(f"p{page}: lyric outside a song: {ln.text!r}")
            return
        kind = "chorus" if ln.role is Role.CHORUS else "verse"
        prev = self.last_lyric
        st = self.stanza
        # The book never splits a stanza across pages (checked on all 179
        # in-song page breaks), so a new page always starts a new stanza.
        same_block = (
            st is not None
            and st.kind == kind
            and prev is not None
            and self._last_page == page
            and ln.top - prev.top <= STANZA_GAP
        )
        if not same_block:
            st = Stanza(kind=kind)
            self.song.stanzas.append(st)
            self.stanza = st
        assert st is not None
        st.lines.append(ln.text)
        idx = len(st.lines) - 1
        if ln.repeat is not None:
            st.repeats.append(self._span(idx, idx, ln.repeat))
        self.placed.append(PlacedLine(page=page, center=ln.center, stanza=st, index=idx))
        self.last_lyric = ln
        self._last_page = page
        self.song.page_end = page

    def _add_direction(self, block: list[Line], page: int) -> None:
        if self.song is None:
            self.warnings.append(f"p{page}: direction outside a song: {block[0].text!r}")
            return
        text = join_wrapped([b.text for b in block])
        rep = next((b.repeat for b in block if b.repeat is not None), None)
        m = REFRAIN.match(text)
        if m:
            st = Stanza(kind="chorus-ref", instruction=text[m.end():].strip() or None)
        else:
            st = Stanza(kind="direction", instruction=text)
        if rep is not None and rep.times:
            st.repeat = rep.times
        self.song.stanzas.append(st)
        self.song.page_end = page
        self.stanza = None
        self.last_lyric = None

    def _add_footnote(self, block: list[Line], page: int) -> None:
        if self.song is None:
            self.warnings.append(f"p{page}: footnote outside a song: {block[0].text!r}")
            return
        # Footnotes are prose, wrapped by hand to the lyric column.
        self.song.footnotes.append(join_wrapped([b.text for b in block]))
        self.song.page_end = page
        self.stanza = None
        self.last_lyric = None

    @staticmethod
    def _span(a: int, b: int, rep) -> dict:
        d = {"from": a, "to": b, "marker": rep.marker}
        if rep.times:
            d["times"] = rep.times
        return d

    def _apply_brackets(self, page: Page) -> None:
        for br in page.brackets:
            hits = [
                p
                for p in self.placed
                if p.page == page.number and br.top - 2 <= p.center <= br.bottom + 2
            ]
            if not hits:
                self.warnings.append(f"p{page.number}: bracket {br.repeat.marker} covers no lines")
                continue
            st = hits[0].stanza
            if any(h.stanza is not st for h in hits):
                self.warnings.append(f"p{page.number}: bracket {br.repeat.marker} spans stanzas")
            idx = [h.index for h in hits if h.stanza is st]
            st.repeats.append(self._span(min(idx), max(idx), br.repeat))

    def _close_song(self) -> None:
        if self.song is not None:
            if self.song.stanzas:
                if self.song.language is None:
                    self.song.language = detect_language(self.song.title + " " + self.song.text_sample())
                self.songs.append(self.song)
            else:
                self.warnings.append(f"p{self.song.page_start}: heading without lyrics: {self.song.title!r}")
        self.song = None
        self.stanza = None
        self.last_lyric = None
        self._last_page = None


INDEX_LINE = re.compile(r"^(?P<title>.*?\D)[\s.]*(?P<page>\d+)$")


def parse_index(pages: list[Page]) -> list[tuple[str, int]]:
    entries: list[tuple[str, int]] = []
    pending = ""
    for page in pages:
        for ln in page.lines:
            if ln.role is Role.PAGE_NUMBER or ln.role is Role.DIVIDER:
                continue
            text = (pending + " " + ln.text).strip() if pending else ln.text
            m = INDEX_LINE.match(text)
            if m:
                entries.append((m.group("title").strip(), int(m.group("page"))))
                pending = ""
            else:
                pending = text
    return entries


def _words(title: str) -> list[str]:
    return sorted(slugify(title).split("-"))


def assign_sort_titles(songs: list[Song], index: list[tuple[str, int]], warnings: list[str]) -> None:
    by_page: dict[int, list[str]] = {}
    for title, page in index:
        by_page.setdefault(page, []).append(title)
    # The index sometimes points one or two pages early (at an illustration
    # facing the song), so look at nearby pages too, nearest first.
    for song in songs:
        for delta in (0, -1, 1, -2, 2):
            match = next(
                (t for t in by_page.get(song.page_start + delta, []) if _words(t) == _words(song.title)),
                None,
            )
            if match:
                song.sort_title = match
                break
        else:
            warnings.append(f"p{song.page_start}: no index entry for {song.title!r}")


def assign_ids(songs: list[Song]) -> None:
    seen: dict[str, int] = {}
    for song in songs:
        base = slugify(song.title) or "song"
        n = seen.get(base, 0) + 1
        seen[base] = n
        song.id = base if n == 1 else f"{base}-{n}"
