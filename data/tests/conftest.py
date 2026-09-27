import pytest

from codex_data import PDF_PATH
from codex_data.extract import extract
from codex_data.layout import open_pdf, read_page


@pytest.fixture(scope="session")
def pdf():
    with open_pdf(str(PDF_PATH)) as doc:
        yield doc


@pytest.fixture(scope="session")
def page(pdf):
    cache = {}

    def get(n: int):
        if n not in cache:
            cache[n] = read_page(pdf.pages[n - 1])
        return cache[n]

    return get


@pytest.fixture(scope="session")
def extracted():
    """Full extraction, run once per test session (~6 s)."""
    return extract(PDF_PATH)


@pytest.fixture(scope="session")
def songs(extracted):
    return {s["id"]: s for s in extracted[0]["songs"]}
