# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

The project has two parts:

- `data/`: a Python (uv) project that converts the songbook PDF into JSON, SQL and Markdown.
- `frontend/`: the Codex Bruxellensis PWA (Angular + Firebase), managed with pnpm. It still reads songs from Firestore with its own flat song model, not yet from `data/output/`.

There is no backend for now.

Git remote: `git@github.com:Tyranwyn/codex-bruxellensis-v3.git` (branch `main`). The generated `data/output/` is committed.

The source PDF is **not** in git and must stay out of it (`.gitignore` covers `data/source/*.pdf`). It isn't meant for public distribution, and it was removed from history. Extraction and tests need a local copy at `data/source/codex2022.pdf`.

## Data commands

Run these from `data/`:

```sh
uv run codex-data extract        # PDF → output/json/*.json, output/sql/codex.sql, output/{md,html}/<section>/<song-id>.*
uv run codex-data dump 35 129    # print the typed lines of PDF pages (role, x, y, text); use it to debug parsing
uv run pytest                    # ~7 s: runs a full extraction once, then checks it
uv run pytest tests/test_layout.py::test_bracketed_repeats   # a single test
```

- Files in `output/` are generated. Change the code and re-run `extract`; don't edit them by hand.
- `extract` must finish with 0 warnings, and `tests/test_extract.py::test_no_warnings` enforces this.
- If the output format changes, regenerate `schema/examples/antverpia-lied.json` from `output/json/songs.json`. A test compares the two.

## Frontend (`frontend/`)

Run these from `frontend/`. Angular 22 needs Node ≥ 24.15 (`.nvmrc`).

```sh
pnpm install
pnpm start                 # dev server on :4200, uses the *-test Firestore collections
pnpm build                 # development build (beta, test collections) → dist/
pnpm build:prd             # production build with service worker → dist/
pnpm test --watch=false    # Karma + Jasmine
pnpm lint                  # angular-eslint
```

- Standalone components, zoneless change detection, signals. There is no NgRx: state lives in `core/auth.service.ts` (Firebase Auth), `core/user-data.service.ts` (role and favorites) and `songs/song.service.ts`.
- Firebase is used through the plain SDK plus `rxfire`, provided in `core/firebase.ts`. `@angular/fire` has no release for Angular 22 yet.
- The Firebase client config comes from `FIREBASE_*` environment variables. Locally, copy `.env.example` to `.env` (gitignored) and fill in the values. `scripts/write-firebase-config.mjs` turns them into `src/app/firebase-config.ts` and `src/environment.ts`, which are both generated and gitignored. `pnpm start`, `build` and `build:prd` run it first and fail if a variable is missing; `pnpm test` runs it with `--allow-missing`. Never commit real values.
- There are three targets: `local` (`pnpm start`), `beta` (`pnpm build`, `deploy`) and `prd` (`pnpm build:prd`, `deploy:prd`). The script takes `--target=`, and the target picks the `FIRESTORE_SONGS_COLLECTION_<TARGET>` and `FIRESTORE_USER_DATA_COLLECTION_<TARGET>` variables, which end up in `environment.databases`. `environment.production` is true only for `prd`. The defaults are `songs-test`/`user-data-test` for local and beta, and `songs`/`user-data` for prd.
- Styling is Bulma 1, configured in `src/styles.scss`.
- `pnpm deploy` / `pnpm deploy:prd` build and then run `node deploy.js beta|prd`. It uploads `dist/` to S3, then deletes files that are no longer in the build (`--dry-run` shows what it would do). The buckets come from `S3_BUCKET_BETA`/`S3_BUCKET_PRD` and the region from `AWS_REGION` in `.env`; credentials use the standard AWS chain.
- `pipeline.yml` is the old deploy setup, kept unchanged. It predates the `.env` setup: it writes `firebase-config.ts` from a secret, which the build now overwrites, so it would need `FIREBASE_*` params to be revived. The S3 buckets (`codex.brussels`, `beta.codex.brussels`, eu-west-3) were created by hand, so there is no infrastructure config for them in the repo.

## Data model (`data/schema/`)

`song.schema.json` and `club.schema.json` are the source of truth. `schema.sql` must mirror them, and `export_sql.py` maps between the two.

- A song has an ordered list of stanzas. A stanza has a `kind`:
  - `verse`: upright text.
  - `chorus`: italic text.
  - `chorus-ref`: a printed "Refrein …" instruction. Any extra text goes in `instruction`.
  - `direction`: any other stage direction, e.g. "Ad fundum".
