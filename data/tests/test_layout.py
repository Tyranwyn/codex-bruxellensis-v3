from codex_data.layout import Role, compose_accents


def _char(text, x0, x1, top, size=9.0):
    return {"text": text, "x0": x0, "x1": x1, "top": top, "bottom": top + size, "size": size}


def test_accent_over_lowercase_letter_is_composed():
    chars = [_char("c", 0, 4, 10), _char("a", 4, 8, 10), _char("f", 8, 11, 10),
             _char("´", 11, 15, 10), _char("e", 11, 15, 10)]
    assert "".join(c["text"] for c in compose_accents(chars)) == "café"


def test_accent_above_capital_is_composed():
    # Capital accents sit a couple of points higher than the letter.
    chars = [_char("`", 1.4, 6, 254.8), _char("A", 0, 7, 257.1)]
    assert [c["text"] for c in compose_accents(chars)] == ["À"]


def test_circumflex_on_dotless_i():
    chars = [_char("ˆ", 0, 3, 10), _char("ı", 0, 3, 10)]
    assert [c["text"] for c in compose_accents(chars)] == ["î"]


def test_heading_and_accents(page):
    p = page(259)
    assert p.lines[0].role is Role.HEADING
    assert p.lines[0].text == "À BAS LA CALOTTE"
    assert any(ln.text == "Et dans les bégonias, c’est la même chose" for ln in p.lines)


def test_italic_lines_are_chorus_and_inline_repeat(page):
    p = page(35)
    first = p.lines[0]
    assert first.role is Role.CHORUS
    last_chorus = [ln for ln in p.lines if ln.role is Role.CHORUS][-1]
    assert last_chorus.text == "Maakte mij tot deel van BierKultuur"
    assert last_chorus.repeat is not None and last_chorus.repeat.times == 2


def test_bracketed_repeats(page):
    p = page(129)
    assert len(p.brackets) == 2
    assert all(b.repeat.marker == "(BIS)" for b in p.brackets)


def test_inline_marker_inside_bracket_span_stays_inline(page):
    p = page(382)
    assert len(p.brackets) == 1 and p.brackets[0].repeat.marker == "(BIS)"
    assert any(ln.repeat and ln.repeat.marker == "(TER)" for ln in p.lines)


def test_logo_fonts_are_ignored(page):
    # The Enigma logo prints binary digits next to the club info.
    assert all("1111" not in ln.text for ln in page(41).lines)
