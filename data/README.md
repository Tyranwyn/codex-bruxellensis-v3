# Data

Converts the songbook PDF into structured data that the backend and frontend can use.

```sh
uv run codex-data extract   # regenerate output/
uv run pytest               # check the output
```

- `source/`: the original input. It isn't in git, so place `codex2022.pdf` here yourself before running anything.
- `src/codex_data/`: the extraction pipeline (pdfplumber).
- `schema/`: the data model (JSON Schema and SQL) plus an example song.
- `output/json/`: `songs.json`, `clubs.json` and `sections.json`.
- `output/md/`: one Markdown file per song, `<section>/<song-id>.md`, plus an index in `README.md`.
- `output/sql/`: `codex.sql`, which holds the schema plus INSERTs. Load it with `sqlite3 codex.db < output/sql/codex.sql`.

Files in `output/` are generated. To fix something, change the code or `src/codex_data/overrides.py` and re-run `extract`.
