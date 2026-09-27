import argparse
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2]
PDF_PATH = DATA_DIR / "source" / "codex2022.pdf"
JSON_DIR = DATA_DIR / "output" / "json"
SQL_DIR = DATA_DIR / "output" / "sql"
MD_DIR = DATA_DIR / "output" / "md"
SCHEMA_SQL = DATA_DIR / "schema" / "schema.sql"


def main() -> None:
    parser = argparse.ArgumentParser(prog="codex-data")
    sub = parser.add_subparsers(dest="command", required=True)

    dump = sub.add_parser("dump", help="print the typed lines of PDF pages (for debugging)")
    dump.add_argument("pages", nargs="+", type=int, help="1-based PDF page numbers")

    sub.add_parser("extract", help="convert the PDF into output/json, output/sql and output/md")

    args = parser.parse_args()

    if args.command == "extract":
        from .export_md import write_md
        from .export_sql import write_sql
        from .extract import extract, write_json

        data, warnings = extract(PDF_PATH)
        write_json(data, JSON_DIR)
        write_sql(data, SCHEMA_SQL, SQL_DIR)
        write_md(data, MD_DIR)
        for w in warnings:
            print("warning:", w)
        print(
            f"{len(data['songs'])} songs, {len(data['clubs'])} clubs, "
            f"{len(warnings)} warnings → {DATA_DIR / 'output'}"
        )

    if args.command == "dump":
        from .layout import open_pdf, read_page

        with open_pdf(str(PDF_PATH)) as pdf:
            for n in args.pages:
                page = read_page(pdf.pages[n - 1])
                print(f"=== PDF page {n}")
                for ln in page.lines:
                    rep = f"  {ln.repeat.marker}" if ln.repeat else ""
                    print(f"{ln.role.value:12} {ln.x0:6.1f} {ln.top:6.1f}  {ln.text}{rep}")
                for b in page.brackets:
                    print(f"{'bracket':12} {b.top:6.1f}-{b.bottom:.1f}  {b.repeat.marker}")