- Lines are plain strings. Repeat markers are stored in a stanza's `repeats` as `{from, to, times, marker}` spans, with 0-based inclusive line indexes.
- Songs in the club and official sections point to `clubs.json` through `clubId`.
- `sortTitle` comes from the book's index, e.g. `SMIDJE, ’T`.
- Page numbers are printed page numbers. In this PDF they equal the PDF page index.
- Decisions made with the user:
  - Accents are repaired and only the clean text is stored.
  - `▲`/`▶` illustration captions are dropped.
  - The Reglement (pp. 11–30) is out of scope.

## Extraction pipeline (`data/src/codex_data/`)

1. **`layout.py`** turns one pdfplumber page into typed `Line`s. It relies on the fonts, not on the text layer. The book is LaTeX, so each Computer Modern font marks a role (the full table is in the module docstring):
   - CMB10 is a heading.
   - CMR9 is a verse.
   - CMTI9 is a chorus.
   - CMR8 at 7.2pt is meta (`T:`, `M:`, club info, notes).
   - CMSS8 is a stage direction or a caption.
   - CMR8 at 8pt is a `(BIS)`/`(TER)` marker.

   The layer also does four things:
   - Accents are separate glyphs, and it composes each one into the letter under it by position.
   - Characters in non-CM fonts (logos) are dropped.
   - A repeat marker becomes a *bracket* when it sits right of a vertical rule at x≈386. It then covers every line the rule spans. Otherwise it attaches to the nearest line.
   - Markers that can't be placed are reported as warnings.
2. **`parse.py`** runs a state machine over the pages. `SECTIONS` holds the divider pages and each section's language.
   - A heading plus its meta block is a **club** when the meta has `Gesticht`/`Kleur`/`Stichter` lines, or when it has no `T:`/`M:` and leads straight into another heading. Otherwise it's a **song**.
   - Stanzas break on a vertical gap larger than `STANZA_GAP`, on a verse/chorus change, and at every page break. The book never splits a stanza across pages.
   - Meta paragraphs are rebuilt from line wrapping, using `WRAP_X1`.
   - The index (p. 533 onward) supplies `sortTitle`. The index sometimes points 1–2 pages early, at a facing illustration.
3. **`overrides.py`** holds hand corrections the PDF can't provide. For now these are language codes where the stop-word guesser in `language.py` is wrong, such as Latin, Hebrew and Afrikaans.
4. **`extract.py`** writes the JSON files. **`export_sql.py`** writes `codex.sql` (the schema plus INSERTs, which works in both SQLite and PostgreSQL). **`export_md.py`** writes one Markdown file per song plus an index `README.md`:
   - Each file has YAML front matter.
   - Choruses are blockquotes, and each line ends in `\` for a hard break.
   - Repeat markers go on the last line they cover, e.g. `(BIS, 4 regels)`.
   - It deletes and rewrites `output/md/` on every run.

   **`export_html.py`** writes a static site, `output/html/`. It has one page per song, plus `index.html` (with an accent-insensitive search) and `style.css`. It works from `file://`.
   - Choruses are italic and indented.
   - A one-line repeat marker goes inline, at the end of its line.
   - A multi-line marker becomes a bracket beside its lines, drawn as a CSS grid cell. Nested or overlapping brackets get their own lanes (columns).
   - Club songs show a card with the club's info. Each song page links to the previous and next song in book order.
   - Like the Markdown export, it deletes and rewrites `output/html/` on every run.

Invariants that the tests check:
- All 366 index entries match exactly one song.
- No broken accent glyphs remain in the output.
- The output validates against the JSON Schemas.
- The SQL loads with valid foreign keys.

## Source material: `data/source/codex2022.pdf`

This is the 7th edition (2022) of the Brussels student songbook, 544 pages. Its sections start at these pages:

| Page | Section |
|------|---------|
| 11  | Reglement |
| 31  | Kringliederen |
| 89  | Officiële liederen |
| 101 | Nederlandstalige liederen |
| 257 | Franstalige liederen |
| 413 | Duitstalige liederen |
| 463 | Engelstalige liederen |
| 517 | Anderstalige liederen |
| 533 | Index |

`pdftoppm`/poppler is not installed, so the Read tool can't render PDF pages as images. Use `codex-data dump` instead.
