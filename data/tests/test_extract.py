import json
import re
import sqlite3

import jsonschema
import pytest

from codex_data import DATA_DIR, SCHEMA_SQL
from codex_data.export_sql import to_sql
from codex_data.layout import read_page
from codex_data.parse import INDEX_START, parse_index

SCHEMA_DIR = DATA_DIR / "schema"


def test_no_warnings(extracted):
    assert extracted[1] == []


def test_output_matches_schemas(extracted):
    data = extracted[0]
    song_v = jsonschema.Draft202012Validator(json.loads((SCHEMA_DIR / "song.schema.json").read_text()))
    club_v = jsonschema.Draft202012Validator(json.loads((SCHEMA_DIR / "club.schema.json").read_text()))
    for s in data["songs"]:
        song_v.validate(s)
    for c in data["clubs"]:
        club_v.validate(c)


def test_example_is_current(songs):
    example = json.loads((SCHEMA_DIR / "examples" / "antverpia-lied.json").read_text())
    assert songs["antverpia-lied"] == example


def test_every_index_entry_is_a_song(extracted, pdf):
    index = parse_index([read_page(pdf.pages[n - 1]) for n in range(INDEX_START, len(pdf.pages) + 1)])
    sort_titles = sorted(s["sortTitle"] for s in extracted[0]["songs"])
    assert sorted(t for t, _ in index) == sort_titles


def test_no_broken_accents_left(extracted):
    text = json.dumps(extracted[0], ensure_ascii=False)
    assert not re.search(r"[`´ˆ¨˜¸ˇ˘]", text)


def test_song_with_chorus_and_meta(songs):
    s = songs["ach-lieflijke-meisjes"]
    assert s["lyricist"] == "L. Dolhain"
    assert s["melody"] == "‘Etoile des neiges’"
    assert [st["kind"] for st in s["stanzas"]][:2] == ["verse", "chorus"]
    assert s["pages"] == {"start": 104, "end": 105}


def test_chorus_ref_with_instruction(songs):
    refs = [st for st in songs["het-loze-vissertje"]["stanzas"] if st["kind"] == "chorus-ref"]
    assert refs[-1]["instruction"] == "waarbij ‘zijnen’ door ‘uwen’ vervangen wordt."


def test_bracket_repeat_spans_lines(songs):
    # p129: a (BIS) next to a rule covering four lines, not "Tarara,".
    st = songs["disco-rolling"]["stanzas"][4]
    assert st["lines"][0] == "Tarara,"
    assert st["repeats"] == [{"from": 1, "to": 4, "marker": "(BIS)", "times": 2}]


@pytest.mark.parametrize(
    "club_id, founded, founders, colours",
    [
        ("antverpia", 1977, ["Leo Ven"], ["rood", "wit", "rood"]),
        ("mens-sana-in-corpore-sano", 1990, None, ["rood"]),
        ("psychopedagogische-kring", None, [], ["blauw"]),
    ],
)
def test_clubs(extracted, club_id, founded, founders, colours):
    club = next(c for c in extracted[0]["clubs"] if c["id"] == club_id)
    assert club["founded"] == founded
    assert club["colours"] == colours
    if founders is not None:
        assert club["founders"] == founders
    else:
        assert "Philip van der Veen" in club["founders"]


def test_motto_vs_wrapped_name(extracted):
    clubs = {c["id"]: c for c in extracted[0]["clubs"]}
    assert clubs["brussels-studentengenootschap"]["motto"] == "“GEEN TAAL GEEN VRIJHEID”"
    assert clubs["psychopedagogische-kring"]["motto"] is None


def test_sql_loads_with_valid_foreign_keys(extracted):
    db = sqlite3.connect(":memory:")
    db.executescript(to_sql(extracted[0], SCHEMA_SQL.read_text()))
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    assert db.execute("SELECT count(*) FROM song").fetchone()[0] == len(extracted[0]["songs"])


def test_markdown_files(extracted, tmp_path):
    from codex_data.export_md import escape, write_md

    data = extracted[0]
    write_md(data, tmp_path)
    files = list(tmp_path.glob("*/*.md"))
    assert len(files) == len(data["songs"])

    text = (tmp_path / "nederlandstalige-liederen" / "disco-rolling.md").read_text()
    assert text.startswith('---\nid: "disco-rolling"\n')
    assert "Ik heb U toch zo lief. (BIS, 4 regels)" in text

    chorus = (tmp_path / "nederlandstalige-liederen" / "ach-lieflijke-meisjes.md").read_text()
    assert "> Ach lieflijke meisjes\\\n" in chorus

    index = (tmp_path / "README.md").read_text()
    assert "(kringliederen/antverpia-lied.md)" in index
    assert escape("* De keuze") == "\\* De keuze"
    assert escape("1. Levate") == "1\\. Levate"
    assert escape("- ja") == "\\- ja"


def test_html_files(extracted, tmp_path):
    from codex_data.export_html import write_html

    data = extracted[0]
    write_html(data, tmp_path)
    assert len(list(tmp_path.glob("*/*.html"))) == len(data["songs"])
    assert (tmp_path / "style.css").exists()

    # Nested repeats: one-line markers inline, the 3-line one as a bracket.
    kreet = (tmp_path / "kringliederen" / "wk-kreet.html").read_text()
    assert 'Oeaaaah! <span class="mark">(BIS)</span>' in kreet
    assert 'class="bracket" style="grid-row:2/5;grid-column:2"' in kreet
    assert 'href="bourgeois-vereux.html"' in kreet

    chorus = (tmp_path / "nederlandstalige-liederen" / "ach-lieflijke-meisjes.html").read_text()
    assert '<div class="stanza chorus">' in chorus

    index = (tmp_path / "index.html").read_text()
    assert 'href="kringliederen/antverpia-lied.html"' in index
